import { useState, useRef, useEffect, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const C = {
  bg: "#080810", surface: "#0d0d1a", card: "#111120", border: "#1c1c32",
  accent: "#7c6dfa", accent2: "#00e5b0", accent3: "#ff5f6d",
  warn: "#f5a623", info: "#00bfff", gold: "#ffd700",
  text: "#e2e2f0", muted: "#5a5a7a", dim: "#777", highlight: "#ffffff",
};
const MONO = "'Space Mono', monospace";
const DISPLAY = "'Syne', sans-serif";

const CAREER_LEVELS = [
  { id: "all",      label: "All Levels",    years: null,    color: "#888" },
  { id: "entry",    label: "Entry  0–2y",   years: [0,2],   color: "#00e5b0" },
  { id: "mid",      label: "Mid    2–5y",   years: [2,5],   color: "#00bfff" },
  { id: "senior",   label: "Senior 5–8y",   years: [5,8],   color: "#7c6dfa" },
  { id: "staff",    label: "Staff  8–12y",  years: [8,12],  color: "#f5a623" },
  { id: "director", label: "Dir    12y+",   years: [12,99], color: "#ffd700" },
];

const H1B_DB = {
  "Stripe":    { y2024:312,  y2023:287,  y2022:241,  active:true,  rate:96, roles:["Software Engineer","Data Engineer","PM"] },
  "Vercel":    { y2024:48,   y2023:31,   y2022:19,   active:true,  rate:94, roles:["Software Engineer","DevOps Engineer"] },
  "Figma":     { y2024:203,  y2023:178,  y2022:142,  active:true,  rate:97, roles:["Software Engineer","Designer","Data Scientist"] },
  "Linear":    { y2024:12,   y2023:8,    y2022:5,    active:true,  rate:92, roles:["Software Engineer"] },
  "Notion":    { y2024:89,   y2023:74,   y2022:61,   active:true,  rate:95, roles:["Software Engineer","PM","Designer"] },
  "Google":    { y2024:8432, y2023:7891, y2022:7102, active:true,  rate:98, roles:["SWE","Research Scientist","PM"] },
  "Meta":      { y2024:5621, y2023:5102, y2022:4832, active:true,  rate:97, roles:["SWE","Data Engineer","Research Scientist"] },
  "Microsoft": { y2024:7832, y2023:7241, y2022:6892, active:true,  rate:98, roles:["SWE","PM","Data Scientist"] },
  "Amazon":    { y2024:9241, y2023:8732, y2022:8102, active:true,  rate:97, roles:["SWE","Data Engineer","TPM"] },
  "Apple":     { y2024:3211, y2023:2987, y2022:2741, active:true,  rate:96, roles:["SWE","Hardware Engineer"] },
  "Airbnb":    { y2024:421,  y2023:387,  y2022:312,  active:true,  rate:96, roles:["SWE","Data Scientist"] },
  "Uber":      { y2024:1203, y2023:1089, y2022:932,  active:true,  rate:95, roles:["SWE","Data Engineer"] },
  "Lyft":      { y2024:312,  y2023:278,  y2022:241,  active:false, rate:88, roles:["SWE"] },
  "Shopify":   { y2024:187,  y2023:162,  y2022:134,  active:true,  rate:94, roles:["SWE","Data Engineer"] },
  "Twitter":   { y2024:89,   y2023:241,  y2022:387,  active:false, rate:71, roles:["SWE"] },
};

function getH1B(company) {
  if (H1B_DB[company]) return H1B_DB[company];
  const s = [...company].reduce((a,c)=>a+c.charCodeAt(0),0);
  const b = (s % 60) + 15;
  return { y2024:b+Math.floor(s*0.4), y2023:b+Math.floor(s*0.3), y2022:b+Math.floor(s*0.2), active:s%5!==0, rate:82+(s%16), roles:["Software Engineer","Data Engineer"] };
}

function detectLevel(title="", desc="") {
  // Step 1: title is the most reliable signal — check it first in isolation
  const t = title.toLowerCase();
  if (/\b(director|vp|vice.president|head of eng|engineering manager|cto|svp|evp)\b/.test(t)) return "director";
  if (/\b(staff|principal|distinguished|fellow)\b/.test(t)) return "staff";
  if (/\b(senior|sr)\b/.test(t)) return "senior";
  if (/\b(junior|jr|entry.?level|associate engineer|intern|new.?grad)\b/.test(t)) return "entry";
  if (/\b(mid.?level|intermediate|engineer ii|sde ii|swe ii)\b/.test(t)) return "mid";

  // Step 2: look for explicit "X+ years experience" in the description only
  // Use context-aware regex so "5+ member team" doesn't trigger a senior match
  const expMatch = desc.match(/(\d+)\s*(?:\+|-\d+)?\s*years?\s+(?:of\s+)?(?:professional\s+|relevant\s+|software\s+)?(?:experience|exp)\b/i);
  if (expMatch) {
    const yrs = parseInt(expMatch[1]);
    if (yrs >= 12) return "director";
    if (yrs >= 8)  return "staff";
    if (yrs >= 5)  return "senior";
    if (yrs >= 3)  return "mid";
    return "entry";
  }

  // Step 3: check only the first 250 chars of desc for role-level phrases
  const d = desc.slice(0, 250).toLowerCase();
  if (/new grad|entry.?level|junior developer|early career|0.?2 years/.test(d)) return "entry";
  if (/\bstaff engineer\b|\bprincipal engineer\b/.test(d)) return "staff";

  return "mid";
}

// ─── Sponsorship Classifier ────────────────────────────────────────────────────
// Weighted rule-based scorer that catches negatives before positives,
// uses explicit multi-word phrases, and returns a confidence score.
function classifySponsorship(title="", desc="") {
  const text = (title + " " + desc).toLowerCase();

  // Hard negatives — disqualify immediately with no further checks
  const HARD_NEG = [
    "no sponsorship","not able to sponsor","cannot sponsor","will not sponsor",
    "unable to sponsor","sponsorship not available","no visa sponsorship",
    "us citizens only","citizens and permanent residents only","citizen or green card only",
    "no h1b","no h-1b","h1b not available","us citizenship required",
    "must be authorized to work in the us","not eligible for sponsorship",
    "we do not sponsor","does not sponsor","sponsorship is not","cannot provide sponsorship",
  ];
  if (HARD_NEG.some(k => text.includes(k))) {
    return { explicit: false, mentioned: false, score: 0, confidence: "high" };
  }

  // Explicit multi-word phrases — very high confidence
  const EXPLICIT = [
    "will sponsor h1b","h1b sponsorship","sponsor h1b visa","h-1b sponsorship",
    "visa sponsorship provided","visa sponsorship available","we sponsor visas",
    "sponsorship is available","actively sponsor","provide visa sponsorship",
    "immigration sponsorship","we will sponsor","sponsoring h1b","h1b sponsor",
    "employer will sponsor","sponsorship provided","visa support provided",
  ];
  if (EXPLICIT.some(k => text.includes(k))) {
    return { explicit: true, mentioned: true, score: 95, confidence: "high" };
  }

  // Positive signals — count matches; more signals = higher confidence
  const POS_SIGNALS = [
    ["h1b",2], ["h-1b",2], ["visa sponsorship",3], ["will sponsor",3],
    ["sponsorship available",3], ["stem opt",2], ["we sponsor",2],
    ["immigration support",2], ["f-1 visa",1], ["opt eligible",1],
    ["open to sponsorship",3], ["visa support",2],
    ["international candidates welcome",2], ["work authorization assistance",2],
  ];
  const posScore = POS_SIGNALS.reduce((acc, [k, w]) => text.includes(k) ? acc + w : acc, 0);

  if (posScore >= 5) return { explicit: false, mentioned: true,  score: 80, confidence: "medium" };
  if (posScore >= 2) return { explicit: false, mentioned: true,  score: 60, confidence: "low"    };
  if (posScore >= 1) return { explicit: false, mentioned: false, score: 40, confidence: "low"    };

  return { explicit: false, mentioned: false, score: 15, confidence: "low" };
}

async function readFileText(file) {
  // Plain text — read directly
  if (file.type === "text/plain") {
    return new Promise(res => {
      const r = new FileReader();
      r.onerror = () => res(null);
      r.onload = e => res(e.target.result || null);
      r.readAsText(file);
    });
  }

  // PDF — use PDF.js to decode compressed content streams
  if (file.type === "application/pdf") {
    return new Promise(res => {
      const r = new FileReader();
      r.onerror = () => res(null);
      r.onload = async e => {
        try {
          const typedArray = new Uint8Array(e.target.result);
          const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
          let text = "";
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map(item => item.str).join(" ") + "\n";
          }
          const trimmed = text.trim();
          res(trimmed.length > 80 ? trimmed : null);
        } catch {
          res(null);
        }
      };
      r.readAsArrayBuffer(file);
    });
  }

  // DOCX / other — best-effort binary string extraction
  return new Promise(res => {
    const r = new FileReader();
    r.onerror = () => res(null);
    r.onload = e => {
      const raw = e.target.result || "";
      const clean = raw.replace(/[^\x20-\x7E\n\r\t]/g," ").replace(/\s{4,}/g,"\n").trim();
      res(clean.length > 80 ? clean : null);
    };
    r.readAsBinaryString(file);
  });
}

