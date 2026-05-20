import { ASSETS, COR } from "./constants";

export function cholesky(mat) {
  const n = mat.length;
  const L = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = 0;
      for (let k = 0; k < j; k++) s += L[i][k] * L[j][k];
      L[i][j] = i === j ? Math.sqrt(Math.max(0, mat[i][i] - s)) : (mat[i][j] - s) / L[j][j];
    }
  }
  return L;
}

export function randn() {
  let u, v;
  do { u = Math.random(); v = Math.random(); } while (u === 0);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function randStudentT(df = 4) {
  const z = randn();
  let sumSq = 0;
  for (let i = 0; i < df; i++) {
    const x = randn();
    sumSq += x * x;
  }
  return z / Math.sqrt(sumSq / df);
}

export function portfolioMoments(weights) {
  let mu = 0;
  for (let i = 0; i < ASSETS.length; i++) mu += weights[i] * ASSETS[i].ret;
  let variance = 0;
  for (let i = 0; i < ASSETS.length; i++) {
    for (let j = 0; j < ASSETS.length; j++) {
      variance += weights[i] * weights[j] * COR[i][j] * ASSETS[i].std * ASSETS[j].std;
    }
  }
  return { mu, sigma: Math.sqrt(Math.max(0, variance)) };
}

export const fmt = (v) => {
  if (v == null) return "–";
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${Math.round(v / 1e3)}K`;
  return `$${Math.round(v)}`;
};

export const allocTotal = (alloc) => ASSETS.reduce((sum, asset) => sum + Number(alloc[asset.key] || 0), 0);

export const makeStage = (name, years, cf, alloc) => ({
  id: Math.random().toString(36).slice(2),
  name,
  years,
  cf,
  alloc: { ...alloc },
});

export const makeCrash = (year = 1, magnitude = -30, probability = 100, recoveryYears = 2) => ({
  id: Math.random().toString(36).slice(2),
  year,
  magnitude,
  probability,
  recoveryYears,
});
