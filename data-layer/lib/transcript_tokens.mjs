// Per-agent token attribution (resolves R2).
// Claude Code writes a dedicated per-subagent transcript next to the parent:
//   <parent_transcript without .jsonl>/subagents/agent-<agent_id>.jsonl
// Each assistant row carries message.usage. Summing it equals the runtime's
// reported subagent token total exactly (verified 29105 == 29105, 2026-06-13).

import fs from 'node:fs';

export function subagentTranscriptPath(parentTranscriptPath, agentId) {
  const base = parentTranscriptPath.replace(/\.jsonl$/, '');
  return `${base}/subagents/agent-${agentId}.jsonl`;
}

export function sumAgentTokens(parentTranscriptPath, agentId) {
  const file = subagentTranscriptPath(parentTranscriptPath, agentId);
  if (!parentTranscriptPath || !agentId || !fs.existsSync(file)) {
    return { tokens_in: null, tokens_out: null, found: false };
  }
  let tin = 0, tout = 0;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let o; try { o = JSON.parse(line); } catch { continue; }
    if (o.type !== 'assistant') continue;
    const u = o.message && o.message.usage;
    if (!u) continue;
    // tokens_in counts all billed input: fresh + cache writes + cache reads.
    tin += (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
    tout += (u.output_tokens || 0);
  }
  return { tokens_in: tin, tokens_out: tout, found: true };
}
