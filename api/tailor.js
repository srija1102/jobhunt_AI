// api/tailor.js — Vercel Serverless Function
// Calls Claude API to tailor resume + generate cover letter

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { job, resume, profile } = req.body;
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

  if (!ANTHROPIC_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured.' });
  }

  const prompt = `You are an expert resume writer and career coach with a track record of getting candidates shortlisted at top tech companies.

Your task: Given a job posting and a candidate's base resume, produce TWO tailored documents optimized for ATS systems and human reviewers.

JOB DETAILS:
- Title: ${job.title}
- Company: ${job.company}
- Location: ${job.location}
- Tags/Stack: ${(job.tags || []).join(', ')}
- Description: ${job.description}
- Team Context: ${job.teamWork}

CANDIDATE PROFILE:
- Target Roles: ${profile.targetRoles || 'Software Engineer'}
- Skills: ${profile.skills || ''}

BASE RESUME:
${resume}

INSTRUCTIONS:
1. TAILORED RESUME:
   - Mirror exact keywords from the job description (ATS optimization)
   - Reorder bullet points so most relevant experience appears first
   - Quantify achievements wherever possible
   - Match their technical stack language precisely
   - Keep the same overall format but optimize every line
   - Do NOT invent experience that isn't in the base resume
   - Output under header: === TAILORED RESUME ===

2. COVER LETTER (180-220 words):
   - Opening that references the specific team/product they're building
   - Middle paragraph connecting 2-3 specific experiences to their needs
   - Closing with genuine enthusiasm for their mission
   - Conversational but professional tone
   - Do NOT use generic phrases like "I am writing to apply"
   - Output under header: === COVER LETTER ===

3. MATCH ANALYSIS (brief):
   - 3 bullet points: strongest matches
   - 1 bullet point: potential gap (honest)
   - Output under header: === ANALYSIS ===`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: `Claude API error: ${err}` });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    // Parse sections
    const resumeMatch = text.match(/=== TAILORED RESUME ===([\s\S]*?)(?==== COVER LETTER ===|$)/);
    const coverMatch = text.match(/=== COVER LETTER ===([\s\S]*?)(?==== ANALYSIS ===|$)/);
    const analysisMatch = text.match(/=== ANALYSIS ===([\s\S]*?)$/);

    return res.status(200).json({
      tailoredResume: resumeMatch?.[1]?.trim() || text,
      coverLetter: coverMatch?.[1]?.trim() || '',
      analysis: analysisMatch?.[1]?.trim() || '',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
