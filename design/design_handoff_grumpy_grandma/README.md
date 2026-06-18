# Handoff: Grumpy Grandma — Desktop Usage Companion

## Overview
"Grumpy Grandma" is a desktop companion that lives in the corner of a developer's machine, tracks their Claude (LLM) **token usage**, and visualizes the **agentic workflow** — grumbling at the user the whole time. The product is a small suite of connected experiences reached from a hub ("Grandma's Desktop"):

1. **Live Reaction** — an always-on widget; a full-bodied grandma acts out the current token-window usage (calm → antsy → meltdown), reacts to discrete events (new session, idle, limit hit, spend spike), and fires macOS-style notification nudges.
2. **The Workshop** — a "village office" where sub-agents are drawn as grandma clerks at desks; the orchestrator assigns work and it passes down a pipeline.
3. **The Agent Team** — a realistic multi-agent run shown two ways: an orchestration **tree** (leads spawning sub-agents) and a **timeline / Gantt** with per-agent token costs.
4. **The Workflow** — a chalkboard explainer of how a coding agent works (plan → tools → sub-agent → review → deliver), including failure branches (retry, rejection).
5. **The Session Feed** — a live activity log of agent actions, with grandma commentary.
6. **Grandmas of the World** — eight culturally-themed grandma variants tracking the same data.

## About the Design Files
The files in this bundle are **design references created in HTML** — animated prototypes showing the intended look, motion, and behavior. They are **not production code to copy directly**.

They are authored as "Design Components" (`*.dc.html`) that depend on a small bundled runtime (`support.js`) which provides a lightweight template + React-style class system. **Do not port the DC runtime.** Instead, **recreate these designs in the target codebase's existing environment** (React, Vue, SwiftUI, a native desktop shell like Electron/Tauri, etc.) using its established components, state patterns, and styling approach. If no environment exists yet, pick the most appropriate stack for a small always-on desktop widget + companion windows (e.g. React + a desktop shell) and implement there.

All character art (the grandmas, props, robots, icons) is **pure CSS/DOM** — layered absolutely-positioned `<div>`s with border-radius, gradients, and clip-paths. There are **no raster/image assets**. A developer may keep this CSS approach, or replace the characters with SVG/Lottie/sprite art of equivalent staging; the documentation below describes the intended construction either way.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, motion timing, and interactions are all specified. Recreate the UI to match, using the codebase's existing primitives where they exist (buttons, cards, sliders, toggles, notification/toast system). Exact values are in **Design Tokens** below.

---

## Screens / Views

### 0. Grandma's Desktop (hub) — `Grandma Desktop.dc.html`
- **Purpose**: Front door; navigate to each experience.
- **Layout**: Centered column, max-width 1040px, page padding 54px 32px 90px. Header row (flex, gap 22px): an animated grandma-head avatar (78×80) + a title block. Below: a responsive **3-column grid** of cards, gap 22px. A closing italic caption, centered, 34px above bottom.
- **Background**: radial gradient `130% 90% at 50% 0%` from `#F3EBDD` → `#E4D8C6` (60%) → `#C9B79E`.
- **Header**: eyebrow "GRUMPY GRANDMA" (11px, letter-spacing 2.6px, uppercase, `#927E63`); H1 "Grandma's Desktop" (Libre Caslon Text, 38px/700, `#3A2F28`); sub paragraph (14px, `#6E5F50`, max-width 540, line-height 1.5).
- **Card** (×6): white `#FFFDF9`, 1px border `#E6DCC9`, radius 18px, padding 22px, shadow `0 10px 26px rgba(80,55,35,0.1)`. Contains: a 54×54 rounded-14px **icon tile** (per-card gradient + white CSS glyph), a 17px/700 title, a 13px `#7A6A5A` description (line-height 1.45), and a 12px/700 "Open ›" in the card's accent color.
  - **Hover**: `transform: translateY(-4px)` + shadow `0 18px 38px rgba(80,55,35,0.18)`, transition 0.16s ease.
  - Each card is an `<a href>` to the corresponding view.
