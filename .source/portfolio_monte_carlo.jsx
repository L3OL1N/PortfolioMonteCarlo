import { useState, useCallback } from "react";
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea
} from "recharts";

const ASSETS = [
  { key: "us",          label: "US Stocks",       ret: 0.100, std: 0.170, color: "#2563eb" },
  { key: "cash",        label: "Cash",             ret: 0.020, std: 0.010, color: "#6b7280" },
  { key: "allianztech", label: "安聯台灣科技基金",  ret: 0.200, std: 0.380, color: "#7c3aed" },
  { key: "gold",        label: "黃金",              ret: 0.060, std: 0.160, color: "#ca8a04" },
  { key: "farmland",    label: "農地",              ret: 0.070, std: 0.080, color: "#15803d" },
];
// Correlation matrix order: us, cash, allianztech, gold, farmland
// 安聯台灣科技基金: 5yr CAGR ~34%, annual σ ~38% (from 2021-2025 data)
// Correlations revised: US↔安聯 0.72 (deep tech supply chain link),
//   US↔Gold -0.05, 安聯↔Gold -0.08 (risk-on vs safe-haven)
const COR = [
  [ 1.00,  0.00,  0.72, -0.05,  0.10],
  [ 0.00,  1.00,  0.00,  0.00,  0.00],
  [ 0.72,  0.00,  1.00, -0.08,  0.05],
  [-0.05,  0.00, -0.08,  1.00,  0.10],
  [ 0.10,  0.00,  0.05,  0.10,  1.00],
];

