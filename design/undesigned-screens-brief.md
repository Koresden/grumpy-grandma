> **SUPERSEDED 2026-06-15.** All three were subsequently designed in the updated bundle:
> `Grandma Briefs.dc.html` (View 3), `Grandma Ledger.dc.html` (View 4), and the shared
> **Project Switcher** component (on Briefs + Ledger). See the bundle `README.md` §7, §8,
> and "Project Switcher". This file is kept for the data-binding rationale and §7 guardrails;
> the live trigger names in `grandma_lines.json` have been reconciled to the components
> (`brief_piling`, `brief_stale`, `history_quiet`, `history_spike`, `history_topagent`).

# Design briefs — the three undesigned screens

These three are required by the spec but absent from the Claude Design bundle
(`design_handoff_grumpy_grandma/`). Generate each to **match the existing bundle**:
same fonts, palette, radii, shadows, motion, and the grumpy-grandma voice. Treat the
bundle's `README.md` "Design Tokens" as canonical and reuse the values cited below
verbatim.

Two rules apply to all three (from the spec):
- **No mock data may survive.** Every value binds to the real Phase-1 data layer:
  `~/.claude/grandma/state/current.json` (cheap snapshot) and `events.ndjson`
  (append-only log, schema v1). Field names below are exact.
- **All copy routes through `grandma_lines.json`.** Don't hardcode quips; add the
  trigger keys listed per screen.

Shared tokens (from the bundle README, do not invent new ones):
- Type: **Libre Caslon Text** (titles + italic quips), **IBM Plex Mono** (data/tokens/
  timestamps/paths), system sans (UI/body).
- Surfaces: cards `#FFFDF9`, border `#E6DCC9`, radius 18, padding 22, shadow
  `0 10px 26px rgba(80,55,35,0.10)` (hover `0 18px 38px rgba(80,55,35,0.18)`, lift
  `translateY(-4px)`, 0.16s ease). Page bg radial `#F3EBDD → #E4D8C6 → #C9B79E`.
- Ink: `#3A2F28` / `#6E5F50` / `#7A6A5A`. Eyebrow labels: 11px, uppercase, letter-spacing
  2.6px, `#927E63`. Status: done `#5FA552`, working = accent, waiting `#D9A23E`,
  queued/pending `#C2C6CE`, error `#E0604F`.
- Radii 9–18 (chips 9–10, cards 16–18, pills 50%). Grid gap 22. Motion: `breathe`,
  status `ring/pulse` 1.2–1.8s, data `dash` 0.5–0.7s linear, toast `slide-in` 0.32s.
- Include a "← Desktop" affordance top-left (consistent with the other views).

---

## 1. Decision Brief Queue  (spec View 3)

**Purpose**: show pending Decision Briefs awaiting the Owner, with age, and let him jump
straight to one. Grandma nags when a brief has sat too long.

