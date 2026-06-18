import { useEffect, useState } from 'react';
import { Grandma } from '../components/Grandma.jsx';
import { useQuip } from '../data/useGrandmaState.js';
import { useGrandmaEvents, EVENT_TRIGGER } from '../data/useEvents.js';
import { playChime } from '../data/chime.js';
import { TIERS, windowPct, tierIndex } from './tiers.js';

const TIER_HEX = ['#5fa552', '#a6b048', '#e2b458', '#e08a36', '#d2473a'];

export function LiveReaction({ state, compact, go }) {
  const { current, lines, connected } = state;
  const pct = windowPct(current);
  const ti = tierIndex(current);
  const tier = TIERS[ti];

  const event = useGrandmaEvents(current);
  const [muted, setMuted] = useState(() => localStorage.getItem('grandma_muted') === '1');
  useEffect(() => { localStorage.setItem('grandma_muted', muted ? '1' : '0'); }, [muted]);
  // chime on a discrete event (idle is a state, not a ping)
  useEffect(() => {
    if (event && event.kind !== 'idle' && !muted) playChime();
  }, [event && event.t]);

  // an active event overrides the tier quip + accent
  const trigger = event ? EVENT_TRIGGER[event.kind] : tier.key;
  const quip = useQuip(lines, trigger, {});
  const accent = event && event.kind === 'faint' ? TIER_HEX[4] : TIER_HEX[ti];

  const today = current?.today || {};
  const sessions = current?.open_sessions ?? Object.keys(current?.sessions || {}).length;
  const agentsUp = (current?.agents || []).filter((a) => a.status === 'active' && !a.stale).length;
  const tokens = (today.tokens_in || 0) + (today.tokens_out || 0);
  const resetMin = resetInMinutes(current);

  const card = (
    <div className="widget" style={{ border: `1px solid ${accent}` }}>
      {event && <div className="toast">👵 Grandma · now — <strong>{event.label}</strong></div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: accent }} />
        <strong style={{ fontSize: 13 }}>Grandma</strong>
        <em style={{ fontSize: 12, color: 'var(--ink-3)', marginLeft: 'auto' }}>{event ? event.label : tier.name}</em>
        <button className="mute" onClick={() => setMuted((m) => !m)} title={muted ? 'Muted' : 'Sound on'}>
          {muted ? '🔇' : '🔔'}
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 10px' }}>
        <Grandma tier={ti} accent={accent} scale={1.05} shake={ti === 4 || (event && event.kind === 'faint')} />
      </div>

      <div className="bubble quip">{quip || '…'}</div>

      <div style={{ margin: '14px 0 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="eyebrow" style={{ fontSize: 9.5 }}>5-Hour Window</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: accent }}>{pct}%</span>
      </div>
      <div className="gauge-track"><div className="gauge-fill" style={{ width: `${pct}%`, background: accent }} /></div>

      <div className="statgrid">
        <Stat v={fmtTokens(tokens)} l="fresh tokens today" />
        <Stat v={`$${(today.cost_usd ?? 0).toFixed(2)}`} l="spent today (est.)" />
        <Stat v={sessions} l="open sessions" />
        <Stat v={agentsUp} l="at the desk" />
      </div>
      <div style={{ fontSize: 11, color: '#8a8590', marginTop: 8 }}>
        {resetMin != null ? `Resets in ${resetMin} min` : 'Reset time unknown'}
      </div>
    </div>
  );

  // Compact = the floating always-on-top Tauri widget: just the card, transparent backdrop.
  if (compact) return <div className="widget-shell">{card}</div>;

  return (
    <div className="wrap" style={{ maxWidth: 760 }}>
      <a className="backlink" href="#" onClick={(e) => { e.preventDefault(); go('hub'); }}>← Desktop</a>
      <div className="eyebrow">Live Reaction</div>
      <h1 className="title">She acts out your usage</h1>
      <p className="sub">The 5-hour rate window, made flesh. {connected ? '' : '(waiting for data…)'}</p>
      <div style={{ display: 'flex', gap: 28, marginTop: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {card}
        <div style={{ flex: 1, minWidth: 220, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>
          <p><strong>Gauge</strong>: freshest current 5-hour window reading (verified vs Claude <span className="mono">/usage</span>).</p>
          <p><strong>Fresh tokens</strong>: input + output today (cache excluded), main + sub-agents.</p>
          <p><strong>Spent today (est.)</strong>: per-day delta of Claude's cost estimate, not the bill.</p>
          <p style={{ color: 'var(--ink-3)' }}>Discrete events (new session / idle / faint / reset / spike) fire a toast + chime; 🔔 toggles sound.</p>
        </div>
      </div>
    </div>
  );
}

function Stat({ v, l }) {
  return <div className="stat"><div className="v">{v}</div><div className="l">{l}</div></div>;
}
function fmtTokens(n) { return n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}k` : String(n); }
function resetInMinutes(current) {
  const r = current?.rate_limits?.five_hour?.resets_at;
  if (!r) return null;
  return Math.max(0, Math.round((r * 1000 - Date.now()) / 60000));
}
