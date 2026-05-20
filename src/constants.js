export const ASSETS = [
  { key: "us",          label: "US Stocks",       ret: 0.100, std: 0.170, color: "#2563eb" },
  { key: "allianztech", label: "安聯台灣科技基金",  ret: 0.200, std: 0.380, color: "#7c3aed" },
  { key: "farmland",    label: "農地",              ret: 0.070, std: 0.080, color: "#15803d" },
  { key: "gold",        label: "黃金",              ret: 0.060, std: 0.160, color: "#95890a" },
  { key: "cash",        label: "Cash",             ret: 0.020, std: 0.010, color: "#6b7280" },
];

export const COR = [
  [ 1.00,  0.00,  0.72, -0.05,  0.10],
  [ 0.00,  1.00,  0.00,  0.00,  0.00],
  [ 0.72,  0.00,  1.00, -0.08,  0.05],
  [-0.05,  0.00, -0.08,  1.00,  0.10],
  [ 0.10,  0.00,  0.05,  0.10,  1.00],
];

export const PRESETS = [
  { id: "none",        label: "No Preset",              autocorr: 0,    crashes: [] },
  { id: "2008",        label: "2008 Financial Crisis",   autocorr: 0.15, crashes: [{ year: 4, magnitude: -37, probability: 100, recoveryYears: 3 }] },
  { id: "dotcom",      label: "Dot-com Bust (2000–02)",  autocorr: 0.20, crashes: [{ year: 4, magnitude: -22, probability: 100, recoveryYears: 1 }, { year: 5, magnitude: -13, probability: 100, recoveryYears: 1 }, { year: 6, magnitude: -24, probability: 100, recoveryYears: 2 }] },
  { id: "depression",  label: "Great Depression",        autocorr: 0.30, crashes: [{ year: 4, magnitude: -43, probability: 100, recoveryYears: 1 }, { year: 5, magnitude: -9, probability: 100, recoveryYears: 1 }, { year: 6, magnitude: -26, probability: 100, recoveryYears: 5 }] },
  { id: "stagflation", label: "1970s Stagflation",       autocorr: 0.35, crashes: [] },
  { id: "bear",        label: "Random Bear Market",      autocorr: 0.10, crashes: [{ year: 4, magnitude: -30, probability: 100, recoveryYears: 3 }] },
];

export const PHASE_COLS = ["#2563eb", "#16a34a", "#d97706", "#db2777", "#7c3aed", "#0891b2"];
