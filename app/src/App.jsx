import { useState } from 'react';
import { useGrandmaState } from './data/useGrandmaState.js';
import { Hub } from './screens/Hub.jsx';
import { LiveReaction } from './screens/LiveReaction.jsx';
import { AgentTeam } from './screens/AgentTeam.jsx';
import { Workshop } from './screens/Workshop.jsx';
import { Briefs } from './screens/Briefs.jsx';
import { Ledger } from './screens/Ledger.jsx';
import { SessionFeed } from './screens/SessionFeed.jsx';

// Routing is in-memory, seeded once from the ?v= param each window opens with. We deliberately
// do NOT use window.location.hash — macOS WebView state-restoration re-applies a stale hash
// after load, which would reopen a window on the wrong view. In-memory state is immune.
const params = new URLSearchParams(window.location.search);
const INITIAL = params.get('v') || 'hub';
const IS_WIDGET = params.get('widget') === '1';
if (IS_WIDGET) document.documentElement.classList.add('widget-mode');

const SCREENS = {
  reaction: LiveReaction, agents: AgentTeam, workshop: Workshop,
  briefs: Briefs, ledger: Ledger, feed: SessionFeed,
};

export function App() {
  const [route, go] = useState(INITIAL);
  const state = useGrandmaState(); // shared live state for every screen

  if (IS_WIDGET) return <LiveReaction state={state} compact />;
  const Screen = SCREENS[route];
  if (Screen) return <Screen state={state} go={go} />;
  return <Hub state={state} go={go} />;
}
