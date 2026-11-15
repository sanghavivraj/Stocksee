import hype from '../content/samajh/hype.json';
import {
  sipFutureValue, sipSchedule, requiredAnnualReturn, annualisedMultiple, annualFromMonthly, cagrFromMultiple,
  fdReality, lumpSum, swpSchedule, interestOnlyWithdrawal, recoveryNeeded, afterChange,
} from './finance';
import { fill, formatInr } from './format';
import { pick } from './content';
import { swpOutcome } from './cardMath';
import { parseClaim, detectRedFlags, isTipRequest, validateInput, TIP_REFUSAL, MAX_LENGTH } from './parseClaim';

/**
 * Hype Check, step 2: calculate (in JavaScript only) and assemble the six-part result.
 * Words come from content/samajh/hype.json, numbers come from here. The AI, if used at all, only explains these results.
 */

export const DEFAULTS = {
  rate: 12, timing: 'month-end', years: 10,
  fdRate: 7, tax: 30, inflation: 6, eqGood: 12, eqBad: 4, fall: 35, principal: 100000,
  swpCorpus: 5000000, swpWithdraw: 40000, swpRate: 8, swpYears: 30,
};

const VERDICT_CLASSES = ['mathematically_unrealistic', 'misleading', 'incomplete', 'unverifiable', 'possible'];

/** How demanding is a yearly return that must be earned every single year? (percent) */
export function classifyReturn(requiredPercent) {
  if (requiredPercent === null || requiredPercent === undefined || requiredPercent > 18) return 'mathematically_unrealistic';
  if (requiredPercent > 12) return 'misleading';
  return 'possible';
}

const DURATION = {
  en: { day: (n) => `${n} day${n === 1 ? '' : 's'}`, month: (n) => `${n} month${n === 1 ? '' : 's'}`, year: (n) => `${n} year${n === 1 ? '' : 's'}` },
  hi: { day: (n) => `${n} दिन`, month: (n) => `${n} महीने`, year: (n) => `${n} साल` },
};
export function durationText(days, lang = 'en') {
  const D = DURATION[lang] || DURATION.en;
  const trim = (x) => Number(x.toFixed(1));
  if (days >= 365) return D.year(trim(days / 365));
  if (days >= 60) return D.month(trim(days / 30));
  return D.day(Math.round(days));
}

const PER_LABEL = {
  en: { month: 'a month', year: 'a year', unspecified: '(period not stated)' },
  hi: { month: 'प्रति माह', year: 'सालाना', unspecified: '(अवधि नहीं बताई)' },
};
const ASSUMED = { en: ' (assumed, because the claim did not say)', hi: ' (मान लिया गया, क्योंकि दावे में नहीं बताया गया)' };
const NOTES = {
  en: { years: (y) => `The claim did not say how long, so we used ${y} years. You can change this below.` },
  hi: { years: (y) => `दावे में अवधि नहीं बताई गई, इसलिए हमने ${y} साल लिए। आप इसे नीचे बदल सकते हैं।` },
};

const round = (n, d = 2) => Number(n.toFixed(d));

// ---------------------------------------------------------------- per-kind numbers

function varsSipTarget(p, o, lang) {
  const years = o.years ?? p.years ?? DEFAULTS.years;
  const rate = o.rate ?? DEFAULTS.rate;
  const timing = o.timing ?? DEFAULTS.timing;
  const base = { monthly: p.monthly, years, timing };
  const r = sipFutureValue({ ...base, annualRate: rate });
  const need = requiredAnnualReturn({ ...base, target: p.target });
  const unit = sipFutureValue({ monthly: 1, years, timing, annualRate: rate }).futureValue;
  const bad = sipFutureValue({ ...base, annualRate: 4 });
  const needNominal = need?.nominal ?? 500;
  const needEffective = need?.effective ?? 500;
  const cls = need?.alreadyReached ? 'possible' : classifyReturn(need?.tooHigh ? null : needNominal);
  const sched = sipSchedule({ ...base, annualRate: rate });
  const schedNeed = need?.nominal ? sipSchedule({ ...base, annualRate: needNominal }) : null;
  return {
    cls,
    vars: {
      monthly: p.monthly, target: p.target, years, months: r.months, invested: r.invested, rate, timingLabel: hype.ui[lang].timings[timing],
      fv: r.futureValue, fvPct: (r.futureValue / p.target) * 100, gap: Math.max(0, p.target - r.futureValue), needNominal, needEffective,
      requiredMonthly: p.target / unit, fvBad: bad.futureValue, multipleOfInvested: p.target / r.invested,
    },
    chart: {
      series: [
        { id: 'invested', label: { en: 'Money you put in', hi: 'आपका लगाया पैसा' }, points: sched.map((x) => ({ x: x.year, y: x.invested })) },
        { id: 'value', label: { en: `At ${rate}% a year`, hi: `${rate}% सालाना पर` }, points: sched.map((x) => ({ x: x.year, y: x.value })) },
        ...(schedNeed ? [{ id: 'needed', label: { en: `Path the claim needs (${round(needNominal, 1)}% a year)`, hi: `दावे के लिए ज़रूरी रास्ता (${round(needNominal, 1)}% सालाना)` }, points: schedNeed.map((x) => ({ x: x.year, y: x.value })) }] : []),
      ],
    },
    controls: ['timing', 'years', 'rate'],
    notes: p.yearsAssumed && o.years === undefined ? [NOTES[lang].years(years)] : [],
    effective: { years, rate, timing },
  };
}

