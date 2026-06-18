import { useEffect, useRef, useState } from 'react';

// Derive the design's discrete moments from the live snapshot stream (no extra data needed):
//   session (a new session_id appears) · faint (window hits ~100%) · reset (window drops
//   sharply) · spike (today's spend jumps) · idle (no change for a while).
// Returns the current event ({kind,label} | null); auto-clears after a few seconds.
const IDLE_MS = 5 * 60 * 1000;
const CLEAR_MS = 4200;

export function useGrandmaEvents(current) {
  const prev = useRef(null);
  const lastChange = useRef(Date.now());
  const [event, setEvent] = useState(null);

  useEffect(() => {
    if (!current) return;
    const p = prev.current;
    const win = current.rate_limits?.five_hour?.used_percentage ?? 0;
    const sessions = Object.keys(current.sessions || {});
    const cost = current.today?.cost_usd ?? 0;

    if (p) {
      const pWin = p.rate_limits?.five_hour?.used_percentage ?? 0;
      const pSessions = Object.keys(p.sessions || {});
      const pCost = p.today?.cost_usd ?? 0;
      let e = null;
      if (sessions.some((s) => !pSessions.includes(s))) e = { kind: 'session', label: 'New session' };
      else if (win >= 98 && pWin < 98) e = { kind: 'faint', label: 'Limit reached' };
      else if (pWin - win > 25) e = { kind: 'reset', label: 'Window reset' };
      else if (cost - pCost > 0.5) e = { kind: 'spike', label: 'Spend spike' };
      if (e) setEvent({ ...e, t: Date.now() });
      if (win !== pWin || cost !== pCost || sessions.length !== pSessions.length) lastChange.current = Date.now();
    }
    prev.current = current;
  }, [current]);

  // idle: nothing changed for a while
  useEffect(() => {
    const iv = setInterval(() => {
      if (Date.now() - lastChange.current > IDLE_MS) {
        setEvent((e) => (e && e.kind === 'idle' ? e : { kind: 'idle', label: 'Gone quiet', t: Date.now() }));
      }
    }, 30000);
    return () => clearInterval(iv);
  }, []);

  // auto-clear (except idle, which reflects an ongoing state)
  useEffect(() => {
    if (!event || event.kind === 'idle') return;
    const to = setTimeout(() => setEvent(null), CLEAR_MS);
    return () => clearTimeout(to);
  }, [event]);

  return event;
}

// Map an event to a trigger key in grandma_lines.json (reuses existing keys where sensible).
export const EVENT_TRIGGER = {
  session: 'session_start',
  faint: 'slipper_thrown',
  reset: 'budget_ok',
  spike: 'burn_high',
  idle: 'idle_agent',
};
