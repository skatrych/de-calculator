/**
 * Kinderfreibetrag-Zähler helpers (SPEC v1.3). Pure functions so L1/L2
 * behaviour can be unit-tested without the DOM.
 */

export function defaultKfbZaehler(nChildren: number, married: boolean): number {
  return nChildren * (married ? 1 : 0.5);
}

export function formatKfbZaehler(n: number): string {
  // 0.5 stays "0.5"; whole numbers as "0", "1", "2".
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/**
 * L1: after the children count has been forced through 0 (Zähler was
 * forced to 0 and the field hidden), coming back to a positive count
 * must restore the default and clear the "user edited" flag.
 */
export function shouldResetKfbZaehler(previousChildren: number, nextChildren: number): boolean {
  return previousChildren === 0 && nextChildren > 0;
}

export const KFB_ZAEHLER_ERROR_NO_CHILDREN =
  'Der Kinderfreibetrag-Zähler muss 0 sein, wenn keine Kinder unter 25 angegeben sind.';

export function kfbZaehlerRangeError(max: number): string {
  return `Der Kinderfreibetrag-Zähler muss ein Vielfaches von 0,5 zwischen 0 und ${String(max).replace('.', ',')} sein.`;
}

export function validateKfbZaehler(
  raw: string,
  nChildren: number,
  married: boolean,
): { ok: true; value: number } | { ok: false; message: string } {
  const max = nChildren;
  const text = raw.trim().replace(',', '.');
  if (text === '') {
    return { ok: true, value: defaultKfbZaehler(nChildren, married) };
  }
  const v = Number(text);
  const isStep = Number.isFinite(v) && Math.abs(v * 2 - Math.round(v * 2)) < 1e-9;
  if (!Number.isFinite(v) || !isStep || v < 0 || v > max) {
    return {
      ok: false,
      message: max === 0 ? KFB_ZAEHLER_ERROR_NO_CHILDREN : kfbZaehlerRangeError(max),
    };
  }
  return { ok: true, value: v };
}
