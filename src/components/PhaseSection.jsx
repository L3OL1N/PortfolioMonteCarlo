import { ASSETS, PHASE_COLS } from "../constants";
import { allocTotal, allocAmountTotal } from "../utils";

export default function PhaseSection({ stages, addStage, removeStage, updStage, updAlloc, updAllocAmount, normalizeAlloc }) {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>Investment Phases</span>
        <button onClick={addStage} style={{ fontSize: 13, padding: "6px 14px", cursor: "pointer", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", fontWeight: 600, color: "#374151" }}>+ Add Phase</button>
      </div>

      {stages.map((stage, idx) => {
        const total = allocTotal(stage.alloc);
        const valid = total === 100;
        const amountTotal = allocAmountTotal(stage.allocAmount);
        const isWithdrawal = stage.cf < 0;
        const withdrawalMode = stage.withdrawalMode || "fixed";
        const color = PHASE_COLS[idx % PHASE_COLS.length];

        return (
          <div key={stage.id} style={{ background: "#fff", border: `1.5px solid ${color}33`, borderLeft: `4px solid ${color}`, borderRadius: 12, padding: "16px 20px", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20, background: color + "18", color: color }}>PHASE {idx + 1}</span>
              <input value={stage.name} onChange={(e) => updStage(stage.id, "name", e.target.value)} style={{ flex: 1, border: "none", background: "transparent", fontSize: 15, fontWeight: 700, outline: "none", color: "#111" }} />
              {stages.length > 1 && <button onClick={() => removeStage(stage.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 20, lineHeight: 1, padding: "0 4px" }}>×</button>}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Duration</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="number" value={stage.years} min={1} max={60} onChange={(e) => updStage(stage.id, "years", Math.max(1, Number(e.target.value)))} style={{ width: 64, fontSize: 15, fontWeight: 700 }} />
                  <span style={{ fontSize: 13, color: "#6b7280" }}>years</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Withdrawal Strategy</div>
                <select value={withdrawalMode} onChange={(e) => updStage(stage.id, "withdrawalMode", e.target.value)} style={{ width: "100%", border: "none", background: "transparent", fontSize: 16, fontWeight: 700, outline: "none", color: "#111", cursor: "pointer" }}>
                  <option value="fixed">Fixed</option>
                  <option value="dynamic">Dynamic %</option>
                </select>
              </div>
            </div>

            {withdrawalMode === "fixed" && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Annual Cash Flow
                  <span style={{ marginLeft: 6, padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700, background: isWithdrawal ? "#fee2e2" : "#dcfce7", color: isWithdrawal ? "#dc2626" : "#16a34a" }}>{isWithdrawal ? "WITHDRAWAL" : "CONTRIBUTION"}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input type="number" value={stage.cf} step={1000} onChange={(e) => updStage(stage.id, "cf", Number(e.target.value))} style={{ width: "100%", fontSize: 15, fontWeight: 700, color: isWithdrawal ? "#dc2626" : "#16a34a" }} />
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>$/yr</span>
                </div>
              </div>
            )}

            {withdrawalMode === "dynamic" && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Withdrawal Rate</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="number" value={stage.withdrawalRate ?? 4.0} step={0.1} min={0} max={20} onChange={(e) => updStage(stage.id, "withdrawalRate", Number(e.target.value))} style={{ width: "100%", border: "none", background: "transparent", fontSize: 16, fontWeight: 700, outline: "none", color: "#111" }} />
                  <span style={{ fontSize: 14, color: "#6b7280" }}>%</span>
                </div>
              </div>
            )}

            <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>Asset Allocation</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: valid ? "#16a34a" : "#dc2626" }}>Total: {total}%</span>
                  {!valid && <button onClick={() => normalizeAlloc(stage.id)} style={{ fontSize: 11, padding: "3px 10px", cursor: "pointer", borderRadius: 6, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", fontWeight: 700 }}>Normalize</button>}
                </div>
              </div>
              {ASSETS.map((asset) => (
                <div key={asset.key} style={{ display: "grid", gridTemplateColumns: "96px 1fr 50px 50px", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: asset.color, display: "inline-block", flexShrink: 0 }} />{asset.label}
                  </span>
                  <input type="range" min={0} max={100} step={1} value={stage.alloc[asset.key]} onChange={(e) => updAlloc(stage.id, asset.key, e.target.value)} style={{ accentColor: asset.color, width: "100%" }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <input type="number" min={0} max={100} step={1} value={stage.alloc[asset.key]} onChange={(e) => updAlloc(stage.id, asset.key, e.target.value)} style={{ width: 40, fontSize: 13, fontWeight: 700, textAlign: "right" }} />
                    <span style={{ fontSize: 12, color: "#9ca3af" }}>%</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <input type="number" min={0} value={stage.allocAmount?.[asset.key] ?? 0} onChange={(e) => updAllocAmount(stage.id, asset.key, e.target.value)} style={{ width: 48, fontSize: 13, fontWeight: 700, textAlign: "right" }} />
                    <span style={{ fontSize: 12, color: "#9ca3af" }}>$</span>
                  </div>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, paddingTop: 8, borderTop: "1px solid #f3f4f6" }}>
                <span style={{ fontSize: 12, color: "#6b7280" }}>Total asset amount</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>${amountTotal.toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", height: 8, borderRadius: 6, overflow: "hidden", marginTop: 6 }}>
                {ASSETS.filter((asset) => stage.alloc[asset.key] > 0).map((asset) => (
                  <div key={asset.key} style={{ flex: stage.alloc[asset.key], background: asset.color, transition: "flex .2s" }} />
                ))}
                {total < 100 && <div style={{ flex: 100 - total, background: "#f3f4f6" }} />}
              </div>
            </div>
          </div>
        );
      })}

      <div style={{ display: "flex", height: 28, borderRadius: 8, overflow: "hidden", marginBottom: 20, border: "1px solid #e5e7eb" }}>
        {stages.map((stage, index) => (
          <div key={stage.id} style={{ flex: stage.years, background: PHASE_COLS[index % PHASE_COLS.length], display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            <span style={{ fontSize: 11, color: "white", fontWeight: 700, whiteSpace: "nowrap", padding: "0 6px" }}>{stage.name} ({stage.years}yr)</span>
          </div>
        ))}
      </div>
    </>
  );
}
