/**
 * § 32a EStG tariff, Solidaritätszuschlag, and church-tax helpers.
 * Formulae and zone bounds: SPEC Section 7.1 and 6.7–6.9.
 */
import { CONSTANTS, type ResolvedYearParams } from './params.ts';
import {
  d,
  floorCents,
  floorEuro,
  type Decimal,
} from './money.ts';
import type { TaxZone } from './types.ts';

export interface TariffResult {
  /** Floored to a whole euro. */
  est: Decimal;
  /** Raw result before flooring, for isolated tariff tests. */
  raw: Decimal;
  zone: TaxZone;
}

/**
 * tarifliche Einkommensteuer after § 32a Abs. 1.
 * `zve` is already a whole euro (caller floors). Result is floored to a whole euro.
 */
export function tariff(zve: Decimal, params: ResolvedYearParams): TariffResult {
  const x = floorEuro(zve);
  const { grundfreibetrag, zone2To, zone3To, zone4To } = params;

  let raw: Decimal;
  let zone: TaxZone;

  if (x.lte(grundfreibetrag)) {
    raw = d(0);
    zone = 1;
  } else if (x.lte(zone2To)) {
    const y = x.minus(grundfreibetrag).div(10000);
    raw = params.zone2Coeff.times(y).plus(CONSTANTS.zone2Linear).times(y);
    zone = 2;
  } else if (x.lte(zone3To)) {
    const z = x.minus(zone2To).div(10000);
    raw = params.zone3Coeff.times(z).plus(CONSTANTS.zone3Linear).times(z).plus(params.zone3Offset);
    zone = 3;
  } else if (x.lte(zone4To)) {
    raw = CONSTANTS.zone4Rate.times(x).minus(params.zone4Subtract);
    zone = 4;
  } else {
    raw = CONSTANTS.zone5Rate.times(x).minus(params.zone5Subtract);
    zone = 5;
  }

  return { est: floorEuro(raw), raw, zone };
}

/** Splitting after § 32a Abs. 5: twice the tax on half the joint zvE, half floored. */
export function tariffSplitting(zveJoint: Decimal, params: ResolvedYearParams): TariffResult & { half: Decimal } {
  const half = floorEuro(d(zveJoint).div(2));
  const halfResult = tariff(half, params);
  return {
    est: halfResult.est.times(2),
    raw: halfResult.raw,
    zone: halfResult.zone,
    half,
  };
}

/**
 * Solidaritätszuschlag on a festzusetzende ESt assessment base.
 * Due only if the base *exceeds* the Freigrenze (`>`, not `≥`).
 * Fractions of a cent discarded (§ 4 SolzG 1995).
 */
export function soliOn(festSoli: Decimal, params: ResolvedYearParams, joint: boolean): Decimal {
  const fg = joint ? params.soliFreigrenzeJoint : params.soliFreigrenzeSingle;
  if (festSoli.lte(fg)) {
    return d(0);
  }
  const full = params.soliRate.times(festSoli);
  const mild = params.soliMilderung.times(festSoli.minus(fg));
  const raw = full.lt(mild) ? full : mild;
  return floorCents(raw);
}

/** Statutory marginal-rate label for the zone of the (half-of-joint) zvE. */
export function statutoryMarginalRateLabel(zone: TaxZone): string {
  switch (zone) {
    case 1:
      return '0 %';
    case 2:
      return '14–23,97 %';
    case 3:
      return '23,97–42 %';
    case 4:
      return '42 %';
    case 5:
      return '45 %';
  }
}
