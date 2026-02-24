// api/h1b.js — H1B Sponsorship History Lookup
// Uses H1BData.us (public USCIS disclosure data) — FREE, no key needed
// Data source: USCIS Labor Condition Application (LCA) public records

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { company } = req.body;
  if (!company) return res.status(400).json({ error: 'Company name required' });

  // Clean company name for search
  const cleanName = company
    .replace(/\b(Inc|LLC|Corp|Ltd|Co|Company|Technologies|Technology|Solutions|Services|Group|Holdings)\b\.?/gi, '')
    .trim();

  try {
    // Source 1: H1BData.us — aggregates USCIS LCA public disclosure data
    const h1bRes = await fetch(
      `https://h1bdata.info/index.php?em=${encodeURIComponent(cleanName)}&job=&city=&year=2024`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; JobSearch/1.0)',
          'Accept': 'text/html,application/xhtml+xml',
        }
      }
    );

    let sponsorHistory = null;
    let totalApplications = 0;
    let approvedCount = 0;
    let avgSalary = 0;
    let recentYears = [];
    let topJobTitles = [];

    if (h1bRes.ok) {
      const html = await h1bRes.text();

      // Parse table data from h1bdata.info
      const rowMatches = html.matchAll(/<tr[^>]*>[\s\S]*?<\/tr>/gi);
      const rows = [...rowMatches].slice(1); // skip header

      let salarySum = 0;
      let salaryCount = 0;
      const yearMap = {};
      const titleMap = {};

      for (const row of rows.slice(0, 100)) {
        const cells = [...row[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
          .map(m => m[1].replace(/<[^>]+>/g, '').trim());

        if (cells.length >= 5) {
          const [employer, title, baseWage, location, year, status] = cells;

          totalApplications++;
          if ((status || '').toLowerCase().includes('certif')) approvedCount++;

          const wage = parseInt((baseWage || '').replace(/[^0-9]/g, ''));
          if (wage > 30000 && wage < 500000) {
            salarySum += wage;
            salaryCount++;
          }

          const yr = (year || '').trim();
          if (yr) yearMap[yr] = (yearMap[yr] || 0) + 1;

          const t = (title || '').trim();
          if (t) titleMap[t] = (titleMap[t] || 0) + 1;
        }
      }

      if (totalApplications > 0) {
        avgSalary = salaryCount > 0 ? Math.round(salarySum / salaryCount) : 0;
        recentYears = Object.entries(yearMap)
          .sort((a, b) => b[0].localeCompare(a[0]))
          .slice(0, 4)
          .map(([year, count]) => ({ year, count }));
        topJobTitles = Object.entries(titleMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([title]) => title);

        sponsorHistory = {
          hasSponsored: true,
          totalApplications,
          approvedCount,
          approvalRate: Math.round((approvedCount / totalApplications) * 100),
          avgSalary,
          recentYears,
          topJobTitles,
          dataSource: 'USCIS LCA Disclosure Data via H1BData.info',
          lastChecked: new Date().toISOString(),
        };
      }
    }

    // If no data found in H1B records
    if (!sponsorHistory || totalApplications === 0) {
      // Check if it's a well-known non-sponsor
      const knownNonSponsors = [
        'spacex', 'government', 'federal', 'state', 'county', 'city of',
        'school district', 'nonprofit',
      ];
      const isLikelyNonSponsor = knownNonSponsors.some(k =>
        cleanName.toLowerCase().includes(k)
      );

      sponsorHistory = {
        hasSponsored: false,
        totalApplications: 0,
        approvedCount: 0,
        approvalRate: 0,
        avgSalary: 0,
        recentYears: [],
        topJobTitles: [],
        note: isLikelyNonSponsor
          ? 'This organization typically does not sponsor visas.'
          : 'No H1B records found. Company may sponsor but not appear in public LCA data, or may be too small/new.',
        dataSource: 'USCIS LCA Disclosure Data',
        lastChecked: new Date().toISOString(),
      };
    }

    return res.status(200).json(sponsorHistory);

  } catch (err) {
    console.error('H1B lookup error:', err.message);
    return res.status(200).json({
      hasSponsored: null,
      error: 'Could not fetch H1B data: ' + err.message,
      note: 'Try searching manually at h1bdata.info or myvisajobs.com',
      totalApplications: 0,
    });
  }
};
