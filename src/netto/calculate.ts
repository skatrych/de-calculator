/**
 * Calculation pipeline (SPEC Section 6). This is the only place the
 * pipeline lives. Deterministic, no I/O, no DOM.
 *
 * Order: year params → social contributions → deductible Vorsorge →
 * GewSt → KiSt/ESt iteration (KiSt on the same fictitious ESt as Soli, § 51a Abs. 2) → Soli → Netto.
 * Gewerbesteuer is not deducted from Gewinn (§ 4 Abs. 5b EStG).
 */
import { commercialCents, commercialPercent, d, floorEuro, toMoney, toPercent, type Decimal } from './money.ts';
import { CONSTANTS, SUPPORTED_YEARS, getYearParams, isTaxYear, type TaxYear } from './params.ts';
import { tariff, tariffSplitting, soliOn, statutoryMarginalRateLabel } from './income-tax.ts';
import { computeSocial } from './social.ts';
import { computeGewerbesteuer, section35Credit } from './gewerbesteuer.ts';
import { validateInput, type ValidatedInput } from './validate.ts';
import type { AverageOutcome, CalculationOutcome, MultiYearResult, YearInput, YearResult, TaxZone } from './types.ts';

export type { YearInput, YearResult, MultiYearResult, CalculationOutcome, AverageOutcome, NettoInput, NettoResult } from './types.ts';

const KIST_MAX_ITERATIONS = 30;
const MARGINAL_STEP = 100;

interface CoreResult {
  result: YearResult;
  totalBurden: Decimal;
}

/**
 * Public entry: validate, run the pipeline, and attach effective / marginal rates.
 * The entire pipeline is re-run at Gewinn+100 for the marginal burden.
 */
export function calculateNetto(input: YearInput): CalculationOutcome {
  const validated = validateInput(input);
  if (!validated.ok) {
    return { ok: false, errors: validated.errors };
  }
  const core = runPipeline(validated.value, { skipMarginal: false, originalInput: input });
  return { ok: true, result: core.result };
}

