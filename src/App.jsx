import { useState, useCallback } from "react";
import { ASSETS, PRESETS } from "./constants";
import { makeStage, makeCrash, allocTotal, allocAmountTotal, computeAllocFromAmounts, fmt } from "./utils";
import { simulate } from "./simulation";
import SequenceRiskPanel from "./components/SequenceRiskPanel";
import PhaseSection from "./components/PhaseSection";
import ResultsSection from "./components/ResultsSection";

const DEFAULT_ALLOC = { us: 40, bond: 10, cash: 10, allianztech: 20, gold: 10, farmland: 10 };

export default function App() {
  const [initial, setInitial] = useState(10000000);
  const [inflation, setInflation] = useState(3.0);
  const [numSims, setNumSims] = useState(10000);
  const [stages, setStages] = useState([
    makeStage("Now", 3, 720000, { us: 34, bond: 0, cash: 3, allianztech: 49, gold: 0, farmland: 14 }, { us: 350, bond: 0, allianztech: 500, farmland: 140, gold: 0, cash: 70 }),
    makeStage("Transition", 3, -120000, { us: 33, bond: 0, cash: 10, allianztech: 32, gold: 10, farmland: 15 }),
    makeStage("Retirement", 20, -480000, { us: 30, bond: 0, cash: 10, allianztech: 30, gold: 20, farmland: 10 }),
  ]);
  const [seqRisk, setSeqRisk] = useState({ autocorr: 0, crashes: [] });
  const [rebalance, setRebalance] = useState("annual");
  const [distribution, setDistribution] = useState("normal");
  const [emergencyFund, setEmergencyFund] = useState({ enabled: false, mode: 'bear_shield', years: 3, bearThreshold: -10, contributionRate: 4, floorPct: 5 });
  const [results, setResults] = useState(null);
  const [running, setRunning] = useState(false);
  const [seqOpen, setSeqOpen] = useState(true);

  const addStage = () => setStages((prev) => [...prev, makeStage(`Phase ${prev.length + 1}`, 10, 0, DEFAULT_ALLOC)]);
  const removeStage = (id) => setStages((prev) => (prev.length > 1 ? prev.filter((stage) => stage.id !== id) : prev));
  const updStage = (id, key, value) => setStages((prev) => prev.map((stage) => (stage.id === id ? { ...stage, [key]: value } : stage)));
  const updAlloc = (id, asset, value) => setStages((prev) => prev.map((stage) => {
    if (stage.id !== id) return stage;
    const nextAlloc = { ...stage.alloc, [asset]: Math.max(0, Math.min(100, Number(value))) };
    const amountTotal = allocAmountTotal(stage.allocAmount);
    if (amountTotal > 0) {
      const nextAllocAmount = Object.fromEntries(ASSETS.map(({ key }) => [key, Math.round((nextAlloc[key] / 100) * amountTotal)]));
      return { ...stage, alloc: nextAlloc, allocAmount: nextAllocAmount };
    }
    return { ...stage, alloc: nextAlloc };
  }));
  const updAllocAmount = (id, asset, value) => setStages((prev) => prev.map((stage) => {
    if (stage.id !== id) return stage;
    const nextAllocAmount = { ...stage.allocAmount, [asset]: Math.max(0, Number(value) || 0) };
    const totalAmount = allocAmountTotal(nextAllocAmount);
    if (totalAmount === 0) return { ...stage, allocAmount: nextAllocAmount };
    return { ...stage, allocAmount: nextAllocAmount, alloc: computeAllocFromAmounts(nextAllocAmount) };
  }));
  const normalizeAlloc = (id) => setStages((prev) => prev.map((stage) => {
    if (stage.id !== id) return stage;
    const total = allocTotal(stage.alloc);
    if (total === 0) return stage;
    const keys = Object.keys(stage.alloc);
    let sum = 0;
    const normalized = {};
    keys.forEach((key, index) => {
      normalized[key] = index < keys.length - 1 ? Math.round((stage.alloc[key] / total) * 100) : 0;
      sum += normalized[key];
    });
    normalized[keys[keys.length - 1]] = 100 - sum;
    const amountTotal = allocAmountTotal(stage.allocAmount);
    if (amountTotal > 0) {
      const normalizedAmounts = {};
      keys.forEach((key) => {
        normalizedAmounts[key] = Math.round((normalized[key] / 100) * amountTotal);
      });
      return { ...stage, alloc: normalized, allocAmount: normalizedAmounts };
    }
    return { ...stage, alloc: normalized };
  }));

  const setAutocorr = (value) => setSeqRisk((prev) => ({ ...prev, autocorr: value }));
  const addCrash = () => setSeqRisk((prev) => ({ ...prev, crashes: [...prev.crashes, makeCrash(1, -30, 100, 2)] }));
  const removeCrash = (id) => setSeqRisk((prev) => ({ ...prev, crashes: prev.crashes.filter((crash) => crash.id !== id) }));
  const updCrash = (id, key, value) => setSeqRisk((prev) => ({ ...prev, crashes: prev.crashes.map((crash) => (crash.id === id ? { ...crash, [key]: value } : crash)) }));
  const applyPreset = (pid) => {
    const preset = PRESETS.find((item) => item.id === pid);
    if (!preset) return;
    setSeqRisk({ autocorr: preset.autocorr, crashes: preset.crashes.map((crash) => ({ ...crash, id: Math.random().toString(36).slice(2) })) });
  };

  const maxWithdrawalCf = stages.reduce((max, st) => (st.cf < 0 ? Math.max(max, Math.abs(st.cf)) : max), 0);
  const emergencyFundInitial = emergencyFund.enabled ? emergencyFund.years * maxWithdrawalCf : 0;

  const allValid = stages.every((stage) => allocTotal(stage.alloc) === 100);

  const runSim = useCallback(() => {
    if (running || !allValid) return;
    setRunning(true);
    setTimeout(() => {
      try {
        const normedStages = stages.map((stage) => ({
          ...stage,
          alloc: Object.fromEntries(Object.entries(stage.alloc).map(([key, value]) => [key, Number(value) / 100])),
        }));
        setResults(simulate(normedStages, initial, numSims, inflation / 100, seqRisk, rebalance, distribution, emergencyFund));
      } catch (error) {
        console.error(error);
      }
      setRunning(false);
    }, 20);
  }, [stages, initial, numSims, inflation, seqRisk, rebalance, distribution, running, allValid]);

  return (
    <div style={{ fontFamily: "system-ui,-apple-system,sans-serif", maxWidth: 800, margin: "0 auto", padding: "24px 20px", color: "#111", background: "#f9fafb", minHeight: "100vh" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px", letterSpacing: -0.5 }}>Portfolio Monte Carlo</h1>
      <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 20px" }}>Multi-phase allocation · Sequence of returns risk · Inflation-adjusted real returns</p>

      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 14 }}>Simulation Settings</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Initial Portfolio</div>
            <div style={{ display: "flex", alignItems: "center" }}><span style={{ fontSize: 14, color: "#6b7280" }}>$</span>
              <input type="number" value={initial} step={10000} onChange={(e) => setInitial(Number(e.target.value))} style={{ border: "none", background: "transparent", fontSize: 16, fontWeight: 700, outline: "none", color: "#111", width: "100%" }} /></div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Inflation Rate</div>
            <div style={{ display: "flex", alignItems: "center" }}>
              <input type="number" value={inflation} step={0.1} min={0} max={20} onChange={(e) => setInflation(Number(e.target.value))} style={{ border: "none", background: "transparent", fontSize: 16, fontWeight: 700, outline: "none", color: "#111", width: "100%" }} />
              <span style={{ fontSize: 14, color: "#6b7280" }}>%</span></div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Simulations</div>
            <select value={numSims} onChange={(e) => setNumSims(Number(e.target.value))} style={{ border: "none", background: "transparent", fontSize: 16, fontWeight: 700, outline: "none", color: "#111", cursor: "pointer", width: "100%" }}>
              {[500, 1000, 2500, 5000, 10000].map((option) => <option key={option} value={option}>{option.toLocaleString()}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Distribution</div>
            <select value={distribution} onChange={(e) => setDistribution(e.target.value)} style={{ border: "none", background: "transparent", fontSize: 16, fontWeight: 700, outline: "none", color: "#111", cursor: "pointer", width: "100%" }}>
              <option value="normal">Normal</option>
              <option value="fat">Fat tails</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Rebalance</div>
            <select value={rebalance} onChange={(e) => setRebalance(e.target.value)} style={{ border: "none", background: "transparent", fontSize: 16, fontWeight: 700, outline: "none", color: "#111", cursor: "pointer", width: "100%" }}>
              <option value="annual">Annual</option>
              <option value="none">None</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 20px", marginBottom: 16, display: "flex", flexWrap: "wrap", gap: "4px 18px", alignItems: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5 }}>Assets</span>
        {ASSETS.map((asset) => (
          <span key={asset.key} style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: asset.color, display: "inline-block" }} />{asset.label}
            <span style={{ color: "#9ca3af" }}>μ={(asset.ret * 100).toFixed(0)}% σ={(asset.std * 100).toFixed(0)}%</span>
          </span>
        ))}
      </div>

      <SequenceRiskPanel
        seqOpen={seqOpen}
        setSeqOpen={setSeqOpen}
        seqRisk={seqRisk}
        setAutocorr={setAutocorr}
        addCrash={addCrash}
        removeCrash={removeCrash}
        updCrash={updCrash}
        applyPreset={applyPreset}
        totalYrs={stages.reduce((sum, stage) => sum + stage.years, 0)}
      />

      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.6 }}>Emergency Fund (緊急預備金)</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Draw from reserve during bear markets instead of selling investments</div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
            <input type="checkbox" checked={emergencyFund.enabled} onChange={(e) => setEmergencyFund((prev) => ({ ...prev, enabled: e.target.checked }))} style={{ width: 16, height: 16, cursor: "pointer" }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Enable</span>
          </label>
        </div>
        {emergencyFund.enabled && (
          <>
            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                { id: 'bear_shield', label: 'Bear Shield', desc: 'Use reserve only during bear markets · replenishes in bull years' },
                { id: 'water_tank', label: 'Water Tank (水塔)', desc: 'Annual portfolio contribution → tank → spend tank ÷ years with floor' },
              ].map(({ id, label, desc }) => (
                <label key={id} style={{ display: "flex", gap: 8, cursor: "pointer", padding: "8px 12px", border: `1.5px solid ${emergencyFund.mode === id ? '#1d4ed8' : '#e5e7eb'}`, borderRadius: 8, background: emergencyFund.mode === id ? '#eff6ff' : '#f9fafb', userSelect: "none" }}>
                  <input type="radio" name="ef-mode" value={id} checked={emergencyFund.mode === id} onChange={() => setEmergencyFund(prev => ({ ...prev, mode: id }))} style={{ marginTop: 2, cursor: "pointer" }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{label}</div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>{desc}</div>
                  </div>
                </label>
              ))}
            </div>

            {emergencyFund.mode === 'bear_shield' && (
              <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Reserve Years</div>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <input type="number" value={emergencyFund.years} step={1} min={1} max={10}
                      onChange={(e) => setEmergencyFund((prev) => ({ ...prev, years: Math.max(1, Math.min(10, Number(e.target.value))) }))}
                      style={{ border: "none", background: "transparent", fontSize: 16, fontWeight: 700, outline: "none", color: "#111", width: "100%" }} />
                    <span style={{ fontSize: 14, color: "#6b7280" }}>yrs</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Bear Market Threshold</div>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <input type="number" value={emergencyFund.bearThreshold} step={1} min={-30} max={-1}
                      onChange={(e) => setEmergencyFund((prev) => ({ ...prev, bearThreshold: Math.max(-30, Math.min(-1, Number(e.target.value))) }))}
                      style={{ border: "none", background: "transparent", fontSize: 16, fontWeight: 700, outline: "none", color: "#111", width: "100%" }} />
                    <span style={{ fontSize: 14, color: "#6b7280" }}>%</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Initial Fund Size</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#15803d" }}>{fmt(emergencyFundInitial)}</div>
                  <div style={{ fontSize: 10, color: "#9ca3af" }}>{emergencyFund.years} yrs × {fmt(maxWithdrawalCf)}/yr</div>
                </div>
              </div>
            )}

            {emergencyFund.mode === 'water_tank' && (
              <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Tank Size</div>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <input type="number" value={emergencyFund.years} step={1} min={1} max={10}
                      onChange={(e) => setEmergencyFund((prev) => ({ ...prev, years: Math.max(1, Math.min(10, Number(e.target.value))) }))}
                      style={{ border: "none", background: "transparent", fontSize: 16, fontWeight: 700, outline: "none", color: "#111", width: "100%" }} />
                    <span style={{ fontSize: 14, color: "#6b7280" }}>yrs</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Annual Contribution</div>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <input type="number" value={emergencyFund.contributionRate} step={0.5} min={1} max={10}
                      onChange={(e) => setEmergencyFund((prev) => ({ ...prev, contributionRate: Math.max(1, Math.min(10, Number(e.target.value))) }))}
                      style={{ border: "none", background: "transparent", fontSize: 16, fontWeight: 700, outline: "none", color: "#111", width: "100%" }} />
                    <span style={{ fontSize: 14, color: "#6b7280" }}>%/yr</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Spending Floor</div>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <input type="number" value={emergencyFund.floorPct} step={1} min={1} max={20}
                      onChange={(e) => setEmergencyFund((prev) => ({ ...prev, floorPct: Math.max(1, Math.min(20, Number(e.target.value))) }))}
                      style={{ border: "none", background: "transparent", fontSize: 16, fontWeight: 700, outline: "none", color: "#111", width: "100%" }} />
                    <span style={{ fontSize: 14, color: "#6b7280" }}>% max cut/yr</span>
                  </div>
                </div>
                <div style={{ gridColumn: "1 / -1", display: "flex", gap: 20, alignItems: "flex-start", paddingTop: 4, borderTop: "1px solid #f0fdf4" }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>Initial Tank</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#15803d" }}>{fmt(emergencyFundInitial)}</div>
                    <div style={{ fontSize: 10, color: "#9ca3af" }}>{emergencyFund.years} yrs × {fmt(maxWithdrawalCf)}/yr</div>
                  </div>
                  <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.7, marginTop: 2 }}>
                    Portfolio adds <strong>{emergencyFund.contributionRate}%</strong> to tank each year · spending = tank ÷ {emergencyFund.years} · if market crashes, spending drops at most <strong>{emergencyFund.floorPct}%/yr</strong>, smoothing the impact over ~{Math.ceil(100 / emergencyFund.floorPct)} years
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <PhaseSection
        stages={stages}
        addStage={addStage}
        removeStage={removeStage}
        updStage={updStage}
        updAlloc={updAlloc}
        updAllocAmount={updAllocAmount}
        normalizeAlloc={normalizeAlloc}
      />

      <button onClick={runSim} disabled={running || !allValid}
        style={{ width: "100%", padding: "13px", fontSize: 15, fontWeight: 700, cursor: running ? "wait" : allValid ? "pointer" : "not-allowed", borderRadius: 10, border: "none", marginBottom: 28,
          background: !allValid ? "#f3f4f6" : running ? "#dbeafe" : "#1d4ed8", color: !allValid ? "#9ca3af" : running ? "#1d4ed8" : "#fff", transition: "all .2s" }}>
        {running ? "⏳ Simulating…" : !allValid ? "⚠ Fix allocations first (each phase must sum to 100%)" : `▶ Run ${numSims.toLocaleString()} Simulations`}
      </button>

      {results && <ResultsSection results={results} seqRisk={seqRisk} stages={stages} />}
    </div>
  );
}
