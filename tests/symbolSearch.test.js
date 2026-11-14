const request = require('supertest');
const { createApp } = require('../src/app');
const { search, normalizeQuery } = require('../src/services/symbolSearchService');

const local = (q, limit) => search(q, { remote: false, limit });

describe('symbol search (typeahead)', () => {
  it('suggests Indian stocks from a single letter', async () => {
    const r = await local('D', 8);
    expect(r).toHaveLength(8);
    r.forEach((x) => expect(x.code.startsWith('D') || /\bD/i.test(x.name)).toBe(true));
  });

  it('finds a company by symbol prefix or by a word in its name', async () => {
    expect((await local('DECN'))[0]).toMatchObject({ symbol: 'DECNGOLD.NS', code: 'DECNGOLD', exchange: 'NSE' });
    const gold = await local('deccan gold');
    expect(gold.map((x) => x.code)).toContain('DECNGOLD');
  });

  it('puts an exact symbol match first and ignores a typed .NS suffix', async () => {
    expect((await local('TCS'))[0].code).toBe('TCS');
    expect((await local('reliance.ns'))[0].code).toBe('RELIANCE');
    expect(normalizeQuery('  cccl.bo ')).toBe('CCCL');
  });

  it('includes indices and commodities', async () => {
    expect((await local('nifty')).map((x) => x.symbol)).toEqual(expect.arrayContaining(['^NSEI', 'NIFTYBANK']));
    expect((await local('GOLD'))[0]).toMatchObject({ symbol: 'GOLD', exchange: 'COMMODITY' });
  });

  it('tops up with remote BSE-only results but prefers NSE for dual-listed companies', async () => {
    const fetchRemote = jest.fn(async () => [
      { symbol: 'TCS.BO', code: 'TCS', name: 'TCS (BSE)', exchange: 'BSE' },
      { symbol: 'ZZBSEONLY.BO', code: 'ZZBSEONLY', name: 'Only On BSE Ltd', exchange: 'BSE' },
    ]);
    const r = await search('ZZ', { limit: 8, fetchRemote });
    expect(r.map((x) => x.symbol)).toContain('ZZBSEONLY.BO');
    const t = await search('TCS', { limit: 15, fetchRemote });
    expect(t.map((x) => x.symbol)).not.toContain('TCS.BO');
  });

  it('never calls the remote search for one letter, and survives remote failure', async () => {
    const fetchRemote = jest.fn(async () => { throw new Error('down'); });
    await search('D', { fetchRemote });
    expect(fetchRemote).not.toHaveBeenCalled();
    await expect(search('QQQQQQ', { fetchRemote })).resolves.toEqual([]);
  });

  it('GET /api/search validates input and returns results', async () => {
    const app = createApp();
    expect((await request(app).get('/api/search')).status).toBe(400);
    const res = await request(app).get('/api/search').query({ q: 'tcs', limit: 1 });
    expect(res.status).toBe(200);
    expect(res.body.results[0]).toMatchObject({ code: 'TCS', symbol: 'TCS.NS' });
    expect(res.body.results.length).toBe(1);
  });
});
