import { formatDate } from './dates.js';

export function formatScoreToPar(score, par) {
  const diff = Number(score) - Number(par);
  if (isNaN(diff)) return '';
  if (diff === 0) return 'E';
  if (diff > 0) return `+${diff}`;
  return `${diff}`;
}

export function getScoreClass(score, par) {
  const s = Number(score);
  const p = Number(par);
  if (isNaN(s) || isNaN(p) || s === 0) return '';
  const diff = s - p;
  if (diff <= -2) return 'score-eagle';
  if (diff === -1) return 'score-birdie';
  if (diff === 0) return 'score-par';
  if (diff === 1) return 'score-bogey';
  return 'score-double';
}
