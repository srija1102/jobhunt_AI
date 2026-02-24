import { useState, useRef, useEffect } from "react";

const C = {
  bg: "#07080f", surface: "#0d0e1a", card: "#111220", border: "#1c1d30",
  accent: "#7c6dfa", accent2: "#00e5b0", accent3: "#ff5f6d",
  warn: "#f5a623", info: "#00bfff", gold: "#ffd700",
  text: "#e2e2f0", muted: "#5a5a7a", dim: "#888", highlight: "#ffffff",
  visa: "#00e5b0", visaBg: "rgba(0,229,176,0.08)",
  noVisa: "#ff5f6d", noVisaBg: "rgba(255,95,109,0.08)",
  unknown: "#f5a623", unknownBg: "rgba(245,166,35,0.08)",
};
const MONO = "'Space Mono', monospace";
const DISPLAY = "'Syne', sans-serif";

const BASE_RESUME = `YOUR NAME
your@email.com | github.com/yourhandle | linkedin.com/in/yourprofile | (555) 000-0000

SUMMARY
International student on OPT/STEM OPT seeking full-time engineering roles with H1B sponsorship. 
6+ years building scalable web applications. Specialized in React, TypeScript, and Node.js.

EXPERIENCE
Senior Software Engineer — Company Name (Year–Present)
• Achievement with metrics
• Achievement with metrics

Engineer — Previous Company (Year–Year)
• Achievement with metrics

SKILLS
Languages: JavaScript, TypeScript, Python
Frontend: React, Next.js
Backend: Node.js, PostgreSQL
DevOps: Docker, AWS

EDUCATION
M.S. Computer Science — University Name (Year) — F-1 Visa / OPT
B.S. Computer Science — University Name (Year)`;

// ── Helpers ──────────────────────────────────────────────────────────────────
function VisaBadge({ visaInfo, h1bData }) {
  if (!visaInfo) return null;

  let color, bg, label, icon;

  if (h1bData && h1bData.hasSponsored && h1bData.totalApplications > 0) {
    color = C.visa; bg = C.visaBg;
    label = `✓ H1B: ${h1bData.totalApplications} filings`; icon = "🛂";
  } else if (visaInfo.explicitlySponsors) {
    color = C.visa; bg = C.visaBg;
    label = "✓ Sponsors H1B"; icon = "🛂";
  } else if (visaInfo.mentionsSponsorship) {
    color = C.warn; bg = C.unknownBg;
    label = "~ OPT/Visa Mentioned"; icon = "📋";
  } else if (h1bData && h1bData.hasSponsored === false) {
    color = C.noVisa; bg = C.noVisaBg;
    label = "✗ No H1B History"; icon = "⚠";
  } else {
    color = C.unknown; bg = C.unknownBg;
    label = "? Check Sponsorship"; icon = "❓";
  }

  return (
    <span style={{ fontSize: 9, fontFamily: MONO, color, background: bg,
      border: `1px solid ${color}`, padding: "2px 8px", borderRadius: 2,
      letterSpacing: 0.8, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4 }}>
      {icon} {label}
    </span>
  );
}

function StatusBadge({ status }) {
  const M = {
    new: [C.accent2, "NEW"], tailored: [C.accent, "TAILORED"],
    applied: [C.warn, "APPLIED"], rejected: [C.noVisa, "REJECTED"],
    interview: [C.info, "INTERVIEW 🎉"],
  };
  const [color, label] = M[status] || [C.accent2, "NEW"];
  return (
    <span style={{ fontSize: 9, fontFamily: MONO, color, border: `1px solid ${color}`,
      padding: "2px 7px", borderRadius: 2, letterSpacing: 1.2, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function MatchBar({ score }) {
  const color = score >= 85 ? C.accent2 : score >= 70 ? C.accent : C.warn;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 64, height: 3, background: C.border, borderRadius: 2 }}>
        <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.6s" }} />
      </div>
      <span style={{ fontSize: 11, fontFamily: MONO, color, fontWeight: 700 }}>{score}%</span>
    </div>
  );
}

function Spinner({ size = 14, color = C.accent }) {
  return <span style={{ display: "inline-block", width: size, height: size,
    border: `2px solid ${C.border}`, borderTop: `2px solid ${color}`,
    borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />;
}

function Btn({ onClick, disabled, children, variant = "primary", style: s = {} }) {
  const base = {
    primary: { background: C.accent, color: "#fff", border: "none" },
    secondary: { background: "transparent", color: C.accent2, border: `1px solid ${C.accent2}` },
    ghost: { background: "transparent", color: C.muted, border: `1px solid ${C.border}` },
    danger: { background: "transparent", color: C.accent3, border: `1px solid ${C.accent3}` },
    visa: { background: C.visaBg, color: C.visa, border: `1px solid ${C.visa}` },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...base[variant], cursor: disabled ? "default" : "pointer", fontFamily: MONO,
      fontSize: 10, padding: "7px 14px", borderRadius: 4, letterSpacing: 1,
      opacity: disabled ? 0.5 : 1, whiteSpace: "nowrap",
      display: "inline-flex", alignItems: "center", gap: 6, ...s,
    }}>{children}</button>
  );
}

function Tab({ label, active, onClick, count, alert }) {
  return (
    <button onClick={onClick} style={{
      background: "none", border: "none", cursor: "pointer", fontFamily: MONO, fontSize: 11,
      color: active ? C.highlight : C.muted, padding: "10px 18px",
      borderBottom: active ? `2px solid ${C.accent}` : "2px solid transparent",
      letterSpacing: 1, display: "flex", alignItems: "center", gap: 6,
    }}>
      {label.toUpperCase()}
      {count !== undefined && (
        <span style={{ background: active ? C.accent : C.border, color: active ? "#fff" : C.muted,
          borderRadius: 10, padding: "1px 7px", fontSize: 9 }}>{count}</span>
      )}
      {alert && <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.accent3, display: "inline-block" }} />}
    </button>
  );
}

