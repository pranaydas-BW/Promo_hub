// Supabase Edge Function: offers
//
// A small, read-only feed of "which offers are live right now", for Stock Finder.
// It returns ONLY the offer wording, the end date and the cities — nothing internal
// (no funding, no approver, no IDs). Protected by a shared secret (OFFERS_SECRET).
//
// What counts as an offer (all must be true):
//   offer_type = 'Promotion'  AND  status = 'Promo Created - System'
//   AND  current_status = 'Active'  AND  today (IST) is inside one of its date ranges
//   AND  it runs in at least one store city (Online-only offers are ignored)
//
// How it attaches to products:
//   "Selected SKUs"           -> only the barcodes listed in that promo's SKU file
//   "All SKUs - Flat on All"  -> every barcode of that brand (brand names compared ignoring case/punctuation)
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by the platform.
// OFFERS_SECRET must be added under Edge Functions -> Secrets.

import { createClient } from "npm:@supabase/supabase-js@2";

const CITIES: [string, string][] = [
  ["VK, Delhi", "delhi"],
  ["BH, Hyderabad", "hyderabad"],
  ["Pune", "pune"],
  ["Mumbai", "mumbai"],
];
const PAGE = 1000;
const CACHE_MS = 10 * 60 * 1000;
const SKU_FETCH_TIMEOUT_MS = 15000;
const SKU_FETCH_CONCURRENCY = 8;

// ── Pure helpers (exported so they can be tested) ───────────────────────────
export const normBrand = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
export const normBarcode = (s: string) =>
  (s || "").replace(/^\uFEFF/, "").trim().replace(/^"|"$/g, "").replace(/\.0+$/, "");

export function todayIST(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

export function parseCSV(csv: string): string[][] {
  const records: string[][] = [];
  let cur = "", inQ = false;
  let fields: string[] = [];
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i], next = csv[i + 1];
    if (ch === '"') {
      if (inQ && next === '"') { cur += '"'; i++; } else { inQ = !inQ; }
    } else if (ch === "," && !inQ) {
      fields.push(cur.trim()); cur = "";
    } else if ((ch === "\n" || ch === "\r") && !inQ) {
      if (ch === "\r" && next === "\n") i++;
      fields.push(cur.trim()); cur = "";
      if (fields.some((f) => f.length > 0)) records.push(fields);
      fields = [];
    } else {
      cur += ch;
    }
  }
  if (cur || fields.length) {
    fields.push(cur.trim());
    if (fields.some((f) => f.length > 0)) records.push(fields);
  }
  return records;
}

export function citiesOf(store: string | null | undefined): string[] {
  const s = store || "";
  if (!s.trim() || s.trim() === "Online") return [];
  return CITIES.filter(([label]) => s.includes(label)).map(([, key]) => key);
}

type Range = { from: string; till: string };
export function liveRange(ranges: unknown, today: string): Range | null {
  if (!Array.isArray(ranges)) return null;
  return (ranges as Range[]).find((r) => r && r.from <= today && r.till >= today) || null;
}

// New-style promos: promotion_name is the generated mechanic text ("Flat 20% off"),
// promo_details is optional extra info. Older promos: the offer wording is in promo_details.
export function offerText(r: any): string {
  const name = (r.promotion_name || "").trim();
  const details = (r.promo_details || "").trim();
  const text = r.promo_mechanic ? (name + (details ? " — " + details : "")) : (details || name);
  return text.replace(/\s+/g, " ").trim().slice(0, 200);
}

export function isLiveOffer(r: any, today: string): boolean {
  return r.offer_type === "Promotion" &&
    r.status === "Promo Created - System" &&
    r.current_status === "Active" &&
    !!liveRange(r.date_ranges, today) &&
    citiesOf(r.store).length > 0;
}

export function skuBarcodes(csvText: string): string[] {
  const records = parseCSV(csvText);
  if (records.length < 2) return [];
  const bcIdx = records[0].findIndex((h) => h.replace(/^\uFEFF/, "").toLowerCase().includes("barcode"));
  if (bcIdx < 0) return [];
  const out: string[] = [];
  for (const row of records.slice(1)) {
    const bc = normBarcode(row[bcIdx] || "");
    if (bc) out.push(bc);
  }
  return out;
}

