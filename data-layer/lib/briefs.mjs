// Decision Brief queue scanner (DB-1 storage convention).
// Phase 1 has no daemon, so we scan on SessionStart + Stop (spec §4.2). Phase 2's
// app does real fs-watch. Briefs live at:
//   ~/.claude/grandma/briefs/<project>/<brief-id>.md  with YAML frontmatter:
//   id, project, title, status: pending|approved|rejected|edits, created_ts, cwd, source
// Returns the current queue and any brief_* events to emit (status transitions).

import fs from 'node:fs';
import path from 'node:path';
import { GRANDMA_DIR, CURRENT_PATH, readJSON, makeEvent } from './state.mjs';

const BRIEFS_DIR = path.join(GRANDMA_DIR, 'briefs');

function parseFrontmatter(text) {
  const m = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) return {};
  const out = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

function scanFiles() {
  const briefs = [];
  let projects = [];
  try { projects = fs.readdirSync(BRIEFS_DIR); } catch { return briefs; }
  for (const proj of projects) {
    const dir = path.join(BRIEFS_DIR, proj);
    let files = [];
    try { files = fs.readdirSync(dir).filter(f => f.endsWith('.md')); } catch { continue; }
    for (const f of files) {
      const full = path.join(dir, f);
      let text, stat;
      try { text = fs.readFileSync(full, 'utf8'); stat = fs.statSync(full); } catch { continue; }
      const fm = parseFrontmatter(text);
      briefs.push({
        brief_id: fm.id || `${proj}/${f}`,
        project: fm.project || proj,
        brief_title: fm.title || f.replace(/\.md$/, ''),
        brief_status: fm.status || 'pending',
        created_ts: fm.created_ts || new Date(stat.birthtimeMs || stat.mtimeMs).toISOString(),
        cwd: fm.cwd || null,
        brief_path: full,
      });
    }
  }
  return briefs;
}

// Diff against last-known statuses (persisted in current.json) and emit events.
export function scanBriefs() {
  const briefs = scanFiles();
  const prev = {};
  for (const b of (readJSON(CURRENT_PATH, {}).brief_queue || [])) prev[b.brief_id] = b.brief_status;

  const events = [];
  const eventName = { pending: 'brief_created', approved: 'brief_approved', rejected: 'brief_rejected', edits: 'brief_edited' };
  for (const b of briefs) {
    if (prev[b.brief_id] === b.brief_status) continue; // unchanged
    const ev = eventName[b.brief_status] || 'brief_created';
    events.push(makeEvent(ev, {
      project: b.project, cwd: b.cwd,
      meta: { brief_id: b.brief_id, brief_path: b.brief_path, brief_title: b.brief_title, brief_status: b.brief_status },
    }));
  }
  // Queue shown to the UI = anything still awaiting the Owner.
  const queue = briefs
    .filter(b => b.brief_status === 'pending' || b.brief_status === 'edits')
    .map(b => ({ ...b, age_ms: Date.now() - Date.parse(b.created_ts || '') || 0 }));
  return { queue, events };
}
