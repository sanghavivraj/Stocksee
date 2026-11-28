import { describe, it, expect } from 'vitest';
import { SWP_BEATS, SWP_TEXT, SWP_LABELS, swpVars } from './swpStory';
import { swpSchedule, interestOnlyWithdrawal } from '../samajh/finance';
import { loadCards } from '../samajh/content';
import { computeCard } from '../samajh/cardMath';
import { fill, formatInr } from '../samajh/format';

const card = loadCards().find((c) => c.id === 'swp');
const inp = card.inputs; // { corpus: 50 lakh, withdraw: 40,000 a month, rate: 8, years: 30 }
const f = { inr: (v) => formatInr(v, 'en') };
const L = (k) => k;
const frame = (id, p) => SWP_BEATS.find((b) => b.id === id).frame(p, { inp, f, L });
const sched = (withdraw, rate, years) => swpSchedule({ corpus: inp.corpus, monthlyWithdrawal: withdraw, annualRate: rate, years });

describe('the SWP film: story order', () => {
  it('has the six parts in the teaching order', () => {
    expect(SWP_BEATS.map((b) => b.id)).toEqual(['pot', 'month', 'gap', 'years', 'smaller', 'rates']);
    SWP_BEATS.forEach((b) => { expect(b.type).toBe('beat'); expect(b.dur).toBeGreaterThan(5000); expect(SWP_TEXT[b.id]).toBeTruthy(); });
  });
});