function varsSipReturn(p, o, lang) {
  const years = o.years ?? p.years;
  const timing = o.timing ?? DEFAULTS.timing;
  const lowerRate = o.rate ?? DEFAULTS.rate;
  const base = { monthly: p.monthly, years, timing };
  const r = sipFutureValue({ ...base, annualRate: p.claimedRate });
  return {
    cls: 'incomplete',
    vars: {
      monthly: p.monthly, years, months: r.months, invested: r.invested, claimedRate: p.claimedRate, lowerRate, timingLabel: hype.ui[lang].timings[timing],
      fvClaim: r.futureValue, fvLower: sipFutureValue({ ...base, annualRate: lowerRate }).futureValue, fv4: sipFutureValue({ ...base, annualRate: 4 }).futureValue,
    },
    chart: null,
    controls: ['timing', 'years', 'rate'],
    notes: [],
    effective: { years, rate: lowerRate, timing },
  };
}

function varsMultiple(p, lang) {
  const { multiple, days } = p;
  const short = days < 365;
  const cagr = short ? (annualisedMultiple(multiple, days) - 1) * 100 : cagrFromMultiple(multiple, days / 365);
  const perYear = annualisedMultiple(multiple, days);
  const start = DEFAULTS.principal;
  let cls;
  if (short) cls = multiple >= 1.5 ? 'mathematically_unrealistic' : (cagr > 18 ? 'misleading' : 'possible');
  else cls = classifyReturn(cagr);
  return {
    cls,
    vars: {
      multiple, days, duration: durationText(days, lang), start, perDay: (multiple ** (1 / days) - 1) * 100, perYear, cagr, startAfterYear: start * perYear,
      normal: lumpSum({ principal: start, annualRate: 12, years: days / 365 }).value, bad: afterChange(start, -10), multipleValue: start * multiple,
      short, long: !short,
    },
    chart: null, controls: [], notes: [], effective: {},
  };
}

function varsFdVsStocks() {
  const principal = DEFAULTS.principal;
  const years = 10;
  const fd = fdReality({ principal, annualRate: DEFAULTS.fdRate, years, taxPercent: DEFAULTS.tax, inflationPercent: DEFAULTS.inflation });
  const good = lumpSum({ principal, annualRate: DEFAULTS.eqGood, years }).value;
  const bad = lumpSum({ principal, annualRate: DEFAULTS.eqBad, years }).value;
  return {
    cls: 'misleading',
    vars: {
      principal, years, fdRate: DEFAULTS.fdRate, tax: DEFAULTS.tax, inflation: DEFAULTS.inflation, good: DEFAULTS.eqGood, bad: DEFAULTS.eqBad, fall: DEFAULTS.fall,
      fdPre: fd.preTax, fdPost: fd.postTax, fdToday: fd.todaysMoney, eqGood: good, eqBad: bad, eqCrash: afterChange(good, -DEFAULTS.fall),
    },
    chart: null, controls: [], notes: [], effective: {},
  };
}

function varsSwp(p, o, lang) {
  const corpus = p.corpus ?? DEFAULTS.swpCorpus;
  const withdraw = p.withdraw ?? DEFAULTS.swpWithdraw;
  const rate = o.rate ?? DEFAULTS.swpRate;
  const years = DEFAULTS.swpYears;
  const sched = (r) => swpSchedule({ corpus, monthlyWithdrawal: withdraw, annualRate: r, years });
  const s = sched(rate);
  const outcome = (x) => swpOutcome(x, years, lang, formatInr);
  return {
    cls: 'incomplete',
    vars: {
      corpus, withdraw, rate, years, goodRate: rate + 2, withdrawPct: ((withdraw * 12) / corpus) * 100, interestOnly: interestOnlyWithdrawal(corpus, rate),
      outcome: outcome(s), badOutcome: outcome(sched(4)), goodOutcome: outcome(sched(rate + 2)),
      assumedNote: p.corpus === null || p.withdraw === null ? ASSUMED[lang] : '',
    },
    chart: {
      series: [
        { id: 'base', label: { en: `${rate}% a year`, hi: `${rate}% सालाना` }, points: s.yearly.map((x) => ({ x: x.year, y: x.balance })) },
        { id: 'bad', label: { en: '4% a year', hi: '4% सालाना' }, points: sched(4).yearly.map((x) => ({ x: x.year, y: x.balance })) },
        { id: 'good', label: { en: `${rate + 2}% a year`, hi: `${rate + 2}% सालाना` }, points: sched(rate + 2).yearly.map((x) => ({ x: x.year, y: x.balance })) },
      ],
    },
    controls: ['rate'], notes: [], effective: { rate },
  };
}

