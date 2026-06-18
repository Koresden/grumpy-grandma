// Live agent graph built from current.json.agents[] (DB-4/D11: 2-level — session → agents).
// Active pulses, done is green, tokens are the real per-agent totals from subagent_stop.
const ACCENTS = ['var(--a-blue)', 'var(--a-green)', 'var(--a-purple)', 'var(--a-amber)', 'var(--a-slate)', 'var(--a-orange)'];
const STATUS_RING = { active: 'var(--a-plum)', done: 'var(--st-done)', waiting: 'var(--st-wait)' };

export function AgentTeam({ state, go }) {
  const { current, connected } = state;
  const sessions = current?.sessions || {};
  // Only agents we can attribute to a project (the server enriches a.project from events).
  // Unattributable orphans — e.g. agent files whose events were lost — are dropped, not bucketed.
  const agents = (current?.agents || []).filter((a) => a.project);

  // group by project — only projects that actually have sub-agents (solo sessions omitted).
  const groups = {};
  for (const a of agents) (groups[a.project] ||= []).push(a);
  const projects = Object.keys(groups).sort();
  const live = agents.filter((a) => a.status === 'active' && !a.stale).length;
  const totalTok = agents.reduce((s, a) => s + freshTok(a), 0);
  const depth = agents.length ? 2 : 1;

  return (
    <div className="wrap">
      <a className="backlink" href="#" onClick={(e) => { e.preventDefault(); go('hub'); }}>← Desktop</a>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div className="eyebrow">The Agent Team</div>
          <h1 className="title">Who's working, and what it costs</h1>
          <p className="sub">Live from <span className="mono">current.json</span> · {connected ? 'connected' : 'connecting…'}</p>
        </div>
        <div className="counters">
          <Counter v={live} l="agents live" c="var(--a-blue)" />
          <Counter v={depth} l="depth" c="var(--a-green)" />
          <Counter v={fmtTokens(totalTok)} l="fresh tokens" c="var(--a-amber)" />
        </div>
      </div>

      {projects.length === 0 ? (
        <p className="empty" style={{ marginTop: 40 }}>No projects in view right now. Peace, of a sort.</p>
      ) : (
        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 30 }}>
          {projects.map((proj) => {
            const list = groups[proj];
            return (
              <div key={proj} className="card" style={{ padding: 22 }}>
                <div style={{ marginBottom: 6 }}>
                  <div className="eyebrow">Project</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: 'var(--ink)' }}>
                    {proj} <span className="mono" style={{ fontSize: 12, fontWeight: 400, color: 'var(--ink-3)' }}>· {list.length} {list.length === 1 ? 'agent' : 'agents'}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <Node label="Grandma" role="orchestrator" accent="var(--a-plum)" status="active" />
                  {list.length > 0 ? (
                    <>
                      <div style={{ width: 2, height: 18, background: 'var(--border)' }} />
                      <div style={{ height: 2, background: 'var(--border)', width: '80%' }} />
                      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'center', paddingTop: 14 }}>
                        {list.map((a, i) => (
                          <div key={a.agent_id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ width: 2, height: 14, background: 'var(--border)', marginBottom: 6 }} />
                            <Node
                              label={a.agent_type || 'agent'}
                              role={a.status}
                              accent={ACCENTS[i % ACCENTS.length]}
                              status={a.status}
                              tok={freshTok(a)}
                            />
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="empty" style={{ marginTop: 12, fontSize: 13 }}>Solo session — no sub-agents.</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Node({ label, role, accent, status, tok }) {
  const ring = STATUS_RING[status] || 'var(--st-queued)';
  return (
    <div className="node">
      <div
        className={status === 'active' ? 'pulse' : ''}
        style={{
          width: 46, height: 46, borderRadius: '50%', background: accent,
          border: `3px solid ${ring}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 700, fontSize: 18, fontFamily: 'var(--font-display)',
        }}
      >
        {String(label).charAt(0).toUpperCase()}
        {status === 'done' && <span style={{ position: 'absolute', marginTop: 30, marginLeft: 30, fontSize: 13 }}>✓</span>}
      </div>
      <div className="label">{label}</div>
      <div className="role">{role}</div>
      {tok != null && <div className="tok">{fmtTokens(tok)}</div>}
    </div>
  );
}

function Counter({ v, l, c }) {
  return <div className="counter"><div className="v" style={{ color: c }}>{v}</div><div className="l">{l}</div></div>;
}
// Fresh tokens (input+output, cache excluded) from the server enrichment; falls back to the
// cache-inclusive billed total only if the transcript wasn't found.
function freshTok(a) { return a.fresh_in != null ? a.fresh_in + a.fresh_out : (a.tokens_in || 0) + (a.tokens_out || 0); }
function fmtTokens(n) { return n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}k` : String(n); }
