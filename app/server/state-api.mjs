// Shared data seam — the SSE + enrichment logic, used by BOTH the Vite dev server
// (vite.config.js) and the standalone sidecar server (server.mjs) so the verified
// accuracy behavior is identical in dev and in the shipped app. Phase 1 untouched.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { todayTokens, costToday, agentFreshTokens, dailyTokens } from './usage.mjs';

const STATE_DIR = path.join(os.homedir(), '.claude', 'grandma', 'state');
const CURRENT = path.join(STATE_DIR, 'current.json');
const EVENTS = path.join(STATE_DIR, 'events.ndjson');
const LINES = path.join(os.homedir(), '.claude', 'grandma', 'grandma_lines.json');

function readJSON(p, fb) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fb; } }

// events.ndjson carries project + agent_id/session_id on every subagent/session event, so
// build agent_id->project and session_id->project to attribute agents whose slice rotated.
function projectMaps() {
  const byAgent = {}, bySession = {};
  let text = '';
  try { text = fs.readFileSync(EVENTS, 'utf8'); } catch { return { byAgent, bySession }; }
  for (const line of text.split('\n')) {
    if (!line) continue;
    let o; try { o = JSON.parse(line); } catch { continue; }
    if (!o.project) continue;
    if (o.agent_id) byAgent[o.agent_id] = o.project;
    if (o.session_id) bySession[o.session_id] = o.project;
  }
  return { byAgent, bySession };
}

// Session slices, fresh from disk (statusline writes these every render — fresher than current.json).
function readSlices() {
  const dir = path.join(STATE_DIR, 'sessions');
  const out = [];
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')); } catch { return out; }
  for (const f of files) { const s = readJSON(path.join(dir, f), null); if (s && s.session_id) out.push(s); }
  return out;
}

// Account-global 5h limit. It's a ROLLING window (usage ages out → % can tick down), so
// `max` over-reports. The accurate "now" value is the FRESHEST reading from a CURRENT-window
// session (resets_at still in the future). Stale past-window readings — idle sessions that
// re-render with a days-old reading — are excluded entirely. Freshest-within-current avoids
// the original jitter because the stale sessions causing it are filtered out first.
function freshestRateLimits(slices) {
  const withRL = slices.filter((s) => s.rate_limits && s.rate_limits.five_hour);
  if (!withRL.length) return null;
  const nowSec = Date.now() / 1000; // resets_at is epoch seconds
  const current = withRL.filter((s) => (s.rate_limits.five_hour.resets_at || 0) > nowSec);
  const pool = current.length ? current : withRL; // prefer current window; fall back if none
  pool.sort((a, b) => String(b.last_ts || '').localeCompare(String(a.last_ts || '')));
  return pool[0].rate_limits;
}

const ACTIVE_MAX_MS = 30 * 60 * 1000;   // an "active" agent older than this = orphaned (missed stop)
const OPEN_SESSION_MS = 20 * 60 * 1000; // a session counts as "open" if seen within this window

export function enrich(cur) {
  if (!cur || typeof cur !== 'object') return cur;
  const now = Date.now();
  const { byAgent, bySession } = projectMaps();
  const sessions = cur.sessions || {};
  const slices = readSlices();

  if (Array.isArray(cur.agents)) {
    cur.agents = cur.agents.map((a) => {
      const project = a.project || byAgent[a.agent_id] || bySession[a.session_id] || sessions[a.session_id]?.project || null;
      const fresh = project ? agentFreshTokens(a.agent_id, a.session_id) : { in: null, out: null };
      return {
        ...a,
        project,
        stale: a.status === 'active' && a.start_ts ? (now - Date.parse(a.start_ts) > ACTIVE_MAX_MS) : false,
        fresh_in: fresh.in, fresh_out: fresh.out,
      };
    });
  }

  const fresh = freshestRateLimits(slices);
  if (fresh) cur.rate_limits = fresh;

  cur.open_sessions = slices.filter((s) => s.last_ts && now - Date.parse(s.last_ts) < OPEN_SESSION_MS).length;

  const ft = todayTokens();
  const sessMap = Object.fromEntries(slices.map((s) => [s.session_id, s]));
  cur.today = {
    date: new Date().toISOString().slice(0, 10),
    tokens_in: ft.input, tokens_out: ft.output,
    cost_usd: costToday(sessMap),
    estimated: true,
  };

  // recent metadata events for the Session Feed (newest first; NO tool-level content, §7)
  cur.recent_events = readEvents(40);
  return cur;
}

// Last n events from the log, newest first.
function readEvents(n) {
  let text = '';
  try { text = fs.readFileSync(EVENTS, 'utf8'); } catch { return []; }
  const lines = text.split('\n').filter(Boolean);
  const out = [];
  for (const line of lines.slice(-n)) {
    try { out.push(JSON.parse(line)); } catch { /* skip */ }
  }
  return out.reverse();
}

// Rough cost estimate from fresh tokens (Opus-ish input/output rates, cache excluded). Labeled "est".
const RATE_IN = 15, RATE_OUT = 75; // $ per 1M tokens
function estCost(input, output) { return (input / 1e6) * RATE_IN + (output / 1e6) * RATE_OUT; }

// --- HTTP handlers (node http req/res — work as Vite connect middleware too) -----------
export function handleLines(_req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(readJSON(LINES, {})));
}

// The Ledger: 7-day fresh-token chart + per-agent ranking ("top offenders"), from
// transcripts (per-day) + events.ndjson (per-agent), all FRESH tokens. Cost is a rough est.
export function handleHistory(_req, res) {
  const buckets = dailyTokens(7);
  const today = new Date();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const b = buckets[key] || { input: 0, output: 0 };
    const tokens = b.input + b.output;
    days.push({ date: key, label: d.toLocaleDateString(undefined, { weekday: 'short' }), tokens, cost: estCost(b.input, b.output) });
  }

  // per-agent over the last 7 days, fresh tokens, ranked
  const weekStart = Date.now() - 7 * 86400000;
  const byType = {};
  let text = '';
  try { text = fs.readFileSync(EVENTS, 'utf8'); } catch { /* none */ }
  for (const line of text.split('\n')) {
    if (!line) continue;
    let o; try { o = JSON.parse(line); } catch { continue; }
    if (o.event !== 'subagent_stop' || !o.agent_id) continue;
    if (o.ts && Date.parse(o.ts) < weekStart) continue;
    const f = agentFreshTokens(o.agent_id, o.session_id);
    const key = o.agent_type || 'agent';
    const a = (byType[key] ||= { agent_type: key, tokens: 0, runs: 0 });
    a.tokens += (f.in || 0) + (f.out || 0);
    a.runs += 1;
  }
  const agents = Object.values(byType).sort((x, y) => y.tokens - x.tokens);
  const total = days.reduce((s, d) => s + d.tokens, 0);
  const cost = days.reduce((s, d) => s + d.cost, 0);

  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ days, agents, total, cost, estimated: true }));
}

export function handleStream(req, res) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  const send = () => res.write(`data: ${JSON.stringify(enrich(readJSON(CURRENT, {})))}\n\n`);
  send();
  let t = null, watcher = null;
  try {
    watcher = fs.watch(STATE_DIR, { recursive: true }, () => { clearTimeout(t); t = setTimeout(send, 80); });
  } catch { /* state dir missing → just the initial frame */ }
  const refresh = setInterval(send, 3000);
  const keepAlive = setInterval(() => res.write(': ping\n\n'), 15000);
  req.on('close', () => { clearInterval(keepAlive); clearInterval(refresh); clearTimeout(t); watcher && watcher.close(); });
}
