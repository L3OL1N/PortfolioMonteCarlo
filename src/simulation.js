import { ASSETS, COR } from "./constants";
import { cholesky, portfolioMoments, randn, randStudentT } from "./utils";

export function simulate(stages, initial, numSims, inflation, seqRisk, rebalance = "annual", distribution = "normal") {
  const { autocorr, crashes } = seqRisk;
  const totalYears = stages.reduce((s, st) => s + st.years, 0);
  const yearVals = Array.from({ length: totalYears + 1 }, () => new Array(numSims).fill(0));
  const withdrawalSums = Array(totalYears + 1).fill(0);

  const assetCov = ASSETS.map((a, i) => ASSETS.map((b, j) => a.std * b.std * COR[i][j]));
  const assetChol = cholesky(assetCov);
  const assetMeans = ASSETS.map((a) => a.ret);
  const assetMeansReal = assetMeans.map((m) => (1 + m) / (1 + inflation) - 1);
  const numAssets = ASSETS.length;
  const rng = distribution === "fat" ? randStudentT : randn;

  for (let sim = 0; sim < numSims; sim++) {
    let yi = 0;
    const stagePrevShock = stages.map(() => new Array(numAssets).fill(0));
    const assetValues = ASSETS.map((asset) => initial * stages[0].alloc[asset.key]);
    yearVals[0][sim] = initial;

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
      const weights = ASSETS.map((a) => stages[stIdx].alloc[a.key]);
      const totalBeforeStage = assetValues.reduce((sum, value) => sum + value, 0);
      if (totalBeforeStage > 0) {
        assetValues.forEach((_, idx) => {
          assetValues[idx] = totalBeforeStage * weights[idx];
        });
      }

      for (let y = 0; y < stages[stIdx].years; y++) {
        yi++;
        const totalBefore = assetValues.reduce((sum, value) => sum + value, 0);
        if (totalBefore > 0 || stages[stIdx].cf > 0) {
          const recovery = recoveryMap[yi] || 0;
          if (activeCrashes[yi]) {
            assetValues.forEach((_, idx) => {
              assetValues[idx] *= 1 + activeCrashes[yi].magnitude / 100;
            });
            stagePrevShock[stIdx] = stagePrevShock[stIdx].map((s) => s * autocorr);
          } else {
            const eps = Array.from({ length: numAssets }, rng);
            const correlated = assetChol.map((row) => row.reduce((sum, lij, j) => sum + lij * eps[j], 0));
            const nextShock = correlated.map((value, idx) => autocorr * stagePrevShock[stIdx][idx] + Math.sqrt(1 - autocorr * autocorr) * value);
            stagePrevShock[stIdx] = nextShock;
            assetValues.forEach((_, idx) => {
              assetValues[idx] *= 1 + assetMeansReal[idx] + nextShock[idx] + recovery;
            });
          }

          const totalAfter = assetValues.reduce((sum, value) => sum + value, 0);
          let cashFlow = stages[stIdx].cf;
          const withdrawalMode = stages[stIdx].withdrawalMode || "fixed";
          if (stages[stIdx].cf < 0 && withdrawalMode === "dynamic") {
            const baseWithdrawal = Math.abs(stages[stIdx].cf);
            const withdrawalRate = stages[stIdx].withdrawalRate != null ? stages[stIdx].withdrawalRate : 4.0;
            const currentTarget = totalAfter * (withdrawalRate / 100);
            const minSpending = baseWithdrawal * 0.8;
            const maxSpending = baseWithdrawal * 1.2;
            let finalSpending = Math.max(minSpending, Math.min(maxSpending, currentTarget));
            finalSpending = Math.min(totalAfter, finalSpending);
            cashFlow = -finalSpending;
          }
          const adjustedTotal = Math.max(0, totalAfter + cashFlow);
          withdrawalSums[yi] += Math.max(0, -cashFlow);
          const currentWeights = totalAfter > 0 ? assetValues.map((value) => value / totalAfter) : weights;
          if (rebalance === "annual") {
            assetValues.forEach((_, idx) => {
              assetValues[idx] = adjustedTotal * weights[idx];
            });
          } else {
            assetValues.forEach((_, idx) => {
              assetValues[idx] = adjustedTotal * currentWeights[idx];
            });
          }
        }
        yearVals[yi][sim] = assetValues.reduce((sum, value) => sum + value, 0);
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

  const withdrawalData = withdrawalSums.slice(1).map((sum, index) => ({
    year: index + 1,
    withdraw: Math.round(sum / numSims),
    monthly: Math.round(sum / numSims / 12),
  }));

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
    withdrawalData,
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
