/**
 * Statutory and private KV, PV, RV and AV (SPEC Sections 6.2–6.6).
 */
import type { PvSchedule, ResolvedYearParams } from './params.ts';
import { CONSTANTS } from './params.ts';
import {
  clamp,
  commercialCents,
  d,
  type Decimal,
} from './money.ts';
import type { AvMode, KvType, RvMode } from './types.ts';

export interface SocialInput {
  gewinn: Decimal;
  kvType: KvType;
  zusatzbeitrag: Decimal;
  childrenUnder25: number;
  elterneigenschaft: boolean;
  age23Plus: boolean;
  pkvPremiumMonthly: Decimal;
  pkvBasisMonthly: Decimal;
  privatePvMonthly: Decimal;
  rvMode: RvMode;
  voluntaryRvMonthly: Decimal;
  avMode: AvMode;
  married: boolean;
}

export interface SocialResult {
  kvPvBemessung: Decimal | null;
  kvPvBemessungNote: 'minimum' | 'income' | 'bbg' | 'pkv';
  kvCash: Decimal;
  kvDeductible: Decimal;
  kvRate: Decimal | null;
  pvCash: Decimal;
  pvDeductible: Decimal;
  pvRate: Decimal;
  rvCash: Decimal;
  avCash: Decimal;
  deductAlter: Decimal;
  deductBasis: Decimal;
  deductSonstige: Decimal;
  vorsorge: Decimal;
}

/**
 * Annual PV rate (SPEC Section 6.4).
 * 2025–2026: 3.6 % base + child rules.
 * 2024: 3.4 % base + child rules (PUEG, full year).
 * 2023: equal-month (6/12 + 6/12) weighted average of pre-PUEG H1 and PUEG H2.
 * Childless 23+ in 2023 is 3.70 % (not 3.525 %).
 */
function pvRateFromSchedule(
  schedule: PvSchedule,
  age23Plus: boolean,
  childrenUnder25: number,
  elterneigenschaft: boolean,
): Decimal {
  if (childrenUnder25 >= 2 && schedule.abschlagPerChild.gt(0)) {
    const n = Math.min(childrenUnder25, schedule.abschlagMaxChildren);
    return schedule.baseRate.minus(schedule.abschlagPerChild.times(n - 1));
  }
  if (childrenUnder25 >= 1 || elterneigenschaft || !age23Plus) {
    return schedule.baseRate;
  }
  return schedule.baseRate.plus(schedule.childlessSurcharge);
}

export function pvRate(
  age23Plus: boolean,
  childrenUnder25: number,
  elterneigenschaft: boolean,
  params: ResolvedYearParams,
): Decimal {
  const schedules = params.pvSchedules;
  if (schedules.length === 1) {
    return pvRateFromSchedule(schedules[0], age23Plus, childrenUnder25, elterneigenschaft);
  }
  const h1 = pvRateFromSchedule(schedules[0], age23Plus, childrenUnder25, elterneigenschaft);
  const h2 = pvRateFromSchedule(schedules[1], age23Plus, childrenUnder25, elterneigenschaft);
  return h1.plus(h2).div(2);
}

function statutoryBemessung(
  gewinn: Decimal,
  params: ResolvedYearParams,
): { bemessung: Decimal; note: 'minimum' | 'income' | 'bbg' } {
  const bemessung = clamp(gewinn, params.kvMinAnnual, params.kvPvBbgAnnual);
  if (gewinn.lt(params.kvMinAnnual)) return { bemessung, note: 'minimum' };
  if (gewinn.gt(params.kvPvBbgAnnual)) return { bemessung, note: 'bbg' };
  return { bemessung, note: 'income' };
}