function varsGuaranteed(p, o, lang) {
  const annual = p.per === 'month' ? annualFromMonthly(p.rate) : p.rate;
  const principal = DEFAULTS.principal;
  let cls;
  if (annual > 15) cls = 'mathematically_unrealistic';
  else if (annual > 9) cls = 'misleading';
  else cls = 'possible';
  return {
    cls,
    vars: {
      rate: p.rate, perLabel: PER_LABEL[lang][p.per], annual, principal, oneYear: principal * (1 + annual / 100), fdRate: DEFAULTS.fdRate,
      fdOneYear: principal * (1 + DEFAULTS.fdRate / 100), timesFd: annual / DEFAULTS.fdRate,
    },
    chart: null, controls: [], notes: [], effective: {},
  };
}

function varsNoTime(p) {
  const m = p.multiple;
  return {
    cls: 'unverifiable',
    vars: {
      multiple: m, cagr1: cagrFromMultiple(m, 1), cagr3: cagrFromMultiple(m, 3), cagr5: cagrFromMultiple(m, 5), cagr10: cagrFromMultiple(m, 10),
      yearsAt12: Math.log(m) / Math.log(1.12), start: DEFAULTS.principal, halved: afterChange(DEFAULTS.principal, -50), recovery: recoveryNeeded(50),
    },
    chart: null, controls: [], notes: [], effective: {},
  };
}

function compute(parsed, opts, lang) {
  switch (parsed.kind) {
    case 'sip-target': return varsSipTarget(parsed, opts, lang);
    case 'sip-return': return varsSipReturn(parsed, opts, lang);
    case 'multiple-in-time': return varsMultiple(parsed, lang);
    case 'pct-in-time': return varsMultiple(parsed, lang);
    case 'fd-vs-stocks': return varsFdVsStocks();
    case 'swp-income': return varsSwp(parsed, opts, lang);
    case 'guaranteed-return': return varsGuaranteed(parsed, opts, lang);
    case 'multiple-no-time': return varsNoTime(parsed);
    default: return { cls: 'unverifiable', vars: {}, chart: null, controls: [], notes: [], effective: {} };
  }
}

const CONTENT_KEY = { 'pct-in-time': 'multiple-in-time' };

/** Keep only numbers (rounded) so they can be handed to the AI as "the facts it may use". */
function factsFrom(vars) {
  const out = {};
  for (const [k, v] of Object.entries(vars)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = round(v, 4);
    else if (typeof v === 'string' && v.length < 140) out[k] = v;
  }
  return out;
}

/**
 * Analyse a pasted claim.
 * @param {string} text the claim
 * @param {{ timing?: string, rate?: number, years?: number }} opts changes the user made to the assumptions
 * @param {'en'|'hi'} lang
 */
export function analyseClaim(text, opts = {}, lang = 'en') {
  const language = hype.ui[lang] ? lang : 'en';
  const U = hype.ui[language];
  const valid = validateInput(text);
  if (!valid.ok) return { status: 'invalid', reason: valid.reason, message: U.invalid[valid.reason] };
  if (isTipRequest(text)) return { status: 'refused', message: TIP_REFUSAL[language], note: U.refusalNote };

  const parsed = parseClaim(text);
  const kindKey = CONTENT_KEY[parsed.kind] || parsed.kind;
  const c = hype.kinds[kindKey];
  const calc = compute(parsed, opts, language);
  const vars = calc.vars;
  const f = (t) => fill(t, vars, language);
  const shown = (arr) => (arr || []).filter((item) => !item.when || vars[item.when]);

  const flags = detectRedFlags(text);
  if (calc.cls === 'mathematically_unrealistic' && !flags.includes('unrealistic_math')) flags.push('unrealistic_math');

  const verdictBlock = pick(c.verdicts[calc.cls] || Object.values(c.verdicts)[0], language);
  return {
    status: 'ok',
    kind: parsed.kind,
    parsed,
    cls: calc.cls,
    title: f(pick(c.title, language)),
    controls: calc.controls,
    effective: calc.effective,
    notes: calc.notes,
    math: {
      formula: f(pick(c.formula, language)),
      assumptions: pick(c.assumptions, language).map(f),
      lines: shown(c.lines).map((l) => ({ kind: l.kind, label: f(pick(l.label, language)), value: f(pick(l.value, language)) })),
      chart: calc.chart,
    },
    hidden: pick(c.hidden, language).map(f),
    missing: pick(c.missing, language).map(f),
    realistic: { normal: f(pick(c.realistic.normal, language)), bad: f(pick(c.realistic.bad, language)) },
    redFlags: flags.map((code) => ({ code, text: pick(hype.redFlags[code], language) })),
    verdict: { cls: calc.cls, label: U.verdictLabels[calc.cls], lines: verdictBlock.map(f) },
    // the numbers an AI may talk about, and nothing else
    facts: factsFrom(vars),
  };
}

export { MAX_LENGTH, VERDICT_CLASSES };
export const presets = hype.presets;
export const hypeUi = hype.ui;
