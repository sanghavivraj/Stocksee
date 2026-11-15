const { round } = require('../src/lib/num');
const { mapLimit } = require('../src/lib/async');
const { createTtlCache } = require('../src/lib/ttlCache');

describe('round', () => {
  it('rounds to the given digits (2 by default)', () => {
    expect(round(1.23456)).toBe(1.23);
    expect(round(1.25, 1)).toBe(1.3);
    expect(round(12345.6, 0)).toBe(12346);
  });
  it('gives null, never NaN, for missing input', () => {
    expect(round(null)).toBeNull();
    expect(round(undefined)).toBeNull();
    expect(round(NaN)).toBeNull();
  });
});

describe('mapLimit', () => {
  it('keeps input order and never runs more than `limit` at once', async () => {
    let running = 0;
    let peak = 0;
    const out = await mapLimit([1, 2, 3, 4, 5, 6], 2, async (n) => {
      running += 1; peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5 * (7 - n)));
      running -= 1;
      return n * 10;
    });
    expect(out).toEqual([10, 20, 30, 40, 50, 60]);
    expect(peak).toBeLessThanOrEqual(2);
  });
  it('one failure fills only its own slot with the fallback (null by default)', async () => {
    const fn = async (n) => { if (n === 2) throw new Error('boom'); return n; };
    expect(await mapLimit([1, 2, 3], 2, fn)).toEqual([1, null, 3]);
    expect(await mapLimit([1, 2, 3], 2, fn, [])).toEqual([1, [], 3]);
  });
  it('handles an empty list', async () => {
    expect(await mapLimit([], 3, async (x) => x)).toEqual([]);
  });
});

describe('createTtlCache', () => {
  afterEach(() => jest.useRealTimers());

  it('returns fresh values, and undefined for missing or too-old ones', () => {
    jest.useFakeTimers();
    const cache = createTtlCache();
    cache.set('a', { n: 1 });
    expect(cache.get('a', 1000)).toEqual({ n: 1 });
    expect(cache.get('missing', 1000)).toBeUndefined();
    jest.advanceTimersByTime(1500);
    expect(cache.get('a', 1000)).toBeUndefined();      // too old for this reader
    expect(cache.get('a')).toEqual({ n: 1 });          // any age: the "last known copy" a stale fallback uses
  });
  it('drops the oldest entry when full, but not when only overwriting', () => {
    const cache = createTtlCache({ maxEntries: 2 });
    cache.set('a', 1); cache.set('b', 2);
    cache.set('b', 3);                                  // overwrite: nothing evicted
    expect(cache.get('a')).toBe(1);
    cache.set('c', 4);                                  // new key: oldest ('a') goes
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(3);
    expect(cache.size).toBe(2);
  });
});
