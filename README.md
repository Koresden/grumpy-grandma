# 👵 Grumpy Grandma

> A desktop companion that watches your Claude Code token burn and multi-agent
> orchestration — and grumbles about it the whole time. Dry, disapproving,
> secretly proud.

Grandma lives in the corner of your screen as an always-on-top widget. She acts out your
5-hour rate-limit window (calm → antsy → meltdown), tracks token/cost burn across every
session and sub-agent, and visualizes your live agent orchestration — all from a read-only
data layer built on Claude Code's hooks and statusline.

<p align="center"><img src="docs/screenshots/hub.png" alt="Grandma's Desktop hub + the floating widget" width="900"></p>

---

## What it does

Six connected views, all driven by **live** data (no mock data anywhere):

| View | What it shows |
| --- | --- |
| **Live Reaction** | A frosted, always-on-top widget. Grandma's expression maps to your 5-hour rate window; fresh tokens / spend / open sessions; discrete events (new session, idle, faint, reset, spend spike) with a toast + chime. |
| **The Agent Team** | Live orchestration graph per project — orchestrator → sub-agents — with exact per-agent token costs. |
| **The Workshop** | The same agents drawn as grandma clerks at their desks. |
| **The Ledger** | 7-day fresh-token history, top-offender ranking, estimated cost. |
| **Decision Briefs** | A queue of pending approval briefs, nagged by age. |
| **The Session Feed** | A live, metadata-level log of orchestration events. |

## Architecture in one breath

Grumpy Grandma is two phases that share **one contract**: an append-only event log.

```
Claude Code ──hooks/statusline──▶  Phase 1: data layer  ──▶  state/events.ndjson  (the contract)
                                    (bash + node, ~/.claude/grandma/)   state/current.json  (snapshot)
                                                                              │
                                                                     fs-watch │ tail, don't re-read
                                                                              ▼
                                  Phase 2: desktop app   ◀── SSE ──  Node sidecar (enrichment + API)
                                  (Tauri v2 + React)                  serves the built UI + live data
```

- **Phase 1** is a terminal-only data layer: a `statusline` script and a single `hook`
  entrypoint write a versioned, append-only `events.ndjson` plus a cheap `current.json`
  snapshot. It's a read-only observer — it never modifies Claude Code's behavior and never
  blocks the agent pipeline.
- **Phase 2** is a Tauri desktop app. A bundled Node sidecar fs-watches the data layer,
  enriches it (accurate token/cost/rate-limit computation), and streams it to a React UI
  over Server-Sent Events. The app is fully self-contained — it ships its own Node runtime.

> **"Phase 1's event log IS Phase 2's API."** The app never parses transcripts for display;
> if it needs new data, the schema is extended, not bypassed.

See **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** for the full picture and the design decisions.

## Engineering highlights

The interesting part of this project isn't the cartoon — it's the data.

- **Every displayed number is verified against ground truth, or honestly labeled an estimate.**
  Mid-build, the usage figures *didn't match* Claude's real numbers. Rather than trust them,
  each was traced to a source and checked — which surfaced **three** genuinely wrong figures
  and how they were wrong:
  - *Tokens today* was **cache-inflated and sub-agent-only** (a no-op agent "cost" 30k tokens —
    all cache reads). Fixed: fresh `input + output` summed across **both** main-session and
    sub-agent transcripts.
  - *5-hour window %* over-reported because it took the **max** reading across sessions, but the
    window is **rolling** (usage ages out → it ticks *down*), and idle sessions re-render with
    stale readings. Fixed: the **freshest reading in the current window**, stale windows excluded.
  - *Spent today* summed each session's **cumulative lifetime** cost. Fixed: a **per-day delta
    ledger**, clearly labeled an estimate (it's Claude's client-side estimate, not your bill).
- **Per-agent tokens are exact.** Each sub-agent's tokens are summed from its dedicated
  transcript and verified bit-for-bit against the runtime's reported total (`29826 == 29826`).
- **A real desktop-distribution story**: bundling a *self-contained* Node runtime (the official
  binary, after discovering Homebrew's node drags in a 22-dylib closure), transparent + vibrancy
  windows, a menu-bar tray, clean sidecar lifecycle, and code-signing.

The full write-up — including the macOS `bash 3.2` gotchas and the WebView state-restoration
bug — is in **[docs/ENGINEERING-NOTES.md](docs/ENGINEERING-NOTES.md)**.

## Tech stack

- **Desktop shell**: Tauri v2 (Rust) — multi-window, tray, macOS vibrancy, bundled runtime, code-signing
- **UI**: React 18 + Vite (no UI framework — bespoke CSS/DOM character art, zero raster assets)
- **Data sidecar**: Node.js (HTTP + SSE), shared with the Vite dev server so dev ≡ prod behavior
- **Data layer**: Bash + jq (statusline hot path) and Node (hooks), over Claude Code's hook & statusline APIs

## Run it

**The data layer (Phase 1)** lives in `~/.claude/grandma/` and is wired into `~/.claude/settings.json`
(statusline + hooks). It populates the event log as you use Claude Code.

**The desktop app (Phase 2)** is in [`app/`](app/):

```bash
cd app
npm install

# dev (browser preview of the UI against the live data layer)
npm run dev            # → http://localhost:5599

# native app (requires Rust toolchain)
./src-tauri/binaries/fetch-node.sh   # download the bundled Node runtime (gitignored, 115MB)
npx tauri dev          # run the native shell
npx tauri build --bundles app   # build the standalone, self-contained .app
```

The built app is at `app/src-tauri/target/release/bundle/macos/Grumpy Grandma.app`.

## Status & limitations

This is a portfolio / personal-tooling project, honest about its edges. Cost is an estimate,
the data layer is coupled to Claude Code's (frequently-versioned) internal formats, and the
app is ad-hoc signed (not notarized for other Macs). The full list is in
**[LIMITATIONS.md](LIMITATIONS.md)** — worth reading; the honesty *is* part of the point.

## Non-goals

No cloud sync, no telemetry leaving the machine, no modifying Claude Code, and no reading your
prompts — Grandma judges metadata, not content. She's nosy, but not *that* nosy.