// ── H1B History Panel ────────────────────────────────────────────────────────
function H1BHistoryPanel({ company, h1bData, loading, onFetch }) {
  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: C.muted, padding: "12px 0" }}>
      <Spinner size={12} color={C.visa} /> Checking USCIS H1B records for {company}...
    </div>
  );

  if (!h1bData) return (
    <div style={{ padding: "12px 0" }}>
      <Btn onClick={onFetch} variant="visa">🛂 CHECK H1B HISTORY (USCIS DATA)</Btn>
      <div style={{ fontSize: 10, color: C.muted, marginTop: 6 }}>
        Searches public USCIS Labor Condition Application records
      </div>
    </div>
  );

  if (h1bData.error) return (
    <div style={{ fontSize: 11, color: C.warn, padding: "8px 0" }}>
      ⚠ {h1bData.error} — <a href={`https://h1bdata.info/index.php?em=${encodeURIComponent(company)}`}
        target="_blank" rel="noreferrer" style={{ color: C.info }}>Check manually →</a>
    </div>
  );

  const hasHistory = h1bData.hasSponsored && h1bData.totalApplications > 0;

  return (
    <div style={{ background: hasHistory ? C.visaBg : C.noVisaBg,
      border: `1px solid ${hasHistory ? C.visa : C.noVisa}`, borderRadius: 6, padding: 14, marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: hasHistory ? 12 : 0 }}>
        <span style={{ fontSize: 20 }}>{hasHistory ? "✅" : "❌"}</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: hasHistory ? C.visa : C.noVisa, fontFamily: DISPLAY }}>
            {hasHistory
              ? `${company} has sponsored H1B visas`
              : `No H1B sponsorship history found`}
          </div>
          <div style={{ fontSize: 10, color: C.muted }}>Source: {h1bData.dataSource}</div>
        </div>
      </div>

      {hasHistory && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 10 }}>
          {[
            { label: "Total Filings", value: h1bData.totalApplications, color: C.visa },
            { label: "Approved", value: h1bData.approvedCount, color: C.accent2 },
            { label: "Approval Rate", value: `${h1bData.approvalRate}%`, color: h1bData.approvalRate >= 80 ? C.visa : C.warn },
          ].map(s => (
            <div key={s.label} style={{ background: "rgba(0,0,0,0.3)", borderRadius: 4, padding: 10, textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: s.color, fontFamily: DISPLAY }}>{s.value}</div>
              <div style={{ fontSize: 9, color: C.muted, letterSpacing: 1 }}>{s.label.toUpperCase()}</div>
            </div>
          ))}
        </div>
      )}

      {hasHistory && h1bData.avgSalary > 0 && (
        <div style={{ fontSize: 11, color: C.dim, marginBottom: 8 }}>
          💰 Avg H1B salary: <span style={{ color: C.gold, fontWeight: 700 }}>${h1bData.avgSalary.toLocaleString()}</span>
        </div>
      )}

      {hasHistory && h1bData.recentYears?.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 9, color: C.muted, letterSpacing: 1, marginBottom: 6 }}>FILINGS BY YEAR</div>
          <div style={{ display: "flex", gap: 8 }}>
            {h1bData.recentYears.map(y => (
              <div key={y.year} style={{ background: "rgba(0,0,0,0.3)", borderRadius: 4, padding: "6px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.visa }}>{y.count}</div>
                <div style={{ fontSize: 9, color: C.muted }}>{y.year}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasHistory && h1bData.topJobTitles?.length > 0 && (
        <div style={{ fontSize: 10, color: C.muted }}>
          Top roles sponsored: {h1bData.topJobTitles.join(" · ")}
        </div>
      )}

      {!hasHistory && h1bData.note && (
        <div style={{ fontSize: 11, color: C.dim, marginTop: 6 }}>{h1bData.note}</div>
      )}

      <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
        <a href={`https://h1bdata.info/index.php?em=${encodeURIComponent(company)}`}
          target="_blank" rel="noreferrer"
          style={{ fontSize: 9, color: C.info, fontFamily: MONO, letterSpacing: 0.5 }}>
          → View full H1B records ↗
        </a>
        <a href={`https://www.myvisajobs.com/Search_Visa_Sponsor.aspx?K=${encodeURIComponent(company)}`}
          target="_blank" rel="noreferrer"
          style={{ fontSize: 9, color: C.info, fontFamily: MONO, letterSpacing: 0.5, marginLeft: 8 }}>
          → MyVisaJobs ↗
        </a>
      </div>
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [jobs, setJobs] = useState([]);
  const [h1bCache, setH1bCache] = useState({}); // company -> h1b data
  const [h1bLoading, setH1bLoading] = useState({});
  const [expandedJob, setExpandedJob] = useState(null);
  const [profile, setProfile] = useState({
    resume: BASE_RESUME,
    targetRoles: "Senior Frontend Engineer, Staff Engineer, Full Stack Engineer",
    locations: "Remote",
    minSalary: "100000",
    skills: "React, TypeScript, Node.js, GraphQL, PostgreSQL",
    visaStatus: "OPT", // OPT | STEM OPT | H1B | CPT | Other
  });
  const [scrapeConfig, setScrapeConfig] = useState({
    keywords: "Senior Frontend Engineer React TypeScript",
    location: "Remote",
    sources: ["LinkedIn", "Indeed", "Greenhouse"],
    optH1bFilter: "prefer", // 'only' | 'prefer' | 'off'
  });
  const [selectedJob, setSelectedJob] = useState(null);
  const [tailor, setTailor] = useState({ resume: "", cover: "", analysis: "" });
  const [loading, setLoading] = useState({ scrape: false, tailor: false });
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");
  const logRef = useRef(null);

  // Persist data
  useEffect(() => {
    try {
      const saved = localStorage.getItem("jobhunt_v2");
      if (saved) {
        const d = JSON.parse(saved);
        if (d.jobs) setJobs(d.jobs);
        if (d.profile) setProfile(d.profile);
        if (d.h1bCache) setH1bCache(d.h1bCache);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem("jobhunt_v2", JSON.stringify({ jobs, profile, h1bCache })); } catch {}
  }, [jobs, profile, h1bCache]);

  const addLog = (msg, type = "info") => {
    const icons = { info: "→", success: "✓", error: "✗", warn: "⚠" };
    setLogs(l => [...l, { msg, type, icon: icons[type], t: new Date().toLocaleTimeString() }]);
    setTimeout(() => logRef.current?.scrollTo(0, 99999), 60);
  };

  const stats = {
    total: jobs.length,
    sponsorConfirmed: jobs.filter(j => j.visaInfo?.explicitlySponsors || (h1bCache[j.company]?.totalApplications > 0)).length,
    new: jobs.filter(j => j.status === "new").length,
    applied: jobs.filter(j => j.status === "applied").length,
    interview: jobs.filter(j => j.status === "interview").length,
  };

  // ── Fetch H1B history for a company ──────────────────────────────────────
  const fetchH1B = async (company) => {
    if (h1bCache[company] || h1bLoading[company]) return;
    setH1bLoading(l => ({ ...l, [company]: true }));
    try {
      const res = await fetch("/api/h1b", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company }),
      });
      const data = await res.json();
      setH1bCache(c => ({ ...c, [company]: data }));
    } catch (err) {
      setH1bCache(c => ({ ...c, [company]: { error: err.message, hasSponsored: null } }));
    }
    setH1bLoading(l => ({ ...l, [company]: false }));
  };

  // Auto-fetch H1B for top 5 new jobs
  useEffect(() => {
    const toFetch = jobs.filter(j => j.status === "new" && !h1bCache[j.company]).slice(0, 5);
    toFetch.forEach(j => fetchH1B(j.company));
  }, [jobs]);

  // ── Scrape ──────────────────────────────────────────────────────────────────
  const handleScrape = async () => {
    setLoading(l => ({ ...l, scrape: true }));
    setLogs([]);
    setError("");
    addLog("Connecting to job board APIs...");
    addLog(`Mode: ${scrapeConfig.optH1bFilter === 'only' ? '🛂 OPT/H1B ONLY' : scrapeConfig.optH1bFilter === 'prefer' ? '🛂 Prefer sponsoring companies' : 'All jobs'}`);
    addLog(`Filtering OUT jobs that explicitly reject visa holders`);

    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords: scrapeConfig.keywords,
          location: scrapeConfig.location,
          sources: scrapeConfig.sources,
          minSalary: Number(profile.minSalary) || 0,
          optH1bFilter: scrapeConfig.optH1bFilter,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scrape failed");

      addLog(`Found ${data.total} jobs (no-sponsorship listings removed)`, "success");
      addLog(`Checking AI match scores...`);

      // Score jobs
      const scoreRes = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobs: data.jobs, profile }),
      });
      const scoreData = await scoreRes.json();
      const scored = (scoreData.jobs || data.jobs).sort((a, b) => b.match - a.match);

      const existingIds = new Set(jobs.map(j => j.id));
      const newJobs = scored.filter(j => !existingIds.has(j.id));
      setJobs(prev => [...newJobs, ...prev]);

      const sponsorCount = newJobs.filter(j => j.visaInfo?.explicitlySponsors || j.visaInfo?.mentionsSponsorship).length;
      addLog(`Added ${newJobs.length} jobs — ${sponsorCount} mention visa sponsorship`, "success");
      addLog("Fetching USCIS H1B history for top companies...", "info");
    } catch (err) {
      setError(err.message);
      addLog(`Error: ${err.message}`, "error");
    }
    setLoading(l => ({ ...l, scrape: false }));
  };

  // ── Tailor ──────────────────────────────────────────────────────────────────
  const handleTailor = async (job) => {
    setSelectedJob(job);
    setTailor({ resume: "", cover: "", analysis: "" });
    setLoading(l => ({ ...l, tailor: true }));
    setTab("tailor");
    setError("");
    try {
      const res = await fetch("/api/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job,
          resume: profile.resume,
          profile: { ...profile, visaContext: `Candidate is on ${profile.visaStatus} and will need H1B sponsorship.` },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTailor({ resume: data.tailoredResume, cover: data.coverLetter, analysis: data.analysis });
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: "tailored" } : j));
    } catch (err) {
      setError(err.message);
      setTailor({ resume: profile.resume, cover: "", analysis: "" });
    }
    setLoading(l => ({ ...l, tailor: false }));
  };

  const handleMarkApplied = (id) => setJobs(prev => prev.map(j => j.id === id ? { ...j, status: "applied" } : j));
  const handleStatus = (id, status) => setJobs(prev => prev.map(j => j.id === id ? { ...j, status } : j));
  const toggleExpand = (id) => setExpandedJob(e => e === id ? null : id);

  // ── Visa filter for display ────────────────────────────────────────────────
  const [visaDisplayFilter, setVisaDisplayFilter] = useState("all"); // 'all' | 'confirmed' | 'mentioned' | 'unknown'
  const filteredJobs = jobs.filter(j => {
    if (visaDisplayFilter === "all") return true;
    const h = h1bCache[j.company];
    if (visaDisplayFilter === "confirmed") return j.visaInfo?.explicitlySponsors || (h?.totalApplications > 0);
    if (visaDisplayFilter === "mentioned") return j.visaInfo?.mentionsSponsorship && !j.visaInfo?.explicitlySponsors;
    if (visaDisplayFilter === "unknown") return !j.visaInfo?.explicitlySponsors && !j.visaInfo?.mentionsSponsorship;
    return true;
  });

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: MONO, display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        input,textarea,select { outline: none; }
        input:focus, textarea:focus, select:focus { border-color: ${C.accent} !important; }
        ::-webkit-scrollbar { width: 3px; } ::-webkit-scrollbar-track { background: ${C.bg}; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 2px; }
      `}</style>

      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`,
        padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, background: C.accent, borderRadius: 6,
            display: "grid", placeItems: "center", fontSize: 16 }}>⚡</div>
          <div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 17, color: C.highlight, letterSpacing: -0.5 }}>
              JobHunt.ai
            </div>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: 1.5 }}>OPT · H1B SPONSORSHIP TRACKER</div>
          </div>
          <div style={{ marginLeft: 12, background: C.visaBg, border: `1px solid ${C.visa}`,
            borderRadius: 4, padding: "4px 10px", fontSize: 10, color: C.visa, fontFamily: MONO }}>
            🛂 {profile.visaStatus} MODE
          </div>
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          {[
            { k: "total", l: "TOTAL", c: C.text },
            { k: "sponsorConfirmed", l: "SPONSOR ✓", c: C.visa },
            { k: "new", l: "NEW", c: C.accent2 },
            { k: "applied", l: "APPLIED", c: C.warn },
            { k: "interview", l: "INTERVIEWS", c: C.info },
          ].map(s => (
            <div key={s.k} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.c, fontFamily: DISPLAY }}>{stats[s.k]}</div>
              <div style={{ fontSize: 8, color: C.muted, letterSpacing: 1.5 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Nav */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 20px", display: "flex" }}>
        {[
          { id: "dashboard", label: "Jobs", count: stats.total },
          { id: "scrape", label: "Scrape" },
          { id: "h1b", label: "🛂 H1B Lookup" },
          { id: "tailor", label: "AI Tailor" },
          { id: "tracker", label: "Tracker" },
          { id: "profile", label: "My Profile" },
          { id: "setup", label: "⚙ Setup" },
        ].map(t => <Tab key={t.id} label={t.label} active={tab === t.id} onClick={() => setTab(t.id)} count={t.count} />)}
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: "#1a0505", borderBottom: `1px solid ${C.accent3}`,
          padding: "10px 28px", fontSize: 12, color: C.accent3,
          display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          ✗ {error}
          <button onClick={() => setError("")} style={{ background: "none", border: "none", color: C.accent3, cursor: "pointer", fontSize: 18 }}>×</button>
        </div>
      )}

      <div style={{ flex: 1, overflow: "auto", padding: 24 }}>

        {/* ── DASHBOARD ── */}
        {tab === "dashboard" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 700 }}>
                Job Matches
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {/* Visa filter pills */}
                {[
                  { id: "all", label: "All Jobs" },
                  { id: "confirmed", label: "✓ Confirmed Sponsors" },
                  { id: "mentioned", label: "~ Visa Mentioned" },
                  { id: "unknown", label: "? Unknown" },
                ].map(f => (
                  <button key={f.id} onClick={() => setVisaDisplayFilter(f.id)} style={{
                    background: visaDisplayFilter === f.id ? C.visa : "transparent",
                    border: `1px solid ${visaDisplayFilter === f.id ? C.visa : C.border}`,
                    color: visaDisplayFilter === f.id ? "#000" : C.muted,
                    cursor: "pointer", fontFamily: MONO, fontSize: 9, padding: "5px 10px", borderRadius: 3,
                  }}>{f.label}</button>
                ))}
                <Btn onClick={() => setTab("scrape")}>⚡ SCRAPE</Btn>
              </div>
            </div>

            {filteredJobs.length === 0 ? (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
                padding: 60, textAlign: "center", color: C.muted }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🛂</div>
                <div style={{ fontFamily: DISPLAY, fontSize: 18, color: C.text, marginBottom: 8 }}>
                  No jobs yet
                </div>
                <div style={{ fontSize: 12, marginBottom: 20 }}>
                  Fill your profile, then scrape jobs filtered for OPT/H1B sponsorship
                </div>
                <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                  <Btn onClick={() => setTab("profile")}>EDIT PROFILE</Btn>
                  <Btn onClick={() => setTab("scrape")} variant="primary">START SCRAPING →</Btn>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {filteredJobs.map(job => {
                  const h1b = h1bCache[job.company];
                  const isExpanded = expandedJob === job.id;
                  const sponsorConfirmed = job.visaInfo?.explicitlySponsors || (h1b?.totalApplications > 0);

                  return (
                    <div key={job.id} style={{
                      background: C.card,
                      border: `1px solid ${sponsorConfirmed ? C.visa : C.border}`,
                      borderLeft: `3px solid ${sponsorConfirmed ? C.visa : job.visaInfo?.mentionsSponsorship ? C.warn : C.border}`,
                      borderRadius: 8, overflow: "hidden", animation: "fadeUp 0.3s ease",
                    }}>
                      {/* Main row */}
                      <div style={{ padding: "14px 16px", display: "flex", gap: 14, alignItems: "flex-start" }}>
                        {/* Logo */}
                        <div style={{ width: 36, height: 36, borderRadius: 6, background: C.border,
                          display: "grid", placeItems: "center", fontSize: 18, flexShrink: 0 }}>
                          {job.employerLogo
                            ? <img src={job.employerLogo} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} onError={e => e.target.style.display = 'none'} />
                            : job.company?.[0] || "?"}
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                            <span style={{ fontFamily: DISPLAY, fontSize: 15, fontWeight: 600, color: C.highlight }}>{job.title}</span>
                            <StatusBadge status={job.status} />
                            <VisaBadge visaInfo={job.visaInfo} h1bData={h1b} />
                            {h1bLoading[job.company] && <Spinner size={10} color={C.visa} />}
                          </div>
                          <div style={{ fontSize: 12, color: C.accent2, marginBottom: 5 }}>
                            {job.company} · {job.location} · {job.salary}
                          </div>
                          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 5 }}>
                            {(job.tags || []).map(t => (
                              <span key={t} style={{ fontSize: 9, background: C.border,
                                padding: "2px 7px", borderRadius: 2, color: C.muted }}>{t}</span>
                            ))}
                          </div>
                          <div style={{ fontSize: 10, color: C.muted }}>{job.source} · {job.posted}</div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                          <MatchBar score={job.match || 0} />
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                            <Btn onClick={() => toggleExpand(job.id)} variant="ghost">
                              {isExpanded ? "▲ LESS" : "🛂 H1B INFO"}
                            </Btn>
                            {job.status !== "applied" && job.status !== "interview" && (
                              <Btn onClick={() => handleTailor(job)}>✨ TAILOR</Btn>
                            )}
                            {job.status === "tailored" && (
                              <Btn onClick={() => handleMarkApplied(job.id)} variant="secondary">✓ APPLIED</Btn>
                            )}
                            <a href={job.url} target="_blank" rel="noreferrer">
                              <Btn variant="ghost">↗</Btn>
                            </a>
                          </div>
                        </div>
                      </div>

                      {/* Expanded H1B Panel */}
                      {isExpanded && (
                        <div style={{ borderTop: `1px solid ${C.border}`, padding: "14px 16px 14px 66px", background: "rgba(0,0,0,0.2)" }}>
                          <H1BHistoryPanel
                            company={job.company}
                            h1bData={h1b}
                            loading={h1bLoading[job.company]}
                            onFetch={() => fetchH1B(job.company)}
                          />
                          {job.visaInfo?.optFriendly && (
                            <div style={{ marginTop: 8, fontSize: 11, color: C.accent2 }}>
                              ✓ Job posting mentions OPT/F-1/STEM — likely OPT-friendly
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── H1B LOOKUP TAB ── */}
        {tab === "h1b" && (
          <div style={{ maxWidth: 700 }}>
            <div style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 700, marginBottom: 6 }}>H1B Sponsorship Lookup</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 24 }}>
              Search USCIS public Labor Condition Application records to verify any company's H1B history
            </div>

            <CompanyH1BSearch h1bCache={h1bCache} h1bLoading={h1bLoading} fetchH1B={fetchH1B} />

            {/* Top sponsors from current job list */}
            {jobs.length > 0 && (
              <div style={{ marginTop: 28 }}>
                <div style={{ fontFamily: DISPLAY, fontSize: 14, fontWeight: 700, marginBottom: 14 }}>
                  Companies in Your Job List
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[...new Set(jobs.map(j => j.company))].map(company => {
                    const h = h1bCache[company];
                    return (
                      <div key={company} style={{ background: C.card, border: `1px solid ${C.border}`,
                        borderRadius: 6, padding: "12px 16px", display: "flex",
                        alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontFamily: DISPLAY, fontWeight: 600 }}>{company}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {h1bLoading[company] && <Spinner size={12} color={C.visa} />}
                          {h && h.totalApplications > 0 && (
                            <span style={{ fontSize: 11, color: C.visa }}>
                              ✓ {h.totalApplications} H1B filings · {h.approvalRate}% approved
                            </span>
                          )}
                          {h && h.hasSponsored === false && (
                            <span style={{ fontSize: 11, color: C.noVisa }}>✗ No H1B history</span>
                          )}
                          {!h && !h1bLoading[company] && (
                            <Btn onClick={() => fetchH1B(company)} variant="visa" style={{ fontSize: 9, padding: "4px 10px" }}>
                              CHECK
                            </Btn>
                          )}
                          <a href={`https://h1bdata.info/index.php?em=${encodeURIComponent(company)}`}
                            target="_blank" rel="noreferrer"
                            style={{ fontSize: 9, color: C.info, fontFamily: MONO }}>↗</a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ marginTop: 24, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 11, color: C.visa, fontWeight: 700, marginBottom: 8 }}>📚 Data Sources</div>
              <div style={{ fontSize: 11, color: C.dim, lineHeight: 2 }}>
                • <a href="https://h1bdata.info" target="_blank" rel="noreferrer" style={{ color: C.info }}>H1BData.info</a> — USCIS LCA public disclosure database<br/>
                • <a href="https://www.myvisajobs.com" target="_blank" rel="noreferrer" style={{ color: C.info }}>MyVisaJobs.com</a> — H1B sponsor rankings<br/>
                • <a href="https://www.dol.gov/agencies/eta/foreign-labor/performance" target="_blank" rel="noreferrer" style={{ color: C.info }}>DOL.gov</a> — Official LCA disclosure data<br/>
                • All data is <strong style={{ color: C.text }}>public government records</strong> — updated quarterly
              </div>
            </div>
          </div>
        )}

        {/* ── SCRAPE ── */}
        {tab === "scrape" && (
          <div style={{ maxWidth: 680 }}>
            <div style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Job Scraper</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 20 }}>
              Scrapes real jobs and automatically removes listings that reject visa holders
            </div>

            {/* OPT/H1B Mode selector — prominent */}
            <div style={{ background: C.visaBg, border: `1px solid ${C.visa}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: C.visa, letterSpacing: 1, marginBottom: 10, fontWeight: 700 }}>
                🛂 VISA FILTER MODE
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                {[
                  { id: "only", label: "🛂 Sponsors Only", desc: "Only jobs that explicitly mention H1B/OPT sponsorship" },
                  { id: "prefer", label: "⚡ Smart Filter", desc: "Remove no-sponsor jobs, include unknown (recommended)" },
                  { id: "off", label: "All Jobs", desc: "No visa filtering" },
                ].map(m => (
                  <button key={m.id} onClick={() => setScrapeConfig(s => ({ ...s, optH1bFilter: m.id }))} style={{
                    flex: 1, background: scrapeConfig.optH1bFilter === m.id ? C.visa : C.card,
                    border: `1px solid ${scrapeConfig.optH1bFilter === m.id ? C.visa : C.border}`,
                    color: scrapeConfig.optH1bFilter === m.id ? "#000" : C.muted,
                    cursor: "pointer", fontFamily: MONO, fontSize: 10, padding: "10px 8px",
                    borderRadius: 6, textAlign: "center", transition: "all 0.2s",
                  }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{m.label}</div>
                    <div style={{ fontSize: 8, lineHeight: 1.4, opacity: 0.8 }}>{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, marginBottom: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 10, color: C.muted, letterSpacing: 1.2, display: "block", marginBottom: 6 }}>SEARCH KEYWORDS</label>
                  <input value={scrapeConfig.keywords} onChange={e => setScrapeConfig(s => ({ ...s, keywords: e.target.value }))}
                    style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`,
                      color: C.text, fontFamily: MONO, fontSize: 12, padding: "9px 12px", borderRadius: 4 }}
                    placeholder="e.g. Senior React Engineer TypeScript" />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: C.muted, letterSpacing: 1.2, display: "block", marginBottom: 6 }}>LOCATION</label>
                  <input value={scrapeConfig.location} onChange={e => setScrapeConfig(s => ({ ...s, location: e.target.value }))}
                    style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`,
                      color: C.text, fontFamily: MONO, fontSize: 12, padding: "9px 12px", borderRadius: 4 }}
                    placeholder="Remote, New York, San Francisco..." />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: C.muted, letterSpacing: 1.2, display: "block", marginBottom: 8 }}>SOURCES</label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {["LinkedIn", "Indeed", "Greenhouse", "Glassdoor", "ZipRecruiter", "BeBee"].map(s => (
                      <button key={s} onClick={() => setScrapeConfig(c => ({
                        ...c, sources: c.sources.includes(s) ? c.sources.filter(x => x !== s) : [...c.sources, s]
                      }))} style={{
                        background: scrapeConfig.sources.includes(s) ? C.accent : C.border,
                        border: "none", color: scrapeConfig.sources.includes(s) ? "#fff" : C.muted,
                        cursor: "pointer", fontFamily: MONO, fontSize: 10, padding: "6px 12px", borderRadius: 4,
                      }}>{s}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <button onClick={handleScrape} disabled={loading.scrape} style={{
              width: "100%", background: loading.scrape ? C.border : C.accent,
              border: "none", color: "#fff", cursor: loading.scrape ? "default" : "pointer",
              fontFamily: DISPLAY, fontSize: 14, fontWeight: 700, padding: "14px",
              borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 16,
            }}>
              {loading.scrape ? <><Spinner /> SCRAPING + FILTERING VISA JOBS...</> : "🛂 SCRAPE OPT/H1B FRIENDLY JOBS"}
            </button>

            {logs.length > 0 && (
              <div ref={logRef} style={{ background: "#02030a", border: `1px solid ${C.border}`,
                borderRadius: 6, padding: 16, height: 240, overflowY: "auto", fontFamily: MONO, fontSize: 11 }}>
                {logs.map((log, i) => (
                  <div key={i} style={{
                    color: log.type === "success" ? C.accent2 : log.type === "error" ? C.accent3 :
                      log.type === "warn" ? C.warn : C.muted,
                    marginBottom: 4, animation: "fadeUp 0.2s ease",
                  }}>
                    <span style={{ color: C.border }}>[{log.t}]</span> {log.icon} {log.msg}
                  </div>
                ))}
                {loading.scrape && <span style={{ color: C.accent, animation: "pulse 1s infinite" }}>█</span>}
              </div>
            )}
          </div>
        )}

        {/* ── TAILOR ── */}
        {tab === "tailor" && (
          <div>
            <div style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 700, marginBottom: 20 }}>
              {selectedJob ? `AI Tailoring — ${selectedJob.title} @ ${selectedJob.company}` : "AI Resume Tailor"}
            </div>
            {!selectedJob ? (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
                padding: 60, textAlign: "center", color: C.muted }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✨</div>
                <div style={{ fontFamily: DISPLAY, fontSize: 16, color: C.text, marginBottom: 8 }}>No job selected</div>
                <div style={{ fontSize: 12 }}>Click "TAILOR" on any job in the Jobs tab</div>
              </div>
            ) : loading.tailor ? (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
                padding: 70, textAlign: "center" }}>
                <Spinner size={32} />
                <div style={{ marginTop: 20, fontFamily: DISPLAY, fontSize: 16 }}>Claude AI tailoring your resume...</div>
                <div style={{ marginTop: 8, fontSize: 11, color: C.muted }}>
                  Optimizing for ATS · Matching visa context · Writing cover letter
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                  <Btn onClick={() => navigator.clipboard.writeText(tailor.resume)}>📋 COPY RESUME</Btn>
                  <Btn onClick={() => navigator.clipboard.writeText(tailor.cover)} variant="secondary">📋 COPY COVER LETTER</Btn>
                  <a href={selectedJob.url} target="_blank" rel="noreferrer"><Btn variant="ghost">↗ OPEN JOB PAGE</Btn></a>
                  <Btn onClick={() => { handleMarkApplied(selectedJob.id); setTab("dashboard"); }} variant="secondary">✓ MARK APPLIED</Btn>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1.2, marginBottom: 6 }}>
                      TAILORED RESUME <span style={{ color: C.accent }}>(ATS + visa optimized)</span>
                    </div>
                    <textarea value={tailor.resume} onChange={e => setTailor(t => ({ ...t, resume: e.target.value }))}
                      style={{ width: "100%", height: 520, background: C.card, border: `1px solid ${C.accent}`,
                        color: C.text, fontFamily: MONO, fontSize: 11, padding: 16, borderRadius: 6, lineHeight: 1.75 }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                      <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1.2, marginBottom: 6 }}>COVER LETTER</div>
                      <textarea value={tailor.cover} onChange={e => setTailor(t => ({ ...t, cover: e.target.value }))}
                        style={{ width: "100%", height: 240, background: C.card, border: `1px solid ${C.accent2}`,
                          color: C.text, fontFamily: MONO, fontSize: 11, padding: 16, borderRadius: 6, lineHeight: 1.75 }} />
                    </div>
                    {tailor.analysis && (
                      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: 16 }}>
                        <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1.2, marginBottom: 8 }}>AI ANALYSIS</div>
                        <pre style={{ fontSize: 11, color: C.dim, lineHeight: 1.7, whiteSpace: "pre-wrap", fontFamily: MONO }}>{tailor.analysis}</pre>
                      </div>
                    )}
                    {selectedJob && (
                      <H1BHistoryPanel
                        company={selectedJob.company}
                        h1bData={h1bCache[selectedJob.company]}
                        loading={h1bLoading[selectedJob.company]}
                        onFetch={() => fetchH1B(selectedJob.company)}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TRACKER ── */}
        {tab === "tracker" && (
          <div>
            <div style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Application Tracker</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
              {[
                { l: "Total Jobs", v: stats.total, c: C.text, icon: "📋" },
                { l: "H1B Confirmed", v: stats.sponsorConfirmed, c: C.visa, icon: "🛂" },
                { l: "Applied", v: stats.applied, c: C.warn, icon: "📤" },
                { l: "Interviews", v: stats.interview, c: C.info, icon: "🎯" },
              ].map(s => (
                <div key={s.l} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 18 }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
                  <div style={{ fontSize: 26, fontFamily: DISPLAY, fontWeight: 800, color: s.c }}>{s.v}</div>
                  <div style={{ fontSize: 9, color: C.muted, letterSpacing: 1.2, marginTop: 2 }}>{s.l.toUpperCase()}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
              {["new", "tailored", "applied", "interview"].map(status => (
                <div key={status} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <StatusBadge status={status} />
                    <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 16 }}>
                      {jobs.filter(j => j.status === status).length}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {jobs.filter(j => j.status === status).map(job => {
                      const h = h1bCache[job.company];
                      const sponsored = job.visaInfo?.explicitlySponsors || (h?.totalApplications > 0);
                      return (
                        <div key={job.id} style={{ background: C.bg, border: `1px solid ${sponsored ? C.visa : C.border}`,
                          borderRadius: 6, padding: 10 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 2, color: C.highlight }}>{job.company}</div>
                          <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>{job.title}</div>
                          {sponsored && <div style={{ fontSize: 8, color: C.visa }}>🛂 H1B sponsor confirmed</div>}
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                            {status === "applied" && (
                              <button onClick={() => handleStatus(job.id, "interview")}
                                style={{ fontSize: 8, background: C.info, border: "none", color: "#000",
                                  cursor: "pointer", fontFamily: MONO, padding: "2px 6px", borderRadius: 3 }}>
                                → INTERVIEW
                              </button>
                            )}
                            {status === "new" && (
                              <button onClick={() => handleTailor(job)}
                                style={{ fontSize: 8, background: C.accent, border: "none", color: "#fff",
                                  cursor: "pointer", fontFamily: MONO, padding: "2px 6px", borderRadius: 3 }}>
                                TAILOR
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── PROFILE ── */}
        {tab === "profile" && (
          <div style={{ maxWidth: 820 }}>
            <div style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 700, marginBottom: 20 }}>My Profile</div>

            {/* Visa Status selector */}
            <div style={{ background: C.visaBg, border: `1px solid ${C.visa}`, borderRadius: 8, padding: 16, marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: C.visa, letterSpacing: 1, marginBottom: 10, fontWeight: 700 }}>🛂 YOUR VISA STATUS</div>
              <div style={{ display: "flex", gap: 10 }}>
                {["OPT", "STEM OPT", "CPT", "F-1 (Pending OPT)", "H1B Transfer"].map(v => (
                  <button key={v} onClick={() => setProfile(p => ({ ...p, visaStatus: v }))} style={{
                    background: profile.visaStatus === v ? C.visa : C.card,
                    border: `1px solid ${profile.visaStatus === v ? C.visa : C.border}`,
                    color: profile.visaStatus === v ? "#000" : C.muted,
                    cursor: "pointer", fontFamily: MONO, fontSize: 10, padding: "7px 14px", borderRadius: 4,
                  }}>{v}</button>
                ))}
              </div>
              <div style={{ marginTop: 10, fontSize: 10, color: C.muted }}>
                This will be added to your resume tailoring context so Claude highlights visa status appropriately
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              {[
                { key: "targetRoles", label: "Target Roles", ph: "Senior Engineer, Staff Engineer..." },
                { key: "skills", label: "Skills", ph: "React, TypeScript, Node.js..." },
                { key: "locations", label: "Locations", ph: "Remote, New York..." },
                { key: "minSalary", label: "Min Salary ($)", ph: "100000", type: "number" },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 10, color: C.muted, letterSpacing: 1.2, display: "block", marginBottom: 6 }}>
                    {f.label.toUpperCase()}
                  </label>
                  <input type={f.type || "text"} value={profile[f.key]} placeholder={f.ph}
                    onChange={e => setProfile(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`,
                      color: C.text, fontFamily: MONO, fontSize: 12, padding: "9px 12px", borderRadius: 4 }} />
                </div>
              ))}
            </div>

            <div>
              <label style={{ fontSize: 10, color: C.muted, letterSpacing: 1.2, display: "block", marginBottom: 6 }}>
                BASE RESUME <span style={{ color: C.accent }}>(paste your full resume — AI tailors this per job)</span>
              </label>
              <textarea value={profile.resume} onChange={e => setProfile(p => ({ ...p, resume: e.target.value }))}
                style={{ width: "100%", height: 420, background: C.card, border: `1px solid ${C.border}`,
                  color: C.text, fontFamily: MONO, fontSize: 11, padding: 16, borderRadius: 6, lineHeight: 1.75 }} />
            </div>
            <div style={{ marginTop: 8, fontSize: 10, color: C.muted }}>✓ Profile auto-saved to your browser</div>
          </div>
        )}

        {/* ── SETUP ── */}
        {tab === "setup" && (
          <div style={{ maxWidth: 700 }}>
            <div style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Setup Guide</div>
            {[
              {
                step: "1", title: "Deploy to Vercel", color: C.accent2,
                content: `1. Unzip the downloaded project\n2. Create GitHub repo at github.com/new → upload all files\n3. Go to vercel.com → Import repo → Deploy\n4. Your app goes live in ~60 seconds`,
              },
              {
                step: "2", title: "Anthropic API Key (AI Tailoring)", color: C.accent,
                content: `1. Go to console.anthropic.com → API Keys → Create\n2. In Vercel: Settings → Environment Variables\n3. Add: ANTHROPIC_API_KEY = sk-ant-your-key\n\nCost: ~$0.01 per resume tailor`,
              },
              {
                step: "3", title: "RapidAPI Key (Real Job Scraping)", color: C.warn,
                content: `1. Go to rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch\n2. Subscribe FREE (200 searches/month)\n3. Copy your key from the header panel\n4. In Vercel: Add RAPIDAPI_KEY = your-key\n\nAggregates LinkedIn, Indeed, Glassdoor, ZipRecruiter + 20 more`,
              },
              {
                step: "4", title: "H1B Lookup (No Key Needed!)", color: C.visa,
                content: `The H1B lookup uses public USCIS data — no API key required!\n\nData comes from:\n• h1bdata.info — USCIS LCA public disclosure records\n• Updated quarterly with real government data\n\nJust deploy and it works automatically.`,
              },
            ].map(s => (
              <div key={s.step} style={{ background: C.card, border: `1px solid ${C.border}`,
                borderLeft: `3px solid ${s.color}`, borderRadius: 8, padding: 20, marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: s.color,
                    display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, color: "#000" }}>{s.step}</div>
                  <div style={{ fontFamily: DISPLAY, fontSize: 15, fontWeight: 700 }}>{s.title}</div>
                </div>
                <pre style={{ fontFamily: MONO, fontSize: 11, color: C.dim, lineHeight: 1.8, whiteSpace: "pre-wrap", margin: 0 }}>{s.content}</pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Company Search Component ────────────────────────────────────────────────
function CompanyH1BSearch({ h1bCache, h1bLoading, fetchH1B }) {
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState("");

  const handleSearch = () => {
    if (!query.trim()) return;
    setSearched(query.trim());
    fetchH1B(query.trim());
  };

  const result = h1bCache[searched];

  return (
    <div style={{ background: C.card, border: `1px solid ${C.visa}`, borderRadius: 8, padding: 20, marginBottom: 20 }}>
      <div style={{ fontSize: 11, color: C.visa, letterSpacing: 1, marginBottom: 12 }}>SEARCH ANY COMPANY</div>
      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <input value={query} onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSearch()}
          placeholder="e.g. Google, Microsoft, Stripe, Accenture..."
          style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`,
            color: C.text, fontFamily: MONO, fontSize: 12, padding: "9px 12px", borderRadius: 4 }} />
        <button onClick={handleSearch} style={{
          background: C.visa, border: "none", color: "#000", cursor: "pointer",
          fontFamily: MONO, fontSize: 11, padding: "9px 20px", borderRadius: 4, letterSpacing: 1,
        }}>🛂 SEARCH USCIS</button>
      </div>
      {searched && (
        <H1BHistoryPanel
          company={searched}
          h1bData={result}
          loading={h1bLoading[searched]}
          onFetch={() => fetchH1B(searched)}
        />
      )}
    </div>
  );
}