- **Cards & accents**: Live Reaction (`#C75C49`, face glyph), The Workshop (`#5A8FB8`, desks glyph), The Agent Team (`#7D62B0`, node-tree glyph), The Workflow (`#4E6E50`, chalkboard glyph), The Session Feed (`#4A5163`, log-rows glyph), Grandmas of the World (`#BE6F44`, globe glyph).

### 1. Live Reaction — `Grandma Reacts.dc.html`
- **Purpose**: Always-on companion that mirrors the user's 5-hour token window and scolds proportionally.
- **Layout**: A **macOS desktop scene** (rounded 16px card, 1000×~540, gradient backdrop `#6E7CA8 → #8E7FA0 → #B98C86`) with a 26px translucent **menu bar** (blurred, `rgba(255,255,255,0.2)`). A frosted **widget** docks top-right (width 318, `rgba(247,244,240,0.9)` + `backdrop-filter: blur(26px)`, radius 22, border = current tier accent, shadow `0 22px 50px rgba(20,20,45,0.34)`). The full-bodied grandma stands bottom-left with a speech bubble. Below the scene: a **director control panel** (white card) with a usage slider, preset chips, event-trigger buttons, and a sound toggle.
- **Widget contents**: header (status dot in tier color + "Grandma" + tier name italic); a **stage** (height 226) holding a speech bubble (white, radius `13px 13px 13px 4px`, Libre Caslon italic 12px) and the animated grandma figure; a **gauge** (label "5-HOUR WINDOW" 9.5px uppercase + big % in tier color; track 9px `rgba(40,30,40,0.1)`, fill = tier color, radius 6); a 2×2 stat grid (tokens today, spent today, open sessions, at the desk) — each cell `rgba(255,255,255,0.6)`, radius 10, 15px/700 value + 9.5px label.
- **Escalation tiers** (driven by window %): `0–19 Content` (accent `#5FA552`, gauge `#5FA552`, prop: knitting), `20–41 Watchful` (`#9CA85E`/`#A6B048`, teacup), `42–63 Busy` (`#D8A14A`/`#E2B458`, mixing bowl), `64–83 Antsy` (`#D9823C`/`#E08A36`, raised spoon), `84–100 Meltdown` (`#CF4A38`/`#D2473A`, banging a pot + steam). As % rises: eyebrows angle down (brow 9°→27°), mouth goes smile→flat→frown→deep, cheeks redden (0.18→0.46 alpha), body animation speeds up (multiply base duration by `1 - usage/100*0.32`), and the held prop changes.
- **Discrete events** (override the tier pose ~2.4–4.5s, show a top banner + colored widget border): **New session** (perk up, both arms wave, sparkles), **Idle** (looks around → after ~2.8s dozes with floating "Zzz", closed eyes), **Limit reached / faint** (keels over: body rotate −19°, head 22°, X-eyes, dizzy swirl, tipped pot — auto-fires at 100%), **Window reset** (relieved, gauge → 0), **Spend spike** (clutches coin purse), **Proud / nicely paced** (hands on hips, gold medal, sparkles).
- **Notification nudges**: a macOS-style toast slides in top-left (`#FCFBFA`, radius 15, shadow `0 14px 34px rgba(20,20,45,0.28)`, app-icon = grandma glasses, "Grandma · now", italic body) on every event and on each tier crossing. A two-note WebAudio chime (660→880 Hz sine, ~0.13s each) plays unless muted. **Sound on / Muted** toggle in controls.
- **Controls**: range slider 0–100 (accent = gauge color); preset chips 8/35/58/78/96%; event buttons (New session, Spend spike, Proud, Go idle, Reset window, Hit the limit); auto-behaviors: faints at 100%, dozes after 14s idle.
- **Fake data model** (derive from usage %): tokens `usage/100*1.95M`, cost `usage/100*$11.70`, sessions 1→4 by thresholds, desk time `usage/100*8.4h`, reset-in `(100-usage)/100*300min`.

