// api/scrape.js — Vercel Serverless Function
// Real job scraping via JSearch (RapidAPI) with visa + career level filtering

const SPONSOR_NEGATIVE = [
  'no sponsorship','not able to sponsor','cannot sponsor','will not sponsor',
  'unable to sponsor','sponsorship not available','no visa','must be a us citizen',
  'citizens only','us citizens only','permanent residents only','green card only',
  'no work authorization','citizen or green card','no h1b','no h-1b',
  'not eligible for sponsorship','us citizenship required',
];

const SPONSOR_POSITIVE = [
  'h1b','h-1b','opt','visa sponsorship','will sponsor','sponsorship available',
  'visa support','stem opt','f-1','international candidates','we sponsor',
  'immigration support',
];

function detectLevel(title = '', desc = '') {
  const t = (title + ' ' + desc).toLowerCase();
  if (/\bdirector\b|\bvp\b|head of eng|engineering manager|\b12\+|\b15\+/.test(t)) return 'director';
  if (/\bstaff\b|\bprincipal\b|tech lead|\b8\+|\b9\+|\b10\+/.test(t)) return 'staff';
  if (/\bsenior\b|\bsr\.?\b|\b5\+|\b6\+|\b7\+/.test(t)) return 'senior';
  if (/junior|\bentry\b|new grad|associate|0-2 year|\b1\+/.test(t)) return 'entry';
  if (/\b3\+|\b4\+|mid.?level|intermediate/.test(t)) return 'mid';
  return 'mid';
}

function salary(job) {
  if (!job.job_min_salary && !job.job_max_salary) return 'Not listed';
  const f = n => n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;
  if (job.job_min_salary && job.job_max_salary) return `${f(job.job_min_salary)}–${f(job.job_max_salary)}`;
  return f(job.job_min_salary || job.job_max_salary);
}

function posted(d) {
  if (!d) return 'Recently';
  const h = Math.floor((Date.now() - new Date(d)) / 3600000);
  if (h < 1) return 'Just now';
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return days === 1 ? '1d ago' : `${days}d ago`;
}

function tags(desc = '') {
  return ['React','TypeScript','JavaScript','Node.js','Python','Go','Rust','Java',
    'GraphQL','PostgreSQL','MongoDB','Redis','AWS','GCP','Azure','Docker',
    'Kubernetes','Next.js','Vue','Angular','Terraform','Swift','Flutter',
  ].filter(k => desc.toLowerCase().includes(k.toLowerCase())).slice(0, 5);
}

function teamCtx(desc = '') {
  const s = desc.split(/[.!?]/)
    .filter(s => /team|squad|collaborat|culture|mission/i.test(s))
    .slice(0, 2).join('. ').trim();
  return s || 'Collaborative engineering team building impactful products.';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { keywords = '', location = 'Remote', sources = [], minSalary = 0, visaMode = 'prefer', careerLevel = 'all' } = req.body || {};
  const KEY = process.env.RAPIDAPI_KEY;

  if (!KEY) {
    return res.status(500).json({
      error: 'RAPIDAPI_KEY not set. Add it in Vercel → Project Settings → Environment Variables. Get a free key at rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch',
    });
  }

  const queries = [keywords];
  if (visaMode !== 'off') queries.push(`${keywords} visa sponsorship`);

  const allJobs = [];
  const errors = [];

  for (const query of queries.slice(0, 2)) {
    try {
      const params = new URLSearchParams({
        query: `${query} ${location}`.trim(),
        page: '1', num_pages: '2', date_posted: 'week',
        remote_jobs_only: location.toLowerCase().includes('remote') ? 'true' : 'false',
        employment_types: 'FULLTIME',
      });

      const response = await fetch(`https://jsearch.p.rapidapi.com/search?${params}`, {
        headers: { 'X-RapidAPI-Key': KEY, 'X-RapidAPI-Host': 'jsearch.p.rapidapi.com' },
      });

      const rawText = await response.text();
      let data;
      try { data = JSON.parse(rawText); }
      catch { errors.push(`Non-JSON for "${query}": ${rawText.slice(0, 100)}`); continue; }

      if (response.status === 401 || response.status === 403) {
        return res.status(500).json({ error: `RapidAPI auth failed (${response.status}). Check RAPIDAPI_KEY and ensure you are subscribed to JSearch at rapidapi.com.` });
      }
      if (response.status === 429) {
        return res.status(500).json({ error: 'RapidAPI rate limit reached. Free plan: 200 req/month. Upgrade at rapidapi.com.' });
      }
      if (!response.ok || !data.data) { errors.push(`API ${response.status} for "${query}"`); continue; }

      const mapped = data.data
        .filter(job => {
          const tx = ((job.job_description || '') + ' ' + (job.job_title || '')).toLowerCase();
          if (visaMode !== 'off' && SPONSOR_NEGATIVE.some(k => tx.includes(k))) return false;
          if (minSalary && job.job_min_salary && job.job_min_salary < minSalary) return false;
          if (sources.length > 0 && !sources.some(s => (job.job_publisher || '').toLowerCase().includes(s.toLowerCase()))) return false;
          return true;
        })
        .map(job => {
          const tx = ((job.job_description || '') + ' ' + (job.job_title || '')).toLowerCase();
          return {
            id: job.job_id, title: job.job_title, company: job.employer_name,
            location: job.job_is_remote ? 'Remote' : `${job.job_city || ''}, ${job.job_state || job.job_country || ''}`.trim().replace(/^,\s*/, ''),
            salary: salary(job), source: job.job_publisher || 'Job Board', posted: posted(job.job_posted_at_datetime_utc),
            match: 0, level: detectLevel(job.job_title, job.job_description),
            tags: tags(job.job_description), status: 'new',
            url: job.job_apply_link || job.job_google_link || '#',
            description: (job.job_description || '').slice(0, 700),
            team: teamCtx(job.job_description),
            employerLogo: job.employer_logo || null,
            visa: {
              explicit: ['will sponsor','visa sponsorship','h1b sponsor','sponsorship available','we sponsor'].some(k => tx.includes(k)),
              mentioned: SPONSOR_POSITIVE.some(k => tx.includes(k)),
            },
          };
        });

      allJobs.push(...mapped);
    } catch (err) {
      errors.push(err.message);
    }
  }

  const seen = new Set();
  const unique = allJobs
    .filter(j => { if (seen.has(j.id)) return false; seen.add(j.id); return true; })
    .sort((a, b) => (b.visa.explicit ? 3 : b.visa.mentioned ? 2 : 1) - (a.visa.explicit ? 3 : a.visa.mentioned ? 2 : 1));

  if (unique.length === 0 && errors.length > 0) {
    return res.status(500).json({ error: errors[0], allErrors: errors });
  }

  return res.status(200).json({ jobs: unique, total: unique.length, warnings: errors.length ? errors : undefined });
};
