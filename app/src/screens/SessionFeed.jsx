import { Grandma } from '../components/Grandma.jsx';

// The Session Feed (spec View 5), metadata-level per §7: a live log of real events
// (session/subagent/handoff/brief) — NOT tool calls. Bound to current.recent_events.
const META = {
  session_start: { c: '#5fa552', label: 'session start' },
  session_end: { c: '#8a8590', label: 'session end' },
  subagent_start: { c: '#5a93c8', label: 'sub-agent spawned' },
  subagent_stop: { c: '#5fa552', label: 'sub-agent done' },
  handoff: { c: '#d2a23e', label: 'handoff' },
  brief_created: { c: '#9a78c8', label: 'brief created' },
  brief_approved: { c: '#5fa552', label: 'brief approved' },
  brief_rejected: { c: '#e0604f', label: 'brief rejected' },
  brief_edited: { c: '#9a78c8', label: 'brief edited' },
};

export function SessionFeed({ state, go }) {
  const { current } = state;
  const events = current?.recent_events || [];

  return (
    <div className="wrap">
      <a className="backlink" href="#" onClick={(e) => { e.preventDefault(); go('hub'); }}>← Desktop</a>
      <div className="eyebrow">The Session Feed</div>
      <h1 className="title">Live activity</h1>
      <p className="sub">Real orchestration events — what happened, not what you typed.</p>

      <div style={{ display: 'flex', gap: 22, marginTop: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 540px', minWidth: 320, background: '#15171d', borderRadius: 13, padding: 16, boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#ff5f57' }} />
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#febc2e' }} />
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#28c840' }} />
            <span className="mono" style={{ marginLeft: 8, color: '#8a8f9a', fontSize: 12 }}>session.log</span>
            <span style={{ marginLeft: 'auto', width: 7, height: 7, borderRadius: '50%', background: '#28c840' }} className="pulse" />
            <span className="mono" style={{ color: '#8a8f9a', fontSize: 11 }}>live</span>
          </div>
          <div style={{ maxHeight: 460, overflowY: 'auto' }}>
            {events.length === 0 ? (
              <div className="mono" style={{ color: '#6a6f7a', fontSize: 13, padding: 12 }}>waiting for activity…</div>
            ) : events.map((e) => {
              const m = META[e.event] || { c: '#8a8f9a', label: e.event };
              return (
                <div key={e.event_id} style={{ display: 'flex', gap: 10, padding: '4px 0', fontFamily: 'var(--font-mono)', fontSize: 12.5, alignItems: 'baseline' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.c, flexShrink: 0, alignSelf: 'center' }} />
                  <span style={{ color: '#cfd3da', width: 130, flexShrink: 0 }}>{m.label}</span>
                  <span style={{ color: '#7b818c' }}>{detail(e)}</span>
                  <span style={{ marginLeft: 'auto', color: '#5a5f68', flexShrink: 0 }}>{time(e.ts)}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="card" style={{ flex: '0 0 220px', textAlign: 'center' }}>
          <Grandma tier={1} scale={0.7} />
          <p className="quip" style={{ margin: '10px 4px' }}>"I see everything that goes on in this house. Everything."</p>
        </div>
      </div>
    </div>
  );
}

function detail(e) {
  const bits = [];
  if (e.agent_type) bits.push(e.agent_type);
  if (e.project) bits.push(e.project);
  if (e.tokens_in != null) bits.push(`${fmt((e.tokens_in || 0) + (e.tokens_out || 0))} tok`);
  if (e.meta && e.meta.brief_title) bits.push(e.meta.brief_title);
  return bits.join('  ·  ');
}
function time(ts) { try { return new Date(ts).toLocaleTimeString(); } catch { return ''; } }
function fmt(n) { return n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}k` : String(n); }
