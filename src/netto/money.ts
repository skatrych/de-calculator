/**
 * Decimal-safe money helpers. IEEE-754 floats are not used for money
 * or for the § 32a formulae (SPEC Section 6, Section 9).
 */
import { Decimal } from 'decimal.js';

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

export function d(value: Decimal.Value): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

/** Round down to a whole euro (§ 32a Abs. 1 Satz 1). */
export function floorEuro(value: Decimal.Value): Decimal {
  return d(value).toDecimalPlaces(0, Decimal.ROUND_DOWN);
}

/** Round down to a full 100 € (Gewerbeertrag, § 11 Abs. 1 GewStG). */
export function floorTo100Euros(value: Decimal.Value): Decimal {
  return d(value).div(100).toDecimalPlaces(0, Decimal.ROUND_DOWN).mul(100);
}

/** Discard fractions of a cent (Soli, § 4 Satz 3 SolzG 1995). */
export function floorCents(value: Decimal.Value): Decimal {
  return d(value).toDecimalPlaces(2, Decimal.ROUND_DOWN);
}

/** Commercial (kaufmännisch, ROUND_HALF_UP) rounding to cents. */
export function commercialCents(value: Decimal.Value): Decimal {
  return d(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** Commercial rounding to two decimal places (percentages). */
export function commercialPercent(value: Decimal.Value): Decimal {
  return d(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function clamp(value: Decimal.Value, lo: Decimal.Value, hi: Decimal.Value): Decimal {
  const x = d(value);
  const min = d(lo);
  const max = d(hi);
  if (x.lt(min)) return min;
  if (x.gt(max)) return max;
  return x;
}

/**
 * Amount already rounded per the SPEC rules, expressed as integer cents
 * and as a canonical two-decimal string (dot decimal, no grouping).
 */
export interface MoneyValue {
  /** Integer euro cents. 1 € = 100. Negative allowed (Netto can be negative). */
  cents: number;
  /** Canonical euros, e.g. "16304.00" or "-1558.02". */
  euros: string;
}

/** Convert an already-rounded decimal euro amount to MoneyValue. */
export function toMoney(value: Decimal.Value): MoneyValue {
  const amount = d(value);
  const centsDec = amount.mul(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  const cents = centsDec.toNumber();
  if (!Number.isInteger(cents)) {
    throw new Error(`toMoney: cents are not an integer: ${amount.toString()}`);
  }
  const euros = centsDec.div(100).toFixed(2);
  return { cents, euros };
}

export function moneyFromCents(cents: number): MoneyValue {
  if (!Number.isInteger(cents)) {
    throw new Error(`moneyFromCents: expected an integer, got ${cents}`);
  }
  return { cents, euros: new Decimal(cents).div(100).toFixed(2) };
}

export interface PercentValue {
  /** Hundredths of a percentage point: 3878 means 38.78 %. */
  hundredths: number;
  /** Canonical percent, e.g. "38.78". */
  percent: string;
}

export function toPercent(value: Decimal.Value): PercentValue {
  const rounded = commercialPercent(value);
  const hundredths = rounded.mul(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
  return { hundredths, percent: new Decimal(hundredths).div(100).toFixed(2) };
}
