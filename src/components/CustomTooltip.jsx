import { fmt } from "../utils";

export default function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 14px", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,.1)" }}>
      <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 13 }}>Year {d.year}</div>
      {[
        ["90th", d.p90, "#15803d"],
        ["75th", d.p75, "#4d7c0f"],
        ["Median", d.p50, "#1d4ed8"],
        ["25th", d.p25, "#c2410c"],
        ["10th", d.p10, "#b91c1c"],
      ].map(([label, value, color]) => (
        <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 20, color, lineHeight: 1.9 }}>
          <span>{label}</span>
          <span style={{ fontWeight: 700 }}>{fmt(value)}</span>
        </div>
      ))}
    </div>
  );
}
