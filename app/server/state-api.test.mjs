// Regression tests for the enrichment seam (app/server/state-api.mjs).
// Run: `npm test` (from app/) or `node --test server/`. node:test only, no deps.
//
// One HOME sandbox for the whole file (node --test runs each test file in its own
// process, so the module state here is isolated from usage.test.mjs). HOME/TMPDIR are
// set BEFORE importing state-api so it (and its usage import) bind to the sandbox.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REAL_TMP = os.tmpdir();
const SB = fs.mkdtempSync(path.join(REAL_TMP, 'grandma-stateapi-'));
process.env.HOME = SB;
process.env.TMPDIR = path.join(SB, 'tmp');

const STATE = path.join(SB, '.claude', 'grandma', 'state');
const SESSIONS = path.join(STATE, 'sessions');
const EVENTS = path.join(STATE, 'events.ndjson');
const PROJECTS = path.join(SB, '.claude', 'projects');
for (const d of [SESSIONS, PROJECTS, process.env.TMPDIR, path.join(SB, '.claude', 'grandma')]) fs.mkdirSync(d, { recursive: true });
fs.writeFileSync(EVENTS, '');

const NOW_ISO = new Date().toISOString();
const FUTURE = Math.floor(Date.now() / 1000) + 100000; // resets_at in the current window

const { enrich } = await import('./state-api.mjs');
const { localDayKey } = await import('./usage.mjs');

after(() => fs.rmSync(SB, { recursive: true, force: true }));

// --- fixture helpers ---------------------------------------------------------
function clearSessions() { for (const f of fs.readdirSync(SESSIONS)) fs.rmSync(path.join(SESSIONS, f)); }
function writeSlice(o) { fs.writeFileSync(path.join(SESSIONS, o.session_id + '.json'), JSON.stringify(o)); }
function writeEvents(objs) { fs.writeFileSync(EVENTS, objs.map((o) => JSON.stringify(o)).join('\n') + (objs.length ? '\n' : '')); }
function writeSubagent(hash, session, agentId, rows) {
  const file = path.join(PROJECTS, hash, session, 'subagents', `agent-${agentId}.jsonl`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, rows.join('\n') + '\n');
}
function asst(id, input, output) {
  return JSON.stringify({ type: 'assistant', timestamp: NOW_ISO, message: { id, usage: { input_tokens: input, output_tokens: output } } });
}
function rl(pct) { return { five_hour: { used_percentage: pct, resets_at: FUTURE }, seven_day: { used_percentage: 1, resets_at: FUTURE } }; }
function spin(ms) { const t = Date.now(); while (Date.now() - t < ms) { /* ensure Date.now advances between enrich calls */ } }

test('orphan agents (no resolvable project) bucket under "unknown", not dropped', () => {
  clearSessions(); writeEvents([]);
  const out = enrich({ agents: [{ agent_id: 'orphanX', session_id: 'sessNone', status: 'done', start_ts: NOW_ISO }], sessions: {} });
  assert.equal(out.agents.length, 1);
  assert.equal(out.agents[0].project, 'unknown');
});

test('Session Feed events carry FRESH per-agent tokens (matching the Agent Team)', () => {
  clearSessions();
  writeSubagent('ph', 'sessF', 'AGF', [asst('x1', 30, 3), asst('x1', 30, 3), asst('x1', 30, 3), asst('x2', 10, 1), asst('x2', 10, 1)]);
  writeEvents([{ schema_version: 1, event_id: 'e1', ts: NOW_ISO, event: 'subagent_stop', agent_id: 'AGF', session_id: 'sessF', agent_type: 'gp', project: 'p', tokens_in: 999999, tokens_out: 111111 }]);
  const out = enrich({ agents: [], sessions: {} });
  const ev = out.recent_events.find((e) => e.event === 'subagent_stop');
  assert.ok(ev, 'subagent_stop event present in recent_events');
  assert.equal(ev.fresh_in, 40);   // x1 once (30) + x2 once (10); fan-out deduped
  assert.equal(ev.fresh_out, 4);   // 3 + 1
  assert.equal(ev.tokens_in, 999999); // original cache-inclusive event field left intact
});

test('5h gauge tracks the freshest READING, not the most recent statusline render', () => {
  clearSessions();
  // live-repro shape: A idle@59 rendered most recently, B@79, C@82 — all current-window
  writeSlice({ session_id: 'A', last_ts: '2026-06-30T01:00:03-0700', rate_limits: rl(59) });
  writeSlice({ session_id: 'B', last_ts: '2026-06-30T01:00:01-0700', rate_limits: rl(79) });
  writeSlice({ session_id: 'C', last_ts: '2026-06-30T01:00:02-0700', rate_limits: rl(82) });
  const g1 = enrich({ agents: [], sessions: {} }).rate_limits.five_hour.used_percentage;
  assert.equal(g1, 59); // cold start: readings tie -> tie-break on newest last_ts (A)

  spin(5); // guarantee Date.now() advances so the changed reading gets a strictly newer timestamp
  writeSlice({ session_id: 'A', last_ts: '2026-06-30T01:00:10-0700', rate_limits: rl(59) }); // idle re-render: newest last_ts, SAME %
  writeSlice({ session_id: 'C', last_ts: '2026-06-30T01:00:08-0700', rate_limits: rl(83) }); // actively burning: % changed
  const g2 = enrich({ agents: [], sessions: {} }).rate_limits.five_hour.used_percentage;
  assert.equal(g2, 83); // C's moved reading wins despite A holding the newest last_ts
});

test('today.date is keyed on the local day', () => {
  clearSessions();
  const out = enrich({ agents: [], sessions: {} });
  assert.equal(out.today.date, localDayKey());
  assert.match(out.today.date, /^\d{4}-\d{2}-\d{2}$/);
});