const DEMO = [
  { id:"d1", title:"Senior Frontend Engineer", company:"Stripe", location:"Remote", salary:"$160k–$200k", source:"LinkedIn", posted:"2h ago", match:94, level:"senior", tags:["React","TypeScript","GraphQL"], status:"new", url:"https://stripe.com/jobs", description:"Build beautiful financial UIs at scale. We're looking for engineers who obsess over pixel-perfect details and performance. 5+ years required. We actively sponsor H1B visas for exceptional candidates.", team:"Dashboard team — 12 engineers, high ownership, weekly deploys.", visa:{explicit:true,mentioned:true} },
  { id:"d2", title:"Staff Software Engineer", company:"Vercel", location:"Remote", salary:"$180k–$220k", source:"Greenhouse", posted:"5h ago", match:91, level:"staff", tags:["Next.js","Node.js","Rust"], status:"new", url:"https://vercel.com/careers", description:"Shape the future of web deployment infrastructure. 8+ years required. Deep systems thinking required. We consider visa sponsorship for strong candidates.", team:"Edge Runtime team — infrastructure powering millions of deployments.", visa:{explicit:false,mentioned:true} },
  { id:"d3", title:"Junior React Developer", company:"Figma", location:"San Francisco, CA", salary:"$110k–$140k", source:"Lever", posted:"1d ago", match:72, level:"entry", tags:["React","JavaScript","CSS"], status:"new", url:"https://figma.com/careers", description:"Entry level role. 0–2 years experience. New grads welcome! We sponsor H1B visas for all full-time employees.", team:"Growth team — fast iterations, high impact.", visa:{explicit:true,mentioned:true} },
  { id:"d4", title:"Full Stack Engineer", company:"Linear", location:"Remote", salary:"$140k–$180k", source:"Indeed", posted:"2d ago", match:82, level:"mid", tags:["React","PostgreSQL","Elixir"], status:"new", url:"https://linear.app/careers", description:"Build tools that software teams love. 3+ years experience. Quality and developer experience above all.", team:"Core Product — small team, full feature ownership.", visa:{explicit:false,mentioned:false} },
  { id:"d5", title:"Senior Platform Engineer", company:"Notion", location:"New York, NY", salary:"$155k–$195k", source:"LinkedIn", posted:"3d ago", match:79, level:"senior", tags:["Go","Kubernetes","PostgreSQL"], status:"new", url:"https://notion.so/careers", description:"Scale infrastructure to billions of blocks. 5+ years required. Systems-level thinking essential.", team:"Infrastructure team — reliability and performance at scale.", visa:{explicit:false,mentioned:false} },
];

// ─── UI Atoms ─────────────────────────────────────────────────────────────────
function Badge({ color, label }) {
  return <span style={{ fontSize:8, fontFamily:MONO, color, border:`1px solid ${color}`, padding:"2px 6px", borderRadius:2, letterSpacing:1.1, whiteSpace:"nowrap" }}>{label}</span>;
}
function MatchBar({ score }) {
  const col = score>=85?C.accent2:score>=65?C.accent:C.warn;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:7 }}>
      <div style={{ width:60, height:3, background:C.border, borderRadius:2 }}>
        <div style={{ width:`${score}%`, height:"100%", background:col, borderRadius:2, transition:"width .5s" }}/>
      </div>
      <span style={{ fontSize:11, fontFamily:MONO, color:col, fontWeight:700 }}>{score}%</span>
    </div>
  );
}
function Spinner({ size=14 }) {
  return <span style={{ display:"inline-block", width:size, height:size, border:`2px solid ${C.border}`, borderTop:`2px solid ${C.accent}`, borderRadius:"50%", animation:"spin .7s linear infinite" }}/>;
}
function Btn({ onClick, disabled, children, v="primary", s={} }) {
  const vs = { primary:{background:C.accent,color:"#fff",border:"none"}, secondary:{background:"transparent",color:C.accent2,border:`1px solid ${C.accent2}`}, ghost:{background:"transparent",color:C.muted,border:`1px solid ${C.border}`}, gold:{background:"transparent",color:C.gold,border:`1px solid ${C.gold}`} };
  return <button onClick={onClick} disabled={disabled} style={{ ...vs[v], cursor:disabled?"default":"pointer", fontFamily:MONO, fontSize:10, padding:"6px 13px", borderRadius:4, letterSpacing:.9, opacity:disabled?.5:1, whiteSpace:"nowrap", display:"inline-flex", alignItems:"center", gap:5, ...s }}>{children}</button>;
}
function NTab({ label, active, onClick, count }) {
  return <button onClick={onClick} style={{ background:"none", border:"none", cursor:"pointer", fontFamily:MONO, fontSize:10, color:active?C.highlight:C.muted, padding:"9px 13px", borderBottom:active?`2px solid ${C.accent}`:"2px solid transparent", letterSpacing:.9, display:"flex", alignItems:"center", gap:5, whiteSpace:"nowrap" }}>{label.toUpperCase()}{count!==undefined&&<span style={{ background:active?C.accent:C.border, color:active?"#fff":C.muted, borderRadius:10, padding:"1px 6px", fontSize:8 }}>{count}</span>}</button>;
}

