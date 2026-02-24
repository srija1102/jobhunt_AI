// api/scrape.js — Vercel Serverless Function
// JSearch API (RapidAPI) + OPT/H1B filtering

const SPONSOR_POSITIVE = [
  'h1b', 'h-1b', 'h1-b', 'opt', 'visa sponsorship', 'will sponsor',
  'sponsorship available', 'visa support', 'stem opt', 'f-1',
  'international candidates', 'we sponsor', 'immigration support',
];

const SPONSOR_NEGATIVE = [
  'no sponsorship', 'not able to sponsor', 'cannot sponsor', 'will not sponsor',
  'unable to sponsor', 'sponsorship not available', 'no visa',
  'must be a us citizen', 'citizens only', 'us citizens only',
  'permanent residents only', 'green card only', 'no work authorization',
  'citizen or green card', 'must be authorized', 'not eligible for sponsorship',
  'no h1b', 'no h-1b',
];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { keywords, location = 'Remote', sources = [], minSalary = 0, optH1bFilter = 'prefer' } = req.body;
  const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

  if (!RAPIDAPI_KEY) {
    return res.status(500).json({ error: 'RAPIDAPI_KEY not set in Vercel Environment Variables.' });
  }

  const queries = [keywords];
  if (optH1bFilter !== 'off') {
    queries.push(`${keywords} visa sponsorship`);
    queries.push(`${keywords} OPT`);
  }

  const allJobs = [];

  for (const query of queries.slice(0, 3)) {
    try {
      const params = new URLSearchParams({
        query: `${query} ${location}`.trim(),
        page: '1',
        num_pages: '2',
        date_posted: 'week',
        remote_jobs_only: location.toLowerCase().includes('remote') ? 'true' : 'false',
        employment_types: 'FULLTIME',
      });

      const response = await fetch(`https://jsearch.p.rapidapi.com/search?${params}`, {
        headers: {
          'X-RapidAPI-Key': RAPIDAPI_KEY,
          'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
        },
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`JSearch ${response.status}: ${errText}`);
      }

      const data = await response.json();
      if (!data.data || !Array.isArray(data.data)) continue;

      const mapped = data.data
        .filter(job => {
          const fullText = ((job.job_description || '') + ' ' + (job.job_title || '')).toLowerCase();
          if (optH1bFilter !== 'off') {
            if (SPONSOR_NEGATIVE.some(kw => fullText.includes(kw))) return false;
          }
          if (minSalary && job.job_min_salary && job.job_min_salary < minSalary) return false;
          if (sources.length > 0) {
            const pub = (job.job_publisher || '').toLowerCase();
            if (!sources.some(s => pub.includes(s.toLowerCase()))) return false;
          }
          return true;
        })
        .map(job => {
          const fullText = ((job.job_description || '') + ' ' + (job.job_title || '')).toLowerCase();
          const explicitlySponsors = ['will sponsor', 'visa sponsorship', 'h1b sponsor', 'h-1b', 'sponsorship available', 'we sponsor'].some(kw => fullText.includes(kw));
          const mentionsSponsorship = SPONSOR_POSITIVE.some(kw => fullText.includes(kw));

          return {
            id: job.job_id,
            title: job.job_title,
            company: job.employer_name,
            location: job.job_is_remote ? 'Remote' : `${job.job_city || ''}, ${job.job_state || job.job_country || ''}`.trim().replace(/^,\s*/, ''),
            salary: formatSalary(job),
            source: job.job_publisher || 'Job Board',
            posted: formatDate(job.job_posted_at_datetime_utc),
            match: 0,
            tags: extractTags(job.job_description || ''),
            status: 'new',
            url: job.job_apply_link || job.job_google_link || '#',
            description: (job.job_description || '').slice(0, 700),
            teamWork: extractTeamContext(job.job_description || ''),
            employerLogo: job.employer_logo || null,
            visaInfo: {
              explicitlySponsors,
              mentionsSponsorship,
              optFriendly: fullText.includes('opt') || fullText.includes('f-1') || fullText.includes('stem'),
              h1bMentioned: fullText.includes('h1b') || fullText.includes('h-1b'),
              h1bHistory: null, // fetched on-demand per company
            },
          };
        });

      allJobs.push(...mapped);
    } catch (err) {
      console.error('Scrape error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // Deduplicate
  const seen = new Set();
  const unique = allJobs.filter(j => { if (seen.has(j.id)) return false; seen.add(j.id); return true; });

  // Sort: explicit sponsors first
  unique.sort((a, b) => {
    const s = j => j.visaInfo.explicitlySponsors ? 3 : j.visaInfo.mentionsSponsorship ? 2 : 1;
    return s(b) - s(a);
  });

  return res.status(200).json({ jobs: unique, total: unique.length });
};

function formatSalary(job) {
  if (!job.job_min_salary && !job.job_max_salary) return 'Not listed';
  const fmt = n => n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;
  if (job.job_min_salary && job.job_max_salary) return `${fmt(job.job_min_salary)}–${fmt(job.job_max_salary)}`;
  return fmt(job.job_min_salary || job.job_max_salary);
}

function formatDate(d) {
  if (!d) return 'Recently';
  const h = Math.floor((Date.now() - new Date(d)) / 3600000);
  if (h < 1) return 'Just now';
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return days === 1 ? '1d ago' : `${days}d ago`;
}

function extractTags(desc) {
  return ['React','TypeScript','JavaScript','Node.js','Python','Go','Rust','Java','GraphQL',
    'PostgreSQL','MongoDB','Redis','AWS','GCP','Azure','Docker','Kubernetes','Next.js',
    'Vue','Angular','Tailwind','Terraform','Kafka','Spark','Flutter','Swift']
    .filter(k => desc.toLowerCase().includes(k.toLowerCase())).slice(0, 5);
}

function extractTeamContext(desc) {
  const s = desc.split(/[.!?]/).filter(s => /team|squad|collaborat|culture|mission|eng org/i.test(s)).slice(0, 2).join('. ').trim();
  return s || 'Collaborative engineering team building impactful products.';
}