function cholesky(mat) {
  const n = mat.length;
  const L = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = 0; j <= i; j++) {
      let s = 0;
      for (let k = 0; k < j; k++) s += L[i][k] * L[j][k];
      L[i][j] = i === j ? Math.sqrt(Math.max(0, mat[i][i] - s)) : (mat[i][j] - s) / L[j][j];
    }
  return L;
}
function randn() {
  let u, v;
  do { u = Math.random(); v = Math.random(); } while (u === 0);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function portfolioMoments(weights) {
  let mu = 0;
  for (let i = 0; i < ASSETS.length; i++) mu += weights[i] * ASSETS[i].ret;
  let variance = 0;
  for (let i = 0; i < ASSETS.length; i++)
    for (let j = 0; j < ASSETS.length; j++)
      variance += weights[i] * weights[j] * COR[i][j] * ASSETS[i].std * ASSETS[j].std;
  return { mu, sigma: Math.sqrt(Math.max(0, variance)) };
}

const PRESETS = [
  { id: "none",        label: "No Preset",              autocorr: 0,    crashes: [] },
  { id: "2008",        label: "2008 Financial Crisis",   autocorr: 0.15, crashes: [{ year: 1, magnitude: -37, probability: 100, recoveryYears: 3 }] },
  { id: "dotcom",      label: "Dot-com Bust (2000–02)",  autocorr: 0.20, crashes: [{ year: 1, magnitude: -22, probability: 100, recoveryYears: 1 }, { year: 2, magnitude: -13, probability: 100, recoveryYears: 1 }, { year: 3, magnitude: -24, probability: 100, recoveryYears: 2 }] },
  { id: "depression",  label: "Great Depression",        autocorr: 0.30, crashes: [{ year: 1, magnitude: -43, probability: 100, recoveryYears: 1 }, { year: 2, magnitude: -9, probability: 100, recoveryYears: 1 }, { year: 3, magnitude: -26, probability: 100, recoveryYears: 5 }] },
  { id: "stagflation", label: "1970s Stagflation",       autocorr: 0.35, crashes: [] },
  { id: "bear",        label: "Random Bear Market",      autocorr: 0.10, crashes: [{ year: 3, magnitude: -28, probability: 40, recoveryYears: 2 }] },
];

function simulate(stages, initial, numSims, inflation, seqRisk) {
  const { autocorr, crashes } = seqRisk;
  const totalYears = stages.reduce((s, st) => s + st.years, 0);
  const yearVals = Array.from({ length: totalYears + 1 }, () => new Array(numSims).fill(0));
  const stageMoments = stages.map(st => portfolioMoments(ASSETS.map(a => st.alloc[a.key])));

  for (let sim = 0; sim < numSims; sim++) {
    let val = initial;
    yearVals[0][sim] = val;
    let yi = 0;
    let z_prev = 0;

    const activeCrashes = {};
    const recoveryMap = {};
    for (const c of crashes) {
      if (Math.random() * 100 < c.probability) {
        activeCrashes[c.year] = c;
        const boost = Math.abs(c.magnitude / 100) / Math.max(1, c.recoveryYears);
        for (let r = 1; r <= c.recoveryYears; r++)
          recoveryMap[c.year + r] = (recoveryMap[c.year + r] || 0) + boost;
      }
    }

    for (let stIdx = 0; stIdx < stages.length; stIdx++) {
      const { mu, sigma } = stageMoments[stIdx];
      const muReal = (1 + mu) / (1 + inflation) - 1;
      for (let y = 0; y < stages[stIdx].years; y++) {
        yi++;
        if (val > 0 || stages[stIdx].cf > 0) {
          let ret;
          if (activeCrashes[yi]) {
            ret = activeCrashes[yi].magnitude / 100;
            z_prev = (ret - muReal) / Math.max(sigma, 0.001);
          } else {
            const z_t = autocorr * z_prev + Math.sqrt(1 - autocorr * autocorr) * randn();
            z_prev = z_t;
            ret = muReal + sigma * z_t + (recoveryMap[yi] || 0);
          }
          val = Math.max(0, val * (1 + ret) + stages[stIdx].cf);
        }
        yearVals[yi][sim] = val;
      }
    }
  }

  const pct = (s, p) => s[Math.max(0, Math.min(s.length - 1, Math.floor(s.length * p)))];
  const chartData = yearVals.map((vals, y) => {
    const s = [...vals].sort((a, b) => a - b);
    const [p10, p25, p50, p75, p90] = [0.10, 0.25, 0.50, 0.75, 0.90].map(p => Math.round(pct(s, p)));
    return { year: y, base: p10, lo: Math.max(0, p25 - p10), mid: Math.max(0, p75 - p25), hi: Math.max(0, p90 - p75), p10, p25, p50, p75, p90 };
  });

  const stageEnds = [];
  let cum = 0;
  for (let i = 0; i < stages.length - 1; i++) { cum += stages[i].years; stageEnds.push({ x: cum, name: stages[i + 1].name }); }

  const sf = [...yearVals[totalYears]].sort((a, b) => a - b);
  let ruinCount = 0;
  for (let sim = 0; sim < numSims; sim++)
    for (let y = 1; y <= totalYears; y++)
      if (yearVals[y][sim] === 0) { ruinCount++; break; }

  return {
    chartData, stageEnds,
    success: (yearVals[totalYears].filter(v => v > 0).length / numSims * 100).toFixed(1),
    ruinRate: (ruinCount / numSims * 100).toFixed(1),
    p10: pct(sf, 0.10), p25: pct(sf, 0.25), p50: pct(sf, 0.50), p75: pct(sf, 0.75), p90: pct(sf, 0.90),
    crashYears: crashes.filter(c => c.probability >= 50).map(c => c.year),
  };
}

const fmt = (v) => { if (v == null) return "–"; if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`; if (v >= 1e3) return `$${Math.round(v / 1e3)}K`; return `$${Math.round(v)}`; };
const allocTotal = (a) => ASSETS.reduce((s, x) => s + Number(a[x.key]), 0);
const makeStage = (name, years, cf, alloc) => ({ id: Math.random().toString(36).slice(2), name, years, cf, alloc: { ...alloc } });
const makeCrash = (year = 1, magnitude = -30, probability = 100, recoveryYears = 2) => ({ id: Math.random().toString(36).slice(2), year, magnitude, probability, recoveryYears });
const PHASE_COLS = ["#2563eb", "#16a34a", "#d97706", "#db2777", "#7c3aed", "#0891b2"];

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 14px", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,.1)" }}>
      <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 13 }}>Year {d.year}</div>
      {[["90th", d.p90, "#15803d"], ["75th", d.p75, "#4d7c0f"], ["Median", d.p50, "#1d4ed8"], ["25th", d.p25, "#c2410c"], ["10th", d.p10, "#b91c1c"]].map(([l, v, c]) => (
        <div key={l} style={{ display: "flex", justifyContent: "space-between", gap: 20, color: c, lineHeight: 1.9 }}>
          <span>{l}</span><span style={{ fontWeight: 700 }}>{fmt(v)}</span>
        </div>
      ))}
    </div>
  );
};

function AutocorrMeter({ value }) {
  const c = value === 0 ? "#9ca3af" : value < 0.15 ? "#2563eb" : value < 0.25 ? "#d97706" : "#dc2626";
  const label = value === 0 ? "None" : value < 0.15 ? "Mild" : value < 0.25 ? "Moderate" : value < 0.35 ? "High" : "Extreme";
  return (
    <div>
      <div style={{ position: "relative", height: 8, background: "#f3f4f6", borderRadius: 4, margin: "8px 0 4px" }}>
        <div style={{ position: "absolute", inset: "0 auto 0 0", width: `${(value / 0.4) * 100}%`, background: `linear-gradient(90deg, #93c5fd, ${c})`, borderRadius: 4, transition: "all .2s" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
        <span style={{ color: "#9ca3af" }}>No persistence</span>
        <span style={{ color: c, fontWeight: 700 }}>ρ = {value.toFixed(2)} — {label}</span>
        <span style={{ color: "#9ca3af" }}>High persistence</span>
      </div>
    </div>
  );
}

export default function App() {
  const [initial, setInitial] = useState(10000000);
  const [inflation, setInflation] = useState(3.0);
  const [numSims, setNumSims] = useState(5000);
  const [stages, setStages] = useState([
    makeStage("Now",        3,   720000, { us: 34, cash: 3, allianztech: 49, gold: 0, farmland: 14 }),
    makeStage("Retirement", 30, -480000, { us: 30, cash: 10, allianztech: 30, gold: 20, farmland: 10 }),
  ]);
  const [seqRisk, setSeqRisk] = useState({ autocorr: 0, crashes: [] });
  const [results, setResults] = useState(null);
  const [running, setRunning] = useState(false);
  const [seqOpen, setSeqOpen] = useState(true);

  const addStage = () => setStages(p => [...p, makeStage(`Phase ${p.length + 1}`, 10, 0, { us: 50, intl: 15, bonds: 30, reits: 0, cash: 5 })]);
  const removeStage = id => setStages(p => p.length > 1 ? p.filter(s => s.id !== id) : p);
  const updStage = (id, k, v) => setStages(p => p.map(s => s.id === id ? { ...s, [k]: v } : s));
  const updAlloc = (id, asset, val) => setStages(p => p.map(s => s.id === id ? { ...s, alloc: { ...s.alloc, [asset]: Math.max(0, Math.min(100, Number(val))) } } : s));
  const normalizeAlloc = id => setStages(p => p.map(s => {
    if (s.id !== id) return s;
    const total = allocTotal(s.alloc); if (total === 0) return s;
    const keys = Object.keys(s.alloc); let sum = 0; const norm = {};
    keys.forEach((k, i) => { norm[k] = i < keys.length - 1 ? Math.round(s.alloc[k] / total * 100) : 0; sum += norm[k]; });
    norm[keys[keys.length - 1]] = 100 - sum;
    return { ...s, alloc: norm };
  }));

  const setAutocorr = v => setSeqRisk(r => ({ ...r, autocorr: v }));
  const addCrash = () => setSeqRisk(r => ({ ...r, crashes: [...r.crashes, makeCrash(1, -30, 100, 2)] }));
  const removeCrash = id => setSeqRisk(r => ({ ...r, crashes: r.crashes.filter(c => c.id !== id) }));
  const updCrash = (id, k, v) => setSeqRisk(r => ({ ...r, crashes: r.crashes.map(c => c.id === id ? { ...c, [k]: v } : c) }));
  const applyPreset = pid => {
    const p = PRESETS.find(x => x.id === pid); if (!p) return;
    setSeqRisk({ autocorr: p.autocorr, crashes: p.crashes.map(c => ({ ...c, id: Math.random().toString(36).slice(2) })) });
  };

  const allValid = stages.every(s => allocTotal(s.alloc) === 100);
  const totalYrs = stages.reduce((s, st) => s + st.years, 0);

  const runSim = useCallback(() => {
    if (running || !allValid) return;
    setRunning(true);
    setTimeout(() => {
      try {
        const normed = stages.map(s => ({ ...s, alloc: Object.fromEntries(Object.entries(s.alloc).map(([k, v]) => [k, Number(v) / 100])) }));
        setResults(simulate(normed, initial, numSims, inflation / 100, seqRisk));
      } catch (e) { console.error(e); }
      setRunning(false);
    }, 20);
  }, [stages, initial, numSims, inflation, seqRisk, running, allValid]);

  return (
    <div style={{ fontFamily: "system-ui,-apple-system,sans-serif", maxWidth: 800, margin: "0 auto", padding: "24px 20px", color: "#111", background: "#f9fafb", minHeight: "100vh" }}>

      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px", letterSpacing: -0.5 }}>Portfolio Monte Carlo</h1>
      <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 20px" }}>Multi-phase allocation · Sequence of returns risk · Inflation-adjusted real returns</p>

      {/* Global settings */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 14 }}>Simulation Settings</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Initial Portfolio</div>
            <div style={{ display: "flex", alignItems: "center" }}><span style={{ fontSize: 14, color: "#6b7280" }}>$</span>
              <input type="number" value={initial} step={10000} onChange={e => setInitial(Number(e.target.value))} style={{ border: "none", background: "transparent", fontSize: 16, fontWeight: 700, outline: "none", color: "#111", width: "100%" }} /></div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Inflation Rate</div>
            <div style={{ display: "flex", alignItems: "center" }}>
              <input type="number" value={inflation} step={0.1} min={0} max={20} onChange={e => setInflation(Number(e.target.value))} style={{ border: "none", background: "transparent", fontSize: 16, fontWeight: 700, outline: "none", color: "#111", width: "100%" }} />
              <span style={{ fontSize: 14, color: "#6b7280" }}>%</span></div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Simulations</div>
            <select value={numSims} onChange={e => setNumSims(Number(e.target.value))} style={{ border: "none", background: "transparent", fontSize: 16, fontWeight: 700, outline: "none", color: "#111", cursor: "pointer", width: "100%" }}>
              {[250, 500, 1000, 2500, 5000].map(o => <option key={o} value={o}>{o.toLocaleString()}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Asset legend */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 20px", marginBottom: 16, display: "flex", flexWrap: "wrap", gap: "4px 18px", alignItems: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5 }}>Assets</span>
        {ASSETS.map(a => (
          <span key={a.key} style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: a.color, display: "inline-block" }} />{a.label}
            <span style={{ color: "#9ca3af" }}>μ={(a.ret * 100).toFixed(0)}% σ={(a.std * 100).toFixed(0)}%</span>
          </span>
        ))}
      </div>

      {/* ══ SEQUENCE OF RETURNS RISK ══════════════════════════════════════════ */}
      <div style={{ background: "#fff", border: "1.5px solid #fca5a5", borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
        {/* Header toggle */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setSeqOpen(o => !o)}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⚡</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#dc2626" }}>Sequence of Returns Risk</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Return persistence · Crash injection · Historical scenarios</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {seqRisk.autocorr > 0 && <span style={{ fontSize: 11, padding: "2px 10px", background: "#fef2f2", color: "#dc2626", borderRadius: 20, fontWeight: 700 }}>ρ={seqRisk.autocorr.toFixed(2)}</span>}
            {seqRisk.crashes.length > 0 && <span style={{ fontSize: 11, padding: "2px 10px", background: "#fef2f2", color: "#dc2626", borderRadius: 20, fontWeight: 700 }}>{seqRisk.crashes.length} crash{seqRisk.crashes.length > 1 ? "es" : ""}</span>}
            <span style={{ fontSize: 20, color: "#9ca3af" }}>{seqOpen ? "▲" : "▼"}</span>
          </div>
        </div>

        {seqOpen && <div style={{ borderTop: "1px solid #fee2e2", marginTop: 16, paddingTop: 16 }}>

          {/* Presets */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 }}>Historical Stress Test Presets</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {PRESETS.map(p => (
                <button key={p.id} onClick={() => applyPreset(p.id)}
                  style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontWeight: 600, border: "1px solid #fca5a5", background: "#fff5f5", color: "#b91c1c" }}>
                  {p.label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>Presets fill in autocorrelation + crash events below — you can customise further after applying.</div>
          </div>

          {/* ── Return Autocorrelation ── */}
          <div style={{ background: "#fafafa", border: "1px solid #f3f4f6", borderRadius: 10, padding: "14px 16px", marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 2 }}>Return Autocorrelation (ρ)</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>
              Bad returns tend to persist across consecutive years — "bear market clustering". When ρ &gt; 0, a negative shock in year t makes year t+1 more likely to also be negative. This is devastating for retirees withdrawing from a declining portfolio.
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <input type="range" min={0} max={0.4} step={0.01} value={seqRisk.autocorr} onChange={e => setAutocorr(Number(e.target.value))} style={{ flex: 1, accentColor: "#dc2626" }} />
              <input type="number" min={0} max={0.4} step={0.01} value={seqRisk.autocorr} onChange={e => setAutocorr(Math.min(0.4, Math.max(0, Number(e.target.value))))} style={{ width: 60, fontSize: 14, fontWeight: 700, textAlign: "right" }} />
            </div>
            <AutocorrMeter value={seqRisk.autocorr} />
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              {[[0, "None (IID)"], [0.10, "Mild (2008)"], [0.20, "Moderate (Dot-com)"], [0.35, "High (1970s)"]].map(([v, l]) => (
                <button key={v} onClick={() => setAutocorr(v)}
                  style={{ fontSize: 11, padding: "3px 9px", borderRadius: 6, cursor: "pointer", border: `1px solid ${seqRisk.autocorr === v ? "#dc2626" : "#e5e7eb"}`, background: seqRisk.autocorr === v ? "#fef2f2" : "#fff", color: seqRisk.autocorr === v ? "#dc2626" : "#6b7280", fontWeight: seqRisk.autocorr === v ? 700 : 400 }}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* ── Crash Events ── */}
          <div style={{ background: "#fafafa", border: "1px solid #f3f4f6", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>Crash / Shock Events</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>Inject a market crash at a specific simulation year with optional probabilistic frequency.</div>
              </div>
              <button onClick={addCrash} style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, cursor: "pointer", border: "1px solid #fca5a5", background: "#fff5f5", color: "#dc2626", fontWeight: 700 }}>+ Add</button>
            </div>

            {/* Column headers */}
            {seqRisk.crashes.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "60px 110px 110px 1fr 28px", gap: 8, padding: "6px 0 4px", borderBottom: "1px solid #e5e7eb", marginTop: 10 }}>
                {["Year", "Crash %", "Recovery yrs", "Probability of occurring", ""].map(h => (
                  <div key={h} style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.4 }}>{h}</div>
                ))}
              </div>
            )}

            {seqRisk.crashes.length === 0 && (
              <div style={{ textAlign: "center", padding: "18px 0 6px", color: "#9ca3af", fontSize: 13 }}>No crash events. Add one or use a preset.</div>
            )}

            {seqRisk.crashes.map((c) => (
              <div key={c.id} style={{ marginTop: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "60px 110px 110px 1fr 28px", gap: 8, alignItems: "center" }}>
                  {/* Year */}
                  <input type="number" value={c.year} min={1} max={totalYrs} onChange={e => updCrash(c.id, "year", Math.max(1, Math.min(totalYrs, Number(e.target.value))))}
                    style={{ fontSize: 14, fontWeight: 700, color: "#dc2626", width: "100%" }} />
                  {/* Magnitude */}
                  <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <input type="number" value={c.magnitude} min={-80} max={-1} step={1} onChange={e => updCrash(c.id, "magnitude", Math.max(-80, Math.min(-1, Number(e.target.value))))}
                      style={{ width: "100%", fontSize: 14, fontWeight: 700, color: "#dc2626" }} />
                    <span style={{ fontSize: 12, color: "#9ca3af" }}>%</span>
                  </div>
                  {/* Recovery */}
                  <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <input type="number" value={c.recoveryYears} min={0} max={10} onChange={e => updCrash(c.id, "recoveryYears", Math.max(0, Math.min(10, Number(e.target.value))))}
                      style={{ width: "100%", fontSize: 14, fontWeight: 700, color: "#111" }} />
                    <span style={{ fontSize: 12, color: "#9ca3af" }}>yr</span>
                  </div>
                  {/* Probability slider */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input type="range" min={5} max={100} step={5} value={c.probability} onChange={e => updCrash(c.id, "probability", Number(e.target.value))}
                        style={{ flex: 1, accentColor: c.probability === 100 ? "#dc2626" : "#d97706" }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: c.probability === 100 ? "#dc2626" : "#d97706", minWidth: 38, textAlign: "right" }}>{c.probability}%</span>
                    </div>
                    <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>
                      {c.probability === 100 ? "⚠ Stress test — all simulations hit this crash" : `~${c.probability}% of simulations experience this event`}
                    </div>
                  </div>
                  {/* Remove */}
                  <button onClick={() => removeCrash(c.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 20, lineHeight: 1, padding: 0 }}>×</button>
                </div>
              </div>
            ))}

            <div style={{ marginTop: 14, padding: "10px 12px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, fontSize: 12, color: "#78350f" }}>
              <strong>Why sequence risk matters:</strong> A retiree withdrawing $60K/year who experiences a -37% crash in Year 1 must sell
              far more shares than if the same crash occurred in Year 20. Those sold shares never participate in the recovery —
              the loss is permanent. Autocorrelation amplifies this by making multi-year downturns more probable.
            </div>
          </div>
        </div>}
      </div>

      {/* ══ INVESTMENT PHASES ═══════════════════════════════════════════════════ */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>Investment Phases</span>
        <button onClick={addStage} style={{ fontSize: 13, padding: "6px 14px", cursor: "pointer", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", fontWeight: 600, color: "#374151" }}>+ Add Phase</button>
      </div>

      {stages.map((s, idx) => {
        const total = allocTotal(s.alloc), valid = total === 100, isW = s.cf < 0, col = PHASE_COLS[idx % PHASE_COLS.length];
        return (
          <div key={s.id} style={{ background: "#fff", border: `1.5px solid ${col}33`, borderLeft: `4px solid ${col}`, borderRadius: 12, padding: "16px 20px", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20, background: col + "18", color: col }}>PHASE {idx + 1}</span>
              <input value={s.name} onChange={e => updStage(s.id, "name", e.target.value)} style={{ flex: 1, border: "none", background: "transparent", fontSize: 15, fontWeight: 700, outline: "none", color: "#111" }} />
              {stages.length > 1 && <button onClick={() => removeStage(s.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 20, lineHeight: 1, padding: "0 4px" }}>×</button>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Duration</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="number" value={s.years} min={1} max={60} onChange={e => updStage(s.id, "years", Math.max(1, Number(e.target.value)))} style={{ width: 64, fontSize: 15, fontWeight: 700 }} />
                  <span style={{ fontSize: 13, color: "#6b7280" }}>years</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Annual Cash Flow
                  <span style={{ marginLeft: 6, padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700, background: isW ? "#fee2e2" : "#dcfce7", color: isW ? "#dc2626" : "#16a34a" }}>{isW ? "WITHDRAWAL" : "CONTRIBUTION"}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input type="number" value={s.cf} step={1000} onChange={e => updStage(s.id, "cf", Number(e.target.value))} style={{ width: "100%", fontSize: 15, fontWeight: 700, color: isW ? "#dc2626" : "#16a34a" }} />
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>$/yr</span>
                </div>
              </div>
            </div>
            <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>Asset Allocation</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: valid ? "#16a34a" : "#dc2626" }}>Total: {total}%</span>
                  {!valid && <button onClick={() => normalizeAlloc(s.id)} style={{ fontSize: 11, padding: "3px 10px", cursor: "pointer", borderRadius: 6, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", fontWeight: 700 }}>Normalize</button>}
                </div>
              </div>
              {ASSETS.map(a => (
                <div key={a.key} style={{ display: "grid", gridTemplateColumns: "96px 1fr 56px", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: a.color, display: "inline-block", flexShrink: 0 }} />{a.label}
                  </span>
                  <input type="range" min={0} max={100} step={1} value={s.alloc[a.key]} onChange={e => updAlloc(s.id, a.key, e.target.value)} style={{ accentColor: a.color, width: "100%" }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <input type="number" min={0} max={100} step={1} value={s.alloc[a.key]} onChange={e => updAlloc(s.id, a.key, e.target.value)} style={{ width: 40, fontSize: 13, fontWeight: 700, textAlign: "right" }} />
                    <span style={{ fontSize: 12, color: "#9ca3af" }}>%</span>
                  </div>
                </div>
              ))}
              <div style={{ display: "flex", height: 8, borderRadius: 6, overflow: "hidden", marginTop: 6 }}>
                {ASSETS.filter(a => s.alloc[a.key] > 0).map(a => <div key={a.key} style={{ flex: s.alloc[a.key], background: a.color, transition: "flex .2s" }} />)}
                {total < 100 && <div style={{ flex: 100 - total, background: "#f3f4f6" }} />}
              </div>
            </div>
          </div>
        );
      })}

      {/* Timeline */}
      <div style={{ display: "flex", height: 28, borderRadius: 8, overflow: "hidden", marginBottom: 20, border: "1px solid #e5e7eb" }}>
        {stages.map((s, i) => (
          <div key={s.id} style={{ flex: s.years, background: PHASE_COLS[i % PHASE_COLS.length], display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            <span style={{ fontSize: 11, color: "white", fontWeight: 700, whiteSpace: "nowrap", padding: "0 6px" }}>{s.name} ({s.years}yr)</span>
          </div>
        ))}
      </div>

      {/* Run */}
      <button onClick={runSim} disabled={running || !allValid}
        style={{ width: "100%", padding: "13px", fontSize: 15, fontWeight: 700, cursor: running ? "wait" : allValid ? "pointer" : "not-allowed", borderRadius: 10, border: "none", marginBottom: 28,
          background: !allValid ? "#f3f4f6" : running ? "#dbeafe" : "#1d4ed8", color: !allValid ? "#9ca3af" : running ? "#1d4ed8" : "#fff", transition: "all .2s" }}>
        {running ? "⏳ Simulating…" : !allValid ? "⚠ Fix allocations first (each phase must sum to 100%)" : `▶ Run ${numSims.toLocaleString()} Simulations`}
      </button>

      {/* ══ RESULTS ══════════════════════════════════════════════════════════════ */}
      {results && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "20px 20px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 16 }}>Simulation Results — Final Portfolio Value</div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 8, marginBottom: 18 }}>
            {[
              { label: "Success Rate",   val: `${results.success}%`,  c: parseFloat(results.success) >= 90 ? "#16a34a" : parseFloat(results.success) >= 70 ? "#d97706" : "#dc2626",  bg: parseFloat(results.success) >= 90 ? "#f0fdf4" : parseFloat(results.success) >= 70 ? "#fffbeb" : "#fef2f2" },
              { label: "Ruin Risk",      val: `${results.ruinRate}%`, c: parseFloat(results.ruinRate) <= 5 ? "#16a34a" : parseFloat(results.ruinRate) <= 20 ? "#d97706" : "#dc2626",   bg: parseFloat(results.ruinRate) <= 5 ? "#f0fdf4" : parseFloat(results.ruinRate) <= 20 ? "#fffbeb" : "#fef2f2" },
              { label: "P10 (Worst)",    val: fmt(results.p10),       c: "#b91c1c", bg: "#fff" },
              { label: "Median",         val: fmt(results.p50),       c: "#1d4ed8", bg: "#eff6ff" },
              { label: "P75",            val: fmt(results.p75),       c: "#15803d", bg: "#fff" },
              { label: "P90 (Best)",     val: fmt(results.p90),       c: "#166534", bg: "#f0fdf4" },
            ].map(({ label, val, c, bg }) => (
              <div key={label} style={{ background: bg, border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4, fontWeight: 700 }}>{label}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: c }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Active seq risk badges */}
          {(seqRisk.autocorr > 0 || seqRisk.crashes.length > 0) && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>Sequence risk applied:</span>
              {seqRisk.autocorr > 0 && <span style={{ fontSize: 11, padding: "2px 10px", background: "#fef2f2", color: "#dc2626", borderRadius: 20, fontWeight: 700 }}>ρ={seqRisk.autocorr.toFixed(2)} autocorrelation</span>}
              {seqRisk.crashes.map(c => <span key={c.id} style={{ fontSize: 11, padding: "2px 10px", background: "#fef2f2", color: "#dc2626", borderRadius: 20, fontWeight: 700 }}>Yr{c.year}: {c.magnitude}% ({c.probability}% of sims)</span>)}
            </div>
          )}

          {/* Legend */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", marginBottom: 10, fontSize: 12, color: "#6b7280" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 18, height: 2.5, background: "#1d4ed8", display: "inline-block", borderRadius: 2 }} />Median</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: "rgba(37,99,235,.32)", display: "inline-block" }} />P25–P75</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: "rgba(37,99,235,.13)", display: "inline-block" }} />P10–P90</span>
            {results.crashYears.length > 0 && <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: "#fecaca", display: "inline-block" }} />Crash event (≥50% prob)</span>}
            <span style={{ color: "#9ca3af" }}>· inflation-adjusted · dashed = phase boundary</span>
          </div>

          <div style={{ width: "100%", height: 340 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={results.chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#9ca3af" }} label={{ value: "Year", position: "insideBottom", offset: -10, fontSize: 12, fill: "#9ca3af" }} />
                <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: "#9ca3af" }} width={72} />
                <Tooltip content={<CustomTooltip />} />
                {results.crashYears.map(y => <ReferenceArea key={`ca-${y}`} x1={Math.max(0, y - 0.5)} x2={y + 0.5} fill="#fca5a5" fillOpacity={0.45} />)}
                {results.crashYears.map(y => <ReferenceLine key={`cl-${y}`} x={y} stroke="#dc2626" strokeWidth={1.5} strokeDasharray="3 3" label={{ value: "💥", position: "top", fontSize: 14 }} />)}
                {results.stageEnds.map(se => <ReferenceLine key={se.x} x={se.x} stroke="#9ca3af" strokeDasharray="5 4" />)}
                <Area type="monotone" dataKey="base" stackId="1" fill="transparent" stroke="none" legendType="none" isAnimationActive={false} />
                <Area type="monotone" dataKey="lo"   stackId="1" fill="#2563eb" fillOpacity={0.13} stroke="none" legendType="none" isAnimationActive={false} />
                <Area type="monotone" dataKey="mid"  stackId="1" fill="#2563eb" fillOpacity={0.32} stroke="none" legendType="none" isAnimationActive={false} />
                <Area type="monotone" dataKey="hi"   stackId="1" fill="#2563eb" fillOpacity={0.13} stroke="none" legendType="none" isAnimationActive={false} />
                <Line type="monotone" dataKey="p50" stroke="#1d4ed8" strokeWidth={2.5} dot={false} legendType="none" isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: "flex", height: 22, borderRadius: 6, overflow: "hidden", marginTop: 4 }}>
            {stages.map((s, i) => (
              <div key={s.id} style={{ flex: s.years, background: PHASE_COLS[i % PHASE_COLS.length] + "cc", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                <span style={{ fontSize: 10, color: "white", whiteSpace: "nowrap", padding: "0 4px", fontWeight: 700 }}>{s.name}</span>
              </div>
            ))}
          </div>

          {(seqRisk.autocorr > 0 || seqRisk.crashes.length > 0) && (
            <div style={{ marginTop: 14, padding: "12px 14px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, fontSize: 12, color: "#78350f" }}>
              <strong>Sequence Risk Interpretation: </strong>
              {seqRisk.autocorr > 0 && `ρ=${seqRisk.autocorr.toFixed(2)} widens the outcome fan — the gap between P10 and P90 is larger than IID returns. `}
              {seqRisk.crashes.filter(c => c.probability === 100).length > 0 && `Deterministic crash(es) at year(s) ${seqRisk.crashes.filter(c => c.probability === 100).map(c => c.year).join(", ")} shift all trajectories down at that point. Compare success rate to a run with no crashes to see the pure impact. `}
              {seqRisk.crashes.filter(c => c.probability < 100 && c.probability >= 5).length > 0 && `Probabilistic crashes split simulations into "hit" vs "miss" groups, visibly widening the fan at the crash year.`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
