# PromoHub — Promo Request Dashboard

A team dashboard for submitting, tracking, and analysing promotion requests.
Built with **React + Vite**, deployed on **Render** (free static site), with **Supabase** as the database.

---

## Stack

| Layer     | Service        | Cost        |
|-----------|---------------|-------------|
| Frontend  | Render Static  | Free        |
| Database  | Supabase       | Free tier   |

---

## Step 1 — Set up Supabase (5 min)

1. Go to [https://supabase.com](https://supabase.com) and create a free account.
2. Click **New Project** → give it a name (e.g. `promo-hub`) → set a database password → choose a region close to you.
3. Once the project is ready, go to **SQL Editor** (left sidebar) and run the following SQL:

```sql
create table promo_requests (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz default now(),
  store         text,
  category      text not null,
  brand_names   text not null,
  poc_name      text not null,
  funded_by     text not null,
  valid_from    date not null,
  valid_till    date not null,
  offer_type    text not null,
  promo_details text not null,
  approval_email text,
  file_link     text,
  status        text not null default 'Pending',
  remark        text,
  ginesys_id    text,
  shopify_id    text
);

-- Allow public read, insert and update (no login required)
alter table promo_requests enable row level security;

create policy "public read"   on promo_requests for select using (true);
create policy "public insert" on promo_requests for insert with check (true);
create policy "public update" on promo_requests for update using (true);
```

4. Go to **Project Settings → API** and note down:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon / public key** (the long JWT string under "Project API Keys")

---

## Step 2 — Push code to GitHub (3 min)

1. Create a new **public or private** GitHub repo.
2. Push this folder to it:

```bash
cd promo-dashboard
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/promo-dashboard.git
git push -u origin main
```

---

## Step 3 — Deploy on Render (5 min)

1. Go to [https://render.com](https://render.com) and sign in (use your GitHub account).
2. Click **New → Static Site**.
3. Connect your GitHub repo.
4. Fill in the settings:
   - **Name**: `promo-hub` (or anything you like)
   - **Branch**: `main`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
5. Click **Advanced** → **Add Environment Variable** → add both:
   - `VITE_SUPABASE_URL` → paste your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` → paste your Supabase anon key
6. Click **Create Static Site**.

Render will build and deploy. In ~2 minutes you'll get a public URL like:
`https://promo-hub.onrender.com`

Share this URL with your team — no login required.

---

## Step 4 — (Optional) Import existing data

If you want to load your existing CSV data into Supabase:

1. In Supabase, go to **Table Editor → promo_requests → Import data**.
2. Upload your CSV, mapping columns as needed.

Or use the Supabase CLI / API for bulk inserts.

---

## Local development

```bash
cp .env.example .env
# Fill in your Supabase values in .env

npm install
npm run dev
# Opens at http://localhost:5173
```

---

## How it works

| Page | URL | Purpose |
|------|-----|---------|
| Board | `/` | View all requests, filter by status/category, update status |
| New Request | `/new` | Submit a new promotion request |
| Analytics | `/analytics` | Charts: submissions over time, by category, brand, POC, status |

### Updating a request status
On the Board, click any row to expand it. At the bottom you'll see **Update Status** buttons — click the desired status (Pending → In Progress → Live → Expired / Rejected).

---

## Re-deploying after code changes

Once connected to Render, every `git push` to `main` triggers an automatic re-deploy. No manual steps needed.
