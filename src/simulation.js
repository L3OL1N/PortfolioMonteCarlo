import { ASSETS, COR } from "./constants";
import { cholesky, portfolioMoments, randn, randStudentT } from "./utils";

export function simulate(stages, initial, numSims, inflation, seqRisk, rebalance = "annual", distribution = "normal", emergencyFundConfig = { enabled: false, years: 3, bearThreshold: -10 }) {
  const { autocorr, crashes } = seqRisk;

  // Emergency fund setup
  const efEnabled = !!(emergencyFundConfig && emergencyFundConfig.enabled);
  const efYears = efEnabled ? (emergencyFundConfig.years || 3) : 0;
  const bearThreshold = efEnabled ? ((emergencyFundConfig.bearThreshold != null ? emergencyFundConfig.bearThreshold : -10) / 100) : -0.10;
  const maxAnnualWithdrawal = stages.reduce((max, st) => (st.cf < 0 ? Math.max(max, Math.abs(st.cf)) : max), 0);
  const efMax = efEnabled ? efYears * maxAnnualWithdrawal : 0;

  const totalYears = stages.reduce((s, st) => s + st.years, 0);
  const yearVals = Array.from({ length: totalYears + 1 }, () => new Array(numSims).fill(0));
  const withdrawalSums = Array(totalYears + 1).fill(0);
  const efWithdrawalSums = Array(totalYears + 1).fill(0);
  const year3AssetValues = Array.from({ length: ASSETS.length }, () => []);
  const year3AssetShares = Array.from({ length: ASSETS.length }, () => []);
  const finalAssetValues = Array.from({ length: ASSETS.length }, () => []);
  const finalAssetShares = Array.from({ length: ASSETS.length }, () => []);

  const assetCov = ASSETS.map((a, i) => ASSETS.map((b, j) => a.std * b.std * COR[i][j]));
  const assetChol = cholesky(assetCov);
  const assetMeans = ASSETS.map((a) => a.ret);
  const assetMeansReal = assetMeans.map((m) => (1 + m) / (1 + inflation) - 1);
  const numAssets = ASSETS.length;
  const rng = distribution === "fat" ? randStudentT : randn;
  const yearlyAssetValues = Array.from({ length: totalYears + 1 }, () =>
    Array.from({ length: numAssets }, () => [])
  );

  const efVals = efEnabled ? Array.from({ length: totalYears + 1 }, () => new Array(numSims).fill(0)) : null;

  for (let sim = 0; sim < numSims; sim++) {
    let yi = 0;
    let efBalance = efMax;
    const stagePrevShock = stages.map(() => new Array(numAssets).fill(0));
    const assetValues = ASSETS.map((asset) => initial * stages[0].alloc[asset.key]);
    yearVals[0][sim] = initial;
    if (efEnabled && efVals) efVals[0][sim] = efBalance;

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

          // Bear market detection: portfolio dropped below threshold this year
          const portfolioReturn = totalBefore > 0 ? (totalAfter - totalBefore) / totalBefore : 0;
          const isBear = efEnabled && (portfolioReturn < bearThreshold || !!activeCrashes[yi]);

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

          // Use emergency fund during bear markets to avoid selling investments cheap
          let efUsedThisYear = 0;
          if (efEnabled && cashFlow < 0 && isBear && efBalance > 0) {
            const needed = Math.abs(cashFlow);
            efUsedThisYear = Math.min(needed, efBalance);
            efBalance -= efUsedThisYear;
            cashFlow = -(needed - efUsedThisYear);
          }

          let adjustedTotal = Math.max(0, totalAfter + cashFlow);
          withdrawalSums[yi] += Math.max(0, -cashFlow);
          efWithdrawalSums[yi] += efUsedThisYear;

          // Replenish EF from portfolio during non-bear years (up to 0.5× max annual withdrawal per year)
          if (efEnabled && !isBear && efBalance < efMax && maxAnnualWithdrawal > 0 && adjustedTotal > 0) {
            const replenish = Math.min(efMax - efBalance, maxAnnualWithdrawal * 0.5, adjustedTotal * 0.1);
            efBalance = Math.min(efMax, efBalance + replenish);
            adjustedTotal = Math.max(0, adjustedTotal - replenish);
          }

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

        if (yi === 3) {
          const totalYear3 = assetValues.reduce((sum, value) => sum + value, 0);
          assetValues.forEach((value, idx) => {
            year3AssetValues[idx].push(value);
            year3AssetShares[idx].push(totalYear3 > 0 ? value / totalYear3 : 0);
          });
        }

        if (yi === totalYears) {
          const totalFinal = assetValues.reduce((sum, value) => sum + value, 0);
          assetValues.forEach((value, idx) => {
            finalAssetValues[idx].push(value);
            finalAssetShares[idx].push(totalFinal > 0 ? value / totalFinal : 0);
          });
        }

        yearVals[yi][sim] = assetValues.reduce((sum, value) => sum + value, 0);

        // Collect yearly asset values for line chart
        assetValues.forEach((value, idx) => {
          yearlyAssetValues[yi][idx].push(value);
        });

        // Track emergency fund balance per year
        if (efEnabled && efVals) efVals[yi][sim] = efBalance;
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

  const withdrawalData = withdrawalSums.slice(1).map((sum, index) => {
    const ef = efWithdrawalSums[index + 1];
    return {
      year: index + 1,
      withdraw: Math.round(sum / numSims),
      monthly: Math.round((sum + ef) / numSims / 12),
      efWithdraw: Math.round(ef / numSims),
    };
  });

  // Emergency fund balance percentiles per year
  let emergencyFundData = null;
  if (efEnabled && efVals) {
    emergencyFundData = efVals.map((vals, y) => {
      const sorted = [...vals].sort((a, b) => a - b);
      return {
        year: y,
        p10: Math.round(pct(sorted, 0.10)),
        p25: Math.round(pct(sorted, 0.25)),
        p50: Math.round(pct(sorted, 0.50)),
        p75: Math.round(pct(sorted, 0.75)),
        p90: Math.round(pct(sorted, 0.90)),
      };
    });
  }

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

  const year3AssetSummary = totalYears >= 3 ? ASSETS.reduce((acc, asset, idx) => {
    const values = [...year3AssetValues[idx]].sort((a, b) => a - b);
    const shares = [...year3AssetShares[idx]].sort((a, b) => a - b);
    acc[asset.key] = {
      label: asset.label,
      p10: pct(values, 0.10),
      p50: pct(values, 0.50),
      p75: pct(values, 0.75),
      p90: pct(values, 0.90),
      pct10: pct(shares, 0.10),
      pct50: pct(shares, 0.50),
      pct75: pct(shares, 0.75),
      pct90: pct(shares, 0.90),
    };
    return acc;
  }, {}) : null;

  const finalAssetSummary = totalYears >= 1 ? ASSETS.reduce((acc, asset, idx) => {
    const values = [...finalAssetValues[idx]].sort((a, b) => a - b);
    const shares = [...finalAssetShares[idx]].sort((a, b) => a - b);
    acc[asset.key] = {
      label: asset.label,
      p10: pct(values, 0.10),
      p50: pct(values, 0.50),
      p75: pct(values, 0.75),
      p90: pct(values, 0.90),
      pct10: pct(shares, 0.10),
      pct50: pct(shares, 0.50),
      pct75: pct(shares, 0.75),
      pct90: pct(shares, 0.90),
    };
    return acc;
  }, {}) : null;

  // Calculate yearly asset p50 data for line chart
  const yearlyAssetP50Data = Array.from({ length: totalYears + 1 }, (_, year) => {
    const dataPoint = { year };
    ASSETS.forEach((asset, idx) => {
      const values = [...yearlyAssetValues[year][idx]].sort((a, b) => a - b);
      dataPoint[asset.key] = Math.round(pct(values, 0.50));
    });
    return dataPoint;
  });

  return {
    chartData,
    withdrawalData,
    stageEnds,
    year3AssetSummary,
    finalAssetSummary,
    yearlyAssetP50Data,
    emergencyFundData,
    emergencyFundInitial: efMax,
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
