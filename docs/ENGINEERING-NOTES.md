# Engineering notes

The parts of this project worth talking about in an interview. Less "what it does," more
"what broke and how I knew."

## 1. Trusting numbers means verifying them

A usage tracker is only worth anything if its numbers are right. Mid-build they *weren't* — the
displayed figures didn't match what Claude actually reported. The fix wasn't to tweak until it
looked plausible; it was to give **every displayed number a named ground-truth source and a
check**. That surfaced three genuinely wrong figures.

### a) Per-agent tokens — the primitive, verified exact

No hook payload carries token counts, and `transcript_path` always points at the *parent*
session transcript. But Claude Code writes a dedicated per-sub-agent transcript at
`<session>/subagents/agent-<id>.jsonl`, and each assistant row carries a `usage` block.
Summing `input + cache_creation + cache_read + output` over that file equals the runtime's
reported total **exactly**:

```
our sum:  29819 + 7   = 29826
runtime:  subagent_tokens = 29826   ✅
```

That's the trustworthy primitive everything else builds on.

### b) "Tokens today" — cache-inflated and half-blind

The first implementation summed the per-agent totals. Two problems, both verified against the
transcripts:

- **Cache reads dominate.** A sub-agent that replied with one word still showed ~30k "tokens" —
  almost entirely `cache_read` of the context. Real *new* work was a few hundred tokens.
- **Sub-agents only.** The main conversation's tokens weren't counted at all.

So the headline was simultaneously *inflated* (cache) and *incomplete* (no main thread).
**Fix:** "fresh tokens" = `input + output` (cache excluded), summed across **both** main-session
and sub-agent transcripts for today. Cross-checked against an independent transcript scan:
`3.56M` (independent) == `3.56M` (app).

### c) The 5-hour window — a rolling window, not a fixed one

The rate-limit gauge was the bug the user actually caught (`app showed 37, Claude showed 35`).
The selector took the **max** `used_percentage` across sessions. Two wrong assumptions:

- **The window is *rolling*** — usage ages out, so the percentage ticks *down*. Taking the max
  biases high (it clings to the last peak).
- **`last_ts` ≠ measurement time.** Rate limits only update on an API call, but a session's
  statusline re-renders every ~10s, so an *idle* session has a fresh `last_ts` but a stale
  reading. Selecting "freshest by render time" made the gauge **jitter** between idle sessions'
  stale numbers (89% from a window that reset 19 hours ago, etc.).

**Fix:** the freshest reading **within the current window** (the one whose `resets_at` is still
in the future); stale past-window readings excluded outright. Diagnosed straight from the data:

```
oldphoto       26%   resets in 4h     ← current window  ✅
recipearchive  39%   reset 145h ago   ← stale, excluded
class-news     49%   reset 25h ago    ← stale, excluded
invio          89%   reset 19h ago    ← stale, excluded
```

### d) "Spent today" — cumulative, not daily

It summed each session's *cumulative lifetime* cost (`$316 + $256 + …` → an absurd `$722/day`).
**Fix:** a **per-day delta ledger** over each session's cumulative cost, banked into the current
day. It's labeled `(est.)` — it's Claude's own client-side estimate, not your bill, and it only
counts spend observed while the app is running. Honest beats impressive.

The takeaway I'd put on a résumé: *I don't ship numbers I haven't reconciled against ground truth,
and I label estimates as estimates.*

## 2. macOS `bash 3.2` is a minefield

The statusline is the <100ms hot path, so it's `bash + jq`. macOS still ships **bash 3.2**
(2007), which produced three separate, non-obvious bugs:

- **`mapfile` doesn't exist** (added in bash 4) — silent failure.
- **`read -d $'\t'` collapses empty fields.** Tab is IFS-whitespace, so a `jq @tsv` row with an
  empty column (e.g. an absent `model.id`) shifted every subsequent field. Fix: join with the
  ASCII Unit Separator (`0x1f`), which `read` won't collapse.
- **Multibyte concatenation is broken under a UTF-8 locale.** Building the progress bar
  (`▓`/`░`) under `LC_ALL=en_US.UTF-8` *dropped the leading byte* of each glyph → garbage. Under
  `C` (byte mode) it's perfect. So: stay in byte mode and delegate the one operation that needs
  codepoint awareness (truncating to `$COLUMNS`) to `jq`, which is always UTF-8-aware.

## 3. The macOS WebView state-restoration trap

The main window kept reopening on whatever view it last showed instead of the Hub. Cause: macOS
WebView **state restoration** re-applies the last URL fragment *after* the page loads. Two
attempts (forcing the hash from a `?v=` param, then `replaceState`) lost the race — restoration
fired a `hashchange` afterward.

**Final fix:** drop URL-hash routing entirely. The route is **in-memory React state**, seeded
once from the window's `?v=` query param; navigation is a `setState`, not a hash change. There's
no hash for restoration to clobber. Deterministic.

## 4. Bundling a self-contained Node

To make the app dependency-free, the sidecar's Node had to ship inside the `.app`. Homebrew's
`node` is a 68 KB stub that dynamically links `libnode.141.dylib` **plus a 22-dylib closure**
(openssl, icu, brotli, sqlite, …) — not portable. The official `nodejs.org` arm64 binary, by
contrast, has **zero** non-system dependencies:

```
otool -L (official node):  only /System/... and /usr/lib/...   → portable ✅
otool -L (homebrew node):  22 @rpath/homebrew dylibs            → not portable ❌
```

So the build bundles the official binary as Tauri's `externalBin`; the Rust resolves it next to
the app executable (falling back to system paths in dev), and `codesign --deep` signs the nested
runtime. Result: a self-contained, ad-hoc-signed app — `123 MB`, `115` of it Node.

## 5. Lifecycle details that matter for an always-on app

- **No orphaned processes.** The sidecar (`Child`) is held in an `Arc<Mutex<…>>` and killed on
  `RunEvent::Exit`, so quitting doesn't leave a stray `node` bound to the port.
- **Stale-state hygiene.** "Active" agents older than 30 min (a missed `SubagentStop`) age out of
  the "at the desk" count; "open sessions" only counts recently-seen slices.
- **Atomic writes.** `current.json` is written via temp-file + rename; `events.ndjson` appends a
  single sub-4KB line so concurrent sessions can't tear it.
