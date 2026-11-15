import {
  sipFutureValue, sipSchedule, fdReality, fdSchedule, swpSchedule, interestOnlyWithdrawal, sipUnits, recoveryNeeded,
  afterChange, sipWithCost, yearlyDeposits, todaysValue, goldBreakEven,
} from './finance';

/**
 * Turns a card's inputs into the numbers its text talks about. Content (the words) lives in content/samajh/cards/*.json;
 * this file only calculates. Every function returns { vars, chart, table }:
 *   vars  - numbers the text templates use, e.g. {{maturity|inr}}
 *   chart - what to draw: { type: 'lines'|'bars', series|bars, ... } or null
 *   table - rows for the "see the numbers" table (accessible alternative to the chart)
 */

export const CARD_IDS = ['fd', 'sip', 'swp', 'stocks', 'mutual-funds', 'etf', 'gold', 'ppf'];

// Small phrases whose wording depends on the result (and on the language)
const PHRASES = {
  en: {
    runsOut: (years, months) => `the money runs out after ${years} years${months ? ` ${months} months` : ''}`,
    lasts: (amount, years) => `${amount} is still left after ${years} years`,
  },
  hi: {
    runsOut: (years, months) => `पैसा ${years} साल${months ? ` ${months} महीने` : ''} बाद खत्म हो जाता है`,
    lasts: (amount, years) => `${years} साल बाद भी ${amount} बचे रहते हैं`,
  },
};

export function swpOutcome(s, years, lang, formatInr) {
  const P = PHRASES[lang] || PHRASES.en;
  if (s.depletedMonth) return P.runsOut(Math.floor(s.depletedMonth / 12), s.depletedMonth % 12);
  return P.lasts(formatInr(s.remaining, lang), years);
}

const NAVS = [100, 92, 85, 95, 105, 110]; // hypothetical NAV on the SIP date of 6 months

