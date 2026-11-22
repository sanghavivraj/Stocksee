import {
  sipSchedule, fdReality, fdSchedule, swpSchedule, interestOnlyWithdrawal, recoveryNeeded, afterChange,
  sipWithCost, yearlyDeposits, todaysValue, goldBreakEven,
} from './finance';
import { swpOutcome } from './cardMath';

/**
 * The numbers behind every Money Card story. The words live in content/samajh/stories.json (same scene ids).
 * Every scene is one of:
 *   run  - press Play (or Next) and watch time pass on a jar
 *   buy  - tap to practice-buy units month by month (SIP)
 *   lab  - drag sliders / pick a choice and watch bars or lines change, with Meera reacting
 *   real - real fund history (AMFI NAVs)
 * A scene's compute/frame gets { inp: the card's example inputs, vars: its calculated numbers, f: formatters, lang }.
 * They return the bars/lines to draw, a mood for Meera, and the key of the line she says (from stories.json).
 */

const sign = (v) => (v >= 0 ? '+' : '−');
const at = (arr, i) => (arr[i] ? arr[i].balance : 0);

// ---- the "what if prices fall" model: 12% a year trend, a drop at month 60, 24 months to climb back, 15 years in all
const CR = 60;
const END = 180;
export function crashFinal(choice, dropPct, monthly, recMonths = 24) {
  const tr = (1.12 ** (1 / 12)) - 1;
  const sr = (1.04 ** (1 / 12)) - 1;
  const d = dropPct / 100;
  const trend = (m) => 100 * ((1 + tr) ** m);
  const nav = (m) => (m < CR ? trend(m) : m < CR + recMonths ? trend(m) * ((1 - d) + (d * (m - CR)) / recMonths) : trend(m));
  let units = 0; let cash = 0;
  for (let m = 0; m < END; m += 1) {
    if (choice === 'sell' && m === CR) { cash = units * nav(m); units = 0; } else if (choice === 'sell' && m > CR) cash *= 1 + sr;
    const buy = !(choice === 'pause' && m >= CR && m < CR + 24);
    if (buy) { if (choice === 'sell' && m >= CR) cash += monthly; else units += monthly / nav(m); }
  }
  if (choice === 'sell') cash *= 1 + sr;
  return units * nav(END) + cash;
}

const lab = (o) => ({ type: 'lab', ...o });
const run = (o) => ({ type: 'run', ...o });

