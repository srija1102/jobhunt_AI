# 📁 How to Upload to GitHub

Upload these files maintaining EXACTLY this folder structure:

```
jobhunt-ai/                  ← your GitHub repo root
├── api/
│   ├── scrape.js            ← job scraper (RapidAPI)
│   ├── tailor.js            ← AI resume tailor (Claude)
│   └── score.js             ← AI match scorer
├── src/
│   ├── App.jsx              ← main UI
│   └── main.jsx             ← React entry
├── index.html
├── package.json
├── vite.config.js
├── vercel.json
└── .env.example
```

## ⚠️ Common Mistakes That Cause 404

1. **Uploading the zip itself** instead of the files inside it — unzip first!
2. **Extra nesting** — files should NOT be at `jobhunt-ai/jobhunt/api/scrape.js`, they should be at `jobhunt-ai/api/scrape.js`
3. **Missing vercel.json** — this file MUST be at the root level
4. **Environment variables not set** — must add RAPIDAPI_KEY and ANTHROPIC_API_KEY in Vercel

## ✅ How to Upload Correctly

### Option A: GitHub Web UI (easiest)
1. Unzip the downloaded file on your computer
2. Open the unzipped `jobhunt` folder — you should see: api/, src/, index.html, package.json, etc.
3. Go to your GitHub repo → click "Add file" → "Upload files"
4. Drag ALL the contents of the unzipped folder (not the folder itself) into GitHub
5. Commit changes

### Option B: GitHub Desktop App
1. Download GitHub Desktop from desktop.github.com
2. Clone your repo locally
3. Copy all files from unzipped folder into the cloned repo folder
4. Commit & Push

## After Uploading: Vercel Settings

In Vercel dashboard → your project → Settings → General:
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm install`

Then Settings → Environment Variables:
- `ANTHROPIC_API_KEY` = sk-ant-...
- `RAPIDAPI_KEY` = your rapidapi key

Click **Save** then **Redeploy**.
