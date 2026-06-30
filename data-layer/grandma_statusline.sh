#!/usr/bin/env bash
# Grandma statusline — the <100ms hot path (acceptance S1).
# Reads Claude Code's JSON on stdin, writes this session's slice (the ONLY place
# cost / context / rate-limits enter the data layer), then renders one grumpy line.
# Reads current.json (hook-assembled) for cross-session agent + brief state.
# Never parses transcripts here. Always exits 0; degrades to silence if anything is off.
#
# Notes:
# - jq spawns dominate latency, so fields + severity come from a single jq pass.
# - jq output is joined with US (0x1f), NOT tabs: `read` collapses runs of IFS
#   whitespace (incl. tabs), which would drop empty fields and shift columns.
# - Stay in byte mode (do NOT force a UTF-8 locale): macOS bash 3.2's multibyte
#   string handling is buggy and corrupts literal glyphs (▓ 👵) on concatenation.
#   Byte-mode concatenation preserves them; truncation is delegated to jq, which is
#   UTF-8-aware regardless of shell locale, so glyphs are never split (S2).

US=$'\037'

GDIR="$HOME/.claude/grandma"; SDIR="$GDIR/state"; LINES="$GDIR/grandma_lines.json"

[ -f "$GDIR/OFF" ] && exit 0
[ "$GRANDMA_OFF" = "1" ] && exit 0

input=$(cat)
command -v jq >/dev/null 2>&1 || exit 0
[ -n "$input" ] || exit 0

