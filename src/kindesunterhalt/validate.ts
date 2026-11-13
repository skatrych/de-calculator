import { d, toMoney, type Decimal } from '../netto/money.ts';
import { isUnterhaltYear, SUPPORTED_UNTERHALT_YEARS } from './params.ts';
import type { ChildInput, FieldError, KindesunterhaltInput } from './types.ts';

export interface ValidatedChild {
  ageYears: number;
  privilegedAdult: boolean;
  ownHousehold: boolean;
  childIncome: Decimal;
  bedarfOverride: Decimal | null;
}

export interface ValidatedInput {
  year: number;
  monthlyNetto: Decimal;
  additionalRetirement: Decimal;
  workExpenses: Decimal;
  debts: Decimal;
  otherDeductions: Decimal;
  deductions: Decimal;
  unterhaltsrechtlichesNetto: Decimal;
  erwerbstaetig: boolean;
  warmmiete: Decimal | null;
  otherUnterhalt: Decimal;
  children: ValidatedChild[];
  anzahlBerechtigter: number;
  gruppenverschiebung: number;
  otherParentNetto: Decimal | null;
  warnings: string[];
}

const MAX_NETTO = d('10000000');

function parseNonNeg(
  raw: unknown,
  field: string,
  errors: FieldError[],
  opts: { required?: boolean; integer?: boolean; label: string },
): Decimal | null {
  if (raw === undefined || raw === null || raw === '') {
    if (opts.required) {
      errors.push({ field, message: `Bitte geben Sie ${opts.label} ein.` });
    }
    return null;
  }
  let value: Decimal;
  try {
    value = d(String(raw).trim().replace(',', '.'));
  } catch {
    errors.push({ field, message: `${opts.label} ist keine gültige Zahl.` });
    return null;
  }
  if (!value.isFinite()) {
    errors.push({ field, message: `${opts.label} ist keine gültige Zahl.` });
    return null;
  }
  if (value.lt(0)) {
    errors.push({ field, message: `${opts.label} darf nicht negativ sein.` });
    return null;
  }
  if (opts.integer && !value.isInteger()) {
    errors.push({ field, message: `${opts.label} muss eine ganze Zahl sein.` });
    return null;
  }
  return value;
}

