import { useEffect, useState } from 'react';
import marketService from '../services/marketService';

// One request is shared by everything on screen for a couple of minutes
let shared = null; // { at, limit, promise }

const load = (limit) => {
  if (!shared || shared.limit < limit || Date.now() - shared.at > 2 * 60 * 1000) {
    shared = { at: Date.now(), limit, promise: marketService.getPopular(limit) };
    shared.promise.catch(() => { shared = null; });
  }
  return shared.promise;
};

/** The most traded stocks right now (live Nifty 500 list), for suggestions. Empty when unavailable, never invented. */
export default function usePopular(limit = 8) {
  const [state, setState] = useState({ items: [], loading: true });
  useEffect(() => {
    let alive = true;
    load(limit)
      .then((res) => alive && setState({ items: (res.items || []).slice(0, limit), loading: false }))
      .catch(() => alive && setState({ items: [], loading: false }));
    return () => { alive = false; };
  }, [limit]);
  return state;
}