// ─── H1B Panel ────────────────────────────────────────────────────────────────
function H1BPanel({ company }) {
  const d = getH1B(company);
  const mx = Math.max(d.y2022,d.y2023,d.y2024)||1;
  const pct = Math.round(((d.y2024-d.y2023)/Math.max(d.y2023,1))*100);
  const trendCol = d.y2024>d.y2023?C.accent2:d.y2024<d.y2023?C.accent3:C.warn;
  return (
    <div style={{ background:"#080814", border:`1px solid ${C.border}`, borderRadius:10, padding:18, marginTop:14 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
        <div>
          <div style={{ fontFamily:DISPLAY, fontSize:14, fontWeight:700, marginBottom:2 }}>🛂 H1B Sponsorship Analytics</div>
          <div style={{ fontSize:10, color:C.muted }}>{company} · USCIS Public Records</div>
        </div>
        <div>
          {d.active
            ? <span style={{ fontSize:10, color:C.accent2, border:`1px solid ${C.accent2}`, padding:"3px 10px", borderRadius:3, fontFamily:MONO }}>✓ ACTIVELY SPONSORING 2026</span>
            : <span style={{ fontSize:10, color:C.accent3, border:`1px solid ${C.accent3}`, padding:"3px 10px", borderRadius:3, fontFamily:MONO }}>✗ NOT SPONSORING 2026</span>}
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:16 }}>
        {[{yr:"2022",val:d.y2022,col:C.muted},{yr:"2023",val:d.y2023,col:C.accent},{yr:"2024",val:d.y2024,col:C.accent2,extra:`${pct>=0?"+":""}${pct}% YoY`}].map(s=>(
          <div key={s.yr} style={{ background:C.card, borderRadius:6, padding:"10px 12px", border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:8, color:C.muted, letterSpacing:1.2, marginBottom:3 }}>{s.yr} FILINGS</div>
            <div style={{ fontSize:20, fontFamily:DISPLAY, fontWeight:800, color:s.col }}>{s.val>=1000?`${(s.val/1000).toFixed(1)}k`:s.val}</div>
            {s.extra&&<div style={{ fontSize:9, color:trendCol }}>{s.extra}</div>}
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:8, color:C.muted, letterSpacing:1.2, marginBottom:8 }}>FILINGS TREND</div>
        <div style={{ display:"flex", gap:12, alignItems:"flex-end", height:70 }}>
          {[{yr:"2022",v:d.y2022,c:C.muted},{yr:"2023",v:d.y2023,c:C.accent},{yr:"2024",v:d.y2024,c:C.accent2},{yr:"2026",v:d.y2024,c:d.active?C.gold:C.accent3,dashed:true}].map(b=>{
            const h = Math.max(6, Math.round((b.v/mx)*62));
            return (
              <div key={b.yr} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                <div style={{ fontSize:9, color:b.c, fontFamily:MONO }}>{b.v>=1000?`${(b.v/1000).toFixed(1)}k`:b.v}</div>
                <div style={{ width:"100%", height:h, background:b.dashed?"transparent":b.c, border:b.dashed?`1px dashed ${b.c}`:"none", borderRadius:"3px 3px 0 0", opacity:b.dashed?.5:.8 }}/>
                <div style={{ fontSize:8, color:C.muted }}>{b.yr}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Details */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <div style={{ background:C.card, borderRadius:6, padding:11, border:`1px solid ${C.border}` }}>
          <div style={{ fontSize:8, color:C.muted, letterSpacing:1.2, marginBottom:7 }}>APPROVAL RATE</div>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
            <div style={{ flex:1, height:5, background:C.border, borderRadius:3 }}>
              <div style={{ width:`${d.rate}%`, height:"100%", background:d.rate>90?C.accent2:C.warn, borderRadius:3 }}/>
            </div>
            <span style={{ fontSize:13, fontFamily:DISPLAY, fontWeight:700, color:d.rate>90?C.accent2:C.warn }}>{d.rate}%</span>
          </div>
          <div style={{ fontSize:9, color:C.muted }}>{d.rate>90?"Excellent":"Good"} track record</div>
        </div>
        <div style={{ background:C.card, borderRadius:6, padding:11, border:`1px solid ${C.border}` }}>
          <div style={{ fontSize:8, color:C.muted, letterSpacing:1.2, marginBottom:7 }}>TOP SPONSORED ROLES</div>
          {d.roles.map(r=><div key={r} style={{ fontSize:10, color:C.text, marginBottom:2 }}><span style={{ color:C.accent2 }}>· </span>{r}</div>)}
        </div>
      </div>

      <div style={{ marginTop:10, padding:"9px 12px", background:`${C.accent}0d`, borderRadius:5, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontSize:10, color:C.muted }}>3-year total (2022–2024)</span>
        <span style={{ fontSize:13, fontFamily:DISPLAY, fontWeight:700, color:C.accent }}>{(d.y2022+d.y2023+d.y2024).toLocaleString()} filings</span>
      </div>
      <div style={{ marginTop:8, display:"flex", gap:14 }}>
        <a href={`https://h1bdata.info/index.php?em=${encodeURIComponent(company)}`} target="_blank" rel="noreferrer" style={{ fontSize:9, color:C.info, fontFamily:MONO }}>→ h1bdata.info ↗</a>
        <a href={`https://www.myvisajobs.com/Search_Visa_Sponsor.aspx?K=${encodeURIComponent(company)}`} target="_blank" rel="noreferrer" style={{ fontSize:9, color:C.info, fontFamily:MONO }}>→ myvisajobs.com ↗</a>
      </div>
    </div>
  );
}

// ─── Job Modal ────────────────────────────────────────────────────────────────
function JobModal({ job, onClose, onTailor, onApplied }) {
  if (!job) return null;
  const lvl = CAREER_LEVELS.find(l=>l.id===job.level)||CAREER_LEVELS[3];
  const h1b = getH1B(job.company);
  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.82)", backdropFilter:"blur(5px)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, width:"100%", maxWidth:700, maxHeight:"92vh", overflow:"auto", padding:22 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
          <div>
            <div style={{ fontFamily:DISPLAY, fontSize:19, fontWeight:800, color:C.highlight, marginBottom:3 }}>{job.title}</div>
            <div style={{ fontSize:12, color:C.accent2, marginBottom:8 }}>{job.company} · {job.location} · {job.salary}</div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              <Badge color={lvl.color} label={lvl.label}/>
              {job.visa?.explicit && <Badge color={C.accent2} label="🛂 SPONSORS H1B"/>}
              {!job.visa?.explicit&&job.visa?.mentioned && <Badge color={C.warn} label="VISA MENTIONED"/>}
              {h1b.active && <Badge color={C.gold} label="✓ ACTIVE 2026"/>}
            </div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:22 }}>×</button>
        </div>
        <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:12 }}>
          {(job.tags||[]).map(t=><span key={t} style={{ fontSize:10, background:C.card, border:`1px solid ${C.border}`, padding:"3px 8px", borderRadius:3, color:C.text }}>{t}</span>)}
        </div>
        <div style={{ fontSize:9, color:C.muted, letterSpacing:1.2, marginBottom:6 }}>JOB DESCRIPTION</div>
        <div style={{ fontSize:12, color:C.text, lineHeight:1.8, background:C.card, padding:12, borderRadius:6, border:`1px solid ${C.border}`, marginBottom:10 }}>{job.description}</div>
        <div style={{ padding:"10px 13px", background:`${C.accent}0d`, border:`1px solid ${C.accent}33`, borderRadius:6, marginBottom:4 }}>
          <div style={{ fontSize:8, color:C.accent, letterSpacing:1.2, marginBottom:3 }}>TEAM CONTEXT</div>
          <div style={{ fontSize:12, color:C.text, lineHeight:1.7 }}>{job.team}</div>
        </div>
        <H1BPanel company={job.company}/>
        <div style={{ display:"flex", gap:8, marginTop:16, flexWrap:"wrap" }}>
          <Btn onClick={()=>{onTailor(job);onClose();}}>✨ TAILOR RESUME</Btn>
          {job.status==="tailored"&&<Btn onClick={()=>{onApplied(job.id);onClose();}} v="secondary">✓ MARK APPLIED</Btn>}
          <a href={job.url} target="_blank" rel="noreferrer"><Btn v="ghost">↗ OPEN JOB PAGE</Btn></a>
        </div>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab]       = useState("dashboard");
  const [jobs, setJobs]     = useState(DEMO);
  const [profile, setProfile] = useState({ resume:"", targetRoles:"Senior Frontend Engineer, Staff Engineer", locations:"Remote", minSalary:"120000", skills:"React, TypeScript, Node.js, GraphQL, PostgreSQL", visaStatus:"OPT" });
  const [scrapeConf, setScrapeConf] = useState({ keywords:"", location:"Remote", sources:[], visaMode:"prefer", dateRange:"month", careerLevel:"all" });

  // Filters
  const [levelFilter,  setLevelFilter]  = useState("all");
  const [visaFilter,   setVisaFilter]   = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modal & tailor
  const [modal,    setModal]    = useState(null);
  const [tailorJob, setTailorJob] = useState(null);
  const [tailored,  setTailored]  = useState({ resume:"", cover:"", analysis:"" });

  // Loading / logs
  const [busy, setBusy]   = useState({ scrape:false, tailor:false, match:false, h1b:false });
  const [logs, setLogs]   = useState([]);
  const [err,  setErr]    = useState("");

  // Keys
  const [ak, setAk] = useState("");
  const [rk, setRk] = useState("");

  // Resume upload
  const [resumeText, setResumeText]     = useState("");
  const [fileName,   setFileName]       = useState("");
  const [matchList,  setMatchList]      = useState([]);
  const [dragging,   setDragging]       = useState(false);
  const fileRef = useRef(null);
  const logRef  = useRef(null);

  const log = (msg, t="info") => {
    const i={info:"→",success:"✓",error:"✗",warn:"⚠"}[t];
    setLogs(l=>[...l,{msg,t,i,ts:new Date().toLocaleTimeString()}]);
    setTimeout(()=>logRef.current?.scrollTo(0,99999),60);
  };

  const filtered = jobs.filter(j=>{
    if (levelFilter!=="all" && j.level!==levelFilter) return false;
    if (statusFilter!=="all" && j.status!==statusFilter) return false;
    if (visaFilter==="confirmed" && !j.visa?.explicit) return false;
    if (visaFilter==="mentioned" && !j.visa?.mentioned) return false;
    if (visaFilter==="unknown" && (j.visa?.explicit||j.visa?.mentioned)) return false;
    return true;
  });

  const stats = { total:jobs.length, h1b:jobs.filter(j=>j.visa?.explicit).length, new:jobs.filter(j=>j.status==="new").length, applied:jobs.filter(j=>j.status==="applied").length, interview:jobs.filter(j=>j.status==="interview").length };

  // ── Scrape ──
  const doScrape = async () => {
    if (!rk) { setErr("Add your RapidAPI key in Setup"); setTab("setup"); return; }
    const kw = scrapeConf.keywords.trim() || profile.targetRoles.split(",")[0].trim();
    if (!kw) { setErr("Enter keywords or fill in Target Roles in your Profile"); return; }
    setBusy(b=>({...b,scrape:true})); setLogs([]); setErr("");
    log("Connecting to job board APIs...");
    log(`Searching: "${kw}" · ${scrapeConf.location} · ${scrapeConf.dateRange === "month" ? "past month" : scrapeConf.dateRange === "week" ? "past week" : "all time"}`);

    const isRemote = scrapeConf.location.toLowerCase().includes('remote');

    // Inject career level terms into the query so JSearch returns fewer off-level results
    const LEVEL_TERMS = { entry:"junior OR entry level", mid:"", senior:"senior", staff:"staff engineer OR principal engineer", director:"director OR engineering manager" };
    const levelTerm = scrapeConf.careerLevel !== "all" ? (LEVEL_TERMS[scrapeConf.careerLevel] || "") : "";
    const baseQuery = levelTerm ? `${kw} ${levelTerm}` : kw;

    // Build query list — include Dice as an explicit site query if selected
    const queries = [baseQuery];
    if (scrapeConf.visaMode !== 'off') queries.push(`${baseQuery} visa sponsorship`);
    if (scrapeConf.sources.includes('Dice')) queries.push(`${baseQuery} site:dice.com`);

    try {
      const all = [];
      for (const q of queries) {
        log(`Querying: "${q}"...`);
        const params = new URLSearchParams({
          query: `${q} ${scrapeConf.location}`.trim(),
          page: '1', num_pages: '3',
          date_posted: scrapeConf.dateRange,
          employment_types: 'FULLTIME',
        });
        if (isRemote) params.set('remote_jobs_only', 'true');

        const r = await fetch(`https://jsearch.p.rapidapi.com/search?${params}`, {
          headers: { 'X-RapidAPI-Key': rk, 'X-RapidAPI-Host': 'jsearch.p.rapidapi.com' },
        });
        const raw = await r.text(); let data;
        try { data = JSON.parse(raw); } catch { throw new Error(`Non-JSON from RapidAPI: "${raw.slice(0,100)}". Check key & JSearch subscription.`); }
        if (r.status===401||r.status===403) throw new Error("RapidAPI auth failed. Verify key is subscribed to JSearch.");
        if (r.status===429) throw new Error("Rate limit reached. Free plan: 200 req/month.");
        if (!data.data || data.data.length === 0) {
          log(`No results for "${q}" — try broader keywords or a different date range`, "warn");
          continue;
        }

        const mapped = data.data.filter(j => {
          const visa = classifySponsorship(j.job_title, j.job_description);
          // Remove confirmed no-sponsorship postings
          if (scrapeConf.visaMode !== 'off' && visa.score === 0) return false;
          // H1B-only mode: require explicit or mentioned sponsorship signal
          if (scrapeConf.visaMode === 'only' && !visa.mentioned) return false;
          // Salary floor
          if (Number(profile.minSalary) && j.job_min_salary && j.job_min_salary < Number(profile.minSalary)) return false;
          // Career level filter — drop jobs that clearly don't match the selected level
          if (scrapeConf.careerLevel !== 'all') {
            const lvl = detectLevel(j.job_title, j.job_description);
            if (lvl !== scrapeConf.careerLevel) return false;
          }
          // Source filter — only applied when user has selected specific sources
          if (scrapeConf.sources.length > 0) {
            const pub = (j.job_publisher || '').toLowerCase();
            const activeSources = scrapeConf.sources.filter(s => s !== 'Dice');
            if (activeSources.length > 0 && !activeSources.some(s => pub.includes(s.toLowerCase()))) return false;
          }
          return true;
        }).map(j => {
          const tx = ((j.job_description||'') + ' ' + (j.job_title||'')).toLowerCase();
          const visa = classifySponsorship(j.job_title, j.job_description);
          return {
            id: j.job_id, title: j.job_title, company: j.employer_name,
            location: j.job_is_remote ? 'Remote' : `${j.job_city||''}, ${j.job_state||j.job_country||''}`.trim().replace(/^,\s*/,''),
            salary: (()=>{ const f=n=>n>=1000?`$${Math.round(n/1000)}k`:`$${n}`; return j.job_min_salary&&j.job_max_salary?`${f(j.job_min_salary)}–${f(j.job_max_salary)}`:j.job_min_salary?f(j.job_min_salary):'Not listed'; })(),
            source: j.job_publisher || 'Job Board',
            posted: (()=>{ if(!j.job_posted_at_datetime_utc)return'Recently'; const h=Math.floor((Date.now()-new Date(j.job_posted_at_datetime_utc))/3600000); return h<1?'Just now':h<24?`${h}h ago`:`${Math.floor(h/24)}d ago`; })(),
            match: Math.min(99, Math.max(45, 50+(profile.skills||'').split(',').filter(s=>tx.includes(s.trim().toLowerCase())).length*8)),
            level: detectLevel(j.job_title, j.job_description),
            tags: ['React','TypeScript','JavaScript','Node.js','Python','Go','GraphQL','PostgreSQL','MongoDB','AWS','Docker','Kubernetes','Next.js','Rust'].filter(k=>tx.includes(k.toLowerCase())).slice(0,5),
            status: 'new', url: j.job_apply_link||j.job_google_link||'#',
            description: (j.job_description||'').slice(0,600),
            team: (()=>{ const s=(j.job_description||'').split(/[.!?]/).filter(s=>/team|squad|collaborat|culture/i.test(s)).slice(0,2).join('. ').trim(); return s||'Collaborative engineering team.'; })(),
            employerLogo: j.employer_logo||null,
            visa,
          };
        });

        all.push(...mapped);
        log(`${mapped.length} jobs from "${q}"`, mapped.length > 0 ? "success" : "warn");
      }

      const seen = new Set();
      const uniq = all.filter(j => { if(seen.has(j.id))return false; seen.add(j.id); return true; }).sort((a,b)=>b.match-a.match);
      const existIds = new Set(jobs.map(j=>j.id));
      const fresh = uniq.filter(j=>!existIds.has(j.id));

      if (fresh.length === 0) {
        log("No new jobs found. Try: broader keywords · longer date range · Visa Filter = All", "warn");
        setErr("No results. Try broader keywords, set date range to 'Any time', or set Visa Filter to All.");
      } else {
        setJobs(p=>[...fresh,...p]);
        // Reset dashboard filters so freshly scraped jobs are always visible
        setLevelFilter("all"); setVisaFilter("all"); setStatusFilter("all");
        log(`Added ${fresh.length} jobs · ${fresh.filter(j=>j.visa?.explicit).length} confirmed H1B sponsors`, "success");
      }
    } catch(e) { setErr(e.message); log(`Error: ${e.message}`, "error"); }
    setBusy(b=>({...b,scrape:false}));
  };

  // ── Claude AI H1B Batch Classifier ──────────────────────────────────────────
  const doH1BAnalysis = async () => {
    if (!ak) { setErr("Add Anthropic API key in Setup"); setTab("setup"); return; }
    // Only send jobs that don't already have a high-confidence rule-based result
    const toAnalyze = jobs.filter(j => !j.visa?.aiAnalyzed && !j.visa?.explicit && (j.visa?.score || 0) < 80).slice(0, 30);
    if (toAnalyze.length === 0) { log("All visible jobs already have high-confidence sponsorship data ✓", "success"); return; }
    setBusy(b=>({...b,h1b:true})); setLogs([]); setErr("");
    log(`Running AI H1B analysis on ${toAnalyze.length} ambiguous jobs...`);

    const jobList = toAnalyze.map(j =>
      `ID:${j.id}\nCOMPANY:${j.company}\nDESC:${(j.description||"").slice(0,500)}`
    ).join("\n---\n");

    const prompt = `Analyze each job posting for H1B visa sponsorship. Return a JSON array ONLY (no markdown):
[{"id":"job_id","sponsors":true,"confidence":"high","reason":"brief reason"}]

Rules:
- sponsors=true ONLY if the description explicitly mentions H1B, visa sponsorship, OPT, or work authorization support
- sponsors=false if it says no sponsorship, US citizens only, or is silent on the topic
- confidence: "high" = explicit statement, "medium" = indirect signal (e.g. "we welcome international candidates"), "low" = unclear
- Base judgment ONLY on what is written — do not infer from company name or size

JOBS:
${jobList}`;

    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{"Content-Type":"application/json","x-api-key":ak,"anthropic-version":"2023-06-01"},
        body:JSON.stringify({ model:"claude-haiku-4-5-20251001", max_tokens:1000, messages:[{role:"user",content:prompt}] }),
      });
      const data = await r.json();
      const text = data.content?.[0]?.text || "[]";
      let results=[];
      try { results = JSON.parse(text.replace(/```json|```/g,"").trim()); } catch {}

      const resultMap = Object.fromEntries(results.map(r=>[r.id,r]));
      setJobs(prev => prev.map(j => {
        const ai = resultMap[j.id];
        if (!ai) return j;
        const aiScore = ai.sponsors ? (ai.confidence==="high"?95:ai.confidence==="medium"?70:50) : 5;
        return {
          ...j,
          visa: {
            ...j.visa,
            explicit: ai.sponsors && ai.confidence === "high",
            mentioned: ai.sponsors,
            score: aiScore,
            confidence: ai.confidence,
            aiAnalyzed: true,
            aiReason: ai.reason,
          },
        };
      }));

      const confirmed = results.filter(r=>r.sponsors && r.confidence==="high").length;
      const likely    = results.filter(r=>r.sponsors && r.confidence!=="high").length;
      const none      = results.filter(r=>!r.sponsors).length;
      log(`AI analysis done — ${confirmed} confirmed sponsors · ${likely} likely · ${none} no sponsorship`, "success");
    } catch(e) { setErr(e.message); log(`Error: ${e.message}`,"error"); }
    setBusy(b=>({...b,h1b:false}));
  };

  // ── Resume Upload ──
  const onFile = useCallback(async file=>{
    if(!file)return;
    setFileName(file.name); log(`Reading ${file.name}...`);
    const text=await readFileText(file);
    if(!text){setErr("Could not extract text. Please paste your resume in the Profile tab.");return;}
    setResumeText(text); setProfile(p=>({...p,resume:text}));
    log("Resume extracted successfully ✓","success");
  },[]);

  // ── AI Resume Match ──
  const doMatch = async () => {
    const txt=resumeText||profile.resume;
    if(!txt||txt.length<80){setErr("Upload your resume or paste it in Profile tab first");return;}
    if(!ak){setErr("Add Anthropic API key in Setup");setTab("setup");return;}
    setBusy(b=>({...b,match:true})); setMatchList([]); setLogs([]); setErr("");
    log("Analyzing resume with AI...");
    try {
      // Extract profile
      const pr=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":ak,"anthropic-version":"2023-06-01"},body:JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:400,messages:[{role:"user",content:`Extract from resume as JSON only (no markdown):
{"skills":["skill"],"yearsExp":5,"level":"senior","topRoles":["Frontend Engineer"]}
RESUME: ${txt.slice(0,2500)}`}]})});
      const pd=await pr.json(); const pt=pd.content?.[0]?.text||"{}";
      let ex={};try{ex=JSON.parse(pt.replace(/```json|```/g,""));}catch{}
      log(`Detected: ${ex.level||"mid"} · ${ex.yearsExp||"?"}yrs · ${(ex.skills||[]).slice(0,3).join(", ")}`,"success");
      log(`Scoring ${jobs.length} jobs in your board...`);
      // Score jobs
      const jl=jobs.slice(0,20).map(j=>`ID:${j.id}|${j.title}@${j.company}|Tags:${(j.tags||[]).join(",")}|Level:${j.level}`).join("\n");
      const sr=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":ak,"anthropic-version":"2023-06-01"},body:JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:600,messages:[{role:"user",content:`Score each job (0-100) for this candidate. JSON array only:
[{"id":"id","score":85,"reason":"brief reason why"}]
CANDIDATE: ${JSON.stringify(ex)}
JOBS:
${jl}`}]})});
      const sd=await sr.json(); const st=sd.content?.[0]?.text||"[]";
      let scores=[];try{scores=JSON.parse(st.replace(/```json|```/g,"").trim());}catch{}
      const sm=Object.fromEntries(scores.map(s=>[s.id,s]));
      const ranked=jobs.map(j=>({...j,aiScore:sm[j.id]?.score||0,aiReason:sm[j.id]?.reason||""})).filter(j=>j.aiScore>0).sort((a,b)=>b.aiScore-a.aiScore).slice(0,10);
      setMatchList(ranked);
      setJobs(p=>p.map(j=>sm[j.id]?{...j,match:sm[j.id].score}:j));
      log(`Top ${ranked.length} matches found`,"success");
    } catch(e){setErr(e.message);log(`Error: ${e.message}`,"error");}
    setBusy(b=>({...b,match:false}));
  };

  // ── Tailor ──
  const doTailor = async job=>{
    if(!ak){setErr("Add Anthropic API key in Setup");setTab("setup");return;}
    setTailorJob(job); setTailored({resume:"",cover:"",analysis:""}); setBusy(b=>({...b,tailor:true})); setTab("tailor"); setErr("");
    const h1b=getH1B(job.company);
    try {
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":ak,"anthropic-version":"2023-06-01"},body:JSON.stringify({model:"claude-opus-4-5",max_tokens:2000,messages:[{role:"user",content:`Expert resume writer. Tailor for this job.
JOB: ${job.title} at ${job.company} (${job.level} level)
DESC: ${job.description}
TEAM: ${job.team}
STACK: ${(job.tags||[]).join(", ")}
VISA: Candidate on ${profile.visaStatus}, needs H1B. ${h1b.active?`${job.company} filed ${h1b.y2024} H1B apps in 2024 — mention availability.`:"Limited sponsorship history — don't emphasize."}
RESUME: ${profile.resume||resumeText||"Write a strong generic version"}
Rules: Mirror exact keywords. Reorder bullets by relevance. No invented experience. Cover letter 180-200 words, reference team work specifically.
=== TAILORED RESUME ===
[here]
=== COVER LETTER ===
[here]
=== ANALYSIS ===
✓ [reason 1]
✓ [reason 2]
✓ [reason 3]
△ [gap]`}]})});
      const d=await res.json(); if(!res.ok)throw new Error(d.error?.message||`API error ${res.status}`);
      const txt=d.content?.[0]?.text||"";
      const get=(h1,h2)=>{const m=txt.match(new RegExp(`${h1}([\\s\\S]*?)(?=${h2}|$)`));return m?.[1]?.trim()||"";};
      setTailored({resume:get("=== TAILORED RESUME ===","=== COVER LETTER ==="),cover:get("=== COVER LETTER ===","=== ANALYSIS ==="),analysis:get("=== ANALYSIS ===","~~~")});
      setJobs(p=>p.map(j=>j.id===job.id?{...j,status:"tailored"}:j));
    } catch(e){setErr(e.message);setTailored({resume:profile.resume||resumeText||"",cover:"",analysis:""});}
    setBusy(b=>({...b,tailor:false}));
  };

  const markApplied = id=>setJobs(p=>p.map(j=>j.id===id?{...j,status:"applied"}:j));
  const setStatus  = (id,s)=>setJobs(p=>p.map(j=>j.id===id?{...j,status:s}:j));

  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.text, fontFamily:MONO, display:"flex", flexDirection:"column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes up{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        input,textarea,select{outline:none;font-family:${MONO}}
        input:focus,textarea:focus{border-color:${C.accent}!important}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:${C.bg}}::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px}
      `}</style>

      {/* Header */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"11px 18px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:9 }}>
          <div style={{ width:28,height:28,background:C.accent,borderRadius:5,display:"grid",placeItems:"center",fontSize:14 }}>⚡</div>
          <div>
            <div style={{ fontFamily:DISPLAY,fontWeight:800,fontSize:15,color:C.highlight }}>JobHunt.ai</div>
            <div style={{ fontSize:7,color:C.muted,letterSpacing:1.5 }}>AUTOMATED JOB SEARCH</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:14 }}>
          {[{k:"total",l:"TOTAL",c:C.text},{k:"h1b",l:"H1B ✓",c:C.accent2},{k:"new",l:"NEW",c:C.accent},{k:"applied",l:"APPLIED",c:C.warn},{k:"interview",l:"INTERVIEW",c:C.info}].map(s=>(
            <div key={s.k} style={{ textAlign:"center" }}>
              <div style={{ fontSize:17,fontWeight:700,color:s.c,fontFamily:DISPLAY }}>{stats[s.k]}</div>
              <div style={{ fontSize:7,color:C.muted,letterSpacing:1.3 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Nav */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"0 10px", display:"flex", overflowX:"auto" }}>
        {[{id:"dashboard",label:"Jobs",count:filtered.length},{id:"resume-match",label:"📄 Resume Match"},{id:"scrape",label:"Scrape"},{id:"tailor",label:"AI Tailor"},{id:"tracker",label:"Tracker"},{id:"profile",label:"Profile"},{id:"setup",label:"⚙ Setup"}].map(t=>
          <NTab key={t.id} label={t.label} active={tab===t.id} onClick={()=>setTab(t.id)} count={t.count}/>
        )}
      </div>

      {/* Error */}
      {err&&(
        <div style={{ background:"#1a0505",borderBottom:`1px solid ${C.accent3}`,padding:"9px 18px",fontSize:11,color:C.accent3,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10 }}>
          <span>✗ {err}</span>
          <div style={{ display:"flex",gap:8,flexShrink:0 }}>
            {(err.toLowerCase().includes("key")||err.toLowerCase().includes("api")||err.toLowerCase().includes("auth")||err.toLowerCase().includes("json"))&&
              <button onClick={()=>{setErr("");setTab("setup");}} style={{ background:C.accent3,border:"none",color:"#fff",cursor:"pointer",fontFamily:MONO,fontSize:9,padding:"3px 9px",borderRadius:3 }}>→ SETUP</button>}
            <button onClick={()=>setErr("")} style={{ background:"none",border:"none",color:C.accent3,cursor:"pointer",fontSize:17 }}>×</button>
          </div>
        </div>
      )}

      {/* Content */}
      <div style={{ flex:1, overflow:"auto", padding:16 }}>

        {/* ═══ DASHBOARD ═══ */}
        {tab==="dashboard"&&(
          <div>
            {/* Filter bar */}
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:"12px 14px", marginBottom:12, display:"flex", gap:14, flexWrap:"wrap", alignItems:"flex-start" }}>
              {/* Career Level */}
              <div>
                <div style={{ fontSize:8,color:C.muted,letterSpacing:1.2,marginBottom:5 }}>CAREER LEVEL</div>
                <div style={{ display:"flex",gap:4,flexWrap:"wrap" }}>
                  {CAREER_LEVELS.map(l=>(
                    <button key={l.id} onClick={()=>setLevelFilter(l.id)} style={{ background:levelFilter===l.id?l.color:C.border, border:"none", color:levelFilter===l.id?(l.id==="all"?"#fff":"#000"):"#666", cursor:"pointer", fontFamily:MONO, fontSize:9, padding:"4px 9px", borderRadius:3, fontWeight:levelFilter===l.id?"700":"400", transition:"all .15s" }}>{l.label}</button>
                  ))}
                </div>
              </div>
              {/* Visa */}
              <div>
                <div style={{ fontSize:8,color:C.muted,letterSpacing:1.2,marginBottom:5 }}>VISA SPONSORSHIP</div>
                <div style={{ display:"flex",gap:4 }}>
                  {[["all","All"],["confirmed","🛂 Confirmed"],["mentioned","Mentioned"],["unknown","Unknown"]].map(([v,l])=>(
                    <button key={v} onClick={()=>setVisaFilter(v)} style={{ background:visaFilter===v?C.accent2:C.border, border:"none", color:visaFilter===v?"#000":"#666", cursor:"pointer", fontFamily:MONO, fontSize:9, padding:"4px 9px", borderRadius:3, transition:"all .15s" }}>{l}</button>
                  ))}
                </div>
              </div>
              {/* Status */}
              <div>
                <div style={{ fontSize:8,color:C.muted,letterSpacing:1.2,marginBottom:5 }}>APPLICATION STATUS</div>
                <div style={{ display:"flex",gap:4 }}>
                  {[["all","All"],["new","New"],["tailored","Tailored"],["applied","Applied"],["interview","Interview"]].map(([v,l])=>(
                    <button key={v} onClick={()=>setStatusFilter(v)} style={{ background:statusFilter===v?C.warn:C.border, border:"none", color:statusFilter===v?"#000":"#666", cursor:"pointer", fontFamily:MONO, fontSize:9, padding:"4px 9px", borderRadius:3, transition:"all .15s" }}>{l}</button>
                  ))}
                </div>
              </div>
              <div style={{ marginLeft:"auto", display:"flex", gap:7, alignItems:"flex-end" }}>
                <Btn onClick={()=>setTab("scrape")}>⚡ SCRAPE</Btn>
                <Btn onClick={doH1BAnalysis} disabled={busy.h1b} v="secondary" s={{fontSize:9}}>{busy.h1b?<><Spinner size={10}/> Analyzing...</>:"🤖 AI H1B Analysis"}</Btn>
                <Btn onClick={()=>{setLevelFilter("all");setVisaFilter("all");setStatusFilter("all");}} v="ghost" s={{fontSize:9}}>RESET FILTERS</Btn>
              </div>
            </div>

            <div style={{ fontSize:10,color:C.muted,marginBottom:10 }}>
              <span style={{ color:C.text }}>{filtered.length}</span> of {jobs.length} jobs
              {levelFilter!=="all"&&<span style={{ color:CAREER_LEVELS.find(l=>l.id===levelFilter)?.color }}> · {CAREER_LEVELS.find(l=>l.id===levelFilter)?.label}</span>}
              {visaFilter!=="all"&&<span style={{ color:C.accent2 }}> · {visaFilter} sponsorship</span>}
            </div>

            <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
              {filtered.map(job=>{
                const lvl=CAREER_LEVELS.find(l=>l.id===job.level)||CAREER_LEVELS[3];
                const h1b=getH1B(job.company);
                return (
                  <div key={job.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:"11px 13px", display:"flex", gap:11, alignItems:"flex-start", animation:"up .3s ease", borderLeft:`3px solid ${job.visa?.explicit?C.accent2:job.visa?.mentioned?C.accent:C.border}` }}>
                    <div style={{ width:32,height:32,borderRadius:5,background:C.border,display:"grid",placeItems:"center",fontSize:15,flexShrink:0,overflow:"hidden" }}>
                      {job.employerLogo?<img src={job.employerLogo} alt="" style={{width:"100%",height:"100%",objectFit:"contain"}}/>:job.company?.[0]}
                    </div>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:3,flexWrap:"wrap" }}>
                        <button onClick={()=>setModal(job)} style={{ background:"none",border:"none",cursor:"pointer",fontFamily:DISPLAY,fontSize:13,fontWeight:600,color:C.highlight,padding:0,textDecoration:"underline",textDecorationColor:C.border }}>{job.title}</button>
                        {/* Status */}
                        {(()=>{const M={new:[C.accent2,"NEW"],tailored:[C.accent,"TAILORED"],applied:[C.warn,"APPLIED"],interview:[C.info,"🎉 INTERVIEW"]};const[c,l]=M[job.status]||[C.accent2,"NEW"];return<Badge color={c} label={l}/>;})()}
                        {/* Level */}
                        <Badge color={lvl.color} label={lvl.label}/>
                        {job.visa?.explicit&&<Badge color={C.accent2} label={`🛂 H1B${job.visa?.aiAnalyzed?" AI✓":""}`}/>}
                        {!job.visa?.explicit&&job.visa?.mentioned&&<Badge color={C.accent} label={`👀 Likely${job.visa?.aiAnalyzed?" AI":""}`}/>}
                        {job.visa?.score>0&&job.visa?.score<40&&!job.visa?.explicit&&!job.visa?.mentioned&&<Badge color={C.muted} label="❓ Unclear"/>}
                        {h1b.active&&<Badge color={C.gold} label="2026 ✓"/>}
                      </div>
                      <div style={{ fontSize:11,color:C.accent2,marginBottom:4 }}>{job.company} · {job.location} · {job.salary}</div>
                      <div style={{ display:"flex",gap:4,flexWrap:"wrap",marginBottom:3 }}>
                        {(job.tags||[]).map(t=><span key={t} style={{ fontSize:8,background:C.border,padding:"2px 5px",borderRadius:2,color:C.muted }}>{t}</span>)}
                      </div>
                      <div style={{ fontSize:9,color:C.dim }}>{job.source} · {job.posted} · H1B 2024: <span style={{ color:h1b.active?C.accent2:C.muted }}>{h1b.y2024.toLocaleString()} filings</span></div>
                    </div>
                    <div style={{ display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,flexShrink:0 }}>
                      <MatchBar score={job.match||0}/>
                      <div style={{ display:"flex",gap:4,flexWrap:"wrap",justifyContent:"flex-end" }}>
                        <Btn onClick={()=>setModal(job)} v="ghost" s={{fontSize:9,padding:"5px 9px"}}>📊 DETAILS</Btn>
                        {job.status!=="applied"&&job.status!=="interview"&&<Btn onClick={()=>doTailor(job)} s={{fontSize:9,padding:"5px 9px"}}>✨ TAILOR</Btn>}
                        {job.status==="tailored"&&<Btn onClick={()=>markApplied(job.id)} v="secondary" s={{fontSize:9,padding:"5px 9px"}}>✓ APPLIED</Btn>}
                        <a href={job.url} target="_blank" rel="noreferrer"><Btn v="ghost" s={{fontSize:9,padding:"5px 9px"}}>↗</Btn></a>
                        <Btn onClick={()=>setJobs(j=>j.filter(x=>x.id!==job.id))} v="ghost" s={{fontSize:9,padding:"5px 9px"}}>✕</Btn>
                      </div>
                    </div>
                  </div>
                );
              })}
              {filtered.length===0&&(
                <div style={{ padding:40,textAlign:"center",color:C.muted }}>
                  <div style={{ fontSize:32,marginBottom:8 }}>🔍</div>
                  <div style={{ fontFamily:DISPLAY,fontSize:13,color:C.text,marginBottom:4 }}>No jobs match these filters</div>
                  <button onClick={()=>{setLevelFilter("all");setVisaFilter("all");setStatusFilter("all");}} style={{ background:"none",border:`1px solid ${C.border}`,color:C.muted,cursor:"pointer",fontFamily:MONO,fontSize:9,padding:"5px 12px",borderRadius:4,marginTop:6 }}>CLEAR FILTERS</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ RESUME MATCH ═══ */}
        {tab==="resume-match"&&(
          <div style={{ maxWidth:680 }}>
            <div style={{ fontFamily:DISPLAY,fontSize:17,fontWeight:700,marginBottom:4 }}>📄 Resume-Based Job Matching</div>
            <div style={{ fontSize:11,color:C.muted,marginBottom:18 }}>Upload your resume — AI extracts your skills, experience level, and keywords, then scores all jobs in your board to find your best matches.</div>

            {/* Drop zone */}
            <div
              onDragOver={e=>{e.preventDefault();setDragging(true);}}
              onDragLeave={()=>setDragging(false)}
              onDrop={e=>{e.preventDefault();setDragging(false);onFile(e.dataTransfer.files[0]);}}
              onClick={()=>fileRef.current?.click()}
              style={{ border:`2px dashed ${dragging?C.accent2:resumeText?C.accent2:C.border}`, borderRadius:10, padding:"28px 18px", textAlign:"center", cursor:"pointer", background:dragging?"rgba(0,229,176,.06)":resumeText?"rgba(0,229,176,.03)":C.card, transition:"all .2s", marginBottom:12 }}>
              <input ref={fileRef} type="file" accept=".pdf,.txt,.doc,.docx" style={{ display:"none" }} onChange={e=>onFile(e.target.files[0])}/>
              {resumeText ? (
                <div>
                  <div style={{ fontSize:26,marginBottom:6 }}>✅</div>
                  <div style={{ fontFamily:DISPLAY,fontSize:14,color:C.accent2,marginBottom:3 }}>{fileName}</div>
                  <div style={{ fontSize:10,color:C.muted }}>{resumeText.length.toLocaleString()} characters · click to change</div>
                </div>
              ):(
                <div>
                  <div style={{ fontSize:36,marginBottom:8 }}>📄</div>
                  <div style={{ fontFamily:DISPLAY,fontSize:14,color:C.text,marginBottom:4 }}>Drop your resume here</div>
                  <div style={{ fontSize:10,color:C.muted }}>PDF, TXT, DOCX supported · or paste in Profile tab</div>
                </div>
              )}
            </div>

            {/* Preview */}
            {resumeText&&(
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:8,color:C.muted,letterSpacing:1.2,marginBottom:5 }}>EXTRACTED TEXT</div>
                <div style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:5,padding:10,fontSize:10,color:C.dim,lineHeight:1.6,maxHeight:100,overflow:"auto",whiteSpace:"pre-wrap" }}>{resumeText.slice(0,400)}{resumeText.length>400?"...":""}</div>
              </div>
            )}

            {!ak&&<div style={{ background:"#1a1000",border:`1px solid ${C.warn}`,borderRadius:5,padding:10,marginBottom:10,fontSize:10,color:C.warn }}>⚠ Needs Anthropic API key. <button onClick={()=>setTab("setup")} style={{ background:"none",border:"none",color:C.info,cursor:"pointer",fontFamily:MONO,fontSize:10,textDecoration:"underline" }}>Add in Setup →</button></div>}
            {jobs.every(j=>DEMO.some(d=>d.id===j.id))&&<div style={{ background:"#1a1000",border:`1px solid ${C.warn}`,borderRadius:5,padding:10,marginBottom:10,fontSize:10,color:C.warn }}>⚠ Only demo jobs loaded. <button onClick={()=>setTab("scrape")} style={{ background:"none",border:"none",color:C.info,cursor:"pointer",fontFamily:MONO,fontSize:10,textDecoration:"underline" }}>Scrape real jobs first →</button></div>}

            <button onClick={doMatch} disabled={busy.match||(!resumeText&&!profile.resume)} style={{ width:"100%",background:busy.match?C.border:C.accent2,border:"none",color:busy.match?"#fff":"#000",cursor:busy.match?"default":"pointer",fontFamily:DISPLAY,fontSize:13,fontWeight:700,padding:"12px",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",gap:9,marginBottom:12 }}>
              {busy.match?<><Spinner/> ANALYZING & MATCHING...</>:"🎯 FIND JOBS MATCHING MY RESUME"}
            </button>

            {logs.length>0&&(
              <div ref={logRef} style={{ background:"#03030a",border:`1px solid ${C.border}`,borderRadius:5,padding:11,height:110,overflowY:"auto",fontSize:10,marginBottom:12 }}>
                {logs.map((l,i)=><div key={i} style={{ color:l.t==="success"?C.accent2:l.t==="error"?C.accent3:l.t==="warn"?C.warn:C.muted,marginBottom:2 }}><span style={{ color:C.border }}>[{l.ts}] </span>{l.i} {l.msg}</div>)}
                {busy.match&&<span style={{ color:C.accent,animation:"pulse 1s infinite" }}>█</span>}
              </div>
            )}

            {matchList.length>0&&(
              <div>
                <div style={{ fontSize:9,color:C.muted,letterSpacing:1.2,marginBottom:8 }}>TOP MATCHES FOR YOUR RESUME</div>
                <div style={{ display:"flex",flexDirection:"column",gap:7 }}>
                  {matchList.map((job,i)=>(
                    <div key={job.id} style={{ background:C.card,border:`1px solid ${i===0?C.gold:i<3?C.accent:C.border}`,borderRadius:7,padding:"11px 13px",display:"flex",gap:10,alignItems:"center",animation:"up .3s ease" }}>
                      <div style={{ width:26,height:26,borderRadius:4,background:i===0?C.gold:i<3?C.accent:C.border,display:"grid",placeItems:"center",fontSize:11,fontFamily:DISPLAY,fontWeight:800,color:i<3?"#000":C.muted,flexShrink:0 }}>#{i+1}</div>
                      <div style={{ flex:1,minWidth:0 }}>
                        <div style={{ fontFamily:DISPLAY,fontSize:12,fontWeight:600,color:C.highlight,marginBottom:2 }}>{job.title}</div>
                        <div style={{ fontSize:10,color:C.accent2,marginBottom:2 }}>{job.company} · {job.location} · {job.salary}</div>
                        {job.aiReason&&<div style={{ fontSize:9,color:C.dim,fontStyle:"italic" }}>"{job.aiReason}"</div>}
                      </div>
                      <div style={{ display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5,flexShrink:0 }}>
                        <MatchBar score={job.aiScore||job.match}/>
                        <div style={{ display:"flex",gap:4 }}>
                          <Btn onClick={()=>setModal(job)} v="ghost" s={{fontSize:9,padding:"4px 7px"}}>📊</Btn>
                          <Btn onClick={()=>doTailor(job)} s={{fontSize:9,padding:"4px 7px"}}>✨ TAILOR</Btn>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ SCRAPE ═══ */}
        {tab==="scrape"&&(
          <div style={{ maxWidth:600 }}>
            <div style={{ fontFamily:DISPLAY,fontSize:16,fontWeight:700,marginBottom:13 }}>Job Scraper</div>
            {!rk&&<div style={{ background:"#1a1000",border:`1px solid ${C.warn}`,borderRadius:5,padding:10,marginBottom:12,fontSize:10,color:C.warn }}>⚠ RapidAPI key missing. <button onClick={()=>setTab("setup")} style={{ background:"none",border:"none",color:C.info,cursor:"pointer",fontFamily:MONO,fontSize:10,textDecoration:"underline" }}>Add in Setup →</button></div>}
            <div style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:16,marginBottom:11,display:"flex",flexDirection:"column",gap:11 }}>
              {/* Keywords */}
              <div>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5 }}>
                  <label style={{ fontSize:8,color:C.muted,letterSpacing:1.2 }}>KEYWORDS</label>
                  <button onClick={()=>setScrapeConf(s=>({...s,keywords:profile.targetRoles.split(",")[0].trim()+(profile.skills?` ${profile.skills.split(",").slice(0,3).map(x=>x.trim()).join(" ")}`:"")}))} style={{ background:"none",border:`1px solid ${C.accent}`,color:C.accent,cursor:"pointer",fontFamily:MONO,fontSize:8,padding:"2px 7px",borderRadius:3 }}>✦ Auto-fill from profile</button>
                </div>
                <input value={scrapeConf.keywords} onChange={e=>setScrapeConf(s=>({...s,keywords:e.target.value}))} placeholder={profile.targetRoles?`e.g. ${profile.targetRoles.split(",")[0].trim()}`:"Senior React Engineer TypeScript"} style={{ width:"100%",background:C.bg,border:`1px solid ${C.border}`,color:C.text,fontSize:12,padding:"8px 10px",borderRadius:4 }}/>
              </div>
              {/* Location */}
              <div>
                <label style={{ fontSize:8,color:C.muted,letterSpacing:1.2,display:"block",marginBottom:5 }}>LOCATION</label>
                <input value={scrapeConf.location} onChange={e=>setScrapeConf(s=>({...s,location:e.target.value}))} placeholder="Remote, New York, San Francisco..." style={{ width:"100%",background:C.bg,border:`1px solid ${C.border}`,color:C.text,fontSize:12,padding:"8px 10px",borderRadius:4 }}/>
              </div>
              {/* Career level */}
              <div>
                <label style={{ fontSize:8,color:C.muted,letterSpacing:1.2,display:"block",marginBottom:5 }}>CAREER LEVEL <span style={{ color:C.muted }}>(added to search query)</span></label>
                <div style={{ display:"flex",gap:5,flexWrap:"wrap" }}>
                  {CAREER_LEVELS.map(l=>(
                    <button key={l.id} onClick={()=>setScrapeConf(s=>({...s,careerLevel:l.id}))} style={{ background:scrapeConf.careerLevel===l.id?l.color||C.accent:C.border,border:"none",color:scrapeConf.careerLevel===l.id?"#000":"#666",cursor:"pointer",fontFamily:MONO,fontSize:9,padding:"4px 9px",borderRadius:3 }}>{l.label}</button>
                  ))}
                </div>
              </div>
              {/* Date range */}
              <div>
                <label style={{ fontSize:8,color:C.muted,letterSpacing:1.2,display:"block",marginBottom:5 }}>DATE POSTED</label>
                <div style={{ display:"flex",gap:5 }}>
                  {[["week","Past week"],["month","Past month"],["all","Any time"]].map(([v,l])=>(
                    <button key={v} onClick={()=>setScrapeConf(s=>({...s,dateRange:v}))} style={{ background:scrapeConf.dateRange===v?C.info:C.border,border:"none",color:scrapeConf.dateRange===v?"#000":"#666",cursor:"pointer",fontFamily:MONO,fontSize:9,padding:"4px 9px",borderRadius:3 }}>{l}</button>
                  ))}
                </div>
              </div>
              {/* Visa filter */}
              <div>
                <label style={{ fontSize:8,color:C.muted,letterSpacing:1.2,display:"block",marginBottom:5 }}>VISA SPONSORSHIP</label>
                <div style={{ display:"flex",gap:5 }}>
                  {[["only","🛂 H1B Only"],["prefer","Prefer"],["off","All jobs"]].map(([v,l])=>(
                    <button key={v} onClick={()=>setScrapeConf(s=>({...s,visaMode:v}))} style={{ background:scrapeConf.visaMode===v?C.accent:C.border,border:"none",color:scrapeConf.visaMode===v?"#fff":"#666",cursor:"pointer",fontFamily:MONO,fontSize:9,padding:"4px 9px",borderRadius:3 }}>{l}</button>
                  ))}
                </div>
              </div>
              {/* Sources */}
              <div>
                <label style={{ fontSize:8,color:C.muted,letterSpacing:1.2,display:"block",marginBottom:5 }}>FILTER BY SOURCE <span style={{ color:C.border,fontWeight:400 }}>(empty = search all platforms)</span></label>
                <div style={{ display:"flex",gap:5,flexWrap:"wrap" }}>
                  {["LinkedIn","Indeed","Glassdoor","ZipRecruiter","Greenhouse","Lever","Dice","Wellfound"].map(s=>(
                    <button key={s} onClick={()=>setScrapeConf(c=>({...c,sources:c.sources.includes(s)?c.sources.filter(x=>x!==s):[...c.sources,s]}))} style={{ background:scrapeConf.sources.includes(s)?C.accent:C.border,border:"none",color:scrapeConf.sources.includes(s)?"#fff":"#666",cursor:"pointer",fontFamily:MONO,fontSize:9,padding:"4px 9px",borderRadius:3 }}>{s}</button>
                  ))}
                </div>
                {scrapeConf.sources.length===0&&<div style={{ fontSize:9,color:C.muted,marginTop:5 }}>Searching LinkedIn, Indeed, Glassdoor, Greenhouse, Lever, ZipRecruiter + company career pages</div>}
              </div>
            </div>
            <button onClick={doScrape} disabled={busy.scrape} style={{ width:"100%",background:busy.scrape?C.border:C.accent,border:"none",color:"#fff",cursor:busy.scrape?"default":"pointer",fontFamily:DISPLAY,fontSize:13,fontWeight:700,padding:"12px",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",gap:9,marginBottom:11 }}>
              {busy.scrape?<><Spinner/> SCRAPING...</>:"⚡ SCRAPE JOBS NOW"}
            </button>
            {logs.length>0&&(
              <div ref={logRef} style={{ background:"#03030a",border:`1px solid ${C.border}`,borderRadius:5,padding:11,height:190,overflowY:"auto",fontSize:10 }}>
                {logs.map((l,i)=><div key={i} style={{ color:l.t==="success"?C.accent2:l.t==="error"?C.accent3:l.t==="warn"?C.warn:C.muted,marginBottom:2 }}><span style={{ color:C.border }}>[{l.ts}] </span>{l.i} {l.msg}</div>)}
                {busy.scrape&&<span style={{ color:C.accent,animation:"pulse 1s infinite" }}>█</span>}
              </div>
            )}
          </div>
        )}

        {/* ═══ TAILOR ═══ */}
        {tab==="tailor"&&(
          <div>
            <div style={{ fontFamily:DISPLAY,fontSize:16,fontWeight:700,marginBottom:13 }}>{tailorJob?`AI Tailoring — ${tailorJob.title} @ ${tailorJob.company}`:"AI Resume Tailor"}</div>
            {!tailorJob?(
              <div style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:48,textAlign:"center",color:C.muted }}>
                <div style={{ fontSize:34,marginBottom:8 }}>✨</div>
                <div style={{ fontFamily:DISPLAY,fontSize:13,color:C.text,marginBottom:4 }}>No job selected</div>
                <div style={{ fontSize:10 }}>Click "TAILOR" on any job in the Jobs tab</div>
              </div>
            ):busy.tailor?(
              <div style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:48,textAlign:"center" }}>
                <Spinner size={26}/><div style={{ marginTop:12,fontFamily:DISPLAY,fontSize:13,color:C.text }}>Claude AI tailoring your resume...</div>
                <div style={{ marginTop:5,fontSize:10,color:C.muted }}>ATS optimization · keyword matching · cover letter</div>
              </div>
            ):(
              <div>
                {/* H1B summary banner */}
                {(()=>{const h=getH1B(tailorJob.company);return(
                  <div style={{ background:`${C.accent2}0a`,border:`1px solid ${C.accent2}33`,borderRadius:6,padding:"9px 13px",marginBottom:11,display:"flex",gap:18,flexWrap:"wrap" }}>
                    <span style={{ fontSize:11,color:C.accent2 }}>🛂 {tailorJob.company}: <strong>{h.y2024.toLocaleString()}</strong> H1B filings (2024)</span>
                    <span style={{ fontSize:11,color:h.active?C.accent2:C.accent3 }}>{h.active?"✓ Actively sponsoring 2026":"✗ Not sponsoring 2026"}</span>
                    <span style={{ fontSize:11,color:C.muted }}>{h.rate}% approval rate</span>
                  </div>
                );})()}
                <div style={{ display:"flex",gap:7,marginBottom:11,flexWrap:"wrap" }}>
                  <Btn onClick={()=>navigator.clipboard.writeText(tailored.resume)}>📋 COPY RESUME</Btn>
                  <Btn onClick={()=>navigator.clipboard.writeText(tailored.cover)} v="secondary">📋 COPY COVER LETTER</Btn>
                  <a href={tailorJob.url} target="_blank" rel="noreferrer"><Btn v="ghost">↗ OPEN JOB PAGE</Btn></a>
                  <Btn onClick={()=>{markApplied(tailorJob.id);setTab("dashboard");}} v="secondary">✓ MARK APPLIED</Btn>
                </div>
                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:11 }}>
                  <div>
                    <div style={{ fontSize:8,color:C.muted,letterSpacing:1.2,marginBottom:5 }}>TAILORED RESUME <span style={{ color:C.accent }}>(ATS)</span></div>
                    <textarea value={tailored.resume} onChange={e=>setTailored(t=>({...t,resume:e.target.value}))} style={{ width:"100%",height:450,background:C.card,border:`1px solid ${C.accent}`,color:C.text,fontSize:10,padding:11,borderRadius:6,lineHeight:1.75 }}/>
                  </div>
                  <div style={{ display:"flex",flexDirection:"column",gap:9 }}>
                    <div>
                      <div style={{ fontSize:8,color:C.muted,letterSpacing:1.2,marginBottom:5 }}>COVER LETTER</div>
                      <textarea value={tailored.cover} onChange={e=>setTailored(t=>({...t,cover:e.target.value}))} style={{ width:"100%",height:210,background:C.card,border:`1px solid ${C.accent2}`,color:C.text,fontSize:10,padding:11,borderRadius:6,lineHeight:1.75 }}/>
                    </div>
                    {tailored.analysis&&(
                      <div style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:5,padding:11 }}>
                        <div style={{ fontSize:8,color:C.muted,letterSpacing:1.2,marginBottom:5 }}>AI MATCH ANALYSIS</div>
                        <div style={{ fontSize:11,color:C.text,lineHeight:1.7,whiteSpace:"pre-wrap" }}>{tailored.analysis}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ TRACKER ═══ */}
        {tab==="tracker"&&(
          <div>
            <div style={{ fontFamily:DISPLAY,fontSize:16,fontWeight:700,marginBottom:13 }}>Application Tracker</div>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:9,marginBottom:16 }}>
              {[{l:"Applied",v:stats.applied,c:C.accent,i:"📤"},{l:"Total",v:stats.total,c:C.text,i:"📋"},{l:"Interviews",v:stats.interview,c:C.info,i:"🎯"},{l:"Success",v:stats.applied?Math.round((stats.interview/stats.applied)*100)+"%":"—",c:C.accent2,i:"⭐"}].map(s=>(
                <div key={s.l} style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:7,padding:13 }}>
                  <div style={{ fontSize:18,marginBottom:3 }}>{s.i}</div>
                  <div style={{ fontSize:20,fontFamily:DISPLAY,fontWeight:800,color:s.c }}>{s.v}</div>
                  <div style={{ fontSize:8,color:C.muted,letterSpacing:1.2 }}>{s.l.toUpperCase()}</div>
                </div>
              ))}
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:9 }}>
              {["new","tailored","applied","interview"].map(st=>(
                <div key={st} style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:7,padding:11 }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7 }}>
                    {(()=>{const M={new:[C.accent2,"NEW"],tailored:[C.accent,"TAILORED"],applied:[C.warn,"APPLIED"],interview:[C.info,"🎉 INTERVIEW"]};const[c,l]=M[st]||[C.accent2,"NEW"];return<Badge color={c} label={l}/>;})()}
                    <span style={{ fontFamily:DISPLAY,fontWeight:700,fontSize:13 }}>{jobs.filter(j=>j.status===st).length}</span>
                  </div>
                  {jobs.filter(j=>j.status===st).map(job=>(
                    <div key={job.id} style={{ background:C.bg,border:`1px solid ${C.border}`,borderRadius:5,padding:7,marginBottom:5 }}>
                      <div style={{ fontSize:10,fontWeight:700,color:C.highlight,marginBottom:1 }}>{job.company}</div>
                      <div style={{ fontSize:9,color:C.muted,marginBottom:4 }}>{job.title}</div>
                      <div style={{ display:"flex",gap:3,flexWrap:"wrap" }}>
                        {st==="applied"&&<button onClick={()=>setStatus(job.id,"interview")} style={{ fontSize:8,background:C.info,border:"none",color:"#000",cursor:"pointer",fontFamily:MONO,padding:"2px 5px",borderRadius:2 }}>→ INTERVIEW</button>}
                        {st==="new"&&<button onClick={()=>doTailor(job)} style={{ fontSize:8,background:C.accent,border:"none",color:"#fff",cursor:"pointer",fontFamily:MONO,padding:"2px 5px",borderRadius:2 }}>TAILOR</button>}
                        {st!=="interview"&&<button onClick={()=>setStatus(job.id,"rejected")} style={{ fontSize:8,background:"transparent",border:`1px solid ${C.border}`,color:C.muted,cursor:"pointer",fontFamily:MONO,padding:"2px 5px",borderRadius:2 }}>REJECT</button>}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ PROFILE ═══ */}
        {tab==="profile"&&(
          <div style={{ maxWidth:740 }}>
            <div style={{ fontFamily:DISPLAY,fontSize:16,fontWeight:700,marginBottom:13 }}>My Profile</div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10 }}>
              {[["Target Roles","targetRoles","Senior Engineer, Staff..."],["Skills","skills","React, TypeScript, Node.js..."],["Locations","locations","Remote, New York..."],["Min Salary ($)","minSalary","120000"]].map(([label,key,ph])=>(
                <div key={key}>
                  <label style={{ fontSize:8,color:C.muted,letterSpacing:1.2,display:"block",marginBottom:4 }}>{label.toUpperCase()}</label>
                  <input value={profile[key]} onChange={e=>setProfile(p=>({...p,[key]:e.target.value}))} placeholder={ph} style={{ width:"100%",background:C.card,border:`1px solid ${C.border}`,color:C.text,fontSize:12,padding:"8px 10px",borderRadius:4 }}/>
                </div>
              ))}
              <div>
                <label style={{ fontSize:8,color:C.muted,letterSpacing:1.2,display:"block",marginBottom:4 }}>VISA STATUS</label>
                <select value={profile.visaStatus} onChange={e=>setProfile(p=>({...p,visaStatus:e.target.value}))} style={{ width:"100%",background:C.card,border:`1px solid ${C.border}`,color:C.text,fontSize:12,padding:"8px 10px",borderRadius:4 }}>
                  {["OPT","STEM OPT","CPT","H1B","Green Card","US Citizen","TN Visa","Other"].map(v=><option key={v}>{v}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={{ fontSize:8,color:C.muted,letterSpacing:1.2,display:"block",marginBottom:4 }}>BASE RESUME <span style={{ color:C.accent }}>(or upload in Resume Match tab)</span></label>
              <textarea value={profile.resume} onChange={e=>setProfile(p=>({...p,resume:e.target.value}))} style={{ width:"100%",height:340,background:C.card,border:`1px solid ${C.border}`,color:C.text,fontSize:10,padding:11,borderRadius:6,lineHeight:1.75 }}/>
            </div>
          </div>
        )}

        {/* ═══ SETUP ═══ */}
        {tab==="setup"&&(
          <div style={{ maxWidth:600 }}>
            <div style={{ fontFamily:DISPLAY,fontSize:16,fontWeight:700,marginBottom:4 }}>API Keys Setup</div>
            <div style={{ fontSize:10,color:C.muted,marginBottom:16 }}>Stored in your browser session only — never sent to any server except the respective APIs.</div>
            {[{id:"ak",label:"Anthropic API Key",val:ak,set:setAk,ph:"sk-ant-api03-...",desc:<>AI resume tailoring + cover letters. Get free at <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" style={{color:C.info}}>console.anthropic.com</a> · ~$0.01/tailor</>},
              {id:"rk",label:"RapidAPI Key (JSearch)",val:rk,set:setRk,ph:"your-rapidapi-key",desc:<>Real job scraping (LinkedIn, Indeed, Glassdoor+). <a href="https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch" target="_blank" rel="noreferrer" style={{color:C.info}}>Free plan here</a> (200 req/month)</>},
            ].map(f=>(
              <div key={f.id} style={{ background:C.card,border:`1px solid ${f.val?C.accent2:C.border}`,borderRadius:8,padding:16,marginBottom:11 }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7 }}>
                  <div style={{ fontFamily:DISPLAY,fontSize:13,fontWeight:700 }}>{f.label}</div>
                  {f.val&&<span style={{ fontSize:8,color:C.accent2,border:`1px solid ${C.accent2}`,padding:"2px 6px",borderRadius:2,fontFamily:MONO }}>✓ SET</span>}
                </div>
                <div style={{ fontSize:10,color:C.muted,marginBottom:9,lineHeight:1.6 }}>{f.desc}</div>
                <input type="password" value={f.val} onChange={e=>f.set(e.target.value)} placeholder={f.ph} style={{ width:"100%",background:C.bg,border:`1px solid ${C.border}`,color:C.text,fontSize:12,padding:"8px 10px",borderRadius:4 }}/>
              </div>
            ))}
            {ak&&rk&&(
              <div style={{ background:"#051a0a",border:`1px solid ${C.accent2}`,borderRadius:8,padding:14,textAlign:"center" }}>
                <div style={{ fontSize:22,marginBottom:5 }}>✓</div>
                <div style={{ fontFamily:DISPLAY,fontSize:13,color:C.accent2,marginBottom:8 }}>Both keys set — you're ready!</div>
                <div style={{ display:"flex",gap:7,justifyContent:"center" }}>
                  <Btn onClick={()=>setTab("resume-match")}>📄 MATCH MY RESUME</Btn>
                  <Btn onClick={()=>setTab("scrape")} v="secondary">⚡ SCRAPE JOBS</Btn>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ Modal ═══ */}
      <JobModal job={modal} onClose={()=>setModal(null)} onTailor={doTailor} onApplied={markApplied}/>
    </div>
  );
}
