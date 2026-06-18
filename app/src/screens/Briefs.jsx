import { Grandma } from '../components/Grandma.jsx';
import { useQuip } from '../data/useGrandmaState.js';

// Decision Brief queue (spec View 3). Bound to current.json.brief_queue[]. The queue stays
// empty until something writes brief files (brief-emit is a later integration), so the empty
// state is expected for now.
export function Briefs({ state, go }) {
  const { current, lines } = state;
  const queue = [...(current?.brief_queue || [])].sort((a, b) => (b.age_ms || 0) - (a.age_ms || 0));
  const oldest = queue[0]?.age_ms || 0;
  const trigger = queue.length === 0 ? 'brief_queue_empty'
    : oldest >= 6 * 3600e3 ? 'brief_stale'
    : queue.length >= 3 ? 'brief_piling'
    : 'brief_pending';
  const quip = useQuip(lines, trigger, {});
  const tier = oldest >= 6 * 3600e3 ? 4 : oldest >= 30 * 60e3 ? 2 : 0;

  return (
    <div className="wrap">
      <a className="backlink" href="#" onClick={(e) => { e.preventDefault(); go('hub'); }}>← Desktop</a>
      <div className="eyebrow">Decision Briefs</div>
      <h1 className="title">Waiting on you</h1>
      <div style={{ display: 'flex', gap: 28, marginTop: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 460px', minWidth: 320 }}>
          {queue.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <p className="empty" style={{ fontSize: 15 }}>Nothing on my desk. Suspiciously quiet.</p>
            </div>
          ) : queue.map((b) => {
            const stripe = (b.age_ms || 0) >= 6 * 3600e3 ? 'var(--st-error)' : (b.age_ms || 0) >= 30 * 60e3 ? 'var(--st-wait)' : 'var(--ink-3)';
            return (
              <div key={b.brief_id} className="card" style={{ padding: 0, marginBottom: 14, overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: 5, background: stripe }} />
                <div style={{ padding: 18, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="chip">{b.project || 'project'}</span>
                    <span className="mono" style={{ marginLeft: 'auto', fontSize: 12, color: stripe, fontWeight: 600 }}>{fmtAge(b.age_ms)}</span>
                  </div>
                  <div style={{ fontSize: 15.5, fontWeight: 700, margin: '8px 0 4px' }}>{b.brief_title || b.brief_id}</div>
                  {b.summary && <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>{b.summary}</div>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.cwd || ''}</span>
                    <span className="open" style={{ marginLeft: 'auto', color: 'var(--a-amber)' }}>Open ›</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="card" style={{ flex: '0 0 240px', textAlign: 'center', position: 'sticky', top: 20 }}>
          <Grandma tier={tier} scale={0.7} />
          <p className="quip" style={{ margin: '10px 0' }}>{quip}</p>
          <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 8 }}>
            <Stat v={queue.length} l="waiting" />
            <Stat v={queue.length ? fmtAge(oldest) : '—'} l="oldest" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ v, l }) {
  return <div><div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 16 }}>{v}</div><div className="l" style={{ fontSize: 9.5, color: '#8a8590', textTransform: 'uppercase' }}>{l}</div></div>;
}
function fmtAge(ms) {
  if (!ms) return 'now';
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
