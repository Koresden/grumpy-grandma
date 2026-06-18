import { useEffect, useState } from 'react';
import { Grandma } from '../components/Grandma.jsx';
import { useQuip } from '../data/useGrandmaState.js';

const ACCENTS = ['var(--a-plum)', 'var(--a-blue)', 'var(--a-green)', 'var(--a-purple)', 'var(--a-amber)', 'var(--a-slate)', 'var(--a-orange)'];

// History / "The Ledger" (spec View 4). Fetches /api/history (7-day fresh tokens + per-agent
// ranking from the sidecar). Cost is a rough estimate, labeled as such.
export function Ledger({ state, go }) {
  const { lines } = state;
  const [hist, setHist] = useState(null);
  useEffect(() => {
    const load = () => fetch('/api/history').then((r) => r.json()).then(setHist).catch(() => {});
    load();
    const iv = setInterval(load, 15000);
    return () => clearInterval(iv);
  }, []);

  const days = hist?.days || [];
  const agents = hist?.agents || [];
  const total = hist?.total || 0;
  const peak = Math.max(1, ...days.map((d) => d.tokens));
  const mean = days.length ? total / days.length : 0;
  const spikeDay = days.find((d) => d.tokens > mean * 2.1 && d.tokens > 0);
  const top = agents[0];

  const trigger = total < 1.2e6 ? 'history_quiet' : spikeDay ? 'history_spike' : 'history_topagent';
  const vars = spikeDay
    ? { day: spikeDay.label, tokens: fmt(spikeDay.tokens) }
    : top ? { agent: top.agent_type, tokens: fmt(top.tokens) } : {};
  const quip = useQuip(lines, trigger, vars);

  return (
    <div className="wrap">
      <a className="backlink" href="#" onClick={(e) => { e.preventDefault(); go('hub'); }}>← Desktop</a>
      <div className="eyebrow">History</div>
      <h1 className="title">The Ledger</h1>
      <p className="sub">Where the tokens went this week. Cost is a rough estimate, not your bill.</p>

      <div style={{ display: 'flex', gap: 28, marginTop: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div className="card" style={{ flex: '1 1 520px', minWidth: 320 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Fresh tokens · last 7 days</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 180 }}>
            {days.map((d) => (
              <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)' }}>{d.tokens ? fmt(d.tokens) : ''}</div>
                <div style={{
                  width: '70%', height: `${Math.round((d.tokens / peak) * 140)}px`, minHeight: 2,
                  background: d.tokens === peak && d.tokens > 0 ? 'var(--a-orange)' : '#d8c7a8', borderRadius: '5px 5px 0 0',
                }} />
                <div style={{ fontSize: 11, color: 'var(--ink-2)' }}>{d.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 26, marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <Big v={fmt(total)} l="total this week" />
            <Big v={`$${(hist?.cost || 0).toFixed(2)}`} l="est. cost" />
          </div>
        </div>
        <div className="card" style={{ flex: '0 0 240px', textAlign: 'center' }}>
          <Grandma tier={total > 4e6 ? 3 : 1} scale={0.7} />
          <p className="quip" style={{ margin: '10px 4px' }}>{quip}</p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 22 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>Top offenders</div>
        {agents.length === 0 ? <p className="empty">No sub-agents this week.</p> : agents.slice(0, 8).map((a, i) => {
          const w = Math.round((a.tokens / Math.max(1, agents[0].tokens)) * 100);
          return (
            <div key={a.agent_type} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 9 }}>
              <div style={{ width: 130, fontSize: 13, fontWeight: 600 }}>{a.agent_type} <span style={{ color: 'var(--ink-3)', fontWeight: 400, fontSize: 11 }}>×{a.runs}</span></div>
              <div style={{ flex: 1, background: '#eee7d8', borderRadius: 5, height: 14 }}>
                <div style={{ width: `${w}%`, height: '100%', background: ACCENTS[i % ACCENTS.length], borderRadius: 5 }} />
              </div>
              <div className="mono" style={{ width: 64, textAlign: 'right', fontSize: 12, color: 'var(--a-amber)' }}>{fmt(a.tokens)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Big({ v, l }) {
  return <div><div style={{ fontFamily: 'var(--font-mono)', fontSize: 19, fontWeight: 700 }}>{v}</div><div style={{ fontSize: 9.5, color: '#8a8590', textTransform: 'uppercase', letterSpacing: 0.4 }}>{l}</div></div>;
}
function fmt(n) { return n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}k` : String(n || 0); }
