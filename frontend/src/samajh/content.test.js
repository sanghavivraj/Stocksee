import { describe, it, expect } from 'vitest';
import { loadCards, REQUIRED_BLOCKS, LEVELS, LANGUAGES, pick } from './content';
import { computeCard, CARD_IDS } from './cardMath';
import { fill, formatInr } from './format';

const cards = loadCards();
const textOf = (v) => JSON.stringify(v);

describe('Money Cards content', () => {
  it('has all 8 cards in order', () => {
    expect(cards.map((c) => c.id)).toEqual(CARD_IDS);
    expect(CARD_IDS).toEqual(['fd', 'sip', 'swp', 'stocks', 'mutual-funds', 'etf', 'gold', 'ppf']);
  });

  it('SIP and SWP are marked as methods with a plain explanation, the rest as products', () => {
    const kinds = Object.fromEntries(cards.map((c) => [c.id, c.kind]));
    expect(kinds.sip).toBe('method');
    expect(kinds.swp).toBe('method');
    expect(cards.find((c) => c.id === 'sip').methodNote.en).toMatch(/method, not an investment product/i);
    expect(cards.find((c) => c.id === 'swp').methodNote.en).toMatch(/method, not an investment product/i);
    expect(cards.filter((c) => c.kind === 'product')).toHaveLength(6);
  });

  describe.each(cards)('$id', (card) => {
    it('has both levels, every required block, in English and Hindi', () => {
      for (const level of LEVELS) {
        for (const block of REQUIRED_BLOCKS) {
          const field = card.levels[level][block];
          expect(field, `${card.id}.${level}.${block}`).toBeTruthy();
          for (const lang of LANGUAGES) {
            const value = field[lang];
            expect(value, `${card.id}.${level}.${block}.${lang}`).toBeTruthy();
            if (Array.isArray(value)) expect(value.length).toBeGreaterThanOrEqual(3);
          }
        }
        // English and Hindi lists must line up one to one
        for (const block of ['steps', 'wrong', 'influencers']) {
          expect(card.levels[level][block].hi).toHaveLength(card.levels[level][block].en.length);
        }
      }
      for (const key of ['name', 'tag']) for (const lang of LANGUAGES) expect(card[key][lang]).toBeTruthy();
    });

    it('has a "check before you act" list: each item says what to check and why, in both languages, with no advice words', () => {
      expect(card.checks.length).toBeGreaterThanOrEqual(4);
      for (const c of card.checks) {
        for (const lang of LANGUAGES) {
          expect(c.what[lang]).toBeTruthy();
          expect(c.why[lang]).toBeTruthy();
          expect(c.story[lang], `${card.id} story ${lang}`).toBeTruthy();
        }
      }
      expect(textOf(card.checks)).not.toMatch(/\b(you should buy|must buy|best|guaranteed|target price)\b/i);
    });

    it('states its assumptions and names its sources', () => {
      for (const lang of LANGUAGES) expect(card.assumptions[lang].length).toBeGreaterThanOrEqual(3);
      expect(card.sources.length).toBeGreaterThanOrEqual(1);
      card.sources.forEach((s) => expect(s.url).toMatch(/^https:\/\//));
    });

    it('every placeholder resolves for both languages, at the default numbers and at slider extremes', () => {
      const variants = [card.inputs];
      for (const c of card.controls.filter((x) => x.type !== 'timing')) {
        variants.push({ ...card.inputs, [c.key]: c.min }, { ...card.inputs, [c.key]: c.max });
      }
      for (const inputs of variants) {
        for (const lang of LANGUAGES) {
          const { vars } = computeCard(card.id, inputs, lang, formatInr);
          for (const [k, v] of Object.entries(vars)) {
            if (typeof v === 'number') expect(Number.isFinite(v), `${card.id} var ${k} for ${JSON.stringify(inputs)}`).toBe(true);
          }
          const all = [];
          const collect = (node) => {
            if (typeof node === 'string') all.push(node);
            else if (Array.isArray(node)) node.forEach(collect);
            else if (node && typeof node === 'object') Object.values(node).forEach(collect);
          };
          collect(pick(card.assumptions, lang));
          for (const level of LEVELS) for (const block of REQUIRED_BLOCKS) collect(pick(card.levels[level][block], lang));
          for (const text of all) {
            const filled = fill(text, vars, lang);
            expect(filled, `${card.id} (${lang}) -> ${text}`).not.toMatch(/⟦/);
            expect(filled).not.toMatch(/NaN|undefined|Infinity/);
          }
        }
      }
    });

    it('never promises anything and gives no buy or sell call', () => {
      const text = textOf(card.levels).toLowerCase() + textOf(card.assumptions).toLowerCase();
      expect(text).not.toMatch(/\bguaranteed return|you should buy|you should sell|must buy|must sell|assured return/);
      expect(text).not.toMatch(/\bwill (rise|double|triple|grow to)\b/);
    });

    it('shows a positive and a negative outcome together, with numbers', () => {
      for (const level of LEVELS) {
        expect(card.levels[level].positive.en).toMatch(/\{\{/);
        expect(card.levels[level].negative.en).toMatch(/\{\{/);
      }
    });
  });

  it('the acceptance numbers show up in the SIP card', () => {
    const sip = cards.find((c) => c.id === 'sip');
    const { vars } = computeCard('sip', sip.inputs, 'en', formatInr);
    const positive = fill(sip.levels.basic.positive.en, vars, 'en');
    expect(positive).toContain('₹11.5 lakh');
    expect(positive).toContain('₹6 lakh');
    expect(positive).toMatch(/hypothetical/i);
  });

  it('the FD card explains inflation and tax, the SWP card the remaining corpus, the SIP card NAV and units, the stocks card ownership', () => {
    const t = (id) => textOf(cards.find((c) => c.id === id).levels).toLowerCase();
    expect(t('fd')).toMatch(/inflation/);
    expect(t('fd')).toMatch(/tax/);
    expect(t('sip')).toMatch(/nav/);
    expect(t('sip')).toMatch(/units/);
    expect(t('swp')).toMatch(/remain/);
    expect(t('stocks')).toMatch(/ownership|owns/);
    expect(t('stocks')).toMatch(/market risk/);
  });
});
