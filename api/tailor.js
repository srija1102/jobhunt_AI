// api/tailor.js — Vercel Serverless Function
// AI resume tailoring + cover letter via Claude API

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { job, resume, profile } = req.body || {};
  const KEY = process.env.ANTHROPIC_API_KEY;

  if (!KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set in Vercel Environment Variables.' });
  }

  // H1B context for the company
  const H1B_DB = {
    "Stripe":{ y2024:312,active:true,rate:96 }, "Vercel":{ y2024:48,active:true,rate:94 },
    "Figma":{ y2024:203,active:true,rate:97 }, "Google":{ y2024:8432,active:true,rate:98 },
    "Meta":{ y2024:5621,active:true,rate:97 }, "Microsoft":{ y2024:7832,active:true,rate:98 },
    "Amazon":{ y2024:9241,active:true,rate:97 }, "Apple":{ y2024:3211,active:true,rate:96 },
    "Notion":{ y2024:89,active:true,rate:95 }, "Airbnb":{ y2024:421,active:true,rate:96 },
    "Uber":{ y2024:1203,active:true,rate:95 }, "Linear":{ y2024:12,active:true,rate:92 },
  };
  const h1b = H1B_DB[job?.company] || { y2024: 50, active: true, rate: 88 };
  const h1bNote = h1b.active
    ? `${job?.company} actively sponsors H1B (${h1b.y2024} filings in 2024, ${h1b.rate}% approval). Mention openness to sponsorship naturally.`
    : `${job?.company} has limited sponsorship history. Do not emphasize visa needs.`;

  const prompt = `You are an expert resume writer and career coach. Tailor this resume for the specific job.

JOB: ${job?.title} at ${job?.company} (${job?.level || 'senior'} level)
DESCRIPTION: ${job?.description}
TEAM CONTEXT: ${job?.team}
TECH STACK: ${(job?.tags || []).join(', ')}
VISA CONTEXT: Candidate is on ${profile?.visaStatus || 'OPT'} and needs H1B sponsorship. ${h1bNote}

BASE RESUME:
${resume || 'No resume provided — write a strong, generic version for this role.'}

INSTRUCTIONS:
1. TAILORED RESUME: Mirror exact keywords from job description for ATS. Reorder bullet points so most relevant experience appears first. Quantify all achievements. Keep the same format. Do NOT invent experience that is not in the base resume.

2. COVER LETTER (180–220 words): Open by referencing the specific team or product they are building. Connect 2–3 specific experiences from the resume to their exact needs. Close with genuine enthusiasm for their mission. No generic openers like "I am writing to apply."

3. ANALYSIS: 3 strong match reasons, 1 honest gap.

Output using these exact headers (no markdown, no backticks):
=== TAILORED RESUME ===
[resume here]
=== COVER LETTER ===
[cover letter here]
=== ANALYSIS ===
[analysis here]`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const rawText = await response.text();
    let data;
    try { data = JSON.parse(rawText); }
    catch { return res.status(500).json({ error: `Claude API returned non-JSON: ${rawText.slice(0, 100)}` }); }

    if (!response.ok) {
      return res.status(500).json({ error: data?.error?.message || `Claude API error ${response.status}` });
    }

    const text = data.content?.[0]?.text || '';
    const get = (h1, h2) => {
      const m = text.match(new RegExp(`${h1}([\\s\\S]*?)(?=${h2}|$)`));
      return m?.[1]?.trim() || '';
    };

    return res.status(200).json({
      tailoredResume: get('=== TAILORED RESUME ===', '=== COVER LETTER ==='),
      coverLetter:    get('=== COVER LETTER ===',    '=== ANALYSIS ==='),
      analysis:       get('=== ANALYSIS ===',         '~~~NEVER~~~'),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
