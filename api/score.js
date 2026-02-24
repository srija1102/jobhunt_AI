// api/score.js — Vercel Serverless Function
// Scores a batch of jobs against user profile using Claude

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { jobs, profile } = req.body;
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

  if (!ANTHROPIC_KEY) {
    // Fallback: score based on keyword overlap without AI
    const scored = jobs.map(job => ({
      ...job,
      match: scoreByKeywords(job, profile),
    }));
    return res.status(200).json({ jobs: scored });
  }

  const prompt = `Score each job's fit for this candidate on a 0-100 scale.

CANDIDATE:
- Skills: ${profile.skills}
- Target Roles: ${profile.targetRoles}
- Preferred Locations: ${profile.locations}
- Min Salary: $${Number(profile.minSalary || 0).toLocaleString()}

JOBS TO SCORE (return JSON array with id and score only):
${jobs.map(j => `ID: ${j.id} | ${j.title} at ${j.company} | Tags: ${(j.tags || []).join(', ')} | Location: ${j.location} | Salary: ${j.salary}`).join('\n')}

Scoring criteria:
- Skills match (40%): How well do job requirements match candidate skills
- Role alignment (30%): How closely the title/level matches target roles  
- Location fit (20%): Remote/location match
- Salary fit (10%): Salary vs minimum

Return ONLY a JSON array like: [{"id": "job_id", "score": 85}, ...]
No explanation, just the JSON array.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', // Fast + cheap for scoring
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || '[]';
    const clean = text.replace(/```json|```/g, '').trim();
    const scores = JSON.parse(clean);

    const scoreMap = Object.fromEntries(scores.map(s => [s.id, s.score]));
    const scored = jobs.map(j => ({
      ...j,
      match: scoreMap[j.id] || scoreByKeywords(j, profile),
    }));

    return res.status(200).json({ jobs: scored });
  } catch (err) {
    // Fallback to keyword scoring
    const scored = jobs.map(j => ({ ...j, match: scoreByKeywords(j, profile) }));
    return res.status(200).json({ jobs: scored });
  }
}

function scoreByKeywords(job, profile) {
  const skills = (profile.skills || '').toLowerCase().split(',').map(s => s.trim());
  const tags = (job.tags || []).map(t => t.toLowerCase());
  const desc = (job.description || '').toLowerCase();

  let score = 50;
  let matches = 0;
  for (const skill of skills) {
    if (tags.some(t => t.includes(skill)) || desc.includes(skill)) matches++;
  }
  if (skills.length > 0) score += (matches / skills.length) * 40;

  const targetRoles = (profile.targetRoles || '').toLowerCase();
  const title = (job.title || '').toLowerCase();
  if (targetRoles.split(',').some(r => title.includes(r.trim()))) score += 10;

  return Math.min(99, Math.max(40, Math.round(score)));
}
