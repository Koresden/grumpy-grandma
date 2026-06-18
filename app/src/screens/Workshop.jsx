import { Grandma } from '../components/Grandma.jsx';

// The Workshop (spec View 2 alt): sub-agents as grandma clerks at desks. Same live data as
// the Agent Team (current.agents), a warmer spatial layout. Art simplified vs the prototype.
const ACCENTS = ['var(--a-blue)', 'var(--a-green)', 'var(--a-purple)', 'var(--a-amber)', 'var(--a-slate)', 'var(--a-orange)'];
const STATUS = { active: { c: 'var(--a-plum)', t: 'working' }, done: { c: 'var(--st-done)', t: 'done' } };

export function Workshop({ state, go }) {
  const { current } = state;
  const agents = (current?.agents || []).filter((a) => a.project);
  const working = agents.filter((a) => a.status === 'active' && !a.stale).length;

  return (
    <div className="wrap">
      <a className="backlink" href="#" onClick={(e) => { e.preventDefault(); go('hub'); }}>← Desktop</a>
      <div className="eyebrow">The Workshop</div>
      <h1 className="title">Grandma's office</h1>
      <p className="sub">Every sub-agent is a clerk at her desk. {working} working now.</p>

      {/* office manager */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16, background: 'linear-gradient(180deg,#fffdf9,#f6efe1)' }}>
        <Grandma tier={working > 2 ? 2 : 0} scale={0.6} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Office Manager</div>
          <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>{agents.length} clerks on the books · {working} at their desks</div>
        </div>
      </div>

      {agents.length === 0 ? (
        <p className="empty" style={{ marginTop: 30 }}>The office is empty. Even Grandma's having a sit-down.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 18, marginTop: 18 }}>
          {agents.map((a, i) => {
            const st = STATUS[a.status] || { c: 'var(--st-queued)', t: a.status };
            const tok = a.fresh_in != null ? a.fresh_in + a.fresh_out : (a.tokens_in || 0) + (a.tokens_out || 0);
            return (
              <div key={a.agent_id} className="card" style={{ padding: 16, textAlign: 'center' }}>
                <div className={a.status === 'active' ? 'pulse' : ''} style={{ display: 'inline-block', borderRadius: '50%' }}>
                  <Grandma tier={0} accent={ACCENTS[i % ACCENTS.length]} scale={0.5} />
                </div>
                {/* the desk */}
                <div style={{ height: 10, background: '#cbd1db', borderRadius: '4px 4px 0 0', margin: '2px 12px 0' }} />
                <div style={{ height: 6, background: '#b6bec9', margin: '0 18px 10px', borderRadius: '0 0 4px 4px' }} />
                <div style={{ fontSize: 13, fontWeight: 700 }}>{a.agent_type || 'clerk'}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: st.c }} />
                  <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{st.t}</span>
                </div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--a-amber)', marginTop: 4 }}>{fmt(tok)} tok</div>
                <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 2 }}>{a.project}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function fmt(n) { return n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}k` : String(n || 0); }
