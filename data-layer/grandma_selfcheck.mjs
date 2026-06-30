#!/usr/bin/env node
// Soak instrumentation (DB-3). Run any time during the 2-day soak:
//   node ~/.claude/grandma/grandma_selfcheck.mjs
// Checks the acceptance criteria that can be measured offline: events.ndjson
// integrity (S4), current.json validity, statusline latency percentiles (S1),
// and log-size guard (S11/D7). Read-only; changes nothing.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { EVENTS_PATH, CURRENT_PATH, GRANDMA_DIR, SCHEMA_VERSION } from './lib/state.mjs';

const REQUIRED = ['schema_version', 'event_id', 'ts', 'event'];
const out = [];
const log = (s) => out.push(s);

// --- S4: events.ndjson integrity --------------------------------------------
let total = 0, bad = 0, wrongVer = 0;
const byType = {};
if (fs.existsSync(EVENTS_PATH)) {
  const lines = fs.readFileSync(EVENTS_PATH, 'utf8').split('\n').filter(Boolean);
  for (const ln of lines) {
    total++;
    let o; try { o = JSON.parse(ln); } catch { bad++; continue; }
    for (const k of REQUIRED) if (!(k in o)) { bad++; break; }
    if (o.schema_version !== SCHEMA_VERSION) wrongVer++;
    byType[o.event] = (byType[o.event] || 0) + 1;
  }
  log(`S4 events.ndjson: ${total} lines, ${bad} malformed, ${wrongVer} wrong schema_version`);
  log(`   by event: ${JSON.stringify(byType)}`);
} else {
  log('S4 events.ndjson: not created yet');
}

// --- current.json validity ---------------------------------------------------
if (fs.existsSync(CURRENT_PATH)) {
  try {
    const c = JSON.parse(fs.readFileSync(CURRENT_PATH, 'utf8'));
    const agentsUp = (c.agents || []).filter(a => a.status === 'active').length;
    log(`current.json: ok — today $${(c.today?.cost_usd ?? 0)}, ${Object.keys(c.sessions || {}).length} session(s), ` +
        `${(c.agents || []).length} agent(s) (${agentsUp} active), ${(c.brief_queue || []).length} brief(s) queued, sev=${c.severity}`);
  } catch { log('current.json: INVALID JSON'); }
} else {
  log('current.json: not created yet');
}

// --- S1: statusline latency over 50 runs ------------------------------------
const mock = JSON.stringify({
  session_id: 'selfcheck', model: { id: 'claude-opus-4-8', display_name: 'Opus' },
  workspace: { current_dir: process.cwd() },
  context_window: { used_percentage: 62, context_window_size: 200000 },
  cost: { total_cost_usd: 1.84 },
  rate_limits: { five_hour: { used_percentage: 20 }, seven_day: { used_percentage: 35 } },
});
const sl = path.join(GRANDMA_DIR, 'grandma_statusline.sh');
const times = [];
let sample = '';
for (let i = 0; i < 50; i++) {
  const t0 = process.hrtime.bigint();
  try { sample = execFileSync('bash', [sl], { input: mock, env: { ...process.env, COLUMNS: '120' } }).toString().trim(); }
  catch { sample = '(statusline error)'; }
  times.push(Number(process.hrtime.bigint() - t0) / 1e6);
}
// The timed renders wrote a throwaway session slice — remove it so the check is read-only.
try { fs.rmSync(path.join(GRANDMA_DIR, 'state', 'sessions', 'selfcheck.json')); } catch {}

times.sort((a, b) => a - b);
const pct = (p) => times[Math.min(times.length - 1, Math.floor(p / 100 * times.length))].toFixed(1);
log(`S1 statusline latency (ms): p50=${pct(50)} p95=${pct(95)} p100=${times[times.length - 1].toFixed(1)}  ` +
    `[target p95<100, p100<300]`);
log(`   sample render: ${sample}`);

// --- S11/D7: log-size guard --------------------------------------------------
if (fs.existsSync(EVENTS_PATH)) {
  const mb = fs.statSync(EVENTS_PATH).size / 1e6;
  log(`S11 events.ndjson size: ${mb.toFixed(2)} MB${mb > 25 ? '  ⚠️ over 25MB — consider rotation' : ''}`);
}

console.log('Grandma self-check\n------------------\n' + out.join('\n'));