export const SCENES = {
  // ------------------------------------------------------------------ SIP
  sip: [
    run({
      id: 'auto', ticks: 12,
      frame: (i, { inp, f }) => ({
        level: i / 12, big: { label: 'putin', text: f.inr(inp.monthly * i) }, sub: { label: 'month', text: `${i} / 12` },
        mood: i === 12 ? 'happy' : 'calm', say: i === 12 ? 'done' : null, vars: { yearTotal: inp.monthly * 12 },
      }),
    }),
    { id: 'units', type: 'buy' },
    lab({
      id: 'grow',
      sliders: [
        { key: 'years', min: 1, max: 30, step: 1, def: (inp) => inp.years, fmt: 'years', label: 'years' },
        { key: 'rate', min: 0, max: 20, step: 0.5, def: (inp) => inp.rate, fmt: 'pct', label: 'rate' },
      ],
      compute: (v, { inp, f }) => {
        const s = sipSchedule({ monthly: inp.monthly, annualRate: v.rate, years: v.years, timing: inp.timing });
        const { invested, value } = s[s.length - 1];
        const big = value / invested >= 1.8;
        return {
          lines: [
            { key: 'invested', label: 'invested', points: s.map((p) => p.invested), tone: 'a' },
            { key: 'value', label: 'value', points: s.map((p) => p.value), tone: 'b' },
          ],
          readout: { label: 'read', text: f.inr(value) }, say: big ? 'big' : 'small', vars: { years: v.years, rate: v.rate, inv: invested, value }, mood: big ? 'happy' : 'calm',
        };
      },
    }),
    lab({
      id: 'fall',
      sliders: [{ key: 'drop', min: 10, max: 50, step: 5, def: () => 20, fmt: 'pct', label: 'drop' }],
      choices: [{ key: 'path', def: 'stay', options: ['stay', 'pause', 'sell'], label: 'path' }],
      compute: (v, { inp, f }) => {
        const fin = { stay: crashFinal('stay', v.drop, inp.monthly), pause: crashFinal('pause', v.drop, inp.monthly), sell: crashFinal('sell', v.drop, inp.monthly) };
        const order = Object.keys(fin).sort((a, b) => fin[b] - fin[a]);
        const rank = order.indexOf(v.path);
        return {
          bars: ['stay', 'pause', 'sell'].map((k) => ({ key: k, label: k, value: fin[k], tone: k === v.path ? 'sel' : 'dim' })),
          readout: { label: 'read', text: f.inr(fin[v.path]) }, say: rank === 0 ? 'top' : rank === 2 ? 'low' : 'mid',
          vars: { final: fin[v.path], top: fin[order[0]] }, mood: rank === 0 ? 'proud' : rank === 2 ? 'worried' : 'calm',
        };
      },
    }),
    { id: 'real', type: 'real' },
  ],

  // ------------------------------------------------------------------ Fixed Deposit
  fd: [
    run({
      id: 'lend', ticks: (inp) => inp.years,
      frame: (i, { inp, vars, f }) => {
        const s = fdSchedule({ principal: inp.principal, annualRate: inp.rate, years: inp.years, taxPercent: inp.tax, inflationPercent: inp.inflation });
        const p = s[i]; const last = i === inp.years;
        return {
          level: p.preTax / vars.maturity, big: { label: 'bal', text: f.inr(p.preTax) }, sub: { label: 'int', text: f.inr(p.preTax - inp.principal) },
          mood: last ? 'happy' : 'calm', say: last ? 'done' : null, vars: {},
        };
      },
    }),
    lab({
      id: 'tax',
      sliders: [{ key: 'tax', min: 0, max: 40, step: 5, def: (inp) => inp.tax, fmt: 'pct', label: 'tax' }],
      compute: (v, { inp, f }) => {
        const r = fdReality({ principal: inp.principal, annualRate: inp.rate, years: inp.years, taxPercent: v.tax, inflationPercent: inp.inflation });
        const kept = r.postTax - inp.principal;
        return {
          bars: [
            { key: 'interest', label: 'interest', value: r.interestPreTax, tone: 'a' },
            { key: 'taxpaid', label: 'taxpaid', value: r.taxPaid, tone: 'neg' },
            { key: 'kept', label: 'kept', value: kept, tone: 'pos' },
          ],
          scale: r.interestPreTax, readout: { label: 'read', text: f.inr(kept) },
          say: v.tax === 0 ? 'none' : v.tax >= 30 ? 'high' : 'low', vars: { tax: v.tax, taxPaid: r.taxPaid, interest: r.interestPreTax, kept },
          mood: v.tax === 0 ? 'happy' : v.tax >= 30 ? 'worried' : 'calm',
        };
      },
    }),
    lab({
      id: 'shrink',
      sliders: [{ key: 'inflation', min: 2, max: 10, step: 0.5, def: (inp) => inp.inflation, fmt: 'pct', label: 'inflation' }],
      compute: (v, { inp, f }) => {
        const r = fdReality({ principal: inp.principal, annualRate: inp.rate, years: inp.years, taxPercent: inp.tax, inflationPercent: v.inflation });
        const lose = r.todaysMoney < inp.principal;
        return {
          bars: [
            { key: 'put', label: 'put', value: inp.principal, tone: 'a' },
            { key: 'aftertax', label: 'aftertax', value: r.postTax, tone: 'b' },
            { key: 'todays', label: 'todays', value: r.todaysMoney, tone: lose ? 'neg' : 'pos' },
          ],
          scale: Math.max(r.postTax, inp.principal), dots: { total: 10, filled: Math.max(0, Math.min(10, Math.round((10 * r.todaysMoney) / inp.principal))) },
          readout: { label: 'read', text: f.inr(r.todaysMoney) }, say: lose ? 'lose' : 'keep',
          vars: { inflation: v.inflation, afterTax: r.postTax, todays: r.todaysMoney, principal: inp.principal }, mood: lose ? 'worried' : 'happy',
        };
      },
    }),
    lab({
      id: 'insured',
      sliders: [{ key: 'dep', min: 100000, max: 1000000, step: 50000, def: () => 700000, fmt: 'inr', label: 'dep' }],
      compute: (v, { vars, f }) => {
        const covered = Math.min(v.dep, vars.insured); const over = Math.max(0, v.dep - vars.insured);
        return {
          bars: [{ key: 'covered', label: 'covered', value: covered, tone: 'pos' }, { key: 'notcovered', label: 'notcovered', value: over, tone: 'neg' }],
          scale: 1000000, readout: { label: 'read', text: f.inr(covered) }, say: over > 0 ? 'over' : 'under', vars: { dep: v.dep, notIns: over }, mood: over > 0 ? 'worried' : 'happy',
        };
      },
    }),
  ],

  // ------------------------------------------------------------------ SWP
  swp: [
    run({
      id: 'drain', ticks: (inp) => inp.years, tickMs: 320,
      frame: (i, { inp, f }) => {
        const s = swpSchedule({ corpus: inp.corpus, monthlyWithdrawal: inp.withdraw, annualRate: inp.rate, years: i });
        const full = swpSchedule({ corpus: inp.corpus, monthlyWithdrawal: inp.withdraw, annualRate: inp.rate, years: inp.years });
        const depYear = full.depletedMonth ? Math.ceil(full.depletedMonth / 12) : null;
        const left = i === 0 ? inp.corpus : s.remaining;
        const last = i === inp.years;
        return {
          level: Math.min(1, left / inp.corpus), big: { label: 'left', text: f.inr(left) }, sub: { label: 'taken', text: f.inr(s.withdrawn) },
          mood: last && !depYear ? 'happy' : left < inp.corpus * 0.6 ? 'worried' : 'calm',
          say: i === depYear ? 'out' : null, vars: { year: i, withdrawn: s.withdrawn, years: inp.years, left },
        };
      },
    }),
    lab({
      id: 'rate',
      sliders: [{ key: 'rate', min: 2, max: 12, step: 0.5, def: (inp) => inp.rate, fmt: 'pct', label: 'rate' }],
      compute: (v, { inp, f, lang, formatInr }) => {
        const s = swpSchedule({ corpus: inp.corpus, monthlyWithdrawal: inp.withdraw, annualRate: v.rate, years: inp.years });
        const out = !!s.depletedMonth;
        return {
          bars: [{ key: 'y10', label: 'y10', value: at(s.yearly, 10), tone: 'a' }, { key: 'y20', label: 'y20', value: at(s.yearly, 20), tone: 'b' }, { key: 'y30', label: 'y30', value: at(s.yearly, 30), tone: 'c' }],
          scale: inp.corpus * 1.5, readout: { label: 'read', text: f.inr(s.remaining) }, say: out ? 'out' : 'lasts',
          vars: { rate: v.rate, outcome: swpOutcome(s, inp.years, lang, formatInr) }, mood: out ? 'worried' : 'happy',
        };
      },
    }),
    lab({
      id: 'withdraw',
      sliders: [{ key: 'withdraw', min: 10000, max: 100000, step: 5000, def: (inp) => inp.withdraw, fmt: 'inr', label: 'withdraw' }],
      compute: (v, { inp, f, lang, formatInr }) => {
        const s = swpSchedule({ corpus: inp.corpus, monthlyWithdrawal: v.withdraw, annualRate: inp.rate, years: inp.years });
        const earns = interestOnlyWithdrawal(inp.corpus, inp.rate); const over = v.withdraw > earns;
        return {
          bars: [{ key: 'peryear', label: 'peryear', value: v.withdraw * 12, tone: over ? 'neg' : 'b' }, { key: 'earns', label: 'earns', value: earns * 12, tone: 'a' }],
          scale: Math.max(v.withdraw * 12, earns * 12), readout: { label: 'read', text: f.inr(s.remaining) }, say: over ? 'over' : 'under',
          vars: { withdraw: v.withdraw, interestOnly: earns, outcome: swpOutcome(s, inp.years, lang, formatInr) }, mood: over ? 'worried' : 'happy',
        };
      },
    }),
  ],

  // ------------------------------------------------------------------ Stocks
  stocks: [
    lab({
      id: 'own',
      sliders: [{ key: 'shares', min: 10, max: 5000, step: 10, def: (inp) => inp.shares, fmt: 'plain', label: 'shares' }],
      compute: (v, { inp }) => {
        const own = ((v.shares / inp.totalShares) * 100).toFixed(5);
        return {
          bars: [{ key: 'cost', label: 'cost', value: v.shares * inp.price, tone: 'a' }], scale: 5000 * inp.price,
          readout: { label: 'read', text: `${own}%` }, say: 'tiny', vars: { shares: v.shares, own }, mood: 'calm',
        };
      },
    }),
    lab({
      id: 'move',
      sliders: [{ key: 'move', min: -60, max: 60, step: 5, def: () => 0, fmt: 'pct', label: 'move' }],
      compute: (v, { inp, f }) => {
        const paid = inp.shares * inp.price; const worth = afterChange(paid, v.move); const diff = worth - paid;
        return {
          bars: [{ key: 'paid', label: 'paid', value: paid, tone: 'a' }, { key: 'worth', label: 'worth', value: worth, tone: v.move > 0 ? 'pos' : v.move < 0 ? 'neg' : 'b' }],
          scale: paid * 1.6, readout: { label: 'read', text: `${sign(diff)}${f.inr(Math.abs(diff))}` }, say: v.move > 0 ? 'up' : v.move < 0 ? 'down' : 'flat',
          vars: { move: v.move, absMove: Math.abs(v.move), paid, worth, loss: paid - worth }, mood: v.move > 0 ? 'happy' : v.move < 0 ? 'worried' : 'calm',
        };
      },
    }),
    lab({
      id: 'recover',
      sliders: [{ key: 'fall', min: 10, max: 80, step: 5, def: (inp) => inp.down, fmt: 'pct', label: 'fall' }],
      compute: (v) => {
        const need = recoveryNeeded(v.fall);
        return {
          bars: [{ key: 'fallbar', label: 'fallbar', value: v.fall, tone: 'neg', fmt: 'pct' }, { key: 'rise', label: 'rise', value: need, tone: 'pos', fmt: 'pct' }],
          scale: 400, readout: { label: 'read', text: `${need.toFixed(0)}%` }, say: need >= 100 ? 'need' : 'small', vars: { fall: v.fall, need }, mood: need >= 100 ? 'wow' : 'calm',
        };
      },
    }),
    lab({
      id: 'dividend',
      choices: [{ key: 'case', def: 'paid', options: ['paid', 'skipped'], label: 'case' }],
      compute: (v, { inp, f }) => {
        const total = v.case === 'paid' ? inp.shares * inp.dividend : 0;
        return {
          bars: [{ key: 'div', label: 'div', value: total, tone: 'pos' }], scale: inp.shares * inp.dividend,
          readout: { label: 'read', text: f.inr(total) }, say: v.case, vars: { total }, mood: v.case === 'paid' ? 'happy' : 'calm',
        };
      },
    }),
  ],

  // ------------------------------------------------------------------ Mutual funds
  'mutual-funds': [
    lab({
      id: 'leak',
      sliders: [{ key: 'years', min: 1, max: 30, step: 1, def: (inp) => inp.years, fmt: 'years', label: 'years' }],
      compute: (v, { inp, vars, f }) => {
        const a = sipSchedule({ monthly: inp.monthly, annualRate: vars.netIndex, years: v.years });
        const b = sipSchedule({ monthly: inp.monthly, annualRate: vars.netActive, years: v.years });
        const index = a[a.length - 1].value; const active = b[b.length - 1].value; const drag = index - active; const big = drag / index > 0.06;
        return {
          lines: [{ key: 'index', label: 'index', points: a.map((p) => p.value), tone: 'a' }, { key: 'active', label: 'active', points: b.map((p) => p.value), tone: 'b' }],
          readout: { label: 'read', text: f.inr(drag) }, say: big ? 'drag' : 'small', vars: { years: v.years, active, index, drag }, mood: big ? 'worried' : 'calm',
        };
      },
    }),
    lab({
      id: 'edge',
      sliders: [{ key: 'edge', min: -3, max: 4, step: 0.5, def: () => 0, fmt: 'pct', label: 'edge' }],
      compute: (v, { inp, vars, f }) => {
        const index = sipWithCost({ monthly: inp.monthly, grossRate: inp.gross, costPercent: inp.indexCost, years: inp.years }).futureValue;
        const active = sipWithCost({ monthly: inp.monthly, grossRate: inp.gross + v.edge, costPercent: inp.activeCost, years: inp.years }).futureValue;
        const diff = active - index;
        return {
          bars: [{ key: 'index', label: 'index', value: index, tone: 'a' }, { key: 'active', label: 'active', value: active, tone: diff >= 0 ? 'pos' : 'neg' }],
          scale: Math.max(index, active) * 1.05, readout: { label: 'read', text: `${sign(diff)}${f.inr(Math.abs(diff))}` }, say: diff > 0 ? 'ahead' : 'behind',
          vars: { edge: v.edge, diff: Math.abs(diff), need: vars.grossEdgeNeeded }, mood: diff > 0 ? 'happy' : 'worried',
        };
      },
    }),
    { id: 'real', type: 'real' },
  ],

  // ------------------------------------------------------------------ ETF
  etf: [
    lab({
      id: 'nav',
      sliders: [{ key: 'price', min: 240, max: 260, step: 1, def: (inp) => inp.price, fmt: 'rupee', label: 'price' }],
      compute: (v, { inp }) => {
        const pct = ((v.price - inp.nav) / inp.nav) * 100; const extra = Math.max(0, inp.units * (v.price - inp.nav));
        return {
          bars: [{ key: 'extra', label: 'extra', value: extra, tone: 'neg' }], scale: inp.units * inp.price * 0.03,
          readout: { label: 'read', text: `${pct.toFixed(2)}%` }, say: pct > 0 ? 'above' : 'same', vars: { price: v.price, pct, extra, units: inp.units },
          mood: pct > 0.5 ? 'worried' : pct > 0 ? 'calm' : 'happy',
        };
      },
    }),
    lab({
      id: 'cost',
      sliders: [{ key: 'units', min: 1, max: 200, step: 1, def: (inp) => inp.units, fmt: 'plain', label: 'units' }],
      compute: (v, { inp }) => {
        const invested = v.units * inp.price; const brokerage = 2 * inp.brokerage; const spread = 2 * ((invested * inp.spread) / 100);
        const total = brokerage + spread; const pct = (total / invested) * 100;
        return {
          bars: [{ key: 'brokerage', label: 'brokerage', value: brokerage, tone: 'a' }, { key: 'spread', label: 'spread', value: spread, tone: 'b' }, { key: 'total', label: 'total', value: total, tone: 'neg' }],
          scale: Math.max(total, 100), readout: { label: 'read', text: `${pct.toFixed(2)}%` }, say: pct > 1 ? 'big' : 'small', vars: { invested, total, pct }, mood: pct > 1 ? 'worried' : 'calm',
        };
      },
    }),
    lab({
      id: 'move',
      sliders: [{ key: 'move', min: -20, max: 20, step: 1, def: () => 0, fmt: 'pct', label: 'move' }],
      compute: (v, { inp, f }) => {
        const invested = inp.units * inp.price; const roundTrip = 2 * (inp.brokerage + (invested * inp.spread) / 100);
        const back = afterChange(invested, v.move) - roundTrip; const diff = back - invested;
        return {
          bars: [{ key: 'paid', label: 'paid', value: invested, tone: 'a' }, { key: 'back', label: 'back', value: back, tone: diff >= 0 ? 'pos' : 'neg' }],
          scale: invested * 1.25, readout: { label: 'read', text: `${sign(diff)}${f.inr(Math.abs(diff))}` }, say: v.move === 0 ? 'flat' : v.move > 0 ? 'up' : 'down',
          vars: { roundTrip, back, move: v.move, absMove: Math.abs(v.move) }, mood: diff > 0 ? 'happy' : 'worried',
        };
      },
    }),
    lab({
      id: 'gap',
      sliders: [{ key: 'spread', min: 0, max: 1, step: 0.1, def: (inp) => inp.spread, fmt: 'pct', label: 'spread' }],
      compute: (v, { inp, f }) => {
        const invested = inp.units * inp.price; const brokerage = 2 * inp.brokerage; const spreadCost = 2 * ((invested * v.spread) / 100);
        const back = invested - brokerage - spreadCost; const lost = invested - back;
        const wide = v.spread >= 0.5;
        return {
          bars: [{ key: 'paid', label: 'paid', value: invested, tone: 'a' }, { key: 'back', label: 'back', value: back, tone: 'neg' }],
          scale: invested, readout: { label: 'read', text: `−${f.inr(lost)}` }, say: wide ? 'wide' : 'tight',
          vars: { spread: v.spread, lost, invested, spreadCost }, mood: wide ? 'worried' : 'calm',
        };
      },
    }),
  ],

  // ------------------------------------------------------------------ Gold
  gold: [
    run({
      id: 'layers', ticks: 2, manual: true,
      frame: (i, { inp, vars, f }) => {
        const afterMaking = vars.metal * (1 + inp.making / 100);
        const amount = [vars.metal, afterMaking, vars.paid][i];
        const part = [vars.metal, afterMaking - vars.metal, vars.paid - afterMaking][i];
        return {
          level: amount / vars.paid, big: { label: 'paid', text: f.inr(amount) }, sub: { label: `s${i}`, text: f.inr(part) },
          mood: i === 0 ? 'calm' : 'worried', say: ['metal', 'making', 'gst'][i], vars: { makingAmt: afterMaking - vars.metal },
        };
      },
    }),
    lab({
      id: 'grams',
      sliders: [{ key: 'grams', min: 5, max: 50, step: 5, def: (inp) => inp.grams, fmt: 'plain', label: 'grams' }],
      compute: (v, { inp, f }) => {
        const j = goldBreakEven({ grams: v.grams, pricePerGram: inp.pricePerGram, makingPercent: inp.making, gstPercent: inp.gst });
        const e = goldBreakEven({ grams: v.grams, pricePerGram: inp.pricePerGram, makingPercent: inp.etfCost, gstPercent: 0 });
        const diff = j.extraPaid - e.extraPaid;
        return {
          bars: [{ key: 'jew', label: 'jew', value: j.extraPaid, tone: 'neg' }, { key: 'etf', label: 'etf', value: e.extraPaid, tone: 'pos' }],
          scale: Math.max(j.extraPaid, 1), readout: { label: 'read', text: f.inr(diff) }, say: 'diff',
          vars: { grams: v.grams, jewExtra: j.extraPaid, etfExtra: e.extraPaid, diff }, mood: diff > 0 ? 'worried' : 'calm',
        };
      },
    }),
    lab({
      id: 'breakeven',
      sliders: [{ key: 'change', min: -30, max: 40, step: 5, def: () => 0, fmt: 'pct', label: 'change' }],
      compute: (v, { vars, f }) => {
        const worth = vars.metal * (1 + v.change / 100); const diff = worth - vars.paid;
        return {
          bars: [{ key: 'paid', label: 'paid', value: vars.paid, tone: 'a' }, { key: 'worth', label: 'worth', value: worth, tone: diff >= 0 ? 'pos' : 'neg' }],
          scale: Math.max(vars.paid, vars.metal * 1.4), readout: { label: 'read', text: `${sign(diff)}${f.inr(Math.abs(diff))}` }, say: diff >= 0 ? 'above' : 'below',
          vars: { change: v.change, worth, short: vars.paid - worth, breakEven: vars.breakEven, paid: vars.paid }, mood: diff >= 0 ? 'happy' : 'worried',
        };
      },
    }),
    lab({
      id: 'etf',
      sliders: [{ key: 'making', min: 0, max: 25, step: 1, def: (inp) => inp.making, fmt: 'pct', label: 'making' }],
      compute: (v, { inp, vars }) => {
        const jew = goldBreakEven({ grams: inp.grams, pricePerGram: inp.pricePerGram, makingPercent: v.making, gstPercent: inp.gst }).breakEvenRise;
        return {
          bars: [{ key: 'jew', label: 'jew', value: jew, tone: 'neg', fmt: 'pct1' }, { key: 'etf', label: 'etf', value: vars.etfBreakEven, tone: 'pos', fmt: 'pct1' }],
          scale: 30, readout: { label: 'read', text: `${jew.toFixed(1)}%` }, say: 'cmp', vars: { making: v.making, jew, etf: vars.etfBreakEven }, mood: jew > 10 ? 'worried' : 'calm',
        };
      },
    }),
  ],

  // ------------------------------------------------------------------ PPF
  ppf: [
    run({
      id: 'ladder', ticks: (inp) => inp.years, tickMs: 450,
      frame: (i, { inp, vars, f }) => {
        const y = i === 0 ? { invested: 0, maturity: 0 } : yearlyDeposits({ yearly: inp.yearly, annualRate: inp.rate, years: i });
        const last = i === inp.years;
        return {
          level: y.maturity / vars.maturity, big: { label: 'bal', text: f.inr(y.maturity) }, sub: { label: 'put', text: f.inr(y.invested) },
          mood: last ? 'happy' : 'calm', say: i === vars.withdrawFrom ? 'seven' : last ? 'done' : null, vars: {},
        };
      },
    }),
    lab({
      id: 'rate',
      sliders: [{ key: 'rate', min: 4, max: 9, step: 0.1, def: (inp) => inp.rate, fmt: 'pct', label: 'rate' }],
      compute: (v, { inp, vars, f }) => {
        const y = yearlyDeposits({ yearly: inp.yearly, annualRate: v.rate, years: inp.years }); const diff = y.maturity - vars.maturity;
        const same = Math.abs(diff) < 1;
        return {
          bars: [{ key: 'invested', label: 'invested', value: y.invested, tone: 'a' }, { key: 'maturity', label: 'maturity', value: y.maturity, tone: same ? 'b' : diff < 0 ? 'neg' : 'pos' }],
          scale: inp.yearly * inp.years * 2.2, readout: { label: 'read', text: f.inr(y.maturity) }, say: same ? 'same' : diff < 0 ? 'lower' : 'higher',
          vars: { rate: v.rate, baseRate: inp.rate, maturity: y.maturity, diff: Math.abs(diff) }, mood: same ? 'calm' : diff < 0 ? 'worried' : 'happy',
        };
      },
    }),
    lab({
      id: 'inflation',
      sliders: [{ key: 'inflation', min: 2, max: 9, step: 0.5, def: (inp) => inp.inflation, fmt: 'pct', label: 'inflation' }],
      compute: (v, { inp, vars, f }) => {
        const todays = todaysValue(vars.maturity, v.inflation, inp.years); const more = todays >= vars.invested;
        return {
          bars: [{ key: 'maturity', label: 'maturity', value: vars.maturity, tone: 'a' }, { key: 'todays', label: 'todays', value: todays, tone: more ? 'pos' : 'neg' }],
          scale: vars.maturity, dots: { total: 10, filled: Math.max(0, Math.min(10, Math.round((10 * todays) / vars.maturity))) },
          readout: { label: 'read', text: f.inr(todays) }, say: more ? 'more' : 'less', vars: { inflation: v.inflation, todays }, mood: more ? 'happy' : 'worried',
        };
      },
    }),
  ],
};
