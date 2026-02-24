# ⚡ JobHunt.ai — Automated Job Search Engine

Scrape real jobs from LinkedIn, Indeed, Glassdoor + AI-tailor your resume for each one.

## 🚀 Deploy in 5 Minutes (Free)

### Step 1: Push to GitHub
1. Create a new repo at github.com/new (name: `jobhunt-ai`)
2. Upload all these files to the repo (drag & drop in GitHub UI)

### Step 2: Deploy on Vercel
1. Go to [vercel.com](https://vercel.com) → Sign up with GitHub (free)
2. Click **"Add New Project"** → Import your `jobhunt-ai` repo
3. Click **Deploy** — live in ~60 seconds ✓

### Step 3: Add Environment Variables
In Vercel: **Project Settings → Environment Variables**

| Variable | Where to get it | Required |
|----------|----------------|----------|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) | Yes (AI tailoring) |
| `RAPIDAPI_KEY` | [rapidapi.com/jsearch](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch) | Yes (job scraping) |

After adding variables: **Redeploy** the project once.

---

## 💰 Cost

| Service | Free Tier | Paid |
|---------|-----------|------|
| Vercel | Forever free | — |
| RapidAPI JSearch | 200 searches/month FREE | $10/mo = 3,000 searches |
| Anthropic Claude | Pay-as-you-go | ~$0.01 per resume tailor |

**Estimated monthly cost for active job searching: $5–$15**

---

## 🛠 Running Locally

```bash
npm install
cp .env.example .env.local
# Edit .env.local with your API keys
npm run dev
```

---

## 📁 Project Structure

```
jobhunt-ai/
├── src/
│   ├── main.jsx        # React entry point
│   └── App.jsx         # Full application UI
├── api/
│   ├── scrape.js       # Serverless: scrapes jobs via JSearch API
│   ├── tailor.js       # Serverless: AI resume tailoring via Claude
│   └── score.js        # Serverless: AI match scoring
├── index.html
├── vite.config.js
├── vercel.json         # Vercel configuration
├── package.json
└── .env.example        # Copy to .env.local for local dev
```

---

## ✨ Features

- **Real job scraping** from LinkedIn, Indeed, Glassdoor, ZipRecruiter + 20 more via JSearch API
- **AI match scoring** — ranks jobs by fit with your profile
- **Claude AI resume tailoring** — rewrites your resume per job, ATS-optimized
- **AI cover letter generation** — references team's actual work
- **Application tracker** — kanban pipeline (New → Tailored → Applied → Interview)
- **Profile auto-save** — your data persists in browser

---

## ⚠️ Important Notes

- **Auto-submitting applications is not included** — job boards (LinkedIn, Indeed, Workday) actively block bots and will ban your account. The workflow is: AI tailors → you copy → paste & submit (30 seconds each).
- Jobs scraped from JSearch are real, live postings
- Your resume/profile data is stored only in your browser (never sent to any server except during tailoring)
