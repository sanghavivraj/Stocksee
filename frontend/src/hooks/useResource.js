import { useEffect, useState } from 'react';

/**
 * Load something when the component appears (and again whenever `deps` change).
 * Returns { status: 'loading' | 'ready' | 'error', data }. An answer that arrives after the component is gone
 * or after `deps` changed is ignored. A failure is `error` with no data, so screens show "unavailable", never a guess.
 */
export default function useResource(load, deps) {
  const [state, setState] = useState({ status: 'loading', data: null });
  useEffect(() => {
    let alive = true;
    load()
      .then((data) => alive && setState({ status: 'ready', data }))
      .catch(() => alive && setState({ status: 'error', data: null }));
    return () => { alive = false; };
    // `load` is a fresh closure every render; `deps` says when the request really changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
