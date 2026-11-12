/**
 * Input validation (SPEC Section 3 and 11.3).
 * Invalid inputs are rejected with a German message, not silently clamped,
 * except for the legally required clamps on the KV/PV/RV assessment base
 * (those happen in the pipeline after a successful validation).
 */
import {
  DEFAULT_BUNDESLAND,
  DEFAULT_RECHTSKREIS,
  SUPPORTED_YEARS,
  CONSTANTS,
  churchTaxRate,
  getYearParams,
  resolveYearParams,
  isTaxYear,
  type Bundesland,
  type Rechtskreis,
  type ResolvedYearParams,
} from './params.ts';
import { d, type Decimal } from './money.ts';
import type {
  Activity,
  AvMode,
  EuroInput,
  KvType,
  YearInput,
  RvMode,
  ValidationError,
} from './types.ts';

export interface ValidatedInput {
  year: number;
  params: ResolvedYearParams;
  rechtskreis: Rechtskreis;
  gewinn: Decimal;
  overrideEst: Decimal | null;
  overrideSoli: Decimal | null;
  overrideKist: Decimal | null;
  overrideActive: boolean;
  activity: Activity;
  hebesatz: Decimal;
  married: boolean;
  spouseZve: Decimal;
  churchTax: boolean;
  bundesland: Bundesland;
  kistRate: Decimal;
  childrenUnder25: number;
  elterneigenschaft: boolean;
  age23Plus: boolean;
  fullKinderfreibetrag: boolean;
  kvType: KvType;
  zusatzbeitrag: Decimal;
  pkvPremiumMonthly: Decimal;
  pkvBasisMonthly: Decimal;
  privatePvMonthly: Decimal;
  rvMode: RvMode;
  voluntaryRvMonthly: Decimal;
  avMode: AvMode;
  otherSonderausgaben: Decimal;
}

function parseEuro(
  value: EuroInput | undefined,
  field: string,
  errors: ValidationError[],
  opts: { required?: boolean; allowNegative?: boolean; label: string; defaultValue?: Decimal },
): Decimal {
  if (value === undefined || value === '') {
    if (opts.required) {
      errors.push({ field, message: `${opts.label} ist erforderlich.` });
      return d(0);
    }
    return opts.defaultValue ?? d(0);
  }
  try {
    const n = d(value);
    if (!n.isFinite()) {
      errors.push({ field, message: `${opts.label} ist keine gültige Zahl.` });
      return d(0);
    }
    if (!opts.allowNegative && n.isNegative()) {
      errors.push({ field, message: `${opts.label} darf nicht negativ sein.` });
      return d(0);
    }
    return n;
  } catch {
    errors.push({ field, message: `${opts.label} ist keine gültige Zahl.` });
    return d(0);
  }
}

