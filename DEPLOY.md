# ⚡ JobHunt.ai v2 — Deploy to Vercel in 5 Minutes

## What's inside
- **React frontend** (Vite) — full job search dashboard
- **4 serverless API functions** (Vercel) — scrape, tailor, score, h1b

---

## Step 1 — Upload to GitHub (2 min)

1. Go to **github.com/new** → create a repo named `jobhunt-ai` → click Create
2. On the next screen click **"uploading an existing file"**
3. Drag ALL the files from this zip into the upload area
4. Click **"Commit changes"**

---

## Step 2 — Deploy on Vercel (2 min)

1. Go to **vercel.com** → Sign up free with GitHub
2. Click **"Add New Project"** → Import `jobhunt-ai`
3. Leave all settings as default → Click **Deploy**
4. ✅ Your app is live at `https://jobhunt-ai.vercel.app`

---

## Step 3 — Add your 2 API keys (1 min)

In Vercel: **Project → Settings → Environment Variables**

| Variable | Value | Where to get it |
|---|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-...` | console.anthropic.com → API Keys |
| `RAPIDAPI_KEY` | `xxxxxxxx` | rapidapi.com/jsearch (free plan) |

After adding both keys → click **Redeploy** once.

---

## Step 4 — Use the app

1. Open your Vercel URL
2. Go to **⚙ Setup** → paste your API keys (stored in browser session only)
3. Go to **📄 Resume Match** → upload your resume
4. Go to **Scrape** → hit ⚡ to pull real jobs
5. Click **📊 DETAILS** on any job to see H1B analytics
6. Click **✨ TAILOR** to AI-tailor your resume for that job

---

## Cost breakdown

| Service | Free Tier | Notes |
|---|---|---|
| Vercel hosting | Free forever | Hobby plan |
| RapidAPI JSearch | 200 req/month FREE | $10/mo = 3,000 req |
| Anthropic Claude | ~$0.01/tailor | Pay-as-you-go |

**Typical monthly cost for active job search: $5–$15 total**

---

## File structure

```
jobhunt-ai/
├── src/
│   ├── main.jsx          # React entry
│   └── App.jsx           # Full UI (dashboard, filters, H1B panel, resume match)
├── api/
│   ├── scrape.js         # Scrapes jobs via JSearch API
│   ├── tailor.js         # AI resume tailoring via Claude
│   ├── score.js          # AI job match scoring
│   └── h1b.js            # H1B sponsorship history lookup
├── index.html
├── vite.config.js
├── vercel.json
└── package.json
```
