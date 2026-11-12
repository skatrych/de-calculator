/**
 * Gewerbesteuer and the § 35 EStG credit (SPEC Section 6.8).
 * Gewerbeertrag = Gewinn (no Hinzurechnungen / Kürzungen in v1).
 */
import type { ResolvedYearParams } from './params.ts';
import { commercialCents, d, floorTo100Euros, type Decimal } from './money.ts';

export interface GewerbeResult {
  gewerbeertrag: Decimal;
  taxable: Decimal;
  messbetrag: Decimal;
  gewst: Decimal;
}

export function computeGewerbesteuer(
  gewinn: Decimal,
  hebesatz: Decimal,
  params: ResolvedYearParams,
): GewerbeResult {
  const gewerbeertrag = floorTo100Euros(gewinn);
  const taxableRaw = gewerbeertrag.minus(params.gewerbeFreibetrag);
  const taxable = taxableRaw.isNegative() ? d(0) : taxableRaw;
  // 3.5 % of a multiple of 100 is at most two decimal places; keep exact, do not re-round.
  const messbetrag = taxable.times(params.steuermesszahl);
  const gewst = commercialCents(messbetrag.times(hebesatz).div(100));
  return { gewerbeertrag, taxable, messbetrag, gewst };
}

/**
 * § 35 credit: min(4 × Messbetrag, actual GewSt, proportional tarifliche ESt, tarifliche ESt).
 * Left at cents; no further rounding (SPEC Section 9).
 */
export function section35Credit(
  tariflicheEst: Decimal,
  messbetrag: Decimal,
  gewst: Decimal,
  gewinn: Decimal,
  spouseZve: Decimal,
  married: boolean,
  params: ResolvedYearParams,
): Decimal {
  if (messbetrag.lte(0)) return d(0);
  const four = params.section35Multiplier.times(messbetrag);
  const posUser = gewinn.gt(0) ? gewinn : d(0);
  const posSpouse = married && spouseZve.gt(0) ? spouseZve : d(0);
  const posSum = posUser.plus(posSpouse);
  const proportional = posSum.gt(0) ? posUser.div(posSum).times(tariflicheEst) : tariflicheEst;

  let credit = four;
  if (gewst.lt(credit)) credit = gewst;
  if (proportional.lt(credit)) credit = proportional;
  if (tariflicheEst.lt(credit)) credit = tariflicheEst;
  if (credit.isNegative()) credit = d(0);
  return credit;
}
