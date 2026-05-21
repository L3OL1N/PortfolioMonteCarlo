import { ComposedChart, Area, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea } from "recharts";
import CustomTooltip from "./CustomTooltip";
import { fmt } from "../utils";

function WithdrawalTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 14px", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,.1)" }}>
      <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 13 }}>Year {d.year}</div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 20, lineHeight: 1.8 }}>
        <span>Yearly withdrawal</span>
        <span style={{ fontWeight: 700 }}>{fmt(d.withdraw)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 20, lineHeight: 1.8 }}>
        <span>Monthly amount</span>
        <span style={{ fontWeight: 700 }}>{fmt(d.monthly)}</span>
      </div>
    </div>
  );
}

export default function ResultsSection({ results, seqRisk, stages }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "20px 20px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 16 }}>Simulation Results — Final Portfolio Value</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 8, marginBottom: 18 }}>
        {[
          { label: "Success Rate", val: `${results.success}%`, c: parseFloat(results.success) >= 90 ? "#16a34a" : parseFloat(results.success) >= 70 ? "#d97706" : "#dc2626", bg: parseFloat(results.success) >= 90 ? "#f0fdf4" : parseFloat(results.success) >= 70 ? "#fffbeb" : "#fef2f2" },
          { label: "Ruin Risk", val: `${results.ruinRate}%`, c: parseFloat(results.ruinRate) <= 5 ? "#16a34a" : parseFloat(results.ruinRate) <= 20 ? "#d97706" : "#dc2626", bg: parseFloat(results.ruinRate) <= 5 ? "#f0fdf4" : parseFloat(results.ruinRate) <= 20 ? "#fffbeb" : "#fef2f2" },
          { label: "P10 (Worst)", val: fmt(results.p10), c: "#b91c1c", bg: "#fff" },
          { label: "Median", val: fmt(results.p50), c: "#1d4ed8", bg: "#eff6ff" },
          { label: "P75", val: fmt(results.p75), c: "#15803d", bg: "#fff" },
          { label: "P90 (Best)", val: fmt(results.p90), c: "#166534", bg: "#f0fdf4" },
        ].map(({ label, val, c, bg }) => (
          <div key={label} style={{ background: bg, border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4, fontWeight: 700 }}>{label}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: c }}>{val}</div>
          </div>
        ))}
      </div>

      {(seqRisk.autocorr > 0 || seqRisk.crashes.length > 0) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>Sequence risk applied:</span>
          {seqRisk.autocorr > 0 && <span style={{ fontSize: 11, padding: "2px 10px", background: "#fef2f2", color: "#dc2626", borderRadius: 20, fontWeight: 700 }}>ρ={seqRisk.autocorr.toFixed(2)} autocorrelation</span>}
          {seqRisk.crashes.map((crash) => <span key={crash.id} style={{ fontSize: 11, padding: "2px 10px", background: "#fef2f2", color: "#dc2626", borderRadius: 20, fontWeight: 700 }}>Yr{crash.year}: {crash.magnitude}% ({crash.probability}% of sims)</span>)}
        </div>
      )}

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
            {results.crashYears.map((year) => <ReferenceArea key={`ca-${year}`} x1={Math.max(0, year - 0.5)} x2={year + 0.5} fill="#fca5a5" fillOpacity={0.45} />)}
            {results.crashYears.map((year) => <ReferenceLine key={`cl-${year}`} x={year} stroke="#dc2626" strokeWidth={1.5} strokeDasharray="3 3" label={{ value: "💥", position: "top", fontSize: 14 }} />)}
            {results.stageEnds.map((stageEnd) => <ReferenceLine key={stageEnd.x} x={stageEnd.x} stroke="#9ca3af" strokeDasharray="5 4" />)}
            <Area type="monotone" dataKey="base" stackId="1" fill="transparent" stroke="none" legendType="none" isAnimationActive={false} />
            <Area type="monotone" dataKey="lo" stackId="1" fill="#2563eb" fillOpacity={0.13} stroke="none" legendType="none" isAnimationActive={false} />
            <Area type="monotone" dataKey="mid" stackId="1" fill="#2563eb" fillOpacity={0.32} stroke="none" legendType="none" isAnimationActive={false} />
            <Area type="monotone" dataKey="hi" stackId="1" fill="#2563eb" fillOpacity={0.13} stroke="none" legendType="none" isAnimationActive={false} />
            <Line type="monotone" dataKey="p50" stroke="#1d4ed8" strokeWidth={2.5} dot={false} legendType="none" isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: "flex", height: 22, borderRadius: 6, overflow: "hidden", marginTop: 4, paddingLeft: 80 }}>
        {stages.map((stage, index) => (
          <div key={stage.id} style={{ flex: stage.years, background: `#${["2563eb","16a34a","d97706","db2777","7c3aed","0891b2"][index % 6]}cc`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            <span style={{ fontSize: 10, color: "white", whiteSpace: "nowrap", padding: "0 4px", fontWeight: 700 }}>{stage.name}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: "18px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12 }}>Withdrawal Schedule</div>
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={results.withdrawalData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#9ca3af" }} label={{ value: "Year", position: "insideBottom", offset: -10, fontSize: 12, fill: "#9ca3af" }} />
              <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: "#9ca3af" }} width={72} />
              <Tooltip content={<WithdrawalTooltip />} />
              {results.stageEnds.map((stageEnd) => <ReferenceLine key={`wd-${stageEnd.x}`} x={stageEnd.x} stroke="#9ca3af" strokeDasharray="5 4" />)}
              <Bar dataKey="withdraw" fill="#1d4ed8" radius={[8, 8, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {(seqRisk.autocorr > 0 || seqRisk.crashes.length > 0) && (
        <div style={{ marginTop: 14, padding: "12px 14px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, fontSize: 12, color: "#78350f" }}>
          <strong>Sequence Risk Interpretation: </strong>
          {seqRisk.autocorr > 0 && `ρ=${seqRisk.autocorr.toFixed(2)} widens the outcome fan — the gap between P10 and P90 is larger than IID returns. `}
          {seqRisk.crashes.filter((crash) => crash.probability === 100).length > 0 && `Deterministic crash(es) at year(s) ${seqRisk.crashes.filter((crash) => crash.probability === 100).map((crash) => crash.year).join(", ")} shift all trajectories down at that point. Compare success rate to a run with no crashes to see the pure impact. `}
          {seqRisk.crashes.filter((crash) => crash.probability < 100 && crash.probability >= 5).length > 0 && `Probabilistic crashes split simulations into "hit" vs "miss" groups, visibly widening the fan at the crash year.`}
        </div>
      )}
    </div>
  );
}
