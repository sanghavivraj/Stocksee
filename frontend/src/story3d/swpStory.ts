/**
 * The SWP story, rewritten as one continuous film (the lab only; the real app's SWP story is unchanged until you choose).
 * Order: meet the pot -> the monthly salary leaves it -> the key idea (takes more than it earns) -> years pass -> a smaller
 * salary -> what if earnings change. All numbers come from the app's own swpSchedule maths with the card's example inputs.
 * Hindi lines are new and need a native reader before they go in the real app.
 */
import { swpSchedule, interestOnlyWithdrawal } from "../samajh/finance";

const L = (en: string, hi: string) => ({ en, hi });
export const SWP_LABELS: Record<string, { en: string; hi: string }> = {
  pot: L("Her pot", "उसका घड़ा"), taken: L("Taken out so far", "अब तक निकाला"), left: L("Money left in the pot", "घड़े में बचे पैसे"), year: L("Year", "साल"), month: L("Month", "महीना"),
  earns: L("Pot earns in a month", "घड़ा महीने में कमाता है"), takes: L("Meera takes in a month", "मीरा महीने में निकालती है"), short: L("Short every month by", "हर महीने की कमी"),
  runsout: L("The pot runs out", "घड़ा खाली"), leftAfter: L("Left after", "बचे"), perYear: L("a year", "सालाना"), outIn: L("Out in year", "खाली, साल"), earned: L("earned", "कमाई"), taking: L("taken out", "निकाला"),
  inTray: L("Her monthly income", "उसकी मासिक आमदनी"), yrs: L("years", "साल"),
};
export const SWP_TEXT: Record<string, any> = {
  pot: { title: L("Meet the pot", "घड़े से मिलिए"),
    intro: { mood: "happy", ...L("Meet Meera. She has saved {{corpus|inr}}. Think of it as a pot of money. It stays invested and keeps earning, and she wants a monthly income from it.", "मिलिए मीरा से। उसने {{corpus|inr}} जमा किए हैं। इसे पैसों का एक घड़ा समझिए। यह लगा रहता है और कमाता रहता है, और मीरा इससे हर महीने आमदनी चाहती है।") }, says: {} },
  month: { title: L("Her monthly income", "मासिक आमदनी"),
    intro: { mood: "calm", ...L("Every month, on the same date, Meera takes {{withdraw|inr}} out of the pot, like a salary. Watch the coins leave. This is an SWP: a fixed amount out, at regular times, while the rest stays invested.", "हर महीने, एक ही तारीख को, मीरा घड़े से {{withdraw|inr}} निकालती है, जैसे तनख्वाह। देखिए सिक्के निकल रहे हैं। यही SWP है: तय रकम, तय समय पर, और बाकी पैसा लगा रहता है।") },
    says: { done: { mood: "calm", ...L("After 12 months she has taken out {{yearTotal|inr}}. The pot now holds {{left|inr}}.", "12 महीनों में उसने {{yearTotal|inr}} निकाले। अब घड़े में {{left|inr}} बचे हैं।") } } },
  gap: { title: L("The key idea", "असली बात"),
    intro: { mood: "wow", ...L("Here is the key idea. At an assumed {{rate}}% a year, the pot earns about {{earnM|inr}} a month. Meera takes {{withdraw|inr}}.", "यही असली बात है। मान लिए गए {{rate}}% सालाना पर घड़ा हर महीने लगभग {{earnM|inr}} कमाता है। मीरा {{withdraw|inr}} निकालती है।") },
    says: { gap: { mood: "worried", ...L("She takes {{gapM|inr}} more than the pot earns. That extra comes out of the pot itself, so the pot slowly gets smaller.", "वह घड़े की कमाई से {{gapM|inr}} ज़्यादा निकालती है। यह अतिरिक्त रकम घड़े में से ही जाती है, इसलिए घड़ा धीरे-धीरे छोटा होता जाता है।") },
      even: { mood: "happy", ...L("She takes no more than the pot earns, so the pot itself is not used up.", "वह घड़े की कमाई से ज़्यादा नहीं निकालती, इसलिए घड़ा खर्च नहीं होता।") } } },
  years: { title: L("The years pass", "साल बीतते हैं"),
    intro: { mood: "calm", ...L("Now watch the years pass. Each year the pot is a little smaller than the year before.", "अब सालों को बीतते देखिए। हर साल घड़ा पिछले साल से थोड़ा छोटा होता है।") },
    says: { out: { mood: "worried", ...L("In year {{year}} the pot ran out. In all, Meera took out {{withdrawn|inr}}. That is more than the {{corpus|inr}} she began with, because the pot kept earning along the way.", "साल {{year}} में घड़ा खाली हो गया। कुल मिलाकर मीरा ने {{withdrawn|inr}} निकाले। यह उसकी शुरुआती {{corpus|inr}} से ज़्यादा है, क्योंकि घड़ा रास्ते भर कमाता रहा।") },
      lasts: { mood: "happy", ...L("After {{years}} years about {{left|inr}} is still left in the pot.", "{{years}} साल बाद भी घड़े में लगभग {{left|inr}} बचे हैं।") } } },
  smaller: { title: L("A smaller salary", "छोटी तनख्वाह"),
    intro: { mood: "happy", ...L("What if she takes only {{safe|inr}} a month, which is less than the pot earns? Then the pot does not run dry.", "अगर वह सिर्फ़ {{safe|inr}} महीना निकाले, जो घड़े की कमाई से कम है? तब घड़ा खाली नहीं होता।") },
    says: { after: { mood: "happy", ...L("After {{years}} years about {{left|inr}} is still there. One line is {{withdraw|inr}} a month, the other is {{safe|inr}} a month.", "{{years}} साल बाद भी लगभग {{left|inr}} बचे हैं। एक रेखा {{withdraw|inr}} महीना है, दूसरी {{safe|inr}} महीना।") } } },
  rates: { title: L("If earnings change", "कमाई बदले तो"),
    intro: { mood: "calm", ...L("No one can promise what a pot will earn. See how long the same pot lasts if the earning is lower or higher than assumed.", "घड़ा कितना कमाएगा, यह कोई वादा नहीं कर सकता। देखिए कमाई कम या ज़्यादा होने पर वही घड़ा कितना चलता है।") },
    says: { done: { mood: "calm", ...L("Lower earnings made the pot run out sooner. Higher earnings made it last longer. The rate is only an assumption, not a promise.", "कम कमाई में घड़ा जल्दी खाली हुआ। ज़्यादा कमाई में ज़्यादा चला। दर सिर्फ़ एक मान्यता है, वादा नहीं।") } } },
};

