# Phase 1 — data layer (source of truth)

This directory is the version-controlled source for Grumpy Grandma's **Phase 1**
data layer. At runtime these files are deployed to **`~/.claude/grandma/`** and
wired into `~/.claude/settings.json` (statusline + hooks). See
[`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) for the full picture.

| File | Role |
| --- | --- |
| `grandma_statusline.sh` | Claude Code statusline — the `<100ms` hot path (bash + jq). Also the **ingestion point**: writes each session's slice (`state/sessions/<id>.json`) with cost / context / rate-limits, since that data arrives only on the statusline's stdin. |
| `grandma_hook.mjs` | Single hook entrypoint (SessionStart/End, SubagentStart/Stop, Stop) → appends `events.ndjson`, writes per-agent slices, rebuilds `current.json`. |
| `lib/state.mjs` | Paths, atomic writes, advisory lock, ULID ids, event log, `current.json` assembly. |
| `lib/transcript_tokens.mjs` | Per-agent token attribution from the sub-agent transcript. |
| `lib/briefs.mjs` | Decision-brief queue scan. |
| `grandma_selfcheck.mjs` | Standalone health check for the data layer. |
| `grandma_lines.json` | Grandma's quip lines, keyed by trigger. |

## Deploy

The deployed copy under `~/.claude/grandma/` must match this directory. Copy
(or symlink) the source files into place — do **not** edit the deployed copy
directly, or it will drift from the repo:

```bash
DEST="$HOME/.claude/grandma"
mkdir -p "$DEST/lib"
cp grandma_statusline.sh grandma_hook.mjs grandma_selfcheck.mjs grandma_lines.json "$DEST/"
cp lib/*.mjs "$DEST/lib/"
```

Runtime state (`state/`, the `OFF` kill-switch, lock/tmp files) is **not**
tracked here — it's generated on the deployed machine.

> Note: `grandma_statusline.sh` joins its `jq` output with the ASCII Unit
> Separator byte (`0x1f`), which is invisible in most editors. Preserve those
> bytes when editing — re-typing the file from rendered text will corrupt them.