**Layout**: full window/panel on the page bg. Header row: animated grandma-head avatar +
title block (eyebrow "GRUMPY GRANDMA"; H1 "The Brief Queue", Libre Caslon 30px/700) and a
right-aligned count pill ("3 waiting"). Below: a **single-column stack of brief cards**
(max-width ~720, gap 14). Empty state: a calm grandma + centered italic line ("Nothing on
my desk. Suspiciously quiet.").

**Brief card** (one per queued brief): standard card tokens. Left: a status pip + the brief
**title** (16px/700) and a mono **project · id** subline (12px `#7A6A5A`). Right: an **age
badge** (mono) that escalates color — calm `#7A6A5A` < 30 min, `#D9A23E` 30–60 min,
`#E0604F` > 60 min — and an **"Open ›"** button in the accent color. Optional second line:
truncated decision text. Card hover = lift.

**Live data bindings** — `current.json.brief_queue[]`, each:
`{ brief_id, brief_title, brief_status, project, cwd, brief_path, created_ts, age_ms }`.
- Card list = the array, sorted oldest-first (largest `age_ms`).
- Age badge = `age_ms` (render as "45 min", "1 h 12 m"). Threshold colors above.
- Count pill = `brief_queue.length`.
- **"Open ›"** = deep link to `brief_path` in the editor/terminal, rooted at `cwd`
  (the data layer already records both). On macOS, an `open -t`/`$EDITOR` style action.
- Status pip color by `brief_status`: pending `#D9A23E`, edits `#7D62B0`
  (approved/rejected leave the queue, so they won't normally appear here).
- Live updates: the app tails `events.ndjson` for `brief_created` / `brief_approved` /
  `brief_rejected` / `brief_edited` and re-reads the queue; a new card uses `spawn pop`,
  a resolved one fades out.

**Personality** (`grandma_lines.json`): reuse existing **`brief_pending`** (fires when any
`age_ms > 30 min`). Add **`brief_queue_empty`** (calm) and **`brief_resolved`** (a grudging
"about time"). Grandma's avatar tier rises with the oldest brief's age.

**Guardrails**: judges metadata only — show title/age/path, never brief body content unless
the user opens it. No writing to brief files from this view (read + deep-link only).

---

## 2. History  (spec View 4)

**Purpose**: where the tokens (and dollars) actually went — per-day trend, per-agent
breakdown, and "top offenders". This is Grandma's ledger.

**Layout**: full window. Header (avatar + "The Ledger" H1) with a **range toggle** chip group
(7d / 30d / all) and a **project filter** dropdown (ties to screen 3 below). Body, vertically:
1. **Per-day chart** — a bar/area chart, one bar per day, IBM Plex Mono axis labels. Dual
   series toggle: cost ($) / tokens. Today's bar highlighted.
2. **Per-agent breakdown** — horizontal bars ranked by tokens, colored by the agent accents
   from the bundle (orchestrator plum `#7A5C84`, research `#5A93C8`, build `#5FA57E`,
   review `#9A78C8`, etc.), each row: agent name + role + mono token total + cost.
3. **Top offenders** — 3 callout cards ("Your scout agent ate 40% of the groceries this
   week") with grandma commentary.

**Live data bindings** — aggregate `events.ndjson` client-side (the app may read the log
directly for history; this is the one view that legitimately scans it):
- Filter to `subagent_stop` events (carry `tokens_in`, `tokens_out`, `agent_type`, `agent`,
  `model`, `project`, `cwd`, `ts`, `duration_ms`) plus `session_start`/`session_end` for
  session counts.
- Per-day chart: bucket by `ts[0:10]`; sum `tokens_in+tokens_out` and (where present)
  `cost_usd`. Today's live values from `current.json.today`.
- Per-agent breakdown: group by `agent_type` (or `agent`); sum tokens; rank desc.
- Top offenders: top-N agents/projects by share of the selected range.
- Range/project filters operate on the same buckets.

**Caveat to surface honestly**: per-event `cost_usd` is best-effort and session-level
"today" sums each session's *cumulative* total (overcounts long/multi-day sessions). Tokens
are exact (from the per-subagent transcript). If a cost figure is an estimate, label it.

**Personality** (`grandma_lines.json`): add **`history_top_offender`** (e.g. "Your {{agent}}
ate {{pct}}% of the groceries this {{range}}."), **`history_quiet_day`**, **`history_spendy_day`**.
Templated with `{{agent}}`, `{{pct}}`, `{{range}}` — keep the templating in the lines file,
not in logic.

**Guardrails**: aggregate metadata only (tokens/cost/agent/project/time) — never prompt or
output content.

---

## 3. Project Switcher  (spec §5.5 — "project switcher in UI")

**Purpose**: Grandma watches several projects at once (each session is keyed by project).
This is how the Owner scopes every view to one project — or sees all. Required by the §5.5
acceptance criteria; no screen in the bundle covers it.

**Layout**: not a full screen — a **persistent control in the app chrome** (e.g. a pill in
the Hub header and a compact dropdown carried into each view, next to "← Desktop"). Two forms:
- **Hub form**: a horizontal row of **project chips** under the Desktop header. Each chip:
  project name (sans), a mono "live" dot if it has an active session, and a tiny per-project
  usage tick (today's spend). An "All projects" chip on the left (default).
- **In-view form**: a compact dropdown showing the current project; selecting one re-scopes
  the active view. Selected chip uses an accent ring; idle projects are muted (`#C2C6CE`).

**Live data bindings** — `current.json`:
- Project list = distinct `project` across `current.json.sessions{}` (each session slice
  carries `project`, `cwd`, `cost_usd`, `last_ts`, `severity`). Also union with recent
  `events.ndjson` projects so dormant-but-recent projects still appear.
- "live" dot = any session with that `project` whose `last_ts` is recent / not `ended`.
- Per-chip usage tick = sum of that project's session `cost_usd` for today.
- Selection state lives in the app (persist last choice); it filters which `sessions` /
  `agents` / `brief_queue` rows the other views render. "All" = no filter.

**Personality** (`grandma_lines.json`): add **`project_switch`** (a dry remark when switching,
e.g. "Oh, we're worrying about {{project}} now, are we?") and **`project_idle`** (for a
project with no recent activity). Templated with `{{project}}`.

**Guardrails**: derive project identity from `project` / `cwd` only (already in the data
layer). No new ingestion — this is a pure filter over existing state.

---

## Related: the Session Feed needs a rework (not strictly undesigned)

`Grandma Session Feed.dc.html` *exists*, but its row types (read/grep/edit/run with
file paths) require per-tool, content-level events that schema v1 deliberately excludes
(§7 "no per-message content analysis"). For the build it must be **re-specified at the
metadata level**: rows = our real event enum only — `session_start`, `session_end`,
`subagent_start`, `subagent_stop`, `handoff`, `brief_*` — with mono timestamps, agent
name/type, and token deltas; Grandma commentary from `grandma_lines.json`. Keep the
terminal aesthetic and tick-in motion; just feed it metadata, not tool calls. (If this
was the "third" you meant, treat this as its brief and skip the Project Switcher above
until you ask for it.)