const calculators = {
  fd(inp) {
    const r = fdReality({ principal: inp.principal, annualRate: inp.rate, years: inp.years, taxPercent: inp.tax, inflationPercent: inp.inflation });
    const lowInfl = fdReality({ principal: inp.principal, annualRate: inp.rate, years: inp.years, taxPercent: inp.tax, inflationPercent: 4 });
    const highInfl = fdReality({ principal: inp.principal, annualRate: inp.rate, years: inp.years, taxPercent: inp.tax, inflationPercent: 8 });
    const sched = fdSchedule({ principal: inp.principal, annualRate: inp.rate, years: inp.years, taxPercent: inp.tax, inflationPercent: inp.inflation });
    return {
      vars: {
        ...inp,
        maturity: r.preTax, interest: r.interestPreTax, taxPaid: r.taxPaid, afterTax: r.postTax, postRate: r.postTaxRate,
        todays: r.todaysMoney, lostPower: Math.max(0, inp.principal - r.todaysMoney), realRate: r.realRate, realRateAbs: Math.abs(r.realRate),
        todaysLowInfl: lowInfl.todaysMoney, todaysHighInfl: highInfl.todaysMoney, gainLowInfl: lowInfl.todaysMoney - inp.principal,
        lossHighInfl: inp.principal - highInfl.todaysMoney, insured: 500000,
      },
      chart: {
        type: 'lines', xLabel: 'year', yFormat: 'inr',
        series: [
          { id: 'preTax', key: 'preTax', label: { en: 'Bank maturity figure', hi: 'बैंक का परिपक्वता आँकड़ा' }, points: sched.map((p) => ({ x: p.year, y: p.preTax })) },
          { id: 'postTax', key: 'postTax', label: { en: 'After tax', hi: 'टैक्स के बाद' }, points: sched.map((p) => ({ x: p.year, y: p.postTax })) },
          { id: 'today', key: 'today', label: { en: 'In today’s money', hi: 'आज के पैसे में' }, points: sched.map((p) => ({ x: p.year, y: p.todaysMoney })) },
        ],
      },
      table: { head: { en: ['Year', 'Bank figure', 'After tax', 'In today’s money'], hi: ['साल', 'बैंक का आँकड़ा', 'टैक्स के बाद', 'आज के पैसे में'] }, formats: ['n', 'inr', 'inr', 'inr'], rows: sched.map((p) => [p.year, p.preTax, p.postTax, p.todaysMoney]) },
    };
  },

  sip(inp) {
    const base = { monthly: inp.monthly, annualRate: inp.rate, years: inp.years, timing: inp.timing };
    const r = sipFutureValue(base);
    const bad = sipFutureValue({ ...base, annualRate: 4 });
    const mid = sipFutureValue({ ...base, years: Math.max(1, inp.years / 2) });
    const crash = afterChange(mid.futureValue, -30);
    const u = sipUnits({ monthly: inp.monthly, navs: NAVS });
    const vars = {
      ...inp, invested: r.invested, fv: r.futureValue, gain: r.gain, fvBad: bad.futureValue, gainBad: bad.gain,
      halfwayValue: mid.futureValue, halfwayInvested: mid.invested, crashValue: crash, crashLoss: mid.futureValue - crash,
      totalUnits: u.totalUnits, avgCost: u.averageCostPerUnit, avgNav: u.averageNav, unitValue: u.valueAtLastNav, unitInvested: u.invested,
      unitGain: u.valueAtLastNav - u.invested, lastNav: NAVS[NAVS.length - 1], months: NAVS.length,
    };
    u.rows.forEach((row, i) => { vars[`nav${i + 1}`] = row.nav; vars[`u${i + 1}`] = row.units; });
    const sched = sipSchedule(base);
    const schedBad = sipSchedule({ ...base, annualRate: 4 });
    return {
      vars,
      chart: {
        type: 'lines', xLabel: 'year', yFormat: 'inr',
        series: [
          { id: 'invested', key: 'invested', label: { en: 'Money you put in', hi: 'आपका लगाया पैसा' }, points: sched.map((p) => ({ x: p.year, y: p.invested })) },
          { id: 'value', key: 'value', label: { en: `If it grows ${inp.rate}% a year`, hi: `अगर यह ${inp.rate}% सालाना बढ़े` }, points: sched.map((p) => ({ x: p.year, y: p.value })) },
          { id: 'bad', key: 'bad', label: { en: 'If it grows only 4% a year', hi: 'अगर यह सिर्फ 4% सालाना बढ़े' }, points: schedBad.map((p) => ({ x: p.year, y: p.value })) },
        ],
      },
      table: { head: { en: ['Year', 'You put in', 'Value', 'Value at 4%'], hi: ['साल', 'आपने लगाया', 'मूल्य', '4% पर मूल्य'] }, formats: ['n', 'inr', 'inr', 'inr'], rows: sched.map((p, i) => [p.year, p.invested, p.value, schedBad[i].value]) },
      units: { rows: u.rows, head: { en: ['Month', 'NAV (₹)', 'Units bought'], hi: ['महीना', 'NAV (₹)', 'खरीदी गई यूनिट'] } },
    };
  },

  swp(inp, lang = 'en', formatInr) {
    const s = swpSchedule({ corpus: inp.corpus, monthlyWithdrawal: inp.withdraw, annualRate: inp.rate, years: inp.years });
    const bad = swpSchedule({ corpus: inp.corpus, monthlyWithdrawal: inp.withdraw, annualRate: 4, years: inp.years });
    const good = swpSchedule({ corpus: inp.corpus, monthlyWithdrawal: inp.withdraw, annualRate: inp.rate + 2, years: inp.years });
    const at = (sched, y) => (sched.yearly[y] ? sched.yearly[y].balance : 0);
    const first = swpSchedule({ corpus: inp.corpus, monthlyWithdrawal: inp.withdraw, annualRate: inp.rate, years: 1 });
    return {
      vars: {
        ...inp, interestOnly: interestOnlyWithdrawal(inp.corpus, inp.rate), after1: first.remaining, after5: at(s, 5), after10: at(s, 10),
        withdrawnTotal: s.withdrawn, remaining: s.remaining, goodRate: inp.rate + 2,
        withdrawYear: inp.withdraw * 12, withdrawPct: ((inp.withdraw * 12) / inp.corpus) * 100,
        outcome: swpOutcome(s, inp.years, lang, formatInr), badOutcome: swpOutcome(bad, inp.years, lang, formatInr), goodOutcome: swpOutcome(good, inp.years, lang, formatInr),
        badAfter5: at(bad, 5), goodAfter10: at(good, 10),
      },
      chart: {
        type: 'lines', xLabel: 'year', yFormat: 'inr',
        series: [
          { id: 'base', key: 'base', label: { en: `${inp.rate}% a year`, hi: `${inp.rate}% सालाना` }, points: s.yearly.map((p) => ({ x: p.year, y: p.balance })) },
          { id: 'bad', key: 'bad', label: { en: '4% a year', hi: '4% सालाना' }, points: bad.yearly.map((p) => ({ x: p.year, y: p.balance })) },
          { id: 'good', key: 'good', label: { en: `${inp.rate + 2}% a year`, hi: `${inp.rate + 2}% सालाना` }, points: good.yearly.map((p) => ({ x: p.year, y: p.balance })) },
        ],
      },
      table: { head: { en: ['Year', 'Money left', 'At 4%', `At ${inp.rate + 2}%`], hi: ['साल', 'बचा पैसा', '4% पर', `${inp.rate + 2}% पर`] }, formats: ['n', 'inr', 'inr', 'inr'], rows: s.yearly.map((p, i) => [p.year, p.balance, bad.yearly[i]?.balance ?? 0, good.yearly[i]?.balance ?? 0]) },
    };
  },

  stocks(inp) {
    const invested = inp.shares * inp.price;
    const good = afterChange(invested, inp.up);
    const bad = afterChange(invested, -inp.down);
    return {
      vars: {
        ...inp, invested, goodValue: good, badValue: bad, goodGain: good - invested, badLoss: invested - bad,
        ownership: (inp.shares / inp.totalShares) * 100, dividendTotal: inp.shares * inp.dividend, recovery: recoveryNeeded(inp.down),
        goodPrice: inp.price * (1 + inp.up / 100), badPrice: inp.price * (1 - inp.down / 100), nothing: 0,
      },
      chart: {
        type: 'bars', yFormat: 'inr',
        bars: [
          { id: 'invested', label: { en: 'You paid', hi: 'आपने दिया' }, value: invested },
          { id: 'good', label: { en: `Price +${inp.up}%`, hi: `भाव +${inp.up}%` }, value: good },
          { id: 'bad', label: { en: `Price −${inp.down}%`, hi: `भाव −${inp.down}%` }, value: bad },
        ],
      },
      table: null,
    };
  },

  'mutual-funds'(inp) {
    const netIndex = inp.gross - inp.indexCost;
    const netActive = inp.gross - inp.activeCost;
    const index = sipWithCost({ monthly: inp.monthly, grossRate: inp.gross, costPercent: inp.indexCost, years: inp.years });
    const active = sipWithCost({ monthly: inp.monthly, grossRate: inp.gross, costPercent: inp.activeCost, years: inp.years });
    const activeGood = sipWithCost({ monthly: inp.monthly, grossRate: inp.gross + inp.edge, costPercent: inp.activeCost, years: inp.years });
    const activeBad = sipWithCost({ monthly: inp.monthly, grossRate: inp.gross - inp.edge, costPercent: inp.activeCost, years: inp.years });
    const sIdx = sipSchedule({ monthly: inp.monthly, annualRate: netIndex, years: inp.years });
    const sAct = sipSchedule({ monthly: inp.monthly, annualRate: netActive, years: inp.years });
    return {
      vars: {
        ...inp, netIndex, netActive, invested: index.invested, fvIndex: index.futureValue, fvActive: active.futureValue,
        costDrag: index.futureValue - active.futureValue, fvActiveGood: activeGood.futureValue, fvActiveBad: activeBad.futureValue,
        goodVsIndex: activeGood.futureValue - index.futureValue, badVsIndex: index.futureValue - activeBad.futureValue,
        grossEdgeNeeded: inp.activeCost - inp.indexCost, goodGross: inp.gross + inp.edge, badGross: inp.gross - inp.edge,
      },
      chart: {
        type: 'lines', xLabel: 'year', yFormat: 'inr',
        series: [
          { id: 'index', key: 'index', label: { en: 'Index fund (low cost)', hi: 'इंडेक्स फंड (कम खर्च)' }, points: sIdx.map((p) => ({ x: p.year, y: p.value })) },
          { id: 'active', key: 'active', label: { en: 'Active fund (same gross return)', hi: 'एक्टिव फंड (समान सकल रिटर्न)' }, points: sAct.map((p) => ({ x: p.year, y: p.value })) },
        ],
      },
      table: { head: { en: ['Year', 'Index fund', 'Active fund'], hi: ['साल', 'इंडेक्स फंड', 'एक्टिव फंड'] }, formats: ['n', 'inr', 'inr'], rows: sIdx.map((p, i) => [p.year, p.value, sAct[i].value]) },
    };
  },

  etf(inp) {
    const invested = inp.units * inp.price;
    const spreadCost = (invested * inp.spread) / 100;
    const oneWay = inp.brokerage + spreadCost;
    const roundTrip = oneWay * 2;
    const afterCosts = (change) => afterChange(invested, change) - roundTrip;
    return {
      vars: {
        ...inp, invested, spreadCost, oneWay, roundTrip, roundTripPct: (roundTrip / invested) * 100,
        goodValue: afterCosts(inp.up), badValue: afterCosts(-inp.down), goodGain: afterCosts(inp.up) - invested, badLoss: invested - afterCosts(-inp.down),
        premium: inp.price - inp.nav, premiumPct: ((inp.price - inp.nav) / inp.nav) * 100, navValue: inp.units * inp.nav,
        flat: invested - roundTrip, flatLoss: roundTrip,
      },
      chart: {
        type: 'bars', yFormat: 'inr',
        bars: [
          { id: 'invested', label: { en: 'You paid', hi: 'आपने दिया' }, value: invested },
          { id: 'good', label: { en: `Index +${inp.up}%, after costs`, hi: `इंडेक्स +${inp.up}%, खर्च के बाद` }, value: afterCosts(inp.up) },
          { id: 'bad', label: { en: `Index −${inp.down}%, after costs`, hi: `इंडेक्स −${inp.down}%, खर्च के बाद` }, value: afterCosts(-inp.down) },
        ],
      },
      table: null,
    };
  },

  gold(inp) {
    const j = goldBreakEven({ grams: inp.grams, pricePerGram: inp.pricePerGram, makingPercent: inp.making, gstPercent: inp.gst });
    const e = goldBreakEven({ grams: inp.grams, pricePerGram: inp.pricePerGram, makingPercent: inp.etfCost, gstPercent: 0 });
    const metalUp = afterChange(j.metal, inp.rise);
    const metalDown = afterChange(j.metal, -inp.fall);
    return {
      vars: {
        ...inp, metal: j.metal, paid: j.paid, extraPaid: j.extraPaid, breakEven: j.breakEvenRise, etfPaid: e.paid, etfBreakEven: e.breakEvenRise,
        upValue: metalUp, downValue: metalDown, upGain: metalUp - j.paid, downLoss: j.paid - metalDown, upGainSaved: metalUp - e.paid,
        pricePerGramUp: inp.pricePerGram * (1 + inp.rise / 100), pricePerGramDown: inp.pricePerGram * (1 - inp.fall / 100),
        flatLoss: j.extraPaid,
      },
      chart: {
        type: 'bars', yFormat: 'inr',
        bars: [
          { id: 'paid', label: { en: 'Jewellery: you paid', hi: 'गहने: आपने दिया' }, value: j.paid },
          { id: 'up', label: { en: `Gold +${inp.rise}%: worth`, hi: `सोना +${inp.rise}%: मूल्य` }, value: metalUp },
          { id: 'down', label: { en: `Gold −${inp.fall}%: worth`, hi: `सोना −${inp.fall}%: मूल्य` }, value: metalDown },
        ],
      },
      table: null,
    };
  },

  ppf(inp) {
    const p = yearlyDeposits({ yearly: inp.yearly, annualRate: inp.rate, years: inp.years });
    const low = yearlyDeposits({ yearly: inp.yearly, annualRate: inp.lowRate, years: inp.years });
    const high = yearlyDeposits({ yearly: inp.yearly, annualRate: inp.rate + 1, years: inp.years });
    return {
      vars: {
        ...inp, invested: p.invested, maturity: p.maturity, interest: p.interest, todays: todaysValue(p.maturity, inp.inflation, inp.years),
        maturityLow: low.maturity, maturityHigh: high.maturity, diffLow: p.maturity - low.maturity, highRate: inp.rate + 1,
        monthlyEquivalent: inp.yearly / 12, limit: 150000, minimum: 500, withdrawFrom: 7,
      },
      chart: {
        type: 'lines', xLabel: 'year', yFormat: 'inr',
        series: [
          { id: 'invested', key: 'invested', label: { en: 'Money you put in', hi: 'आपका लगाया पैसा' }, points: p.schedule.map((x) => ({ x: x.year, y: x.invested })) },
          { id: 'value', key: 'value', label: { en: `Balance at ${inp.rate}%`, hi: `${inp.rate}% पर बैलेंस` }, points: p.schedule.map((x) => ({ x: x.year, y: x.value })) },
          { id: 'low', key: 'low', label: { en: `Balance if rate falls to ${inp.lowRate}%`, hi: `अगर दर ${inp.lowRate}% हो जाए तो बैलेंस` }, points: low.schedule.map((x) => ({ x: x.year, y: x.value })) },
        ],
      },
      table: { head: { en: ['Year', 'You put in', `At ${inp.rate}%`, `At ${inp.lowRate}%`], hi: ['साल', 'आपने लगाया', `${inp.rate}% पर`, `${inp.lowRate}% पर`] }, formats: ['n', 'inr', 'inr', 'inr'], rows: p.schedule.map((x, i) => [x.year, x.invested, x.value, low.schedule[i].value]) },
    };
  },
};

/** Calculate one card. `formatInr` is passed in only for the few phrases that embed a rupee amount. */
export function computeCard(id, inputs, lang = 'en', formatInr = (v) => String(Math.round(v))) {
  const calc = calculators[id];
  if (!calc) throw new Error(`Unknown Samajh card: ${id}`);
  return calc(inputs, lang, formatInr);
}