# --- one jq pass: all stdin fields + severity tier (spec §2) ----------------
IFS="$US" read -r SID DISP MID CWD PCT CTXSIZE COST SEV < <(printf '%s' "$input" | jq -r '
  (.context_window.used_percentage // 0) as $pct
  | (.rate_limits.five_hour.used_percentage // 0) as $r5
  | (.rate_limits.seven_day.used_percentage // 0) as $r7
  | (if ($r5 >= 90 or $r7 >= 90) then "slipper_thrown"
     elif $pct > 80 then "disappointed"
     elif $pct >= 50 then "suspicious"
     else "content" end) as $sev
  | [ (.session_id // "unknown"), (.model.display_name // "Claude"), (.model.id // ""),
      (.workspace.current_dir // .cwd // ""), ($pct | floor | tostring),
      (.context_window.context_window_size // 0 | tostring),
      (.cost.total_cost_usd // 0 | tostring), $sev ]
  | join("")' 2>/dev/null)
[ -n "$SID" ] || exit 0
PROJECT=$(printf '%s' "${CWD##*/}" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9-')
NOW=$(date +%Y-%m-%dT%H:%M:%S%z); TODAY=${NOW%%T*}

# --- cross-session state from hook-assembled current.json -------------------
AGENTS_UP=0; BRIEF_OLD=0
CUR="$SDIR/current.json"
if [ -f "$CUR" ]; then
  IFS="$US" read -r AGENTS_UP BRIEF_OLD < <(jq -r --argjson now "$(date +%s)" '
    [ ([.agents[]? | select(.status=="active")] | length),
      ([ (.brief_queue // [])[] | select( ($now*1000 - (((.created_ts|fromdateiso8601?) // $now)*1000)) > 1800000 ) ] | length)
    ] | map(tostring) | join("")' "$CUR" 2>/dev/null)
  [ -n "$AGENTS_UP" ] || AGENTS_UP=0; [ -n "$BRIEF_OLD" ] || BRIEF_OLD=0
fi

# --- pick trigger (priority) ------------------------------------------------
TRIGGER="budget_ok"
if   [ "$SEV" = "slipper_thrown" ]; then TRIGGER="slipper_thrown"
elif [ "${BRIEF_OLD:-0}" -gt 0 ];   then TRIGGER="brief_pending"
elif [ "$SEV" = "disappointed" ];   then TRIGGER="burn_high"
elif [ "$SEV" = "suspicious" ];     then TRIGGER="suspicious"
fi

# --- quip rotation: never repeat the last-shown line (spec §4.3) -------------
# One jq pass reads both the lines file and the session's last_quip (slurpfile,
# /dev/null when the session file is absent) -> rotated index + line.
SFILE="$SDIR/sessions/$(printf '%s' "$SID" | tr -cd 'A-Za-z0-9_.:-').json"
SF_ARG="$SFILE"; [ -f "$SFILE" ] || SF_ARG=/dev/null
IDX=0; QUIP=""
IFS="$US" read -r IDX QUIP < <(jq -rn --arg t "$TRIGGER" --slurpfile L "$LINES" --slurpfile S "$SF_ARG" '
  ($L[0] // {}) as $lines | ($S[0].last_quip // {trigger:"",idx:-1}) as $lq
  | ($lines[$t] // []) as $a | ($a | length) as $n
  | (if $n == 0 then 0 elif $t == ($lq.trigger // "") then ((($lq.idx // -1) + 1) % $n) else 0 end) as $i
  | [ ($i | tostring), (if $n == 0 then "" else ($a[$i] // "") end) ] | join("")' 2>/dev/null)
[ -n "$IDX" ] || IDX=0

# --- write this session's slice (live cost/ctx/rate-limits) -----------------
mkdir -p "$SDIR/sessions" 2>/dev/null
printf '%s' "$input" | jq \
  --arg sid "$SID" --arg mid "$MID" --arg disp "$DISP" --arg proj "$PROJECT" \
  --arg cwd "$CWD" --arg now "$NOW" --arg sev "$SEV" --arg trig "$TRIGGER" \
  --argjson idx "$IDX" --argjson pct "${PCT:-0}" '
  { session_id: $sid, model: $mid, display_name: $disp, project: $proj, cwd: $cwd,
    cost_usd: (.cost.total_cost_usd // 0), ctx_pct: $pct,
    ctx_size: (.context_window.context_window_size // null),
    rate_limits: (.rate_limits // null), severity: $sev,
    last_quip: { trigger: $trig, idx: $idx }, last_ts: $now }' \
  > "$SFILE.tmp.$$" 2>/dev/null && mv -f "$SFILE.tmp.$$" "$SFILE" 2>/dev/null

# --- today's cost across all sessions (live for this one) -------------------
TODAYCOST=$(jq -s --arg d "$TODAY" '[.[] | select((.last_ts|tostring)[0:10]==$d) | .cost_usd] | add // 0' "$SDIR"/sessions/*.json 2>/dev/null)
[ -n "$TODAYCOST" ] || TODAYCOST=$COST

# --- build bar + render (pure bash, no spawns) ------------------------------
BARW=10; FILLED=$(( PCT * BARW / 100 )); [ "$FILLED" -gt "$BARW" ] && FILLED=$BARW; [ "$FILLED" -lt 0 ] && FILLED=0
EMPTY=$(( BARW - FILLED ))
BAR=""; i=0; while [ $i -lt $FILLED ]; do BAR="$BAR▓"; i=$((i+1)); done
i=0; while [ $i -lt $EMPTY ]; do BAR="$BAR░"; i=$((i+1)); done
COSTFMT=$(printf '$%.2f' "$TODAYCOST" 2>/dev/null || printf '$0.00')
AGENT_WORD="agents"; [ "$AGENTS_UP" = "1" ] && AGENT_WORD="agent"

LINE="👵 [$DISP] $BAR ${PCT}% ctx | $COSTFMT today | ${AGENTS_UP} ${AGENT_WORD} up"
[ -n "$QUIP" ] && LINE="$LINE | \"$QUIP\""

# Truncate to COLUMNS only when needed; jq slices on codepoints (multibyte-safe).
WIDTH=${COLUMNS:-120}
if [ "${#LINE}" -gt "$WIDTH" ]; then
  LINE=$(jq -rn --arg s "$LINE" --argjson w "$WIDTH" '$s | if (length > $w) then (.[0:($w-1)] + "…") else . end' 2>/dev/null)
fi
printf '%s\n' "$LINE"
exit 0