describe('the SWP film: every number comes from the real SWP maths', () => {
  it('part 1: the pot is full and shows the starting money', () => {
    const r = frame('pot', 0);
    expect(r.visual).toMatchObject({ kind: 'swp', level: 1, taken: 0 });
    expect(r.hud.text).toBe(f.inr(inp.corpus));
  });

  it('part 2: after 12 months the tray holds exactly what the schedule says was taken out', () => {
    const end = frame('month', 1); const year = sched(inp.withdraw, inp.rate, 1);
    expect(end.visual.drop).toBe(12);
    expect(end.hud.text).toBe(f.inr(year.withdrawn));
    expect(end.visual.pot).toBe(f.inr(year.remaining));
    expect(end.visual.level).toBeCloseTo(year.remaining / inp.corpus, 10);
    expect(end.say).toBe('done');
    expect(end.visual.earn).toContain(f.inr(interestOnlyWithdrawal(inp.corpus, inp.rate)));
    expect(end.visual.take).toContain(f.inr(inp.withdraw));
  });
  it('part 2: coins drop one at a time, never backwards', () => {
    let last = -1;
    for (let p = 0; p <= 1.0001; p += 0.01) { const d = frame('month', Math.min(p, 1)).visual.drop; expect(d).toBeGreaterThanOrEqual(last); expect(d).toBeLessThanOrEqual(12); last = d; }
    expect(frame('month', 0).visual.drop).toBe(0);
  });

  it('part 3: the pot earns less than Meera takes, and the shortfall is the difference', () => {
    const r = frame('gap', 1); const earn = interestOnlyWithdrawal(inp.corpus, inp.rate);
    expect(r.visual.bars[0].value).toBeCloseTo(earn, 6);
    expect(r.visual.bars[1].value).toBe(inp.withdraw);
    expect(earn).toBeLessThan(inp.withdraw);
    expect(r.hud.text).toBe(f.inr(inp.withdraw - earn));
    expect(r.say).toBe('gap');
    expect(r.mood).toBe('worried');
  });

  it('part 4: the pot runs out in the year the schedule says, and the line has one point per year', () => {
    const s = sched(inp.withdraw, inp.rate, inp.years); const dep = Math.ceil(s.depletedMonth / 12);
    const r = frame('years', 1);
    expect(dep).toBeGreaterThan(0); expect(dep).toBeLessThan(inp.years);
    expect(r.visual.lines[0].points).toHaveLength(inp.years + 1);
    expect(r.visual.lines[0].points[0]).toBe(inp.corpus);
    expect(r.visual.lines[0].points[inp.years]).toBe(0);
    expect(r.visual.mark.at).toBe(dep);
    expect(r.say).toBe('out');
    expect(r.vars.year).toBe(dep);
    expect(r.vars.withdrawn).toBeCloseTo(s.withdrawn, 6);
    // she took out more than she started with, because the pot kept earning (the surprising point of the story)
    expect(r.vars.withdrawn).toBeGreaterThan(inp.corpus);
  });
  it('part 4: the line is drawn from the left, never backwards', () => {
    let last = -1;
    for (let p = 0; p <= 1.0001; p += 0.05) { const rv = frame('years', Math.min(p, 1)).visual.reveal; expect(rv).toBeGreaterThanOrEqual(last); last = rv; }
    expect(frame('years', 0).say).toBeNull();
  });
  it('part 4: it does not claim the pot ran out when it does not (strong earnings)', () => {
    const strong = { ...inp, rate: 14 };
    const r = SWP_BEATS.find((b) => b.id === 'years').frame(1, { inp: strong, f, L });
    expect(r.visual.mark).toBeNull();
    expect(r.say).toBe('lasts');
  });

  it('part 5: a salary below what the pot earns lasts the whole time', () => {
    const { safe } = swpVars(inp); const r = frame('smaller', 1);
    expect(safe).toBeLessThan(interestOnlyWithdrawal(inp.corpus, inp.rate));
    expect(safe % 5000).toBe(0);
    const s = sched(safe, inp.rate, inp.years);
    expect(s.depletedMonth).toBeNull();
    expect(r.vars.left).toBeCloseTo(s.remaining, 6);
    expect(r.vars.left).toBeGreaterThan(0);
    expect(r.visual.lines).toHaveLength(2);
    expect(r.visual.lines[0].tone).toBe('neg'); expect(r.visual.lines[1].tone).toBe('pos');
  });

  it('part 6: a lower rate runs out sooner, a higher rate lasts', () => {
    const r = frame('rates', 1); const [low, mid, high] = r.visual.bars;
    const depOf = (rate) => { const s = sched(inp.withdraw, rate, inp.years); return s.depletedMonth ? Math.ceil(s.depletedMonth / 12) : null; };
    expect(depOf(inp.rate - 2)).toBeLessThan(depOf(inp.rate));
    expect(low.tone).toBe('neg'); expect(mid.tone).toBe('neg'); expect(high.tone).toBe('pos');
    expect(low.text).toContain(String(depOf(inp.rate - 2)));
    expect(high.value).toBeCloseTo(sched(inp.withdraw, inp.rate + 2, inp.years).remaining, 6);
    expect(r.say).toBe('done');
  });

  it('never invents a number: every frame at every moment is finite', () => {
    SWP_BEATS.forEach((b) => {
      for (let p = 0; p <= 1.0001; p += 0.1) {
        const r = b.frame(Math.min(p, 1), { inp, f, L });
        const nums = [];
        const walk = (v) => { if (typeof v === 'number') nums.push(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
        walk(r.visual); walk(r.vars);
        nums.forEach((n) => expect(Number.isFinite(n)).toBe(true));
        expect(['calm', 'happy', 'proud', 'wow', 'worried']).toContain(r.mood);
      }
    });
  });
});

describe('the SWP film: words (English and Hindi)', () => {
  const lines = [];
  Object.entries(SWP_TEXT).forEach(([id, t]) => {
    lines.push([`${id}.intro`, t.intro]);
    Object.entries(t.says || {}).forEach(([k, v]) => lines.push([`${id}.says.${k}`, v]));
  });
  const holes = (s) => [...String(s).matchAll(/\{\{\s*([a-zA-Z0-9_]+)/g)].map((m) => m[1]).sort();

  it.each(lines)('%s has English, Hindi and a mood', (_n, line) => {
    expect(line.en.length).toBeGreaterThan(10);
    expect(line.hi.length).toBeGreaterThan(10);
    expect(['calm', 'happy', 'proud', 'wow', 'worried']).toContain(line.mood);
  });
  it.each(lines)('%s: Hindi uses exactly the same numbers as English', (_n, line) => {
    expect(holes(line.hi)).toEqual(holes(line.en));
  });
  it('every gap in every line is filled by a real number (nothing like {{x}} is ever shown)', () => {
    const base = computeCard('swp', inp, 'en', formatInr).vars;
    const vars = { ...base, ...swpVars(inp), ...frame('years', 1).vars, ...frame('smaller', 1).vars };
    lines.forEach(([name, line]) => ['en', 'hi'].forEach((lang) => {
      const out = fill(line[lang], vars, lang);
      expect(out, `${name} ${lang}`).not.toMatch(/\{\{|NaN|undefined/);
    }));
  });
  it('every label exists in both languages', () => {
    Object.entries(SWP_LABELS).forEach(([k, v]) => { expect(v.en, k).toBeTruthy(); expect(v.hi, k).toBeTruthy(); });
  });
  it('says no advice: nothing tells her what to do, and the rate is called an assumption', () => {
    const all = lines.map(([, l]) => l.en.toLowerCase()).join(' ');
    expect(all).not.toMatch(/\byou should\b|\bbuy\b|\bsell now\b|guarantee/);
    expect(all).toContain('assumption');
  });
});