### 2. The Workshop — `Grandma Workshop.dc.html`
- **Purpose**: Spatial view of a small agent team as grandma clerks in a traditional office.
- **Layout**: macOS scene (1000×548). Set dressing behind: carpet floor band (bottom 158, `#9FAAB8 → #8C98A9`, baseboard `#B7BFCA`, faint diamond pattern), a wall **window** with skyline (top-right) and a **wall clock** (top-left). The **office manager grandma** stands left holding a **clipboard** with color-coded assignment rows. Four **clerk desks** are arranged 2×2 (centers approx: 468/742 × 168/384 within the scene). Color-coded **assignment threads** run from the clipboard hub `(250,322)` to each clerk (faint dashed); brighter for the active one.
- **Clerk** (each a seated grandma): office chair (colored cushion), grey laminate desk (`#CBD1DB`, modesty panel `#B6BEC9`), a **monitor** showing that role's work (document / code+caret / test checklist / red-green diff), keyboard, steaming coffee mug, a **personal desk prop** (Ada=potted plant, Bea=stack of papers, Mae=biscuit tin, Pearl=framed photo), and a **status pip** (working=pulsing accent, queued=grey, done=green). A floating **status card** per desk shows role + grandma name + status + progress bar.
- **The four clerks** (id, name, role, accent, skin, hair/accessory): `research` Nonna Ada — research lead — `#5A93C8` — silver bun + glasses + pearl earrings; `coder` Auntie Bea — build lead — `#5FA57E` — green kerchief; `tester` Old Mae — test — `#D2A23E` — white curls + half-moon glasses; `verifier` Granny Pearl — review — `#9A78C8` — grey bob + glasses + gold brooch.
- **Pipeline behavior**: a `stage` (0–3) advances Ada → Bea → Mae → Pearl every ~3.2s (Pause/Play). The active clerk is spotlit (warm ring) with a **work-folder baton** hovering above her; earlier clerks are **done** (green check on monitor, green chip dot); later are **queued** (greyed). Bright animated **hand-off connectors** run desk-to-desk; the one feeding the active stage flows. Header reads "Step n/4 · <name> is on it". Clickable name chips jump the baton.

### 3. The Agent Team — `Grandma Agent Team.dc.html`
- **Purpose**: A realistic multi-agent run with two toggleable views.
- **Layout**: Light card (`#F5F6F9`, radius 16). Top strip (white): left = "PHASE n/6" + phase label + caption; right = three counters (**agents live** `#2E6FB0`, **depth** `#5E8E6E`, **tokens** `#C8902E`). Below: a 472px graph area on a dotted grid. Controls row: Tree/Timeline segmented toggle, Back/Play/Next, 6 phase dots, status legend.
- **Hierarchy (9 nodes)**: orchestrator **Grandma** (`#7A5C84`) → leads **Ada** research (`#5A93C8`), **Bea** build (`#5FA57E`), **Pearl** review (`#9A78C8`) → sub-agents **Fern** web-search & **Edna** code-search (under Ada), **Mae** test-writer & **Vi** doc-writer (under Bea), **Glad** linter (under Pearl).
- **Phases (auto-advance ~2.6s)**: 0 Task arrives, 1 Delegate (spawn leads), 2 Spawn sub-agents (parallel fan-out — peak concurrency), 3 Sub-agents report (children done, results flow up), 4 Leads synthesize, 5 Deliver.
- **Tree view**: nodes are circular **grandma-head avatars** (44px, white ring colored by status — working=accent+pulsing ring, waiting=amber, done=green+check badge, pending=grey/faded); name + role + **live token cost** label beneath. **SVG edges** connect parent→child (`<line>` stroke, dasharray 7 7). Spawn edges draw when the child appears; in report/merge phases the edge into the parent flows **upward** in green (animated `stroke-dashoffset`). Orchestrator shows a speech bubble (dark `#34313A`) with a per-phase quip.
- **Timeline view**: a swimlane **Gantt** (W≈852). Left label column: name + role + per-agent token cost. Six phase columns (Task, Delegate, Spawn, Report, Merge, Deliver) with alternating shading. Each node has a planned bar (16px, accent at 0.16 alpha) and a **progress fill** that grows to the playhead (striped while working, green ✓ when done). Dashed **delegation connectors** drop from a lead's lane to its sub-agent's lane at the spawn column. A **playhead** line + triangle marks the current phase.
- **Per-agent token costs (M)**: Grandma 0.62, Bea 0.41, Ada 0.34, Pearl 0.28, Mae 0.19, Edna 0.16, Fern 0.12, Vi 0.11, Glad 0.08. Each accrues proportionally over its active phases: `accrued = tok * min(1, (phase+1 - spawn)/(done - spawn))`. The top **tokens** counter is the live cumulative sum (→ 2.31M at delivery).

