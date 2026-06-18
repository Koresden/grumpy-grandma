# Limitations

Grumpy Grandma is a portfolio / personal-tooling project. Here's an honest account of where it's
soft — knowing the edges is part of the engineering.

## Data accuracy

- **Cost is an estimate, not your bill.** "Spent today" is a per-day delta of Claude Code's own
  *client-side* cost estimate (which Claude itself notes "may differ from your actual bill"). The
  Ledger's cost uses a flat per-token rate. Both are labeled `(est.)`.
- **"Spent today" only counts spend observed while the app is running.** It has no baseline for
  spend that happened earlier in the day before launch. A fully accurate figure needs the data
  layer to record daily deltas itself.
- **The rate-limit gauge can lag by a point or two.** It shows the freshest reading any session
  has reported; the live rolling value drifts between reads. It's exact only when a session is
  actively making calls.
- **Tokens are "fresh" (input + output, cache excluded).** This is a deliberate choice for a
  meaningful headline, but it means cache-read tokens (real, if cheap) aren't reflected.

## Coupling & fragility

- **Tightly coupled to Claude Code internals.** It depends on the hook event names, the
  statusline JSON shape, and the transcript/sub-agent file layout — which the official docs warn
  "version frequently." A Claude Code update could break ingestion until the data layer is
  re-verified against the docs.
- **macOS / Apple Silicon only.** The bundled Node binary, vibrancy, code-signing, and several
  path assumptions are macOS-specific (and arm64 for the bundled runtime).

## Distribution

- **Ad-hoc signed, not notarized.** It launches cleanly on the machine that built it, but other
  Macs will see Gatekeeper's "unidentified developer." Real distribution needs an Apple
  **Developer ID** certificate + notarization (an Apple Developer account).
- **~123 MB `.app`** — most of it the bundled Node runtime, the price of self-containment.

## Scope / fidelity

- **Decision Briefs is empty in practice.** Nothing writes brief files yet (the brief-emit
  integration is future work), so the queue shows its empty state.
- **Character art is simplified** versus the source design bundle — the avatar and the Workshop
  "desks" are functional approximations, not the full multi-layer prototype art.
- **Live Reaction events are heuristic.** New-session / idle / faint / reset / spike are inferred
  by diffing snapshots, not from explicit signals — good enough for a companion, not audit-grade.

## Things deliberately *not* done (non-goals)

No cloud sync, no telemetry, no modification of Claude Code's behavior, and no analysis of prompt
or output content — only metadata.
