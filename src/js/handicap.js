/**
 * Calculate World Handicap System (WHS) Score Differential
 * @param {number} score Adjusted Gross Score
 * @param {number} courseRating USGA Course Rating (e.g., 72.4)
 * @param {number} slopeRating USGA Slope Rating (e.g., 135)
 * @param {number} pcc Playing Conditions Calculation adjustment (default 0)
 * @returns {number} Score Differential rounded to 1 decimal place
 */
export function calculateDifferential(score, courseRating, slopeRating, pcc = 0) {
  if (score === null || score === undefined || score === '' || isNaN(Number(score))) {
    return null;
  }
  if (courseRating === null || courseRating === undefined || courseRating === '' || isNaN(Number(courseRating))) {
    return null;
  }
  if (slopeRating === null || slopeRating === undefined || slopeRating === '' || isNaN(Number(slopeRating))) {
    return null;
  }

  const s = Number(score);
  const cr = Number(courseRating);
  const sr = Number(slopeRating);
  const p = Number(pcc) || 0;

  if (sr === 0) {
    return null;
  }

  const rawDiff = (113 / sr) * (s - cr - p);
  return Math.round(rawDiff * 10) / 10;
}

/**
 * WHS Rule Matrix: Number of differentials used and adjustment
 * @param {number} count Number of available recent rounds (up to 20)
 * @returns {{ countUsed: number, adjustment: number }}
 */
export function getWHSMatrix(count) {
  if (count < 3) return { countUsed: count, adjustment: 0 };
  if (count === 3) return { countUsed: 1, adjustment: -2.0 };
  if (count === 4) return { countUsed: 1, adjustment: -1.0 };
  if (count === 5) return { countUsed: 1, adjustment: 0 };
  if (count === 6) return { countUsed: 2, adjustment: -1.0 };
  if (count >= 7 && count <= 8) return { countUsed: 2, adjustment: 0 };
  if (count >= 9 && count <= 11) return { countUsed: 3, adjustment: 0 };
  if (count >= 12 && count <= 14) return { countUsed: 4, adjustment: 0 };
  if (count >= 15 && count <= 16) return { countUsed: 5, adjustment: 0 };
  if (count >= 17 && count <= 18) return { countUsed: 6, adjustment: 0 };
  if (count === 19) return { countUsed: 7, adjustment: 0 };
  return { countUsed: 8, adjustment: 0 }; // 20+ rounds
}

/**
 * Calculate Handicap Index from a list of rounds
 * @param {Array<Object>} rounds
 * @returns {{ index: number|null, numRounds: number, usedRoundIds: Set<string>, recent20: Array<Object>, lowIndex: number|null }}
 */
export function calculateHandicapIndex(rounds = []) {
  if (!rounds || rounds.length === 0) {
    return {
      index: null,
      numRounds: 0,
      usedRoundIds: new Set(),
      recent20: [],
      lowIndex: null
    };
  }

  // Sort rounds chronologically descending (newest first)
  const sorted = [...rounds].sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at));

  // Take the most recent 20 rounds
  const recent20 = sorted.slice(0, 20);
  const count = recent20.length;

  if (count < 3) {
    // If fewer than 3 rounds, cannot calculate official WHS index, but provide provisional if available
    const lowest = Math.min(...recent20.map(r => Number(r.differential ?? calculateDifferential(r.score, r.course_rating, r.slope_rating))));
    return {
      index: isFinite(lowest) ? Math.round(lowest * 10) / 10 : null,
      isProvisional: true,
      numRounds: count,
      usedRoundIds: new Set(recent20.map(r => r.id)),
      recent20,
      lowIndex: null
    };
  }

  const { countUsed, adjustment } = getWHSMatrix(count);

  // Map each round to its differential
  const mapped = recent20.map(r => ({
    id: r.id,
    differential: Number(r.differential ?? calculateDifferential(r.score, r.course_rating, r.slope_rating))
  }));

  // Sort by differential ascending (lowest differentials first)
  const byDiff = [...mapped].sort((a, b) => a.differential - b.differential);
  const used = byDiff.slice(0, countUsed);
  const usedRoundIds = new Set(used.map(u => u.id));

  const sum = used.reduce((acc, u) => acc + u.differential, 0);
  const avg = sum / countUsed;
  const rawIndex = avg + adjustment;
  const index = Math.round(rawIndex * 10) / 10;

  return {
    index,
    isProvisional: false,
    numRounds: count,
    usedRoundIds,
    recent20,
    lowIndex: Math.round((byDiff[0]?.differential ?? index) * 10) / 10
  };
}

/**
 * Compute performance statistics summary
 * @param {Array<Object>} rounds
 * @returns {Object}
 */
export function calculateStatsSummary(rounds = []) {
  if (!rounds || rounds.length === 0) {
    return {
      totalRounds: 0,
      scoringAvg: null,
      lowScore: null,
      bestDiff: null,
      avgPutts: null,
      firPct: null,
      girPct: null
    };
  }

  let totalScore = 0;
  let minScore = Infinity;
  let minDiff = Infinity;
  let totalPutts = 0;
  let puttsCount = 0;
  let totalFirHit = 0;
  let totalFirPoss = 0;
  let totalGirHit = 0;
  let totalGirPoss = 0;

  rounds.forEach(r => {
    const score = Number(r.score);
    if (!isNaN(score) && score > 0) {
      totalScore += score;
      if (score < minScore) minScore = score;
    }

    const diff = Number(r.differential ?? calculateDifferential(r.score, r.course_rating, r.slope_rating));
    if (!isNaN(diff) && diff < minDiff) {
      minDiff = diff;
    }

    if (r.stats?.putts) {
      totalPutts += Number(r.stats.putts);
      puttsCount++;
    }

    if (r.stats?.fairways_total && r.stats?.fairways_hit !== undefined) {
      totalFirHit += Number(r.stats.fairways_hit);
      totalFirPoss += Number(r.stats.fairways_total);
    }

    if (r.stats?.gir_total && r.stats?.gir_hit !== undefined) {
      totalGirHit += Number(r.stats.gir_hit);
      totalGirPoss += Number(r.stats.gir_total);
    }
  });

  return {
    totalRounds: rounds.length,
    scoringAvg: rounds.length > 0 ? (Math.round((totalScore / rounds.length) * 10) / 10).toFixed(1) : null,
    lowScore: isFinite(minScore) ? minScore : null,
    bestDiff: isFinite(minDiff) ? (Math.round(minDiff * 10) / 10).toFixed(1) : null,
    avgPutts: puttsCount > 0 ? (Math.round((totalPutts / puttsCount) * 10) / 10).toFixed(1) : null,
    firPct: totalFirPoss > 0 ? Math.round((totalFirHit / totalFirPoss) * 100) : null,
    girPct: totalGirPoss > 0 ? Math.round((totalGirHit / totalGirPoss) * 100) : null
  };
}