### 4. The Workflow — `Grandma Workflow.dc.html`
- **Purpose**: Step-by-step explainer of a single agent's loop, narrated grumpily.
- **Layout**: A wooden-framed **chalkboard** (1000-wide; dark green felt `#36473A`-ish, chalk `#F4EEDE`). Top-right caption = current step label + "step n/total". A chalk-drawn **flow diagram** of 6 nodes in a snake layout (top-left → right → down → back). Grandma stands bottom-left at the board with a **pointer** and a speech bubble. Controls: Back / Pause / Next + step dots.
- **Beats (10, auto ~3s)**: Prompt → Plan → Tools (running) → **Tool call failed** (node red "✗ failed" + red *retry* arc) → Retry → Sub-agent → **Review rejects** (amber "↩ sent back" + amber *send-back* flow back up) → Back to fixing → Review passes → Deliver. Active node glows (chalk pulse) with a flowing dashed connector into it; completed nodes get a green ✓. Each beat updates Grandma's quip.
- **Nodes**: chalk-outline icons (chat, list, gear, people, check, paper-plane) + label; states pending (dashed faint), active (solid bright + underline), done (green ✓), error (red), reject (amber).

### 5. The Session Feed — `Grandma Session Feed.dc.html`
- **Purpose**: Live activity log of an agent run.
- **Layout**: macOS scene; a dark terminal-style **`session.log` window** docks right (`#15171D`, radius 13) with traffic-light titlebar + "live" pulse. A session-summary header (project, turns, ticking tokens/cost). A **feed** of typed rows that tick in (slide-in) every ~2.1s; a spinner "working…" line + equalizer bars at the bottom. Grandma stands bottom-left, arms folded, with a reactive speech bubble.
- **Row types** (colored dot + label + timestamp + monospace detail): user, think, plan, read, grep, edit, tool (run), error, ok, fork (sub-agent), done. Script runs prompt → plan → reads/searches → edits → test (fails) → fix → test (passes) → fork verifier → verified → delivered. Controls: Pause/Play, Step +1, Restart.

### 6. Grandmas of the World — `Grandmas of the World.dc.html`
- **Purpose**: Eight culturally-themed grandmas, each visualizing the same usage through her own kitchen, on a mini macOS desktop; click to get scolded in her mother tongue.
- **Variants**: 🇮🇹 Nonna (sauce pot = token window), 🇯🇵 Obaachan (tea fills the cup; sakura), 🇲🇽 Abuela (tortilla stack; papel picado), 🇮🇳 Nani (chapati per session; marigolds, diya), 🇷🇺 Babushka (nesting dolls; samovar), 🇳🇬 Mama Nnukwu (pounding yam; gele + ankara), 🇨🇳 Nǎinai (abacus), 🇰🇷 Halmoni (kimchi basin; hanbok). Each animates (working motion, blink, breathe) and shows a "72% · $8.42 · 3 sessions · 6h" style footer in localized currency/script.

