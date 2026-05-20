export default function AutocorrMeter({ value }) {
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
