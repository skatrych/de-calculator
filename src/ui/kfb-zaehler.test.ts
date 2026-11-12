import { describe, expect, it } from 'vitest';
import {
  defaultKfbZaehler,
  formatKfbZaehler,
  shouldResetKfbZaehler,
  validateKfbZaehler,
  kfbZaehlerRangeError,
  KFB_ZAEHLER_ERROR_NO_CHILDREN,
} from './kfb-zaehler.ts';

describe('L1 — reset Zähler when children go from 0 to >0', () => {
  it('resets when children go from 0 to 2 (and to any positive count)', () => {
    expect(shouldResetKfbZaehler(0, 2)).toBe(true);
    expect(shouldResetKfbZaehler(0, 1)).toBe(true);
    expect(shouldResetKfbZaehler(0, 3)).toBe(true);
  });

  it('does not reset for other transitions (edit-and-keep, lower, raise, stay at 0)', () => {
    expect(shouldResetKfbZaehler(2, 0)).toBe(false);
    expect(shouldResetKfbZaehler(2, 1)).toBe(false);
    expect(shouldResetKfbZaehler(2, 3)).toBe(false);
    expect(shouldResetKfbZaehler(1, 2)).toBe(false);
    expect(shouldResetKfbZaehler(0, 0)).toBe(false);
  });

  it('the restored default is children × 0.5 unmarried, × 1.0 married', () => {
    expect(defaultKfbZaehler(2, false)).toBe(1);
    expect(defaultKfbZaehler(2, true)).toBe(2);
    expect(defaultKfbZaehler(3, false)).toBe(1.5);
    expect(formatKfbZaehler(1)).toBe('1');
    expect(formatKfbZaehler(1.5)).toBe('1.5');
  });
});

describe('L2 — negative, above-max and wrong-step share one German error; no silent accept', () => {
  const msg2 = kfbZaehlerRangeError(2);

  it('rejects a negative value with the same German message as a wrong step', () => {
    const negative = validateKfbZaehler('-1', 2, false);
    const step = validateKfbZaehler('0.3', 2, false);
    expect(negative.ok).toBe(false);
    expect(step.ok).toBe(false);
    if (!negative.ok && !step.ok) {
      expect(negative.message).toBe(msg2);
      expect(negative.message).toBe(step.message);
    }
  });

  it('rejects a value above max (2.5 with 2 children; 1.5 with 1 child) with that message', () => {
    const over = validateKfbZaehler('2.5', 2, false);
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.message).toBe(msg2);

    const overOne = validateKfbZaehler('1.5', 1, false);
    expect(overOne.ok).toBe(false);
    if (!overOne.ok) expect(overOne.message).toBe(kfbZaehlerRangeError(1));
  });

  it('accepts legal values including 0, 0.5, 1, 1.5, 2 with 2 children', () => {
    for (const raw of ['0', '0.5', '0,5', '1', '1.0', '1.5', '2', '2.0']) {
      const r = validateKfbZaehler(raw, 2, false);
      expect(r.ok, raw).toBe(true);
    }
  });

  it('with 0 children, any positive Zähler is rejected (not clamped)', () => {
    const r = validateKfbZaehler('0.5', 0, false);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe(KFB_ZAEHLER_ERROR_NO_CHILDREN);
    expect(validateKfbZaehler('0', 0, false).ok).toBe(true);
  });
});
