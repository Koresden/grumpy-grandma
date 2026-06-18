// Live Reaction escalation tiers keyed to the 5-HOUR RATE WINDOW (DB-4 / D10).
export const TIERS = [
  { key: 'content', name: 'Content', color: 'var(--t-content)', max: 19 },
  { key: 'watchful', name: 'Watchful', color: 'var(--t-watchful)', max: 41 },
  { key: 'busy', name: 'Busy', color: 'var(--t-busy)', max: 63 },
  { key: 'antsy', name: 'Antsy', color: 'var(--t-antsy)', max: 83 },
  { key: 'meltdown', name: 'Meltdown', color: 'var(--t-meltdown)', max: 100 },
];

// 5-hour window % from the live snapshot (0 if absent — e.g. not yet seen / non Pro-Max).
export function windowPct(current) {
  return Math.round(current?.rate_limits?.five_hour?.used_percentage ?? 0);
}

export function tierIndex(current) {
  const p = windowPct(current);
  const i = TIERS.findIndex((t) => p <= t.max);
  return i === -1 ? TIERS.length - 1 : i;
}
