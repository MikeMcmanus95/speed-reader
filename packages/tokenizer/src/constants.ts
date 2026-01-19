// Pause multipliers (matching backend)
export const PAUSE_NORMAL = 1.0;
export const PAUSE_COMMA = 1.3;
export const PAUSE_SENTENCE = 1.8;
export const PAUSE_PARAGRAPH = 2.2;

// Abbreviations that don't end sentences
export const ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'vs', 'etc', 'inc', 'ltd',
  'co', 'corp', 'st', 'ave', 'blvd', 'rd', 'ft', 'mt', 'jan', 'feb', 'mar',
  'apr', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'mon', 'tue',
  'wed', 'thu', 'fri', 'sat', 'sun', 'no', 'vol', 'pg', 'pp', 'fig', 'ca',
  'cf', 'eg', 'ie', 'al', 'govt', 'dept', 'univ', 'assn', 'bros', 'gen',
  'rep', 'sen', 'rev', 'hon', 'pres', 'gov', 'atty', 'supt', 'det', 'rev',
]);
