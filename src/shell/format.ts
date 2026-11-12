/**
 * de-DE number formatting and input parsing. Shared with a future
 * Kindesunterhalt UI (SPEC Section 10). No I/O, no storage.
 */
import { d, type Decimal, type MoneyValue, type PercentValue } from '../netto/index.ts';

const NBSP = '\u00a0';
const MINUS = '\u2212';

/** 1630400 cents → "16.304,00 €" */
export function formatEuro(money: MoneyValue | number): string {
  const cents = typeof money === 'number' ? money : money.cents;
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100);
  const rest = abs % 100;
  const grouped = groupThousands(euros);
  const sign = negative ? MINUS : '';
  return `${sign}${grouped},${pad2(rest)}${NBSP}€`;
}

/** "38.78" or PercentValue → "38,78 %" */
export function formatPercent(value: PercentValue | string | null): string {
  if (value === null) return '—';
  const s = typeof value === 'string' ? value : value.percent;
  const [w, frac = '00'] = s.split('.');
  const negative = w.startsWith('-');
  const whole = negative ? w.slice(1) : w;
  const sign = negative ? MINUS : '';
  return `${sign}${groupThousands(Number(whole))},${frac.padEnd(2, '0')}${NBSP}%`;
}

function groupThousands(n: number): string {
  return Math.trunc(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

export type ParseResult =
  | { ok: true; value: Decimal; empty: false }
  | { ok: true; value: null; empty: true }
  | { ok: false; empty: false };

/**
 * Parse a user-typed euro amount. Accepts German (80.000,50) and
 * plain (80000 / 80000.50) forms. Returns empty for blank input.
 */
export function parseEuroInput(raw: string): ParseResult {
  let s = raw.trim().replace(/€/g, '').replace(/\s/g, '').replace(/\u00a0/g, '');
  s = s.replace(/\u2212/g, '-');
  if (!s) return { ok: true, value: null, empty: true };

  const negative = s.startsWith('-') || s.startsWith('+');
  const sign = s.startsWith('-') ? -1 : 1;
  if (negative) s = s.slice(1);
  if (!s) return { ok: false, empty: false };

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  let normalized: string;

  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if (lastComma > lastDot) {
      // German: 80.000,50
      normalized = s.replace(/\./g, '').replace(',', '.');
    } else {
      // English: 80,000.50
      normalized = s.replace(/,/g, '');
    }
  } else if (hasComma) {
    // 80000,50 or 80,50
    normalized = s.replace(/\./g, '').replace(',', '.');
  } else if (hasDot) {
    const parts = s.split('.');
    const last = parts[parts.length - 1];
    if (parts.length === 2 && last.length <= 2) {
      // 80000.5 or 80000.50 — decimal point
      normalized = s;
    } else {
      // 80.000 or 80.000.000 — thousand separators
      normalized = s.replace(/\./g, '');
    }
  } else {
    normalized = s;
  }

  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return { ok: false, empty: false };
  }
  try {
    const value = d(normalized).times(sign);
    if (!value.isFinite()) return { ok: false, empty: false };
    return { ok: true, value, empty: false };
  } catch {
    return { ok: false, empty: false };
  }
}

/** Format a default Zusatzbeitrag (fraction 0.029) as "2,9". */
export function formatZusatzbeitrag(fraction: Decimal): string {
  const pct = fraction.times(100);
  // Trim trailing zeros: 2.9 not 2.90, but keep at least one decimal if needed.
  return pct.toFixed(2).replace(/\.?0+$/, '').replace('.', ',');
}

export function parsePercentInput(raw: string): ParseResult {
  const s = raw.trim().replace(/%/g, '').replace(/\s/g, '');
  return parseEuroInput(s);
}