### 7. Decision Briefs — `Grandma Briefs.dc.html`
- **Purpose**: A queue of decision briefs — moments where Claude has paused and needs a call from the user before proceeding. The longer a brief sits unanswered, the angrier Grandma gets.
- **Bound to**: `current.json.brief_queue[]` (each item: `id`, `project`, `title`, `summary`, `brief_path`, `cwd`, plus a created timestamp → age in minutes).
- **Layout**: Cozy warm background (same radial as hub). Header + the **shared Project Switcher** (see §Project Switcher). Body is a 2-col grid: left = the brief queue (single column of cards, sorted oldest-first); right = a sticky **Grandma panel** (avatar + quip + two stats: `waiting` count, `oldest` age).
- **Brief card**: white `#FFFDF9`, radius 16, with a left **urgency stripe** colored by age tier. Top row: project chip (dot + name) + an **age badge** (right). Then title (15.5/700), summary (13, `#6E5F50`), and a footer row: monospace `cwd/brief_path` + an **"Open ›" button** (deep-link — in production opens the brief file at `cwd`+`brief_path` in the editor). Clicking Open removes the brief from the queue (marks handled).
- **Age-badge tiers** (escalating): `<30m` FRESH (`#5FA552` stripe, `#E7F0E4`/`#4E7E50` badge) · `30–119m` WAITING (`#C9A24B`/`#FBF0D8`/`#9A7A2E`) · `120–359m` GETTING OLD (`#D9823C`/`#FCE6D4`/`#B5662E`) · `≥360m` STILL WAITING (`#B23A2E`/`#F7DAD6`/`#A8352A`, badge **throbs** via `box-shadow` pulse). Badge text = tier label + formatted age (e.g. "STILL WAITING · 6h 52m").
- **Quips / triggers**: reuses **`brief_pending`** ("A decision's waiting on you, dear. It won't make itself.") and adds two new triggers — **`brief_piling`** (≥3 waiting: "Three briefs stacked up. They're not wine — they don't improve with age.") and **`brief_stale`** (oldest ≥6h: "That top one has sat SIX HOURS. Decide, for pity's sake."). Empty state shows a frugal-relief message; Grandma's brow/mouth shift happy→stern→cross with severity.