// promos: rows from promo_requests. skuTexts: sku_file_link -> CSV text (missing = fetch failed).
export function buildOffers(promos: any[], skuTexts: Map<string, string>, today: string) {
  const offers: { t: string; till: string; c: string[] }[] = [];
  const offerIdx = new Map<string, number>();
  const barcodes: Record<string, number[]> = {};
  const brands: Record<string, number[]> = {};
  const stats = { promos: 0, selectedSkuPromos: 0, allSkuPromos: 0, barcodes: 0, skuFilesMissing: 0, skippedNoText: 0 };

  const addTo = (map: Record<string, number[]>, key: string, idx: number) => {
    if (!map[key]) map[key] = [];
    if (!map[key].includes(idx)) map[key].push(idx);
  };

  for (const r of promos) {
    if (!isLiveOffer(r, today)) continue;
    const text = offerText(r);
    if (!text) { stats.skippedNoText++; continue; }
    const range = liveRange(r.date_ranges, today)!;
    const cities = citiesOf(r.store);
    const key = `${text}|${range.till}|${cities.join(",")}`;
    let idx = offerIdx.get(key);
    const isAll = (r.assortment_type || "").startsWith("All SKUs");
    const isSelected = r.assortment_type === "Selected SKUs";
    if (!isAll && !isSelected) continue;

    let list: string[] = [];
    if (isSelected) {
      const csv = r.sku_file_link ? skuTexts.get(r.sku_file_link) : undefined;
      if (csv === undefined) { stats.skuFilesMissing++; continue; }
      list = skuBarcodes(csv);
      if (!list.length) continue;
    }

    if (idx === undefined) {
      idx = offers.length;
      offers.push({ t: text, till: range.till, c: cities });
      offerIdx.set(key, idx);
    }
    stats.promos++;
    if (isAll) {
      stats.allSkuPromos++;
      const full = normBrand(r.brand_names || "");
      if (full) addTo(brands, full, idx);
      // a field like "BrandA, BrandB" should also match each brand on its own
      for (const part of String(r.brand_names || "").split(/[,/&]/)) {
        const p = normBrand(part);
        if (p && p !== full) addTo(brands, p, idx);
      }
    } else {
      stats.selectedSkuPromos++;
      for (const bc of list) addTo(barcodes, bc, idx);
    }
  }
  stats.barcodes = Object.keys(barcodes).length;
  return { offers, barcodes, brands, stats };
}

// ── Request handling ────────────────────────────────────────────────────────
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

function secretOk(given: string | null): boolean {
  const secret = Deno.env.get("OFFERS_SECRET") || "";
  if (!secret || !given || given.length !== secret.length) return false;
  let diff = 0; // constant-time compare
  for (let i = 0; i < secret.length; i++) diff |= secret.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

async function fetchText(url: string): Promise<string | undefined> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), SKU_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    return res.ok ? await res.text() : undefined;
  } catch (_e) {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

let cached: { at: number; body: unknown } | null = null;

Deno.serve(async (req) => {
  const given = req.headers.get("x-offers-secret") ?? new URL(req.url).searchParams.get("key");
  if (!secretOk(given)) return json({ error: "unauthorized" }, 401);

  try {
    if (cached && Date.now() - cached.at < CACHE_MS) return json(cached.body);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const today = todayIST();

    // Read in pages: one request returns at most 1000 rows
    const rows: any[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from("promo_requests")
        .select("brand_names, promotion_name, promo_details, promo_mechanic, offer_type, status, current_status, assortment_type, sku_file_link, store, date_ranges")
        .eq("offer_type", "Promotion")
        .eq("status", "Promo Created - System")
        .eq("current_status", "Active")
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < PAGE) break;
    }

    const live = rows.filter((r) => isLiveOffer(r, today));

    // Download the SKU file of every "selected SKUs" promo (a few at a time)
    const links = [...new Set(live.filter((r) => r.assortment_type === "Selected SKUs" && r.sku_file_link).map((r) => r.sku_file_link as string))];
    const skuTexts = new Map<string, string>();
    const queue = [...links];
    await Promise.all(Array.from({ length: SKU_FETCH_CONCURRENCY }, async () => {
      while (queue.length) {
        const url = queue.shift()!;
        const text = await fetchText(url);
        if (text !== undefined) skuTexts.set(url, text);
      }
    }));

    const built = buildOffers(live, skuTexts, today);
    const body = { generatedAt: new Date().toISOString(), today, ...built };
    cached = { at: Date.now(), body };
    return json(body);
  } catch (e) {
    return json({ error: "failed", detail: String(e) }, 500);
  }
});
