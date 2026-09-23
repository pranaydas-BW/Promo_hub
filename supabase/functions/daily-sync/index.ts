// Supabase Edge Function: daily-sync
// Rebuilds the combined 4-city "Download daily files" dataset and upserts it into
// daily_sync_files, keyed by today's date (Asia/Kolkata). Triggered daily at 6:00 AM IST
// via pg_cron (see the accompanying SQL). Mirrors PromoCalendar.jsx's buildCombinedDailyRows.
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically by the platform —
// do not hardcode them.

import { createClient } from "npm:@supabase/supabase-js@2";

const CITY_TABS = ["VK Delhi", "BH HYD", "Pune", "Mumbai"];
const INVENTORY_SHEET_ID = "1Uo7OtHVekjsuTSfVodzUNqkL5dtOneM1GwPn85OG_gM";

function todayIST(): string {
  // en-CA gives YYYY-MM-DD directly
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

function parseCSV(csv: string): string[][] {
  const records: string[][] = [];
  let cur = "", inQ = false;
  let fields: string[] = [];
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i], next = csv[i + 1];
    if (ch === '"') {
      if (inQ && next === '"') { cur += '"'; i++; } else { inQ = !inQ; }
    } else if (ch === ',' && !inQ) {
      fields.push(cur.trim()); cur = "";
    } else if ((ch === '\n' || ch === '\r') && !inQ) {
      if (ch === '\r' && next === '\n') i++;
      fields.push(cur.trim()); cur = "";
      if (fields.some(f => f.length > 0)) records.push(fields);
      fields = [];
    } else {
      cur += ch;
    }
  }
  if (cur || fields.length) {
    fields.push(cur.trim());
    if (fields.some(f => f.length > 0)) records.push(fields);
  }
  return records;
}

async function fetchInvTab(tabName: string): Promise<Record<string, any>> {
  const url = `https://docs.google.com/spreadsheets/d/${INVENTORY_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
  const res = await fetch(url);
  if (!res.ok) return {};
  const text = await res.text();
  const records = parseCSV(text);
  if (records.length < 2) return {};
  const headers = records[0];
  const barcodeIdx = headers.findIndex(h => h.toLowerCase().includes("barcode"));
  const whIdx = headers.findIndex(h => h.toLowerCase().includes("ware house") || h.toLowerCase().includes("warehouse"));
  const storeIdx = headers.findIndex(h => h.toLowerCase() === "store stock");
  const mrpIdx = headers.findIndex(h => h.toLowerCase() === "mrp");
  const rspIdx = headers.findIndex(h => h.toLowerCase() === "rsp");
  const map: Record<string, any> = {};
  records.slice(1).forEach(row => {
    const bc = (row[barcodeIdx] || "").toString().trim().replace(/\.0$/, "");
    if (bc) {
      map[bc] = {
        mrp: row[mrpIdx] || "",
        rsp: row[rspIdx] || "",
        wh_stock: row[whIdx] || "",
        store_stock: row[storeIdx] || "",
      };
    }
  });
  return map;
}

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const today = todayIST();

    // Live-today, offline promos — mirrors isOffline(r) && date_ranges overlap today.
    // No category/brand filter here (those are UI-only filters on the manual "Sync again" path).
    const { data: rows, error: rowsErr } = await supabase
      .from("promo_requests")
      .select("brand_names, promotion_name, assortment_type, sku_file_link, store, date_ranges");
    if (rowsErr) throw rowsErr;

    const liveToday = (rows || []).filter((r: any) => {
      if ((r.store || "") === "Online") return false;
      const ranges = Array.isArray(r.date_ranges) ? r.date_ranges : [];
      return ranges.some((dr: any) => dr.from <= today && dr.till >= today);
    });

    const cityMaps: Record<string, Record<string, any>> = {};
    await Promise.all(CITY_TABS.map(async (tab) => { cityMaps[tab] = await fetchInvTab(tab); }));

    const out: any[] = [];
    for (const r of liveToday) {
      const ranges = Array.isArray(r.date_ranges) ? r.date_ranges : [];
      const endDate = ranges[0] ? ranges[0].till : "";

      if (r.assortment_type === "Selected SKUs" && r.sku_file_link) {
        try {
          const res = await fetch(r.sku_file_link);
          const text = await res.text();
          const lines = text.split("\n").map((l: string) => l.trim()).filter(Boolean);
          if (lines.length >= 2) {
            const headers = lines[0].split(",").map((h: string) => h.trim());
            const bcIdx = headers.findIndex((h: string) => h.toLowerCase().includes("barcode"));
            for (const line of lines.slice(1)) {
              const vals = line.split(",");
              const bc = (vals[bcIdx] || "").trim();
              const anyInv = Object.values(cityMaps).find((m) => m[bc])?.[bc] || {};
              const stock: Record<string, any> = {};
              CITY_TABS.forEach((tab) => {
                stock[tab] = {
                  wh: (cityMaps[tab][bc] || {}).wh_stock || "",
                  store: (cityMaps[tab][bc] || {}).store_stock || "",
                };
              });
              out.push({
                brand: r.brand_names,
                promo: r.promotion_name,
                sku: bc,
                mrp: anyInv.mrp || "",
                rsp: anyInv.rsp || "",
                stock,
                till: endDate,
              });
            }
          }
        } catch (_e) {
          // skip this promo's SKU rows if its file can't be fetched
        }
      } else {
        out.push({ brand: r.brand_names, promo: r.promotion_name, sku: "ALL SKUs", mrp: "", rsp: "", stock: {}, till: endDate });
      }
    }

    const { error: upsertErr } = await supabase
      .from("daily_sync_files")
      .upsert(
        { sync_date: today, synced_at: new Date().toISOString(), synced_by: "unknown", data: out },
        { onConflict: "sync_date" },
      );
    if (upsertErr) throw upsertErr;

    return new Response(JSON.stringify({ ok: true, sync_date: today, rows: out.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
