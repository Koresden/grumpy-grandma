import { Grandma } from '../components/Grandma.jsx';
import { useQuip } from '../data/useGrandmaState.js';
import { tierIndex } from './tiers.js';

const CARDS = [
  { id: 'reaction', live: true, title: 'Live Reaction', accent: 'var(--a-red)', glyph: '😖', desc: 'She acts out your 5-hour window and scolds proportionally.' },
  { id: 'agents', live: true, title: 'The Agent Team', accent: 'var(--a-plum)', glyph: '🕸️', desc: 'Live orchestration tree with per-agent token costs.' },
  { id: 'workshop', live: true, title: 'The Workshop', accent: 'var(--a-blue)', glyph: '🪑', desc: 'Sub-agents as grandma clerks at desks.' },
  { id: 'briefs', live: true, title: 'Decision Briefs', accent: 'var(--a-amber)', glyph: '📋', desc: 'Pending briefs awaiting your call.' },
  { id: 'ledger', live: true, title: 'The Ledger', accent: 'var(--a-green)', glyph: '📊', desc: 'Weekly tokens, top offenders.' },
  { id: 'feed', live: true, title: 'The Session Feed', accent: 'var(--a-slate)', glyph: '🧾', desc: 'Live activity log with commentary.' },
];

export function Hub({ state, go }) {
  const { current, lines, connected } = state;
  const tier = tierIndex(current);
  const quip = useQuip(lines, ['content', 'watchful', 'busy', 'antsy', 'meltdown'][tier], {});
  const today = current?.today;

  return (
    <div className="wrap">
      <div className="headrow">
        <Grandma tier={tier} scale={0.62} />
        <div>
          <div className="eyebrow">Grumpy Grandma</div>
          <h1 className="title">Grandma's Desktop</h1>
          <p className="sub">{quip || 'She watches your token usage and grumbles about it.'}</p>
          <p className="sub mono" style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-3)' }}>
            {connected
              ? `live · $${(today?.cost_usd ?? 0).toFixed(2)} today · ${current?.open_sessions ?? Object.keys(current?.sessions || {}).length} open`
              : 'connecting to the data layer…'}
          </p>
        </div>
      </div>

      <div className="grid">
        {CARDS.map((c) => {
          const inner = (
            <>
              <div className="tile" style={{ background: c.accent }}>{c.glyph}</div>
              <h3>{c.title}</h3>
              <p>{c.desc}</p>
              {c.live ? <span className="open" style={{ color: c.accent }}>Open ›</span> : <span className="soon">Coming soon</span>}
            </>
          );
          return c.live ? (
            <a key={c.id} className="card live" href="#" onClick={(e) => { e.preventDefault(); go(c.id); }}>{inner}</a>
          ) : (
            <div key={c.id} className="card disabled">{inner}</div>
          );
        })}
      </div>

      <p className="quip" style={{ textAlign: 'center', marginTop: 34, color: 'var(--ink-2)' }}>
        "I didn't ask to be put in charge of your spending. And yet."
      </p>
    </div>
  );
}
