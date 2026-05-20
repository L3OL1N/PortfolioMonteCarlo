import { ASSETS, COR } from "./constants";
import { cholesky, portfolioMoments, randn } from "./utils";

export function simulate(stages, initial, numSims, inflation, seqRisk) {
  const { autocorr, crashes } = seqRisk;
  const totalYears = stages.reduce((s, st) => s + st.years, 0);
  const yearVals = Array.from({ length: totalYears + 1 }, () => new Array(numSims).fill(0));
  const stageMoments = stages.map((st) => portfolioMoments(ASSETS.map((a) => st.alloc[a.key])));

  const assetCov = ASSETS.map((a, i) => ASSETS.map((b, j) => a.std * b.std * COR[i][j]));
  const assetChol = cholesky(assetCov);
  const assetMeans = ASSETS.map((a) => a.ret);
  const numAssets = ASSETS.length;

  for (let sim = 0; sim < numSims; sim++) {
    let val = initial;
    yearVals[0][sim] = val;
    let yi = 0;
    const stagePrevShock = stages.map(() => new Array(numAssets).fill(0));

    const activeCrashes = {};
    const recoveryMap = {};
    for (const c of crashes) {
      if (Math.random() * 100 < c.probability) {
        activeCrashes[c.year] = c;
        const boost = Math.abs(c.magnitude / 100) / Math.max(1, c.recoveryYears);
        for (let r = 1; r <= c.recoveryYears; r++) {
          recoveryMap[c.year + r] = (recoveryMap[c.year + r] || 0) + boost;
        }
      }
    }

    for (let stIdx = 0; stIdx < stages.length; stIdx++) {
      const { mu } = stageMoments[stIdx];
      const muReal = (1 + mu) / (1 + inflation) - 1;
      const weights = ASSETS.map((a) => stages[stIdx].alloc[a.key]);
      for (let y = 0; y < stages[stIdx].years; y++) {
        yi++;
        if (val > 0 || stages[stIdx].cf > 0) {
          let ret;
          if (activeCrashes[yi]) {
            ret = activeCrashes[yi].magnitude / 100;
            stagePrevShock[stIdx] = stagePrevShock[stIdx].map((s) => s * autocorr);
          } else {
            const eps = Array.from({ length: numAssets }, randn);
            const correlated = assetChol.map((row) => row.reduce((sum, lij, j) => sum + lij * eps[j], 0));
            const nextShock = correlated.map((value, idx) => autocorr * stagePrevShock[stIdx][idx] + Math.sqrt(1 - autocorr * autocorr) * value);
            stagePrevShock[stIdx] = nextShock;
            const portfolioShock = nextShock.reduce((sum, shock, idx) => sum + shock * weights[idx], 0);
            ret = muReal + portfolioShock + (recoveryMap[yi] || 0);
          }
          val = Math.max(0, val * (1 + ret) + stages[stIdx].cf);
        }
        yearVals[yi][sim] = val;
      }
    }
  }

  const pct = (s, p) => s[Math.max(0, Math.min(s.length - 1, Math.floor(s.length * p)))];
  const chartData = yearVals.map((vals, y) => {
    const sorted = [...vals].sort((a, b) => a - b);
    const [p10, p25, p50, p75, p90] = [0.10, 0.25, 0.50, 0.75, 0.90].map((p) => Math.round(pct(sorted, p)));
    return {
      year: y,
      base: p10,
      lo: Math.max(0, p25 - p10),
      mid: Math.max(0, p75 - p25),
      hi: Math.max(0, p90 - p75),
      p10,
      p25,
      p50,
      p75,
      p90,
    };
  });

  const stageEnds = [];
  let cum = 0;
  for (let i = 0; i < stages.length - 1; i++) {
    cum += stages[i].years;
    stageEnds.push({ x: cum, name: stages[i + 1].name });
  }

  const finalSorted = [...yearVals[totalYears]].sort((a, b) => a - b);
  let ruinCount = 0;
  for (let sim = 0; sim < numSims; sim++) {
    for (let y = 1; y <= totalYears; y++) {
      if (yearVals[y][sim] === 0) {
        ruinCount++;
        break;
      }
    }
  }

  return {
    chartData,
    stageEnds,
    success: ((yearVals[totalYears].filter((v) => v > 0).length / numSims) * 100).toFixed(1),
    ruinRate: ((ruinCount / numSims) * 100).toFixed(1),
    p10: pct(finalSorted, 0.10),
    p25: pct(finalSorted, 0.25),
    p50: pct(finalSorted, 0.50),
    p75: pct(finalSorted, 0.75),
    p90: pct(finalSorted, 0.90),
    crashYears: crashes.filter((c) => c.probability >= 50).map((c) => c.year),
  };
}
