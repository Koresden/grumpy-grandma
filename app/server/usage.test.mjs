// Regression tests for the token/cost accuracy logic (app/server/usage.mjs).
// Run: `npm test` (from app/) or `node --test server/`. No test deps — node:test only.
//
// Strategy: each case builds a throwaway HOME sandbox of fixture transcripts under the
// real $TMPDIR, points HOME/TMPDIR at it, then dynamically re-imports usage.mjs with a
// cache-busting query so it binds its ~/.claude paths to that sandbox with fresh caches.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REAL_TMP = os.tmpdir(); // capture before we override TMPDIR
const NOW_ISO = new Date().toISOString();
const sandboxes = [];
let _bust = 0;

after(() => { for (const sb of sandboxes) fs.rmSync(sb, { recursive: true, force: true }); });

// assistant transcript row carrying message.usage (the only rows usage.mjs counts)
function asst(id, input, output, ts = NOW_ISO) {
  return JSON.stringify({ type: 'assistant', timestamp: ts, message: { id, usage: { input_tokens: input, output_tokens: output } } });
}
function writeJsonl(file, rows) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, rows.join('\n') + '\n');
}

// fresh sandbox + freshly-evaluated usage module bound to it
async function freshUsage(build) {
  const sb = fs.mkdtempSync(path.join(REAL_TMP, 'grandma-usage-'));
  sandboxes.push(sb);
  process.env.HOME = sb;
  process.env.TMPDIR = path.join(sb, 'tmp');
  fs.mkdirSync(process.env.TMPDIR, { recursive: true });
  const projects = path.join(sb, '.claude', 'projects');
  fs.mkdirSync(projects, { recursive: true });
  if (build) build(projects);
  return import('./usage.mjs?bust=' + (_bust++));
}

test('todayTokens dedupes content-block fan-out and cross-file resume copies', async () => {
  const u = await freshUsage((proj) => {
    // one turn (m1) written as 3 content-block rows with identical usage; m2 distinct
    writeJsonl(path.join(proj, 'tp', 'sess-1.jsonl'), [asst('m1', 100, 10), asst('m1', 100, 10), asst('m1', 100, 10), asst('m2', 50, 5)]);
    // a resume/compaction copy: m1 again (cross-file dup) + a new m3
    writeJsonl(path.join(proj, 'tp', 'sess-1b.jsonl'), [asst('m1', 100, 10), asst('m3', 20, 2)]);
  });
  // distinct ids m1,m2,m3 counted once each: 100+50+20 / 10+5+2  (naive would be 470/47)
  assert.deepEqual(u.todayTokens(), { input: 170, output: 17 });
});

test('todayTokens sums main + sub-agent transcripts (still deduped)', async () => {
  const u = await freshUsage((proj) => {
    writeJsonl(path.join(proj, 'tp', 'sess-2.jsonl'), [asst('m1', 100, 10)]);
    writeJsonl(path.join(proj, 'tp', 'sess-2', 'subagents', 'agent-A.jsonl'), [asst('s1', 80, 8), asst('s1', 80, 8)]);
  });
  // main m1 (100/10) + sub s1 once (80/8)
  assert.deepEqual(u.todayTokens(), { input: 180, output: 18 });
});

test('dailyTokens buckets today, deduped by message.id', async () => {
  const u = await freshUsage((proj) => {
    writeJsonl(path.join(proj, 'tp', 'sess.jsonl'), [asst('m1', 100, 10), asst('m1', 100, 10), asst('m2', 50, 5)]);
  });
  const key = u.localDayKey();
  const buckets = u.dailyTokens(7);
  assert.deepEqual(buckets[key], { input: 150, output: 15 }); // m1 once + m2  (naive 250/25)
});

test('agentFreshTokens dedupes a sub-agent transcript', async () => {
  const u = await freshUsage((proj) => {
    writeJsonl(path.join(proj, 'tp', 'sess-3', 'subagents', 'agent-AG.jsonl'),
      [asst('a1', 80, 8), asst('a1', 80, 8), asst('a1', 80, 8), asst('a2', 40, 4), asst('a2', 40, 4)]);
  });
  assert.deepEqual(u.agentFreshTokens('AG', 'sess-3'), { in: 120, out: 12 }); // a1 once + a2 once (naive 320/32)
});

test('agentFreshTokens returns nulls when the transcript is missing', async () => {
  const u = await freshUsage();
  assert.deepEqual(u.agentFreshTokens('nope', 'nosession'), { in: null, out: null });
});

test('localDayKey returns the LOCAL calendar day (not UTC)', async () => {
  const u = await freshUsage();
  // constructor + getters are both local, so this is deterministic on any machine TZ
  assert.equal(u.localDayKey(new Date(2026, 5, 30, 23, 30)), '2026-06-30');
  assert.match(u.localDayKey(), /^\d{4}-\d{2}-\d{2}$/);
});

test('costToday accumulates positive per-session deltas from a first-seen baseline', async () => {
  const u = await freshUsage();
  assert.equal(u.costToday({ s1: { cost_usd: 10 } }), 0);                                   // baseline, no add
  assert.equal(u.costToday({ s1: { cost_usd: 12.5 } }), 2.5);                               // +2.50
  assert.equal(u.costToday({ s1: { cost_usd: 12.5 } }), 2.5);                               // unchanged
  assert.equal(u.costToday({ s1: { cost_usd: 12.5 }, s2: { cost_usd: 100 } }), 2.5);        // s2 baseline only
  assert.equal(u.costToday({ s1: { cost_usd: 12.5 }, s2: { cost_usd: 103 } }), 5.5);        // +3.00
});
