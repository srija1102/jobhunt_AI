// api/score.js — Vercel Serverless Function
// AI match scoring: scores a list of jobs against user profile/resume

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { jobs = [], profile = {}, resumeText = '' } = req.body || {};
  const KEY = process.env.ANTHROPIC_API_KEY;

  // Fallback keyword scorer (no API needed)
  function keywordScore(job) {
    const skills = (profile.skills || '').toLowerCase().split(',').map(s => s.trim());
    const tx = ((job.description || '') + ' ' + (job.tags || []).join(' ')).toLowerCase();
    let score = 50;
    const matches = skills.filter(s => s && tx.includes(s)).length;
    if (skills.length > 0) score += Math.round((matches / skills.length) * 35);
    const roles = (profile.targetRoles || '').toLowerCase();
    if (roles.split(',').some(r => (job.title || '').toLowerCase().includes(r.trim()))) score += 10;
    return Math.min(99, Math.max(40, score));
  }

  if (!KEY) {
    return res.status(200).json({ jobs: jobs.map(j => ({ ...j, match: keywordScore(j) })) });
  }

  const context = resumeText
    ? `RESUME:\n${resumeText.slice(0, 1500)}`
    : `SKILLS: ${profile.skills}\nTARGET ROLES: ${profile.targetRoles}\nLOCATIONS: ${profile.locations}`;

  const jobList = jobs.slice(0, 25).map(j =>
    `ID:${j.id}|${j.title}@${j.company}|Level:${j.level}|Tags:${(j.tags || []).join(',')}|Location:${j.location}`
  ).join('\n');

  const prompt = `Score each job's fit for this candidate (0–100). Return JSON array only, no markdown:
[{"id":"job_id","score":85,"reason":"brief reason"}]

CANDIDATE:
${context}

JOBS:
${jobList}

Scoring: skills match (40%), role/level match (35%), location (15%), salary (10%).`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 800, messages: [{ role: 'user', content: prompt }] }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || '[]';
    let scores = [];
    try { scores = JSON.parse(text.replace(/```json|```/g, '').trim()); } catch {}

    const scoreMap = Object.fromEntries(scores.map(s => [s.id, s]));
    return res.status(200).json({
      jobs: jobs.map(j => ({
        ...j,
        match: scoreMap[j.id]?.score || keywordScore(j),
        aiReason: scoreMap[j.id]?.reason || '',
      })),
    });
  } catch (err) {
    return res.status(200).json({ jobs: jobs.map(j => ({ ...j, match: keywordScore(j) })) });
  }
};