/** Extra numbers the words use (on top of the card's own). */
export function swpVars(inp: any) {
  const earnM = interestOnlyWithdrawal(inp.corpus, inp.rate), gapM = Math.max(0, inp.withdraw - earnM);
  const safe = Math.max(5000, Math.floor((earnM * 0.9) / 5000) * 5000), yr = swpSchedule({ corpus: inp.corpus, monthlyWithdrawal: inp.withdraw, annualRate: inp.rate, years: 1 });
  return { earnM, gapM, safe, yearTotal: yr.withdrawn, left: yr.remaining };
}

const sched = (inp: any, withdraw: number, rate: number, years: number) => swpSchedule({ corpus: inp.corpus, monthlyWithdrawal: withdraw, annualRate: rate, years });
const bal = (inp: any, withdraw: number, rate: number) => sched(inp, withdraw, rate, inp.years).yearly.map((y: any) => y.balance);
const depYear = (s: any) => (s.depletedMonth ? Math.ceil(s.depletedMonth / 12) : null);

type Ctx = { inp: any; f: { inr: (v: number) => string }; L: (k: string) => string };
export const SWP_BEATS: any[] = [
  { id: "pot", type: "beat", dur: 10000, frame: (p: number, { inp, f, L }: Ctx) => ({ visual: { kind: "swp", level: 1, taken: 0, drop: 0, pot: f.inr(inp.corpus), tray: "", earn: "", take: "" }, hud: { label: L("pot"), text: f.inr(inp.corpus) }, mood: p < 0.6 ? "happy" : "calm" }) },
  { id: "month", type: "beat", dur: 16000, frame: (p: number, { inp, f, L }: Ctx) => {
    const m = Math.min(12, Math.floor(Math.max(0, p - 0.18) / 0.065)), s = sched(inp, inp.withdraw, inp.rate, m / 12), earnM = interestOnlyWithdrawal(inp.corpus, inp.rate);
    return { visual: { kind: "swp", level: s.remaining / inp.corpus, taken: Math.min(1, s.withdrawn / (inp.withdraw * 12)), drop: m, pot: f.inr(s.remaining), tray: f.inr(s.withdrawn), earn: "+" + f.inr(earnM) + " " + L("earned"), take: "−" + f.inr(inp.withdraw) },
      hud: { label: L("month") + " " + m + " / 12 · " + L("taken"), text: f.inr(s.withdrawn), sub: { label: L("left"), text: f.inr(s.remaining) } }, mood: "calm", say: m >= 12 ? "done" : null };
  } },
  { id: "gap", type: "beat", dur: 15000, frame: (p: number, { inp, f, L }: Ctx) => {
    const earnM = interestOnlyWithdrawal(inp.corpus, inp.rate), over = inp.withdraw > earnM;
    return { visual: { kind: "bars", scale: Math.max(earnM, inp.withdraw) * 1.15, bars: [{ key: "earns", label: L("earns"), value: earnM, tone: "a", text: f.inr(earnM) }, { key: "takes", label: L("takes"), value: inp.withdraw, tone: over ? "neg" : "b", text: f.inr(inp.withdraw) }] },
      hud: over ? { label: L("short"), text: f.inr(inp.withdraw - earnM) } : null, mood: p > 0.45 ? (over ? "worried" : "happy") : "wow", say: p > 0.45 ? (over ? "gap" : "even") : null };
  } },
  { id: "years", type: "beat", dur: 22000, frame: (p: number, { inp, f, L }: Ctx) => {
    const s = sched(inp, inp.withdraw, inp.rate, inp.years), pts = bal(inp, inp.withdraw, inp.rate), dep = depYear(s), yr = Math.min(inp.years, Math.round(p * inp.years)), sy = sched(inp, inp.withdraw, inp.rate, yr), gone = dep !== null && yr >= dep;
    return { visual: { kind: "lines", reveal: p, lines: [{ key: "left", label: L("left"), points: pts, tone: dep ? "neg" : "pos" }], mark: dep ? { at: dep, text: L("runsout") + " · " + L("year") + " " + dep } : null },
      hud: { label: L("year") + " " + yr, text: f.inr(gone ? 0 : sy.remaining), sub: { label: L("taken"), text: f.inr(sy.withdrawn) } }, mood: gone ? "worried" : p < 0.15 ? "calm" : sy.remaining < inp.corpus * 0.6 ? "worried" : "calm",
      say: dep ? (gone ? "out" : null) : p > 0.96 ? "lasts" : null, vars: { year: dep, withdrawn: s.withdrawn, years: inp.years, left: s.remaining } };
  } },
  { id: "smaller", type: "beat", dur: 20000, frame: (p: number, { inp, f, L }: Ctx) => {
    const { safe } = swpVars(inp), a = bal(inp, inp.withdraw, inp.rate), b = bal(inp, safe, inp.rate), yr = Math.min(inp.years, Math.round(p * inp.years)), sb = sched(inp, safe, inp.rate, yr), end = sched(inp, safe, inp.rate, inp.years);
    return { visual: { kind: "lines", reveal: p, lines: [{ key: "big", label: f.inr(inp.withdraw) + " / " + L("month").toLowerCase(), points: a, tone: "neg" }, { key: "small", label: f.inr(safe) + " / " + L("month").toLowerCase(), points: b, tone: "pos" }], mark: null },
      hud: { label: L("year") + " " + yr, text: f.inr(sb.remaining) }, mood: "happy", say: p > 0.55 ? "after" : null, vars: { years: inp.years, left: end.remaining, safe, withdraw: inp.withdraw } };
  } },
  { id: "rates", type: "beat", dur: 15000, frame: (p: number, { inp, f, L }: Ctx) => {
    const rs = [Math.max(2, inp.rate - 2), inp.rate, inp.rate + 2], res = rs.map((r) => ({ r, s: sched(inp, inp.withdraw, r, inp.years) })), max = Math.max(...res.map((x) => x.s.remaining), inp.corpus * 0.5);
    return { visual: { kind: "bars", scale: max, bars: res.map((x, i) => { const dep = depYear(x.s); return { key: "r" + i, label: x.r + "% " + L("perYear"), value: dep ? 0 : x.s.remaining, tone: dep ? "neg" : "pos", text: dep ? L("outIn") + " " + dep : f.inr(x.s.remaining) }; }) },
      hud: null, mood: "calm", say: p > 0.5 ? "done" : null };
  } },
];