function runPipeline(
  v: ValidatedInput,
  opts: { skipMarginal: boolean; originalInput: YearInput },
): CoreResult {
  const { params, gewinn } = v;

  const social = computeSocial(
    {
      gewinn,
      kvType: v.kvType,
      zusatzbeitrag: v.zusatzbeitrag,
      childrenUnder25: v.childrenUnder25,
      elterneigenschaft: v.elterneigenschaft,
      age23Plus: v.age23Plus,
      pkvPremiumMonthly: v.pkvPremiumMonthly,
      pkvBasisMonthly: v.pkvBasisMonthly,
      privatePvMonthly: v.privatePvMonthly,
      rvMode: v.rvMode,
      voluntaryRvMonthly: v.voluntaryRvMonthly,
      avMode: v.avMode,
      married: v.married,
    },
    params,
  );

  const gewerbe =
    v.activity === 'gewerbe'
      ? computeGewerbesteuer(gewinn, v.hebesatz, params)
      : { gewerbeertrag: d(0), taxable: d(0), messbetrag: d(0), gewst: d(0) };

  const pausch = v.married ? params.pauschbetragJoint : params.pauschbetragSingle;

  // --- Kirchensteuer / ESt iteration (SPEC Sections 6.7 and 6.9) ---
  // festzusetzende ESt is computed without Kinderfreibeträge. KiSt and Soli
  // share the same fictitious ESt that deducts them (§ 51a Abs. 2 EStG,
  // SolzG § 3 Abs. 2). The Sonderausgaben deduction still uses the cash KiSt.
  const childrenKfb = v.childrenUnder25;
  const kfbPer =
    v.married || v.fullKinderfreibetrag ? params.kfbBothParents : params.kfbOneParent;
  const kfb = childrenKfb > 0 ? kfbPer.times(childrenKfb) : d(0);

  const assess = (zveUserRaw: Decimal) => {
    let zveUser = zveUserRaw;
    if (zveUser.isNegative()) zveUser = d(0);
    const zveJointInner = zveUser.plus(floorEuro(v.spouseZve));
    let estInner: Decimal;
    let zoneInner: TaxZone;
    let zveForTariffInner: Decimal;
    if (v.married) {
      const split = tariffSplitting(zveJointInner, params);
      estInner = split.est;
      zoneInner = split.zone;
      zveForTariffInner = split.half;
    } else {
      const t = tariff(zveUser, params);
      estInner = t.est;
      zoneInner = t.zone;
      zveForTariffInner = zveUser;
    }
    const creditInner =
      v.activity === 'gewerbe'
        ? section35Credit(
            estInner,
            gewerbe.messbetrag,
            gewerbe.gewst,
            gewinn,
            v.spouseZve,
            v.married,
            params,
          )
        : d(0);
    let festInner = estInner.minus(creditInner);
    if (festInner.isNegative()) festInner = d(0);
    return {
      zve: zveUser,
      zveJoint: zveJointInner,
      est: estInner,
      credit: creditInner,
      fest: festInner,
      taxZone: zoneInner,
      zveForTariff: zveForTariffInner,
    };
  };

  let kist = d(0);
  let fest = d(0);
  let est = d(0);
  let zve = d(0);
  let zveJoint = d(0);
  let credit = d(0);
  let taxZone: TaxZone = 1;
  let zveForTariff = d(0);
  let sa = pausch;
  let festSoli = d(0);

  for (let i = 0; i < KIST_MAX_ITERATIONS; i++) {
    sa = maxDec(pausch, v.otherSonderausgaben.plus(kist));
    const real = assess(floorEuro(gewinn.minus(social.vorsorge).minus(sa)));
    zve = real.zve;
    zveJoint = real.zveJoint;
    est = real.est;
    credit = real.credit;
    fest = real.fest;
    taxZone = real.taxZone;
    zveForTariff = real.zveForTariff;

    if (kfb.gt(0)) {
      festSoli = assess(floorEuro(gewinn.minus(social.vorsorge).minus(sa).minus(kfb))).fest;
    } else {
      festSoli = fest;
    }

    const kistNew = v.churchTax ? commercialCents(v.kistRate.times(festSoli)) : d(0);
    if (kistNew.eq(kist)) {
      kist = kistNew;
      break;
    }
    kist = kistNew;
  }

  const soli = soliOn(festSoli, params, v.married);

  // --- Allocation for Netto when married (SPEC Section 6.7) ---
  const share =
    v.married && zveJoint.gt(0) ? zve.div(zveJoint) : d(1);
  const estUserCalculated = v.married ? commercialCents(fest.times(share)) : fest;
  const soliUserCalculated = v.married ? commercialCents(soli.times(share)) : soli;
  const kistUserCalculated = v.married ? commercialCents(kist.times(share)) : kist;

  // Steuerbescheid override (SPEC 6.12): replaces cash ESt/Soli/KiSt for Netto.
  // Social contributions, GewSt and the § 35 *calculation* still run (zvE,
  // deductible Vorsorge, "berechnet" figures). KiSt iteration still runs so
  // zvE is computed; the cash KiSt is the override when the group is set.
  let estUser = estUserCalculated;
  let soliUser = soliUserCalculated;
  let kistUser = kistUserCalculated;
  if (v.overrideActive) {
    if (v.overrideEst !== null) estUser = v.overrideEst;
    if (v.overrideSoli !== null) soliUser = v.overrideSoli;
    if (v.overrideKist !== null) kistUser = v.overrideKist;
  }

  const taxes = estUser.plus(soliUser).plus(kistUser).plus(gewerbe.gewst);
  const socialTotal = social.kvCash.plus(social.pvCash).plus(social.rvCash).plus(social.avCash);
  const totalBurden = taxes.plus(socialTotal);
  const netto = gewinn.minus(totalBurden);
  const nettoMonthly = commercialCents(netto.div(12));

  let effectiveBurdenPercent = gewinn.gt(0)
    ? toPercent(commercialPercent(totalBurden.div(gewinn).times(100)))
    : null;

  let marginalBurdenPercent: YearResult['marginalBurdenPercent'] = null;
  if (!opts.skipMarginal) {
    const plusInput: YearInput = {
      ...opts.originalInput,
      gewinn: gewinn.plus(MARGINAL_STEP).toString(),
    };
    const plusValidated = validateInput(plusInput);
    if (plusValidated.ok) {
      const plus = runPipeline(plusValidated.value, { skipMarginal: true, originalInput: plusInput });
      const delta = plus.totalBurden.minus(totalBurden);
      marginalBurdenPercent = toPercent(commercialPercent(delta.div(MARGINAL_STEP).times(100)));
    }
  }

  const kistRatePercent = toPercent(v.kistRate.times(100));
  const year = v.year as TaxYear;

  const result: YearResult = {
    year,
    kvPvBemessung: social.kvPvBemessung === null ? null : toMoney(social.kvPvBemessung),
    kvPvBemessungNote: social.kvPvBemessungNote,
    kvCash: toMoney(social.kvCash),
    kvDeductible: toMoney(social.kvDeductible),
    kvRate: social.kvRate === null ? null : toPercent(social.kvRate.times(100)),
    pvCash: toMoney(social.pvCash),
    pvDeductible: toMoney(social.pvDeductible),
    pvRate: toPercent(social.pvRate.times(100)),
    rvCash: toMoney(social.rvCash),
    avCash: toMoney(social.avCash),
    deductAlter: toMoney(social.deductAlter),
    deductBasis: toMoney(social.deductBasis),
    deductSonstige: toMoney(social.deductSonstige),
    vorsorge: toMoney(social.vorsorge),
    sonderausgaben: toMoney(sa),
    pauschbetrag: toMoney(pausch),
    zve: toMoney(zve),
    zveJoint: toMoney(zveJoint),
    taxZone,
    zveForTariff: toMoney(zveForTariff),
    tariflicheEst: toMoney(est),
    tariflicheEstJoint: toMoney(est),
    gewerbesteuerCredit: toMoney(credit),
    festzusetzendeEst: toMoney(fest),
    festzusetzendeEstUser: toMoney(estUser),
    soli: toMoney(soli),
    soliUser: toMoney(soliUser),
    festSoli: toMoney(festSoli),
    kist: toMoney(kist),
    kistUser: toMoney(kistUser),
    kistRate: kistRatePercent,
    gewerbesteuer: toMoney(gewerbe.gewst),
    messbetrag: toMoney(gewerbe.messbetrag),
    gewerbeertrag: toMoney(gewerbe.gewerbeertrag),
    married: v.married,
    taxShare: share.toString(),
    taxes: toMoney(taxes),
    social: toMoney(socialTotal),
    totalBurden: toMoney(totalBurden),
    nettoAnnual: toMoney(netto),
    nettoMonthly: toMoney(nettoMonthly),
    effectiveBurdenPercent,
    marginalBurdenPercent,
    statutoryMarginalRateLabel: statutoryMarginalRateLabel(taxZone),
    gewinn: toMoney(gewinn),
    overrideUsed: v.overrideActive,
    festzusetzendeEstUserCalculated: toMoney(estUserCalculated),
    soliUserCalculated: toMoney(soliUserCalculated),
    kistUserCalculated: toMoney(kistUserCalculated),
  };

  return { result, totalBurden };
}

