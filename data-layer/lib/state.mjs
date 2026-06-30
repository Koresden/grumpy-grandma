// I/O + state layer for Grandma Phase 1.
// Responsibility: paths, atomic file writes, an advisory lock, ULID ids,
// the append-only event log, and assembling current.json from the per-session
// + per-agent slices. No personality, no hook dispatch logic here.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const GRANDMA_DIR = path.join(os.homedir(), '.claude', 'grandma');
export const STATE_DIR = path.join(GRANDMA_DIR, 'state');
export const SESSIONS_DIR = path.join(STATE_DIR, 'sessions');
export const AGENTS_DIR = path.join(STATE_DIR, 'agents');
export const EVENTS_PATH = path.join(STATE_DIR, 'events.ndjson');
export const CURRENT_PATH = path.join(STATE_DIR, 'current.json');
export const OFF_PATH = path.join(GRANDMA_DIR, 'OFF');
export const SCHEMA_VERSION = 1;

// Soft kill-switch: an OFF sentinel file or GRANDMA_OFF=1 silences everything.
export function isDisabled() {
  return process.env.GRANDMA_OFF === '1' || fs.existsSync(OFF_PATH);
}

// Graceful no-op if the state dir was removed: recreate the slices we own.
export function ensureDirs() {
  for (const d of [STATE_DIR, SESSIONS_DIR, AGENTS_DIR]) fs.mkdirSync(d, { recursive: true });
}

// Crockford base32 ULID: time-ordered + unique, so consumers sort by ts then event_id.
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function ulid(now = Date.now()) {
  let t = now, time = '';
  for (let i = 0; i < 10; i++) { time = B32[t % 32] + time; t = Math.floor(t / 32); }
  let rand = '';
  for (let i = 0; i < 16; i++) rand += B32[Math.floor(Math.random() * 32)];
  return time + rand;
}

// Atomic write: temp file on the same dir, then rename (never leaves a torn file).
export function writeAtomic(file, text) {
  const tmp = `${file}.tmp-${process.pid}-${Math.floor(Math.random() * 1e6)}`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

// Best-effort advisory lock via O_EXCL. Caps total wait so a hook NEVER blocks the
// pipeline (acceptance S3): if we can't get the lock fast, we proceed unlocked.
export function withLock(name, fn, { tries = 25, waitMs = 2 } = {}) {
  const lock = path.join(STATE_DIR, `.${name}.lock`);
  let fd = null;
  for (let i = 0; i < tries; i++) {
    try { fd = fs.openSync(lock, 'wx'); break; } catch { sleep(waitMs); }
  }
  try { return fn(); }
  finally { if (fd !== null) { try { fs.closeSync(fd); fs.unlinkSync(lock); } catch {} } }
}

function sleep(ms) { // tiny synchronous spin; ms is single digits
  const end = Date.now() + ms; while (Date.now() < end) {}
}

export function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

// Append one schema-v1 event as a single line. Oversized meta is dropped so the
// line stays small enough that O_APPEND keeps it atomic (acceptance S4, R11).
export function appendEvent(ev) {
  let line = JSON.stringify(ev);
  if (line.length > 3500) { ev = { ...ev, meta: { truncated: true } }; line = JSON.stringify(ev); }
  fs.appendFileSync(EVENTS_PATH, line + '\n');
}

export function makeEvent(event, fields = {}) {
  return {
    schema_version: SCHEMA_VERSION,
    event_id: ulid(),
    ts: new Date().toISOString(),
    event,
    session_id: null, project: null, cwd: null, model: null,
    agent: null, agent_id: null, parent_agent_id: null, agent_type: null,
    tokens_in: null, tokens_out: null, cost_usd: null, duration_ms: null,
    meta: {},
    ...fields,
  };
}

// Reassemble current.json from the slices the statusline (sessions/) and hook
// (agents/, briefs) own. Written under lock so concurrent sessions don't tear it.
export function rebuildCurrent(briefQueue) {
  withLock('current', () => {
    const sessions = {};
    let latestRate = null, latestRateTs = '';
    let todayCost = 0, todayIn = 0, todayOut = 0;
    const today = new Date().toISOString().slice(0, 10);

    // Session slices (statusline-owned) supply cost / context / rate limits.
    for (const f of listJSON(SESSIONS_DIR)) {
      const s = readJSON(path.join(SESSIONS_DIR, f), null);
      if (!s || !s.session_id) continue;
      sessions[s.session_id] = s;
      if ((s.last_ts || '').slice(0, 10) === today) todayCost += Number(s.cost_usd) || 0;
      if (s.rate_limits && (s.last_ts || '') > latestRateTs) { latestRate = s.rate_limits; latestRateTs = s.last_ts; }
    }

    // Agent slices (hook-owned) supply authoritative token totals.
    const agents = [];
    for (const f of listJSON(AGENTS_DIR)) {
      const a = readJSON(path.join(AGENTS_DIR, f), null);
      if (!a || !a.agent_id) continue;
      agents.push(a);
      if ((a.stop_ts || a.start_ts || '').slice(0, 10) === today) {
        todayIn += Number(a.tokens_in) || 0;
        todayOut += Number(a.tokens_out) || 0;
      }
    }

    // Highest severity currently shown across live sessions, for Phase 2.
    const rank = { content: 0, suspicious: 1, disappointed: 2, slipper_thrown: 3 };
    let severity = 'content';
    for (const s of Object.values(sessions)) if ((rank[s.severity] ?? 0) > rank[severity]) severity = s.severity;

    const current = {
      schema_version: SCHEMA_VERSION,
      updated_ts: new Date().toISOString(),
      sessions,
      today: { date: today, cost_usd: round(todayCost), tokens_in: todayIn, tokens_out: todayOut },
      agents,
      brief_queue: briefQueue ?? readJSON(CURRENT_PATH, {}).brief_queue ?? [],
      rate_limits: latestRate,
      severity,
    };
    writeAtomic(CURRENT_PATH, JSON.stringify(current, null, 2));
    return current;
  });
}

function listJSON(dir) { try { return fs.readdirSync(dir).filter(f => f.endsWith('.json')); } catch { return []; } }
function round(n) { return Math.round(n * 1e6) / 1e6; }
