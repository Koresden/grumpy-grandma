// Accurate "today" usage for the preview, computed server-side from ground truth.
// - tokens: FRESH input+output (excludes cache_creation/cache_read), summed across BOTH
//   main-session transcripts AND sub-agent transcripts under ~/.claude/projects.
// - cost: a per-day DELTA ledger over each session's cumulative cost_usd (client estimate),
//   so "today" means today's spend, not the sum of session lifetimes.
// Everything is cached / guarded so it never stalls or breaks the SSE stream.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PROJECTS = path.join(os.homedir(), '.claude', 'projects');
const LEDGER = path.join(os.tmpdir(), 'grandma-cost-ledger.json'); // NOT under the watched state dir

function localDayStartMs() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
}
function readJSON(p, fb) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fb; } }

// One assistant turn is written as SEVERAL JSONL rows (one per content block: thinking /
// text / tool_use), and every row repeats the SAME message.id + identical message.usage;
// resumed/compacted sessions also copy rows across transcripts. So summing usage per row
// multiplies a turn's tokens by its block count (and again per copy). Counting each
// message.id once collapses both. Returns true the first time an id is seen, false after.
// Rows lacking a message.id are always counted (can't dedupe, and shouldn't occur here).
function countOnce(seen, o) {
  const id = o.message && o.message.id;
  if (!id) return true;
  if (seen.has(id)) return false;
  seen.add(id);
  return true;
}

// --- fresh tokens today (cached ~10s; parses only transcripts touched today) ---------
let _tok = { at: 0, val: { input: 0, output: 0 } };

function* transcriptFiles() {
  let hashes = [];
  try { hashes = fs.readdirSync(PROJECTS); } catch { return; }
  for (const h of hashes) {
    const dir = path.join(PROJECTS, h);
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (e.isFile() && e.name.endsWith('.jsonl')) yield path.join(dir, e.name);          // main session
      else if (e.isDirectory()) {                                                          // <session>/subagents/*
        const sub = path.join(dir, e.name, 'subagents');
        let subs = [];
        try { subs = fs.readdirSync(sub); } catch { continue; }
        for (const f of subs) if (f.endsWith('.jsonl')) yield path.join(sub, f);
      }
    }
  }
}

export function todayTokens() {
  const now = Date.now();
  if (now - _tok.at < 10000) return _tok.val;
  const start = localDayStartMs();
  let input = 0, output = 0;
  const seen = new Set();                                    // dedupe by message.id (see countOnce)
  for (const f of transcriptFiles()) {
    let st; try { st = fs.statSync(f); } catch { continue; }
    if (st.mtimeMs < start) continue;                       // not touched today → skip parse
    let text; try { text = fs.readFileSync(f, 'utf8'); } catch { continue; }
    for (const line of text.split('\n')) {
      if (!line) continue;
      let o; try { o = JSON.parse(line); } catch { continue; }
      if (o.type !== 'assistant') continue;
      if (o.timestamp && Date.parse(o.timestamp) < start) continue;
      const u = o.message && o.message.usage;
      if (!u || !countOnce(seen, o)) continue;
      input += u.input_tokens || 0;                          // FRESH only — no cache_* fields
      output += u.output_tokens || 0;
    }
  }
  _tok = { at: now, val: { input, output } };
  return _tok.val;
}

// --- fresh tokens per agent (for the Agent Team) --------------------------------------
// Agent records store cache-inclusive totals; fresh = input+output from the sub-agent
// transcript. Cache by agent_id + file mtime (done agents never change → computed once).
const _hashBySession = {};
function sessionHashDir(sid) {
  if (_hashBySession[sid]) return _hashBySession[sid];
  let hashes = [];
  try { hashes = fs.readdirSync(PROJECTS); } catch { return null; }
  for (const h of hashes) {
    const d = path.join(PROJECTS, h);
    if (fs.existsSync(path.join(d, sid + '.jsonl')) || fs.existsSync(path.join(d, sid))) { _hashBySession[sid] = d; return d; }
  }
  return null; // not cached when missing, so a later-created session can still resolve
}

const _agentTok = {};
export function agentFreshTokens(agentId, sessionId) {
  const dir = sessionHashDir(sessionId);
  if (!dir) return { in: null, out: null };
  const p = path.join(dir, sessionId, 'subagents', `agent-${agentId}.jsonl`);
  let st; try { st = fs.statSync(p); } catch { return { in: null, out: null }; }
  const c = _agentTok[agentId];
  if (c && c.mtime === st.mtimeMs) return { in: c.in, out: c.out };
  let input = 0, output = 0;
  const seen = new Set();                                    // dedupe by message.id (see countOnce)
  try {
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      if (!line) continue;
      let o; try { o = JSON.parse(line); } catch { continue; }
      if (o.type !== 'assistant') continue;
      const u = o.message && o.message.usage;
      if (!u || !countOnce(seen, o)) continue;
      input += u.input_tokens || 0;
      output += u.output_tokens || 0;
    }
  } catch { return { in: null, out: null }; }
  _agentTok[agentId] = { mtime: st.mtimeMs, in: input, out: output };
  return { in: input, out: output };
}

// --- per-day fresh tokens over the last N days (for the Ledger), cached ~30s -----------
let _week = { at: 0, days: 7, val: {} };
export function dailyTokens(nDays = 7) {
  const now = Date.now();
  if (now - _week.at < 30000 && _week.days === nDays) return _week.val;
  const start = localDayStartMs() - (nDays - 1) * 86400000;
  const buckets = {}; // 'YYYY-MM-DD' -> {input, output}
  const seen = new Set();                                    // dedupe by message.id (see countOnce)
  for (const f of transcriptFiles()) {
    let st; try { st = fs.statSync(f); } catch { continue; }
    if (st.mtimeMs < start) continue;
    let text; try { text = fs.readFileSync(f, 'utf8'); } catch { continue; }
    for (const line of text.split('\n')) {
      if (!line) continue;
      let o; try { o = JSON.parse(line); } catch { continue; }
      if (o.type !== 'assistant') continue;
      const t = o.timestamp ? Date.parse(o.timestamp) : 0;
      if (!t || t < start) continue;
      const u = o.message && o.message.usage;
      if (!u || !countOnce(seen, o)) continue;
      const d = new Date(t);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const b = (buckets[key] ||= { input: 0, output: 0 });
      b.input += u.input_tokens || 0;
      b.output += u.output_tokens || 0;
    }
  }
  _week = { at: now, days: nDays, val: buckets };
  return buckets;
}

// --- cost today: per-day delta ledger over cumulative session cost --------------------
let _ledger = null;
function loadLedger() {
  if (!_ledger) _ledger = readJSON(LEDGER, null) || { date: '', last: {}, total: 0 };
  return _ledger;
}
export function costToday(sessions) {
  const today = new Date().toISOString().slice(0, 10);
  const L = loadLedger();
  if (L.date !== today) { L.date = today; L.last = {}; L.total = 0; }
  for (const [sid, s] of Object.entries(sessions || {})) {
    const c = Number(s && s.cost_usd) || 0;
    const prev = L.last[sid];
    if (prev == null) L.last[sid] = c;                       // first sighting = baseline, don't count
    else if (c > prev) { L.total += c - prev; L.last[sid] = c; }
  }
  try { fs.writeFileSync(LEDGER, JSON.stringify(L)); } catch {}
  return L.total;
}