function maxDec(a: Decimal, b: Decimal): Decimal {
  return a.gte(b) ? a : b;
}

/** Defaults used by golden tests and as a starting point for the UI (SPEC Section 11). */
export function defaultInput(overrides: Partial<YearInput> & { gewinn: EuroInputOrEmpty }): YearInput {
  return {
    year: 2026,
    rechtskreis: 'west',
    activity: 'freiberufler',
    married: false,
    spouseZve: 0,
    churchTax: false,
    childrenUnder25: 0,
    elterneigenschaft: false,
    age23Plus: true,
    fullKinderfreibetrag: false,
    kvType: 'gkv_ermaessigt',
    rvMode: 'keine',
    avMode: 'nein',
    otherSonderausgaben: 0,
    hebesatz: 400,
    ...overrides,
  };
}

type EuroInputOrEmpty = YearInput['gewinn'];


function averageMoney(values: YearResult[], pick: (r: YearResult) => { euros: string }): ReturnType<typeof toMoney> {
  const sum = values.reduce((s, r) => s.plus(d(pick(r).euros)), d(0));
  return toMoney(commercialCents(sum.div(values.length)));
}

/**
 * Arithmetic mean of three consecutive supported years (SPEC Section 6.11).
 * Each year is computed in full with that year's own parameter block.
 * There is no blended tariff.
 */