### 8. History / "The Ledger" — `Grandma Ledger.dc.html`
- **Purpose**: A weekly retrospective of token usage, aggregated per day and per sub-agent, with a persistent **"top offenders"** ranking.
- **Bound to**: `events.ndjson` — one JSON object per line; this view consumes **`subagent_stop`** events (fields used: `day`/timestamp, `project`, `agent`, `tokens`, `cost_est`, `duration`). The prototype simulates ~30–40 such events with a seeded generator; production reads the real log.
- **Layout**: Header + shared Project Switcher. Top row (2-col): left = **7-day bar chart** (tokens/day, peak day highlighted orange, others warm tan, empty days a flat stub); right = **Grandma panel** (avatar + quip + `total this week` + `est. cost`). Full-width below: **Top offenders** ranking.
- **Top offenders**: sub-agents ranked by total tokens, each row = rank (`#1` highlighted) · color dot + name + role · proportional **horizontal bar** (in the agent's color) · tokens (e.g. `1.47M`) · est. cost · run count. Agents reuse the team palette (Grandma `#7A5C84`, Ada `#5A93C8`, Bea `#5FA57E`, Pearl `#9A78C8`, Mae `#D2A23E`, Glad `#B07AC8`, Fern `#5AA9C8`).
- **Cost-estimate caveat (required)**: a footnoted, italic disclaimer under the ranking — "Costs are estimated from local token counts at ~$6.10/M — not your actual Anthropic bill. Cache hits, tiers and discounts aren't reflected." The `$/M` rate is a single constant (`RATE`) driving every cost figure.
- **Aggregation**: per-day = sum of `tokens` grouped by day; per-agent = sum tokens + sum `cost_est` + count runs grouped by agent; cost = `tokens/1e6 * RATE`. All recompute when the Project filter changes.
- **Templated `history_*` quips**: `history_quiet` (week < 1.2M tokens: "A quiet week, for once. I almost approve."), `history_spike` (peak day > 2.1× daily mean: "{Day} was a bonfire — {tokens} in one day. What were you building?"), `history_topagent` (default: "{Agent} burned the most again — {tokens}. Typical."). When a project is filtered, the quip is prefixed with the project name.

### Project Switcher (spec §5.5) — shared component
- **Purpose**: A persistent filter that scopes **every** view to a single project (or "All"). The one cross-cutting requirement not covered by any single screen.
- **Bound to**: `current.json.sessions{}` — the set of known projects (the prototype hardcodes `auth-refactor`, `q3-board-deck`, `grandma-widget`, `data-pipeline`, each with a color dot).
- **UI**: a horizontal **chip bar** ( "Project" label + an `All` chip + one chip per project, each = color dot + name [+ count on Briefs]). The active chip is filled dark (`#34302A`/`#F6EFDF`); inactive are light outlined. Selecting a chip re-filters the host view live (queue + counts on Briefs; chart, ranking, totals, and quip on Ledger).
- **Integration note**: implemented on Briefs and Ledger here; in production it should be a single shared, persistent control (its selection ideally stored in app state / `current.json`) mounted above all views — including Live Reaction, Session Feed, Agent Team, and Workshop — so the whole companion stays scoped to one project at a time.

---

## Data Model (simulated → production)
All views run on **mocked data shaped to the intended production sources**, so each maps 1:1 when wired up:
- **`current.json`** — current live state. `sessions{}` (known projects → session info; drives the Project Switcher), `brief_queue[]` (open decision briefs; drives Decision Briefs). Live Reaction's window %, tokens, cost, sessions, desk time also belong here.
- **`events.ndjson`** — append-only event log, one JSON object per line. The Ledger consumes `subagent_stop` events; the Session Feed mirrors the same kind of stream (tool calls, edits, sub-agent spawns/returns). Cost figures are **local estimates** (`tokens/1e6 * RATE`), never the real bill — surface that caveat anywhere costs appear.
Replace each component's hardcoded fixture with a read of the corresponding file/stream; the view-models already match these shapes.

## Interactions & Behavior
- **Navigation**: hub cards are links to each view; consider adding a "← Desktop" affordance in each view when integrating.
- **Project Switcher**: persistent chip bar (§5.5) filtering the active view by project; should be global in production.
- **Auto-play loops**: Workshop (stage 3.2s), Agent Team (phase 2.6s), Workflow (beat 3s), Session Feed (row 2.1s). All have Pause/Play; most have Back/Next or Step and clickable dots/chips to jump.
- **Live Reaction inputs**: slider/presets set usage; event buttons trigger discrete moments; auto-faint at 100%, auto-idle after 14s.
- **Hover**: hub cards lift; clickable grandmas/chips scale or highlight.
- **Animations** (see tokens): idle = breathe + blink; status = pulsing ring; data flow = marching dashes / `stroke-dashoffset`; spawn = pop (overshoot easing); toast = slide-in; ambient = steam, sparkles, falling petals.
- **Audio**: WebAudio two-note chime on notifications (respect a mute toggle and the platform's notification settings).
- **Responsive**: prototypes are fixed-width desktop scenes (≈1000px). For production, the Live Reaction widget should be a small always-on-top window (~320px wide); the other views are full windows/panels.

## State Management
- **Live Reaction**: `usage` (0–100), `event` (null | session | idle | reset | faint | spike | proud), `phase` (idle sub-phase), `toast` ({body,color}), `sound` (bool). Timers: idle (14s), event auto-clear (2.4–4.5s), idle→doze (2.8s). Tier is derived from `usage`; pose = active event override else tier.
- **Workshop**: `stage` (0–3), `playing`. Per-clerk status derived from stage (done/working/queued). Interval 3.2s.
- **Agent Team**: `phase` (0–5), `playing`, `view` ('tree'|'timeline'). Node status derived from `phase` vs each node's `spawn`/`done`. Token accrual derived (see formula). Interval 2.6s.
- **Workflow**: `step` (0–9), `playing`. Interval 3s.
- **Session Feed**: `count` (rows shown), `playing`, `tokens`. Interval 2.1s; advances through a fixed script; stops at end (idle).
- All data here is **simulated**. For production, wire these to a real usage source: the 5-hour window %, tokens, cost, active sessions, and an agent event/log stream. The view-models above map 1:1 to those inputs.

## Design Tokens

**Typography**
- Display / character speech: **Libre Caslon Text** (serif), often *italic* for quips/captions.
- Data, code, logs, token counts: **IBM Plex Mono** (500/600).
- UI / body: system sans (Helvetica/Arial stack).
- Scale: H1 38 (hub) / 27–30 (view titles); section 16–17/700; body 13–14; labels 9.5–11 (uppercase, letter-spacing 0.5–2.6px); data values 15–19/700.

**Core palette**
- Skin: `#EBC9A4` (default), `#E2BC92`, `#C99A6E`, `#EAC7A0`, `#E0B88A`. Outline/line: `#6B4A35`. Nose `#D89A6E`. Cheek blush `rgba(206,74,56,0.18–0.46)`. Hair greys: `#D8D2C8`, `#D7D1C7`, `#C7C0CA`, `#ECE6DA`; brown `#9A7A52`.
- Agent accents: blue `#5A93C8`, green `#5FA57E`, amber `#D2A23E` / `#E2B458`, purple `#9A78C8`, orchestrator plum `#7A5C84`, red `#C75C49`.
- Status: done/positive `#5FA552`; working = the node's accent; waiting `#D9A23E`; queued/pending `#C2C6CE` / `#A8A2AE`; error `#E0604F`.
- Live Reaction tiers: `#5FA552` → `#A6B048` → `#E2B458` → `#E08A36` → `#D2473A`.
- Neutrals/ink: `#34313A`, `#3A2F28`, `#5E5B66`, `#6E6A76`, `#8A8590`; card surfaces `#FFFFFF` / `#FFFDF9` / `#F5F6F9`; borders `#E6DCC9` / `#E7E8EE`.
- Hub bg radial `#F3EBDD → #E4D8C6 → #C9B79E`. Scene desktop gradient `#6E7CA8 → #8E7FA0 → #B98C86`. Office walls `#DEE3EB → #CAD1DC`, carpet `#9FAAB8 → #8C98A9`. Terminal `#15171D`.

**Radius**: chips/buttons 9–10; small UI 12–14; cards 16–18; widgets 22; avatars/pills 50%.

**Shadow**: card `0 10px 26px rgba(80,55,35,0.10)`; card hover `0 18px 38px rgba(80,55,35,0.18)`; floating widget `0 22px 50px rgba(20,20,45,0.34)`; toast `0 14px 34px rgba(20,20,45,0.28)`.

**Spacing**: page padding 30–54px; card padding 18–22px; grid gap 22px; control gaps 7–14px.

**Motion** (all ease-in-out unless noted)
- `breathe` translateY ±3px, 3.4–3.8s. `blink` scaleY→0.12 at 96%, 4.4s. `bob` translateY −6 to −9, 1.4–1.6s.
- Status `ring`/`pulse` box-shadow or opacity, 1.2–1.8s.
- Data flow `dash` (background-position-x 16px) 0.5–0.7s **linear**; reversed for "return up". Tree edges use `stroke-dashoffset → -28`.
- `spawn pop` scale 0.4→1.12→1, cubic-bezier(.34,1.56,.64,1).
- Ambient: `steam` rise+fade ~2.2–2.6s; `sparkle/twinkle` ~1.1s; `petal` fall ~7–9s; toast `slide-in` 0.32s.

## Assets
- **No raster/image assets.** All characters, props, and icons are CSS/DOM (absolutely-positioned divs, gradients, clip-paths) or inline SVG (Agent Team tree edges).
- **Fonts** via Google Fonts: Libre Caslon Text, IBM Plex Mono (+ VT323 / Silkscreen only in early exploration files). Swap to the codebase's font pipeline.
- **Audio**: notification chime is generated at runtime via WebAudio (no file).
- **Emoji** flags appear only in "Grandmas of the World" labels.
- If integrating into an Anthropic-branded product, use the existing brand type/color system rather than these ad-hoc values.

## Files
Design references included in this bundle (open in a browser to view; they need `support.js`, included):
- `Grandma Desktop.dc.html` — hub / launcher
- `Grandma Reacts.dc.html` — Live Reaction widget (primary companion)
- `Grandma Briefs.dc.html` — Decision Brief queue (`brief_queue[]`) + Project Switcher
- `Grandma Ledger.dc.html` — weekly usage history / "top offenders" (`subagent_stop`) + Project Switcher
- `Grandma Workshop.dc.html` — village-office agent team + pipeline
- `Grandma Agent Team.dc.html` — orchestration tree + timeline (token costs)
- `Grandma Workflow.dc.html` — chalkboard agent-loop explainer
- `Grandma Session Feed.dc.html` — live activity log
- `Grandmas of the World.dc.html` — eight cultural variants
- `support.js` — the prototype runtime (reference only; **do not port**)

Each `.dc.html` is plain HTML you can read directly: markup lives in the `<x-dc>…</x-dc>` block and logic in the `class Component extends DCLogic` script. Character art is verbose absolute-positioned div trees — read them for exact geometry, but prefer recreating with your own component/art approach.
