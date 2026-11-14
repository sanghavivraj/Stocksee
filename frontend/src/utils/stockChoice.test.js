import { describe, it, expect } from 'vitest';
import { resolveStockChoice, validationMessage, MESSAGES } from './stockChoice';

const TCS = { symbol: 'TCS.NS', code: 'TCS', name: 'Tata Consultancy Services Limited', exchange: 'NSE' };
const CCCL = { symbol: 'CCCL.NS', code: 'CCCL', name: 'Cons. Const. Consort Ltd', exchange: 'NSE' };

describe('resolveStockChoice', () => {
  it('uses a picked suggestion', () => {
    expect(resolveStockChoice({ selected: TCS, typed: 'tc', suggestions: [] })).toBe(TCS);
  });

  it('accepts typed text only when it exactly equals a suggested code or symbol', () => {
    expect(resolveStockChoice({ selected: null, typed: 'tcs', suggestions: [TCS, CCCL] })).toBe(TCS);
    expect(resolveStockChoice({ selected: null, typed: '  TCS.ns  ', suggestions: [TCS] })).toBe(TCS);
  });

  it('rejects raw text that is not a real stock', () => {
    expect(resolveStockChoice({ selected: null, typed: 'C', suggestions: [] })).toBeNull();
    expect(resolveStockChoice({ selected: null, typed: 'xyz', suggestions: [TCS, CCCL] })).toBeNull();
  });

  it('rejects a partial match even when suggestions are showing', () => {
    expect(resolveStockChoice({ selected: null, typed: 'TC', suggestions: [TCS] })).toBeNull();
    expect(resolveStockChoice({ selected: null, typed: 'C', suggestions: [CCCL] })).toBeNull();
  });

  it('handles empty, whitespace and missing data', () => {
    expect(resolveStockChoice({ selected: null, typed: '', suggestions: [TCS] })).toBeNull();
    expect(resolveStockChoice({ selected: null, typed: '   ', suggestions: [TCS] })).toBeNull();
    expect(resolveStockChoice({ selected: null, typed: 'TCS', suggestions: undefined })).toBeNull();
    expect(resolveStockChoice({ selected: {}, typed: 'x', suggestions: [] })).toBeNull();
  });

  it('ignores special characters and very long text (no crash, no match)', () => {
    expect(resolveStockChoice({ selected: null, typed: '<script>alert(1)</script>', suggestions: [TCS] })).toBeNull();
    expect(resolveStockChoice({ selected: null, typed: 'A'.repeat(5000), suggestions: [TCS] })).toBeNull();
  });
});

describe('validationMessage', () => {
  it('asks for a selection when text was typed, and for typing when empty', () => {
    expect(validationMessage('C')).toBe(MESSAGES.invalid);
    expect(validationMessage('  xyz ')).toBe(MESSAGES.invalid);
    expect(validationMessage('')).toBe(MESSAGES.empty);
    expect(validationMessage('   ')).toBe(MESSAGES.empty);
    expect(MESSAGES.invalid).toBe('Please select a valid stock from the list.');
  });
});
