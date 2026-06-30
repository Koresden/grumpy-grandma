#!/usr/bin/env node
// Single hook entrypoint, dispatched by hook_event_name. Wired in settings.json
// to SessionStart, SessionEnd, SubagentStart, SubagentStop, Stop.
//
// Contract (spec §4.4, §7): READ-ONLY observer. It must NEVER block the pipeline
// and must ALWAYS exit 0 — every path is wrapped so a failure is a silent no-op.
// Token/cost are not in any hook payload, so per-agent tokens are summed from the
// dedicated subagent transcript (see lib/transcript_tokens.mjs).

import fs from 'node:fs';
import path from 'node:path';
import {
  isDisabled, ensureDirs, makeEvent, appendEvent, rebuildCurrent,
  writeAtomic, readJSON, AGENTS_DIR, SESSIONS_DIR,
} from './lib/state.mjs';
import { sumAgentTokens } from './lib/transcript_tokens.mjs';
import { scanBriefs } from './lib/briefs.mjs';

main();

function main() {
  try {
    if (isDisabled()) return ok();
    const input = readStdin();
    if (!input) return ok();
    ensureDirs();

    const evt = input.hook_event_name;
    const base = {
      session_id: input.session_id || null,
      cwd: input.cwd || null,
      project: projectOf(input.cwd),
      model: modelOf(input),
    };

    switch (evt) {
      case 'SessionStart': onSessionStart(input, base); break;
      case 'SessionEnd': onSessionEnd(input, base); break;
      case 'SubagentStart': onSubagentStart(input, base); break;
      case 'SubagentStop': onSubagentStop(input, base); break;
      case 'Stop': onStop(input, base); break;
      default: /* unknown event: ignore */ break;
    }
  } catch {
    // swallow — Grandma never breaks Claude Code
  }
  ok();
}

function onSessionStart(input, base) {
  appendEvent(makeEvent('session_start', { ...base, meta: { source: input.source || null } }));
  const { queue } = scanBriefs();
  rebuildCurrent(queue);
}

function onSessionEnd(input, base) {
  appendEvent(makeEvent('session_end', { ...base, meta: { end_reason: input.end_reason || null } }));
  mergeSession(base.session_id, { ended: true, ended_ts: new Date().toISOString() });
  rebuildCurrent();
}

function onSubagentStart(input, base) {
  const agentId = input.agent_id || null;
  const parent = base.session_id ? `main:${base.session_id}` : null;
  const common = { ...base, agent: input.agent_type || null, agent_id: agentId,
                   agent_type: input.agent_type || null, parent_agent_id: parent };
  appendEvent(makeEvent('subagent_start', common));
  appendEvent(makeEvent('handoff', { ...common, meta: { from: parent, to: agentId, direction: 'down' } }));
  writeAgent(agentId, {
    agent_id: agentId, agent_type: input.agent_type || null, session_id: base.session_id,
    status: 'active', start_ts: new Date().toISOString(), tokens_in: null, tokens_out: null,
  });
  rebuildCurrent();
}

function onSubagentStop(input, base) {
  const agentId = input.agent_id || null;
  const parent = base.session_id ? `main:${base.session_id}` : null;
  const prior = readAgent(agentId);
  const { tokens_in, tokens_out, found } = sumAgentTokens(input.transcript_path, agentId);
  const stop_ts = new Date().toISOString();
  const duration_ms = prior && prior.start_ts ? Date.parse(stop_ts) - Date.parse(prior.start_ts) : null;
  const common = {
    ...base, agent: input.agent_type || (prior && prior.agent_type) || null, agent_id: agentId,
    agent_type: input.agent_type || (prior && prior.agent_type) || null, parent_agent_id: parent,
    tokens_in, tokens_out, duration_ms, meta: { tokens_found: found },
  };
  appendEvent(makeEvent('subagent_stop', common));
  appendEvent(makeEvent('handoff', { ...common, meta: { from: agentId, to: parent, direction: 'up' } }));
  writeAgent(agentId, { ...(prior || { agent_id: agentId, session_id: base.session_id }),
    agent_type: common.agent_type, status: 'done', stop_ts, duration_ms, tokens_in, tokens_out });
  rebuildCurrent();
}

function onStop(_input, _base) {
  // Main-session turn end: cheap periodic tick — rescan briefs, refresh snapshot.
  const { queue } = scanBriefs();
  rebuildCurrent(queue);
}

// ---- helpers ----------------------------------------------------------------

function agentFile(agentId) { return path.join(AGENTS_DIR, `agent-${safe(agentId)}.json`); }
function readAgent(agentId) { return agentId ? readJSON(agentFile(agentId), null) : null; }
function writeAgent(agentId, obj) { if (agentId) writeAtomic(agentFile(agentId), JSON.stringify(obj, null, 2)); }

function mergeSession(sessionId, patch) {
  if (!sessionId) return;
  const file = path.join(SESSIONS_DIR, `${safe(sessionId)}.json`);
  const cur = readJSON(file, {}) || {};
  writeAtomic(file, JSON.stringify({ ...cur, ...patch }, null, 2));
}

function projectOf(cwd) {
  if (!cwd) return null;
  return path.basename(cwd).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || null;
}

function modelOf(input) {
  if (typeof input.model === 'string') return input.model;
  if (input.model && input.model.id) return input.model.id;
  return null;
}

function safe(s) { return String(s || 'unknown').replace(/[^A-Za-z0-9_.:-]/g, '_'); }

function readStdin() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function ok() { process.exit(0); }
