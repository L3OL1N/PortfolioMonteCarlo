import AutocorrMeter from "./AutocorrMeter";
import { PRESETS } from "../constants";

export default function SequenceRiskPanel({ seqOpen, setSeqOpen, seqRisk, setAutocorr, addCrash, removeCrash, updCrash, applyPreset, totalYrs }) {
  return (
    <div style={{ background: "#fff", border: "1.5px solid #fca5a5", borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setSeqOpen((open) => !open)}>
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

      {seqOpen && (
        <div style={{ borderTop: "1px solid #fee2e2", marginTop: 16, paddingTop: 16 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 }}>Historical Stress Test Presets</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {PRESETS.map((preset) => (
                <button key={preset.id} onClick={() => applyPreset(preset.id)}
                  style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontWeight: 600, border: "1px solid #fca5a5", background: "#fff5f5", color: "#b91c1c" }}>
                  {preset.label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>Presets fill in autocorrelation + crash events below — you can customise further after applying.</div>
          </div>

          <div style={{ background: "#fafafa", border: "1px solid #f3f4f6", borderRadius: 10, padding: "14px 16px", marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 2 }}>Return Autocorrelation (ρ)</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>
              Bad returns tend to persist across consecutive years — "bear market clustering". When ρ &gt; 0, a negative shock in year t makes year t+1 more likely to also be negative.
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <input type="range" min={0} max={0.4} step={0.01} value={seqRisk.autocorr} onChange={(e) => setAutocorr(Number(e.target.value))} style={{ flex: 1, accentColor: "#dc2626" }} />
              <input type="number" min={0} max={0.4} step={0.01} value={seqRisk.autocorr} onChange={(e) => setAutocorr(Math.min(0.4, Math.max(0, Number(e.target.value))))} style={{ width: 60, fontSize: 14, fontWeight: 700, textAlign: "right" }} />
            </div>
            <AutocorrMeter value={seqRisk.autocorr} />
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              {[[0, "None (IID)"], [0.10, "Mild (2008)"], [0.20, "Moderate (Dot-com)"], [0.35, "High (1970s)"]].map(([value, label]) => (
                <button key={value} onClick={() => setAutocorr(value)}
                  style={{ fontSize: 11, padding: "3px 9px", borderRadius: 6, cursor: "pointer", border: `1px solid ${seqRisk.autocorr === value ? "#dc2626" : "#e5e7eb"}`, background: seqRisk.autocorr === value ? "#fef2f2" : "#fff", color: seqRisk.autocorr === value ? "#dc2626" : "#6b7280", fontWeight: seqRisk.autocorr === value ? 700 : 400 }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ background: "#fafafa", border: "1px solid #f3f4f6", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>Crash / Shock Events</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>Inject a market crash at a specific simulation year with optional probabilistic frequency.</div>
              </div>
              <button onClick={addCrash} style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, cursor: "pointer", border: "1px solid #fca5a5", background: "#fff5f5", color: "#dc2626", fontWeight: 700 }}>+ Add</button>
            </div>

            {seqRisk.crashes.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "60px 110px 110px 1fr 28px", gap: 8, padding: "6px 0 4px", borderBottom: "1px solid #e5e7eb", marginTop: 10 }}>
                {['Year', 'Crash %', 'Recovery yrs', 'Probability of occurring', ''].map((header) => (
                  <div key={header} style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.4 }}>{header}</div>
                ))}
              </div>
            )}

            {seqRisk.crashes.length === 0 && (
              <div style={{ textAlign: "center", padding: "18px 0 6px", color: "#9ca3af", fontSize: 13 }}>No crash events. Add one or use a preset.</div>
            )}

            {seqRisk.crashes.map((crash) => (
              <div key={crash.id} style={{ marginTop: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "60px 110px 110px 1fr 28px", gap: 8, alignItems: "center" }}>
                  <input type="number" value={crash.year} min={1} max={totalYrs} onChange={(e) => updCrash(crash.id, "year", Math.max(1, Math.min(totalYrs, Number(e.target.value))))} style={{ fontSize: 14, fontWeight: 700, color: "#dc2626", width: "100%" }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <input type="number" value={crash.magnitude} min={-80} max={-1} step={1} onChange={(e) => updCrash(crash.id, "magnitude", Math.max(-80, Math.min(-1, Number(e.target.value))))} style={{ width: "100%", fontSize: 14, fontWeight: 700, color: "#dc2626" }} />
                    <span style={{ fontSize: 12, color: "#9ca3af" }}>%</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <input type="number" value={crash.recoveryYears} min={0} max={10} onChange={(e) => updCrash(crash.id, "recoveryYears", Math.max(0, Math.min(10, Number(e.target.value))))} style={{ width: "100%", fontSize: 14, fontWeight: 700, color: "#111" }} />
                    <span style={{ fontSize: 12, color: "#9ca3af" }}>yr</span>
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input type="range" min={5} max={100} step={5} value={crash.probability} onChange={(e) => updCrash(crash.id, "probability", Number(e.target.value))} style={{ flex: 1, accentColor: crash.probability === 100 ? "#dc2626" : "#d97706" }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: crash.probability === 100 ? "#dc2626" : "#d97706", minWidth: 38, textAlign: "right" }}>{crash.probability}%</span>
                    </div>
                    <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>
                      {crash.probability === 100 ? "⚠ Stress test — all simulations hit this crash" : `~${crash.probability}% of simulations experience this event`}
                    </div>
                  </div>
                  <button onClick={() => removeCrash(crash.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 20, lineHeight: 1, padding: 0 }}>×</button>
                </div>
              </div>
            ))}

            <div style={{ marginTop: 14, padding: "10px 12px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, fontSize: 12, color: "#78350f" }}>
              <strong>Why sequence risk matters:</strong> A retiree withdrawing $60K/year who experiences a -37% crash in Year 1 must sell far more shares than if the same crash occurred in Year 20. Those sold shares never participate in the recovery — the loss is permanent.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
