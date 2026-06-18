import { useEffect, useRef, useState } from 'react';

// Subscribes to the live current.json stream (SSE from the dev-server fs-watcher) and
// loads grandma_lines.json once. The whole UI is a pure render of `current`.
export function useGrandmaState() {
  const [current, setCurrent] = useState(null);
  const [lines, setLines] = useState({});
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    fetch('/api/lines').then((r) => r.json()).then(setLines).catch(() => {});
    const es = new EventSource('/api/stream');
    es.onmessage = (e) => { try { setCurrent(JSON.parse(e.data)); setConnected(true); } catch {} };
    es.onerror = () => setConnected(false);
    return () => es.close();
  }, []);

  return { current, lines, connected };
}

// Picks a quip for `trigger`, re-rolling ONLY when the trigger (or lines) changes — never
// repeating the last-shown line for that trigger (mirrors Phase 1). Vars substitute live.
export function useQuip(lines, trigger, vars) {
  const idxRef = useRef({});
  const [tpl, setTpl] = useState('');
  useEffect(() => {
    const arr = (lines && lines[trigger]) || [];
    if (!arr.length) { setTpl(''); return; }
    const prev = idxRef.current[trigger];
    const idx = prev == null ? 0 : (prev + 1) % arr.length;
    idxRef.current[trigger] = idx;
    setTpl(arr[idx]);
  }, [trigger, lines]);
  return substitute(tpl, vars);
}

function substitute(s, vars) {
  if (!vars) return s;
  return s.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? String(vars[k]) : `{{${k}}}`));
}