export function validateKindesunterhalt(input: KindesunterhaltInput): {
  ok: boolean;
  errors: FieldError[];
  value?: ValidatedInput;
  warnings: string[];
} {
  const errors: FieldError[] = [];
  const warnings: string[] = [];

  if (!isUnterhaltYear(input.year)) {
    errors.push({
      field: 'year',
      message: `Kein Tabellenjahr ${input.year}. Unterstützte Jahre: ${SUPPORTED_UNTERHALT_YEARS.join(', ')}.`,
    });
  }

  const monthlyNetto = parseNonNeg(input.monthlyNetto, 'monthlyNetto', errors, {
    required: true,
    label: 'das monatliche Netto',
  });
  if (monthlyNetto && monthlyNetto.gt(MAX_NETTO)) {
    errors.push({
      field: 'monthlyNetto',
      message: 'Das monatliche Netto darf 10.000.000 € nicht übersteigen.',
    });
  }

  const additionalRetirement =
    parseNonNeg(input.additionalRetirement, 'additionalRetirement', errors, {
      label: 'die zusätzliche Altersvorsorge',
    }) ?? d(0);
  const workExpenses =
    parseNonNeg(input.workExpenses, 'workExpenses', errors, { label: 'die berufsbedingten Aufwendungen' }) ?? d(0);
  const debts = parseNonNeg(input.debts, 'debts', errors, { label: 'die Schulden / Tilgung' }) ?? d(0);
  const otherDeductions =
    parseNonNeg(input.otherDeductions, 'otherDeductions', errors, { label: 'die sonstigen Abzüge' }) ?? d(0);

  const deductions = additionalRetirement.plus(workExpenses).plus(debts).plus(otherDeductions);
  if (monthlyNetto && deductions.gt(monthlyNetto)) {
    errors.push({
      field: 'deductions',
      message: 'Die Abzüge dürfen das monatliche Netto nicht übersteigen.',
    });
  }

  const erwerbstaetig = input.erwerbstaetig !== false;

  const warmmieteRaw = input.warmmiete;
  const warmmiete =
    warmmieteRaw === undefined || warmmieteRaw === null || warmmieteRaw === ''
      ? null
      : parseNonNeg(warmmieteRaw, 'warmmiete', errors, { label: 'die Warmmiete' });

  const otherUnterhalt =
    parseNonNeg(input.otherUnterhalt, 'otherUnterhalt', errors, { label: 'der sonstige Unterhalt' }) ?? d(0);

  if (!Array.isArray(input.children) || input.children.length < 1) {
    errors.push({ field: 'children', message: 'Bitte geben Sie mindestens ein Kind an.' });
  } else if (input.children.length > 12) {
    errors.push({ field: 'children', message: 'Höchstens 12 Kinder.' });
  }

  const children: ValidatedChild[] = [];
  (input.children ?? []).forEach((child: ChildInput, i: number) => {
    const age = parseNonNeg(child.ageYears, `children.${i}.ageYears`, errors, {
      required: true,
      integer: true,
      label: `das Alter von Kind ${i + 1}`,
    });
    if (!age) return;
    const ageN = age.toNumber();
    if (ageN < 0 || ageN > 99) {
      errors.push({
        field: `children.${i}.ageYears`,
        message: `Das Alter von Kind ${i + 1} muss zwischen 0 und 99 Jahren liegen.`,
      });
      return;
    }
    if (ageN > 27) {
      warnings.push(
        `Kind ${i + 1} ist über 27 Jahre. Unterhaltspflicht gegenüber volljährigen Kindern endet regelmäßig mit Abschluss der ersten Berufsausbildung; bitte prüfen.`,
      );
    }

    const privilegedAdult = Boolean(child.privilegedAdult);
    const ownHousehold = Boolean(child.ownHousehold);
    if (privilegedAdult && (ageN < 18 || ageN > 20)) {
      errors.push({
        field: `children.${i}.privilegedAdult`,
        message: `Die Angabe zur privilegierten Volljährigkeit gilt nur für 18- bis 20-jährige Kinder (Kind ${i + 1}).`,
      });
    }
    if (ownHousehold && ageN < 18) {
      errors.push({
        field: `children.${i}.ownHousehold`,
        message: `Eigener Haushalt gilt nur für volljährige Kinder (Kind ${i + 1}).`,
      });
    }
    if (privilegedAdult && ownHousehold) {
      errors.push({
        field: `children.${i}.ownHousehold`,
        message: `Privilegierte Volljährigkeit und eigener Haushalt schließen einander aus (Kind ${i + 1}).`,
      });
    }

    const childIncome =
      parseNonNeg(child.childIncome, `children.${i}.childIncome`, errors, {
        label: `das eigene Einkommen von Kind ${i + 1}`,
      }) ?? d(0);

    let bedarfOverride: Decimal | null = null;
    if (child.bedarfOverride !== undefined && child.bedarfOverride !== null && child.bedarfOverride !== '') {
      bedarfOverride = parseNonNeg(child.bedarfOverride, `children.${i}.bedarfOverride`, errors, {
        label: `der Bedarf von Kind ${i + 1}`,
      });
    }

    children.push({
      ageYears: ageN,
      privilegedAdult,
      ownHousehold,
      childIncome,
      bedarfOverride,
    });
  });

  let anzahlBerechtigter: number;
  if (input.anzahlBerechtigter === undefined || input.anzahlBerechtigter === null || input.anzahlBerechtigter === ('' as unknown as number)) {
    anzahlBerechtigter = (input.children ?? []).length;
  } else {
    const n = parseNonNeg(input.anzahlBerechtigter, 'anzahlBerechtigter', errors, {
      required: true,
      integer: true,
      label: 'die Anzahl der Unterhaltsberechtigten',
    });
    anzahlBerechtigter = n ? n.toNumber() : (input.children ?? []).length;
    if (n && (n.lt(1) || n.gt(20))) {
      errors.push({
        field: 'anzahlBerechtigter',
        message: 'Die Anzahl der Unterhaltsberechtigten muss eine ganze Zahl zwischen 1 und 20 sein.',
      });
    }
  }

  let gruppenverschiebung = 0;
  if (input.gruppenverschiebung !== undefined && input.gruppenverschiebung !== null && input.gruppenverschiebung !== ('' as unknown as number)) {
    let v: Decimal;
    try {
      v = d(String(input.gruppenverschiebung).trim());
    } catch {
      errors.push({ field: 'gruppenverschiebung', message: 'Die Gruppenverschiebung ist keine gültige Zahl.' });
      v = d(0);
    }
    if (v && (!v.isInteger() || v.abs().gt(14))) {
      errors.push({
        field: 'gruppenverschiebung',
        message: 'Die Gruppenverschiebung muss eine ganze Zahl zwischen −14 und 14 sein.',
      });
    } else {
      gruppenverschiebung = v.toNumber();
    }
  }

  const otherParentRaw = input.otherParentNetto;
  const otherParentNetto =
    otherParentRaw === undefined || otherParentRaw === null || otherParentRaw === ''
      ? null
      : parseNonNeg(otherParentRaw, 'otherParentNetto', errors, { label: 'das Netto des anderen Elternteils' });

  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }

  const N = monthlyNetto!.minus(deductions);
  // Floor at 0 is defensive — deductions > Netto is already an error.
  const unterhaltsrechtlichesNetto = N.lt(0) ? d(0) : N;

  return {
    ok: true,
    errors: [],
    warnings,
    value: {
      year: input.year,
      monthlyNetto: monthlyNetto!,
      additionalRetirement,
      workExpenses,
      debts,
      otherDeductions,
      deductions,
      unterhaltsrechtlichesNetto,
      erwerbstaetig,
      warmmiete,
      otherUnterhalt,
      children,
      anzahlBerechtigter,
      gruppenverschiebung,
      otherParentNetto,
      warnings,
    },
  };
}

/** Exposed so tests can assert formatted euro helpers stay consistent. */
export { toMoney };
