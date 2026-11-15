import { useEffect, useState } from 'react';
import marketService from '../services/marketService';

/** Per-stock facts for the latest session: { 'TCS.NS': {changePercent, volumeRatio, relation, ...} }. */
export default function useInsights(symbols) {
  const [state, setState] = useState({ bySymbol: {}, items: [], loading: true });
  const key = (symbols || []).join(',');

  useEffect(() => {
    let alive = true;
    if (!key) {
      setState({ bySymbol: {}, items: [], loading: false });
      return undefined;
    }
    setState((s) => ({ ...s, loading: true }));
    marketService.getInsights(key.split(','))
      .then((res) => {
        if (!alive) return;
        const items = res.items || [];
        setState({ bySymbol: Object.fromEntries(items.map((i) => [i.symbol, i])), items, loading: false });
      })
      .catch(() => alive && setState({ bySymbol: {}, items: [], loading: false })); // unavailable: show nothing, never guess
    return () => { alive = false; };
  }, [key]);

  return state;
}