export function calculateNettoAverage(years: YearInput[]): AverageOutcome {
  const errors: { field: string; message: string }[] = [];
  if (years.length !== CONSTANTS.averageYearCount) {
    errors.push({
      field: 'years',
      message: `Der Dreijahresdurchschnitt erfordert genau ${CONSTANTS.averageYearCount} aufeinander folgende Jahre (${SUPPORTED_YEARS[0]}–${SUPPORTED_YEARS[SUPPORTED_YEARS.length - 1]}).`,
    });
    return { ok: false, errors };
  }

  const yearNumbers = years.map((y) => y.year);
  const sortedUnique = [...new Set(yearNumbers)].sort((a, b) => a - b);
  const consecutive =
    sortedUnique.length === CONSTANTS.averageYearCount &&
    sortedUnique[1] === sortedUnique[0] + 1 &&
    sortedUnique[2] === sortedUnique[0] + 2 &&
    sortedUnique.every((y) => isTaxYear(y));
  if (!consecutive) {
    errors.push({
      field: 'years',
      message: `Der Dreijahresdurchschnitt erfordert drei aufeinander folgende unterstützte Jahre (${SUPPORTED_YEARS.join(', ')}). Erhalten: ${yearNumbers.join(', ')}.`,
    });
    return { ok: false, errors };
  }

  const perYear: YearResult[] = [];
  // Compute in chronological order so the result is stable.
  const ordered = years
    .map((input, index) => ({ input, index }))
    .sort((a, b) => a.input.year - b.input.year);
  for (const { input } of ordered) {
    const outcome = calculateNetto(input);
    if (!outcome.ok) {
      return {
        ok: false,
        errors: outcome.errors.map((e) => ({
          ...e,
          message: `${input.year}: ${e.message}`,
        })),
      };
    }
    perYear.push(outcome.result);
  }

  const avg_netto = averageMoney(perYear, (r) => r.nettoAnnual);
  const avg_burden = averageMoney(perYear, (r) => r.totalBurden);
  const avg_gewinn = averageMoney(perYear, (r) => r.gewinn);
  const avg_monthly = toMoney(commercialCents(d(avg_netto.euros).div(12)));
  const avg_effective =
    d(avg_gewinn.euros).gt(0)
      ? toPercent(commercialPercent(d(avg_burden.euros).div(d(avg_gewinn.euros)).times(100)))
      : null;

  // Grenzbelastung is not averaged (SPEC 6.11). Each YearResult already carries
  // its own marginalBurdenPercent from the single-year pipeline.

  const result: MultiYearResult = {
    years: perYear.map((r) => r.year),
    perYear,
    avg_netto,
    avg_monthly,
    avg_gewinn,
    avg_est: averageMoney(perYear, (r) => r.festzusetzendeEstUser),
    avg_soli: averageMoney(perYear, (r) => r.soliUser),
    avg_kist: averageMoney(perYear, (r) => r.kistUser),
    avg_gewst: averageMoney(perYear, (r) => r.gewerbesteuer),
    avg_kv: averageMoney(perYear, (r) => r.kvCash),
    avg_pv: averageMoney(perYear, (r) => r.pvCash),
    avg_rv: averageMoney(perYear, (r) => r.rvCash),
    avg_av: averageMoney(perYear, (r) => r.avCash),
    avg_burden,
    avg_effective,
  };
  return { ok: true, result };
}


export { getYearParams, isTaxYear };