export function computeSocial(input: SocialInput, params: ResolvedYearParams): SocialResult {
  let kvPvBemessung: Decimal | null = null;
  let kvPvBemessungNote: SocialResult['kvPvBemessungNote'] = 'pkv';
  let kvCash = d(0);
  let kvDeductible = d(0);
  let kvRate: Decimal | null = null;
  let pvCash = d(0);
  let pvDeductible = d(0);
  const ratePv = pvRate(input.age23Plus, input.childrenUnder25, input.elterneigenschaft, params);

  if (input.kvType === 'pkv') {
    kvCash = commercialCents(input.pkvPremiumMonthly.times(12));
    kvDeductible = commercialCents(input.pkvBasisMonthly.times(12));
    pvCash = commercialCents(input.privatePvMonthly.times(12));
    pvDeductible = pvCash;
    kvPvBemessung = null;
    kvPvBemessungNote = 'pkv';
  } else {
    const { bemessung, note } = statutoryBemessung(input.gewinn, params);
    kvPvBemessung = bemessung;
    kvPvBemessungNote = note;
    const base = input.kvType === 'gkv_allgemein' ? params.kvGeneralRate : params.kvReducedRate;
    kvRate = base.plus(input.zusatzbeitrag);
    kvCash = commercialCents(bemessung.times(kvRate));
    kvDeductible =
      input.kvType === 'gkv_allgemein'
        ? commercialCents(kvCash.times(CONSTANTS.krankengeldDeductibleShare))
        : kvCash;
    pvCash = commercialCents(bemessung.times(ratePv));
    pvDeductible = pvCash;
  }

  const rvCash = computeRv(input, params);
  const avCash = computeAv(input.avMode, params);

  const capAlter = input.married ? params.alterCapJoint : params.alterCapSingle;
  const deductAlter = rvCash.lt(capAlter) ? rvCash : capAlter;

  const basis = kvDeductible.plus(pvDeductible);
  let deductBasis: Decimal;
  let deductSonstige: Decimal;
  if (basis.gte(params.sonstigeVorsorgeCap)) {
    deductBasis = basis;
    deductSonstige = d(0);
  } else {
    deductBasis = basis;
    const room = params.sonstigeVorsorgeCap.minus(basis);
    deductSonstige = avCash.lt(room) ? avCash : room;
  }

  const vorsorge = deductAlter.plus(deductBasis).plus(deductSonstige);

  return {
    kvPvBemessung,
    kvPvBemessungNote,
    kvCash,
    kvDeductible,
    kvRate,
    pvCash,
    pvDeductible,
    pvRate: ratePv,
    rvCash,
    avCash,
    deductAlter,
    deductBasis,
    deductSonstige,
    vorsorge,
  };
}

function computeRv(input: SocialInput, params: ResolvedYearParams): Decimal {
  switch (input.rvMode) {
    case 'keine':
      return d(0);
    case 'freiwillig':
      return commercialCents(input.voluntaryRvMonthly.times(12));
    case 'regelbeitrag':
      return commercialCents(params.regelbeitragMonthly.times(12));
    case 'pflicht': {
      const raw = commercialCents(input.gewinn.times(params.rvRate));
      const minAnnual = commercialCents(params.rvMinMonthly.times(12));
      const maxAnnual = commercialCents(params.rvMaxMonthly.times(12));
      return clamp(raw, minAnnual, maxAnnual);
    }
  }
}

function computeAv(mode: AvMode, params: ResolvedYearParams): Decimal {
  if (mode === 'nein') return d(0);
  const monthly = mode === 'anlaufphase' ? params.avAnlaufMonthly : params.avFullMonthly;
  // Official monthly figures are already commercially rounded; annual is monthly × 12, then cents.
  return commercialCents(monthly.times(12));
}

/**
 * AV monthly contribution after SPEC Section 6.5 (for cross-checks).
 * Uses Bezugsgröße × rate, commercially rounded, then × 12.
 */
export function avCashFromBezugsgröße(params: ResolvedYearParams, anlaufphase: boolean): Decimal {
  const monthlyBase = anlaufphase ? params.bezugsgrößeMonthly.div(2) : params.bezugsgrößeMonthly;
  const avMonthly = commercialCents(monthlyBase.times(params.avRate));
  return commercialCents(avMonthly.times(12));
}
