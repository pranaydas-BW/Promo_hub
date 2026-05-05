# 🚀 PromoHub — Deploy Guide (Step by Step)
*Written for someone doing this for the first time. Takes about 20 minutes total.*

---

## What you'll set up
1. **Supabase** — free database that stores your promo data (like a cloud spreadsheet)
2. **GitHub** — free code hosting (needed to connect to Render)
3. **Render** — free website hosting that makes your dashboard live on the internet

---

## PART 1 — Supabase (your database) — ~8 min

### Step 1.1 — Create a free account
1. Go to 👉 https://supabase.com
2. Click **Start your project** → Sign up with Google or email
3. Click **New Project**
4. Fill in:
   - **Name**: `promo-hub` (or anything)
   - **Database Password**: pick something strong, save it somewhere
   - **Region**: pick the one closest to you (e.g. Singapore)
5. Click **Create new project** — wait ~1 minute for it to set up

### Step 1.2 — Create your tables
1. In the left sidebar, click **SQL Editor**
2. Click **New query**
3. Open the file `SUPABASE_SCHEMA.sql` from this folder on your computer
4. Copy ALL the text inside it
5. Paste it into the SQL editor
6. Click the green **Run** button
7. You should see: `Success. No rows returned`

### Step 1.3 — Get your API keys
1. In the left sidebar, click **Project Settings** (gear icon at the bottom)
2. Click **API**
3. You'll see two things — copy both and save them in a notepad:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **anon public** key — a very long string starting with `eyJ...`

---

## PART 2 — GitHub (code hosting) — ~5 min

### Step 2.1 — Create a GitHub account (if you don't have one)
1. Go to 👉 https://github.com
2. Sign up for a free account

### Step 2.2 — Install Git on your computer
- **Mac**: Open Terminal, type `git --version`. If it's not installed, it will prompt you to install it.
- **Windows**: Download from 👉 https://git-scm.com/download/win — just click Next through the installer

### Step 2.3 — Create a new repository
1. Log in to GitHub
2. Click the **+** button (top right) → **New repository**
3. Name it `promo-hub`
4. Leave everything else as default
5. Click **Create repository**
6. Copy the URL shown — it looks like `https://github.com/YOURNAME/promo-hub.git`

### Step 2.4 — Push the code
1. Open Terminal (Mac) or Command Prompt (Windows)
2. Navigate to this folder. For example:
   ```
   cd Desktop/promo-dashboard
   ```
3. Run these commands one by one (paste each line, hit Enter):
   ```
   git init
   git add .
   git commit -m "first commit"
   git branch -M main
   git remote add origin https://github.com/YOURNAME/promo-hub.git
   git push -u origin main
   ```
   *(Replace the URL with your actual GitHub repo URL from Step 2.3)*

4. It may ask for your GitHub username and password. For password, use a **Personal Access Token** — create one at https://github.com/settings/tokens → Generate new token (classic) → check `repo` → copy the token and use it as the password.

---

## PART 3 — Render (your website) — ~5 min

### Step 3.1 — Create a Render account
1. Go to 👉 https://render.com
2. Click **Get Started** → Sign up with GitHub (easier — it connects automatically)

### Step 3.2 — Deploy your dashboard
1. After logging in, click **New +** → **Static Site**
2. Find your `promo-hub` repo and click **Connect**
3. Fill in the settings:
   - **Name**: `promo-hub`
   - **Branch**: `main`
   - **Build Command**: `npm install && npm run build`
   - **Publish directory**: `dist`
4. Scroll down to **Environment Variables** — click **Add Environment Variable** twice:
   - First one:
     - Key: `VITE_SUPABASE_URL`
     - Value: paste your Supabase Project URL from Part 1
   - Second one:
     - Key: `VITE_SUPABASE_ANON_KEY`
     - Value: paste your Supabase anon key from Part 1
5. Click **Create Static Site**

### Step 3.3 — Wait for deploy
- Render will build the site (takes ~2-3 minutes)
- Once done, you'll see a green **Live** badge
- Your URL will be something like: `https://promo-hub.onrender.com`
- **Share this URL with your team** — that's all they need!

---

## PART 4 — You're live! 🎉

Your dashboard has 5 pages:

| Page | What it does |
|------|-------------|
| **Board** | See all promo requests, search/filter, update status |
| **New Request** | Submit a new promo (or replicate an existing one by ID) |
| **Today's** | See which promos start or end today, download CSV |
| **SKUs** | Download templates, upload barcode sheets, view master table |
| **Analytics** | Brand-level charts + SKU-level barcode analytics |

---

## Updating the dashboard later
Every time you make changes to the code and push to GitHub:
```
git add .
git commit -m "what I changed"
git push
```
Render will automatically rebuild and redeploy. No extra steps.

---

## Something not working?
- **Database errors**: Make sure you ran the full `SUPABASE_SCHEMA.sql` in Step 1.2
- **Build fails on Render**: Double check the Build Command is exactly `npm install && npm run build`
- **Blank page**: Make sure both environment variables are set correctly in Render (no extra spaces)
- **Can't push to GitHub**: Make sure you're using a Personal Access Token as the password (Step 2.4)