export function validateInput(input: YearInput): { ok: true; value: ValidatedInput } | { ok: false; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  let params: ResolvedYearParams | null = null;
  const rechtskreis: Rechtskreis = input.rechtskreis ?? DEFAULT_RECHTSKREIS;
  if (input.rechtskreis !== undefined && input.rechtskreis !== 'west' && input.rechtskreis !== 'ost') {
    errors.push({ field: 'rechtskreis', message: 'Rechtskreis muss West oder Ost sein.' });
  }
  if (!isTaxYear(input.year)) {
    errors.push({
      field: 'year',
      message: `Kein Parameterblock für das Jahr ${input.year}. Unterstützte Jahre: ${SUPPORTED_YEARS.join(', ')}.`,
    });
  } else {
    params = resolveYearParams(input.year, rechtskreis);
  }

  // Gewinn is required: an explicit empty / missing value is rejected.
  if (input.gewinn === undefined || input.gewinn === '') {
    errors.push({ field: 'gewinn', message: 'Bitte geben Sie Ihren Jahresgewinn ein.' });
  }
  const gewinn = parseEuro(input.gewinn === '' ? undefined : input.gewinn, 'gewinn', errors, {
    required: false, // already reported a friendlier message above
    label: 'Der Jahresgewinn',
  });

  const hebesatz = parseEuro(input.hebesatz, 'hebesatz', errors, {
    label: 'Der Gewerbesteuer-Hebesatz',
    defaultValue: params ? params.defaultHebesatz : d(400),
  });

  const spouseZve = parseEuro(input.spouseZve, 'spouseZve', errors, {
    label: 'Das zvE des Ehepartners',
    allowNegative: false,
  });

  const otherSonderausgaben = parseEuro(input.otherSonderausgaben, 'otherSonderausgaben', errors, {
    label: 'Weitere Sonderausgaben',
  });

  const children = input.childrenUnder25;
  if (!Number.isInteger(children) || children < 0 || children > CONSTANTS.maxChildrenInput) {
    errors.push({
      field: 'childrenUnder25',
      message: `Die Zahl der Kinder muss eine ganze Zahl zwischen 0 und ${CONSTANTS.maxChildrenInput} sein.`,
    });
  }

  const bundesland = input.bundesland ?? DEFAULT_BUNDESLAND;
  const kistRate = input.churchTax ? churchTaxRate(bundesland) : d(0);

  const kvType = input.kvType;
  const defaultZusatz = params ? params.zusatzbeitragDefault.times(100) : d(0);
  // zusatzbeitragPercent is in percent (2.9), stored internally as a fraction (0.029).
  const zusatzPercent = parseEuro(input.zusatzbeitragPercent, 'zusatzbeitragPercent', errors, {
    label: 'Der Zusatzbeitragssatz',
    defaultValue: defaultZusatz,
  });
  const zusatzbeitrag = zusatzPercent.div(100);

  let pkvPremiumMonthly = d(0);
  let pkvBasisMonthly = d(0);
  let privatePvMonthly = d(0);
  if (kvType === 'pkv') {
    if (input.pkvPremiumMonthly === undefined || input.pkvPremiumMonthly === '') {
      errors.push({ field: 'pkvPremiumMonthly', message: 'Der PKV-Beitrag monatlich ist erforderlich.' });
    } else {
      pkvPremiumMonthly = parseEuro(input.pkvPremiumMonthly, 'pkvPremiumMonthly', errors, {
        required: true,
        label: 'Der PKV-Beitrag monatlich',
      });
    }
    if (input.pkvBasisMonthly === undefined || input.pkvBasisMonthly === '') {
      errors.push({ field: 'pkvBasisMonthly', message: 'Der Basis-Anteil der PKV (monatlich) ist erforderlich.' });
    } else {
      pkvBasisMonthly = parseEuro(input.pkvBasisMonthly, 'pkvBasisMonthly', errors, {
        required: true,
        label: 'Der Basis-Anteil der PKV',
      });
    }
    if (input.privatePvMonthly === undefined || input.privatePvMonthly === '') {
      errors.push({
        field: 'privatePvMonthly',
        message: 'Der Beitrag zur privaten Pflegepflichtversicherung (monatlich) ist erforderlich.',
      });
    } else {
      privatePvMonthly = parseEuro(input.privatePvMonthly, 'privatePvMonthly', errors, {
        required: true,
        label: 'Die private Pflegepflichtversicherung',
      });
    }
    if (
      pkvPremiumMonthly.gte(0) &&
      pkvBasisMonthly.gte(0) &&
      pkvBasisMonthly.gt(pkvPremiumMonthly)
    ) {
      errors.push({
        field: 'pkvBasisMonthly',
        message: 'Der Basis-Anteil darf den PKV-Beitrag nicht übersteigen.',
      });
    }
  }

  let voluntaryRvMonthly = d(0);
  if (input.rvMode === 'freiwillig') {
    if (input.voluntaryRvMonthly === undefined || input.voluntaryRvMonthly === '') {
      errors.push({
        field: 'voluntaryRvMonthly',
        message: 'Der freiwillige RV-Beitrag monatlich ist erforderlich.',
      });
    } else {
      voluntaryRvMonthly = parseEuro(input.voluntaryRvMonthly, 'voluntaryRvMonthly', errors, {
        required: true,
        label: 'Der freiwillige RV-Beitrag',
      });
      if (params && voluntaryRvMonthly.gt(0)) {
        if (voluntaryRvMonthly.lt(params.rvMinMonthly) || voluntaryRvMonthly.gt(params.rvMaxMonthly)) {
          errors.push({
            field: 'voluntaryRvMonthly',
            message: `Der freiwillige RV-Beitrag muss zwischen ${params.rvMinMonthly.toFixed(2)} € und ${params.rvMaxMonthly.toFixed(2)} € monatlich liegen.`,
          });
        }
      }
    }
  }


  const overridePresent = [
    input.override_est,
    input.override_soli,
    input.override_kist,
  ].some((v) => v !== undefined && v !== '');
  let overrideEst: Decimal | null = null;
  let overrideSoli: Decimal | null = null;
  let overrideKist: Decimal | null = null;
  if (overridePresent) {
    // Group is set. Entered ESt is used; a blank Soli/KiSt is 0; a missing ESt
    // keeps the calculated value (null here, applied in the pipeline).
    if (input.override_est !== undefined && input.override_est !== '') {
      overrideEst = parseEuro(input.override_est, 'override_est', errors, {
        label: 'Die festzusetzende Einkommensteuer laut Steuerbescheid',
        allowNegative: false,
      });
    }
    if (input.override_soli !== undefined && input.override_soli !== '') {
      overrideSoli = parseEuro(input.override_soli, 'override_soli', errors, {
        label: 'Der Solidaritätszuschlag laut Steuerbescheid',
        allowNegative: false,
      });
    } else {
      overrideSoli = d(0);
    }
    if (input.override_kist !== undefined && input.override_kist !== '') {
      overrideKist = parseEuro(input.override_kist, 'override_kist', errors, {
        label: 'Die Kirchensteuer laut Steuerbescheid',
        allowNegative: false,
      });
    } else {
      overrideKist = d(0);
    }
  }

  if (errors.length > 0 || !params) {
    return { ok: false, errors };
  }

  // TypeScript: params is set when year is valid; errors would be non-empty otherwise.
  return {
    ok: true,
    value: {
      year: input.year,
      params,
      rechtskreis,
      gewinn,
      overrideEst,
      overrideSoli,
      overrideKist,
      overrideActive: overridePresent,
      activity: input.activity,
      hebesatz,
      married: input.married,
      spouseZve,
      churchTax: input.churchTax,
      bundesland,
      kistRate,
      childrenUnder25: children,
      elterneigenschaft: input.elterneigenschaft,
      age23Plus: input.age23Plus,
      fullKinderfreibetrag: input.married ? true : input.fullKinderfreibetrag,
      kvType,
      zusatzbeitrag,
      pkvPremiumMonthly,
      pkvBasisMonthly,
      privatePvMonthly,
      rvMode: input.rvMode,
      voluntaryRvMonthly,
      avMode: input.avMode,
      otherSonderausgaben,
    },
  };
}

/** Friendlier year-error message uses the live supported-year list. */
export { getYearParams, resolveYearParams };
