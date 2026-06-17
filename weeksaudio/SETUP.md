# WEEKS Audio Design — Setup Guide

## What's in this folder

```
public/
  index.html     ← Your front-facing music site
  admin.html     ← Your private upload page (go to weeksaudio.com/admin.html)
  player.js      ← Audio player logic
  config.js      ← Your Supabase keys go here
  logo.png       ← Your logo
```

---

## Step 1 — Create your Supabase project

1. Go to https://supabase.com and sign up (free)
2. Click **New Project**, name it `weeksaudio`, pick any region
3. Wait ~2 minutes for it to spin up

---

## Step 2 — Create the database table

1. In your Supabase project, click **SQL Editor** in the left sidebar
2. Paste this SQL and click **Run**:

```sql
create table tracks (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamp with time zone default now(),
  name         text not null,
  price        numeric(10,2) not null default 0,
  gumroad_url  text,
  audio_url    text not null,
  contract_url text
);

-- Allow the site to read tracks publicly
alter table tracks enable row level security;
create policy "Public read" on tracks for select using (true);
create policy "Service insert" on tracks for insert with check (true);
create policy "Service delete" on tracks for delete using (true);
```

---

## Step 3 — Create your storage bucket

1. In Supabase, click **Storage** in the left sidebar
2. Click **New Bucket**, name it `tracks`, check **Public bucket**, click Create
3. That's it — audio files and contracts will upload here automatically

---

## Step 4 — Get your keys

1. In Supabase, go to **Settings → API**
2. Copy your **Project URL** (looks like `https://xxxx.supabase.co`)
3. Copy your **anon public** key (long string of characters)
4. Open `config.js` in a text editor and paste them in:

```js
const SUPABASE_URL = "https://xxxx.supabase.co";
const SUPABASE_KEY = "your-anon-key-here";
```

---

## Step 5 — Change your admin password

Open `admin.html` in a text editor.
Find this line near the bottom:

```js
const ADMIN_PASSWORD = "weeks2024admin";
```

Change `weeks2024admin` to whatever password you want.

---

## Step 6 — Deploy to Netlify

1. Go to https://netlify.com and sign up (free)
2. Click **Add new site → Deploy manually**
3. Drag your entire `public/` folder into the drop zone
4. Netlify gives you a URL like `yoursite.netlify.app` — your site is live!

To update the site later, just drag the folder again.

---

## Step 7 — Point your Squarespace domain to Netlify

1. In Netlify go to **Site Settings → Domain Management → Add custom domain**
2. Type `weeksaudio.com` and follow the prompts
3. Netlify will show you DNS values to copy
4. Log into Squarespace → Settings → Domains → your domain → DNS Settings
5. Paste the values from Netlify
6. Wait up to 24 hours (usually much faster)

---

## How to upload a song

1. Go to `weeksaudio.com/admin.html`
2. Enter your password
3. Drop your audio file in the big drop zone
4. Fill in song name, price, and your Gumroad product URL
5. Optionally attach a contract PDF
6. Click UPLOAD TRACK

---

## How Gumroad works with this site

Each song on your site has its own Gumroad product page.
When a fan clicks BUY, they go to your Gumroad page, pay, and Gumroad
automatically emails them the file + any attached contract.

To set up a Gumroad product:
1. Go to https://gumroad.com and create an account
2. Click **New Product → Digital Product**
3. Upload your audio file and contract PDF as "files"
4. Set your price
5. Copy the product URL (looks like `https://yourname.gumroad.com/l/xxxxx`)
6. Paste that URL into the admin upload form

---

## Notes

- Your admin page is at `/admin.html` — bookmark it
- The password is stored locally in the HTML file (simple but effective for personal use)
- If you ever need to edit anything, the files are plain HTML/JS — open in any text editor
