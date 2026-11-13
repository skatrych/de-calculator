/**
 * Pure Kindesunterhalt calculation. No DOM. decimal.js throughout (SPEC §6).
 */
import { commercialCents, d, toMoney, type Decimal } from '../netto/money.ts';
import {
  altersstufe,
  bkbOf,
  getYearTable,
  groupByNumber,
  groupForIncome,
  type YearTable,
} from './params.ts';
import type {
  ChildResult,
  FieldError,
  KindesunterhaltInput,
  KindesunterhaltOutcome,
  KindesunterhaltResult,
  Rank,
} from './types.ts';
import { validateKindesunterhalt, type ValidatedChild, type ValidatedInput } from './validate.ts';

function clampGroup(n: number): number {
  return Math.max(1, Math.min(15, n));
}

function kgShare(table: YearTable, ageYears: number): Decimal {
  return ageYears >= 18 ? table.kindergeld : table.kindergeld.div(2);
}

function isMinor(c: ValidatedChild): boolean {
  return c.ageYears < 18;
}

function isStudent(c: ValidatedChild): boolean {
  return c.ownHousehold && c.ageYears >= 18;
}

function isAdultAtHome(c: ValidatedChild): boolean {
  return c.ageYears >= 18 && !c.ownHousehold;
}

function rankOf(c: ValidatedChild): Rank {
  if (c.ageYears < 18) return 1;
  if (c.privilegedAdult && c.ageYears >= 18 && c.ageYears <= 20 && !c.ownHousehold) return 1;
  return 4;
}

interface WorkingChild {
  src: ValidatedChild;
  index: number;
  rank: Rank;
  studentBedarf: boolean;
  /** Table group in use; null for student/override Bedarf. */
  groupUsed: number | null;
  bedarf: Decimal;
  kindergeldShare: Decimal;
  restBedarf: Decimal;
  zahlbetrag: Decimal;
  haftungsanteil: Decimal | null;
  haftungsanteilUnknown: boolean;
}

function bedarfFromGroup(table: YearTable, groupNum: number, ageYears: number): Decimal {
  return groupByNumber(table, groupNum).bedarf[altersstufe(ageYears)];
}

function restOf(bedarf: Decimal, childIncome: Decimal, kg: Decimal): Decimal {
  const r = bedarf.minus(childIncome).minus(kg);
  return r.gt(0) ? r : d(0);
}

function assignBedarf(
  table: YearTable,
  c: ValidatedChild,
  index: number,
  G_adj: number,
  adultGroup: number,
): WorkingChild {
  const kg = kgShare(table, c.ageYears);
  const student = isStudent(c);
  let groupUsed: number | null;
  let bedarf: Decimal;
  if (c.bedarfOverride !== null) {
    bedarf = c.bedarfOverride;
    groupUsed = null;
  } else if (student) {
    bedarf = table.studentBedarf;
    groupUsed = null;
  } else if (isAdultAtHome(c)) {
    groupUsed = adultGroup;
    bedarf = bedarfFromGroup(table, adultGroup, c.ageYears);
  } else {
    groupUsed = G_adj;
    bedarf = bedarfFromGroup(table, G_adj, c.ageYears);
  }
  return {
    src: c,
    index,
    rank: rankOf(c),
    studentBedarf: student && c.bedarfOverride === null,
    groupUsed,
    bedarf,
    kindergeldShare: kg,
    restBedarf: restOf(bedarf, c.childIncome, kg),
    zahlbetrag: d(0),
    haftungsanteil: null,
    haftungsanteilUnknown: false,
  };
}

function selbstbehalt(
  table: YearTable,
  notwendig: boolean,
  erwerbstaetig: boolean,
  warmmiete: Decimal | null,
): { sb: Decimal; increase: Decimal } {
  const s = table.selbstbehalt;
  const base = notwendig
    ? erwerbstaetig
      ? s.notwendigErwerbstaetig
      : s.notwendigNichtErwerbstaetig
    : s.angemessen;
  const included = notwendig ? s.notwendigWarmmieteIncluded : s.angemessenWarmmieteIncluded;
  if (warmmiete !== null && warmmiete.gt(included)) {
    const inc = warmmiete.minus(included);
    return { sb: base.plus(inc), increase: inc };
  }
  return { sb: base, increase: d(0) };
}

/**
 * Haftungsanteil sockel (SPEC §6.8).
 * Default 1.750 € each. For a privileged adult, lower both parents to the
 * necessary Selbstbehalt when combined capacity at 1.750 € cannot cover
 * that child's group-1 Restbedarf.
 */
function haftungSockel(
  table: YearTable,
  child: WorkingChild,
  erwerbstaetig: boolean,
  N: Decimal,
  otherN: Decimal,
): Decimal {
  const angemessen = table.selbstbehalt.angemessen;
  const notwendig = erwerbstaetig
    ? table.selbstbehalt.notwendigErwerbstaetig
    : table.selbstbehalt.notwendigNichtErwerbstaetig;
  if (!child.src.privilegedAdult) return angemessen;
  const group1Rest = restOf(
    bedarfFromGroup(table, 1, child.src.ageYears),
    child.src.childIncome,
    child.kindergeldShare,
  );
  const capP = max0(N.minus(angemessen));
  const capO = max0(otherN.minus(angemessen));
  if (capP.plus(capO).lt(group1Rest)) return notwendig;
  return angemessen;
}

function max0(x: Decimal): Decimal {
  return x.gt(0) ? x : d(0);
}

/**
 * Distribute Masse in the ratio of weights. Commercial-cent rounding, then
 * largest-remainder adjustment so the sum equals Masse exactly (SPEC §6.7).
 */
export function distributeProportionally(masse: Decimal, weights: Decimal[]): Decimal[] {
  const sumW = weights.reduce((a, b) => a.plus(b), d(0));
  if (sumW.lte(0) || masse.lte(0)) return weights.map(() => d(0));
  const raw = weights.map((w) => masse.times(w).div(sumW));
  const rounded = raw.map((r) => commercialCents(r));
  const sumR = rounded.reduce((a, b) => a.plus(b), d(0));
  const diffCents = masse.minus(sumR).times(100);
  // Masse and rounded amounts are already at cent precision.
  let n = Math.round(diffCents.toNumber());
  if (n === 0) return rounded;
  const order = raw
    .map((r, i) => ({ i, leftover: r.minus(rounded[i]) }))
    .sort((a, b) => {
      const cmp = n > 0 ? b.leftover.cmp(a.leftover) : a.leftover.cmp(b.leftover);
      return cmp !== 0 ? cmp : a.i - b.i;
    });
  const step = n > 0 ? d('0.01') : d('-0.01');
  const count = Math.abs(n);
  for (let k = 0; k < count; k++) {
    const idx = order[k % order.length].i;
    rounded[idx] = rounded[idx].plus(step);
  }
  return rounded;
}

function soloCap(
  table: YearTable,
  c: ValidatedChild,
  G_base: number,
): Decimal {
  const kg = kgShare(table, c.ageYears);
  let bedarf: Decimal;
  if (c.bedarfOverride !== null) {
    bedarf = c.bedarfOverride;
  } else if (isStudent(c)) {
    bedarf = table.studentBedarf;
  } else {
    bedarf = bedarfFromGroup(table, G_base, c.ageYears);
  }
  return restOf(bedarf, c.childIncome, kg);
}

function applyHaftungsanteil(
  table: YearTable,
  v: ValidatedInput,
  kids: WorkingChild[],
  G_base: number,
): void {
  const N = v.unterhaltsrechtlichesNetto;
  if (v.otherParentNetto === null) {
    for (const k of kids) {
      if (k.src.ageYears >= 18) {
        k.haftungsanteilUnknown = true;
        k.haftungsanteil = null;
        k.zahlbetrag = k.restBedarf;
      } else {
        k.zahlbetrag = k.restBedarf;
      }
    }
    return;
  }
  const otherN = v.otherParentNetto;
  for (const k of kids) {
    if (k.src.ageYears < 18) {
      k.zahlbetrag = k.restBedarf;
      continue;
    }
    const sockel = haftungSockel(table, k, v.erwerbstaetig, N, otherN);
    const capP = max0(N.minus(sockel));
    const capO = max0(otherN.minus(sockel));
    const capSum = capP.plus(capO);
    let share: Decimal;
    if (capSum.lte(0)) {
      share = d(0);
    } else {
      share = commercialCents(k.restBedarf.times(capP).div(capSum));
    }
    const cap = soloCap(table, k.src, G_base);
    if (share.gt(cap)) share = cap;
    k.haftungsanteil = share;
    k.haftungsanteilUnknown = false;
    k.zahlbetrag = share;
  }
}

function applyLeistungsfaehigkeit(
  table: YearTable,
  v: ValidatedInput,
  kids: WorkingChild[],
): { mangelfall: boolean; sbApplied: Decimal; warmInc: Decimal } {
  const N = v.unterhaltsrechtlichesNetto;
  const hasRang1 = kids.some((k) => k.rank === 1);
  const notwendig = hasRang1;
  const { sb: sbNotwendig, increase: incN } = selbstbehalt(table, true, v.erwerbstaetig, v.warmmiete);
  const { sb: sbAngemessen, increase: incA } = selbstbehalt(table, false, v.erwerbstaetig, v.warmmiete);
  const sbApplied = notwendig ? sbNotwendig : sbAngemessen;
  const warmInc = notwendig ? incN : incA;

  const rang1 = kids.filter((k) => k.rank === 1);
  const rang4 = kids.filter((k) => k.rank === 4);

  const need1 = rang1.reduce((a, k) => a.plus(k.zahlbetrag), d(0));
  const masse1 = max0(N.minus(sbNotwendig));

  let mangelfall = false;
  if (rang1.length > 0) {
    if (masse1.lt(need1)) {
      mangelfall = true;
      // Einsatz = group-1 Restbedarf (same KG share and child income).
      const einsatz = rang1.map((k) =>
        restOf(bedarfFromGroup(table, 1, k.src.ageYears), k.src.childIncome, k.kindergeldShare),
      );
      const parts = distributeProportionally(masse1, einsatz);
      rang1.forEach((k, i) => {
        k.zahlbetrag = parts[i];
      });
      for (const k of rang4) k.zahlbetrag = d(0);
    }
    // else: Rang-1 already hold their post-BKB / Haftungsanteil Zahlbetrag.
  }

  if (rang4.length > 0 && !mangelfall && (rang1.length === 0 || masse1.gte(need1))) {
    const already = rang1.reduce((a, k) => a.plus(k.zahlbetrag), d(0));
    const masse4 = max0(N.minus(sbAngemessen).minus(already).minus(v.otherUnterhalt));
    const need4 = rang4.reduce((a, k) => a.plus(k.zahlbetrag), d(0));
    if (masse4.lt(need4)) {
      // Shortfall: distribute in the ratio of Restbedarf after Haftungsanteil
      // (i.e. the already-computed zahlbetrag / share), not Mindestunterhalt.
      const weights = rang4.map((k) => k.zahlbetrag);
      const parts = distributeProportionally(masse4, weights);
      rang4.forEach((k, i) => {
        k.zahlbetrag = parts[i];
      });
      // Adults-only, nothing left to share (Masse ≤ 0): same Mangelfall
      // flag as Rang-1 at or below the necessary Selbstbehalt (N1).
      if (rang1.length === 0 && masse4.lte(0)) mangelfall = true;
    }
    // else: already at their post-Haftungsanteil need.
  }

  if (rang1.length === 0 && rang4.length > 0) {
    const need4 = rang4.reduce((a, k) => a.plus(k.zahlbetrag), d(0));
    const masse4 = max0(N.minus(sbAngemessen).minus(v.otherUnterhalt));
    if (masse4.lt(need4)) {
      const parts = distributeProportionally(
        masse4,
        rang4.map((k) => k.zahlbetrag),
      );
      rang4.forEach((k, i) => {
        k.zahlbetrag = parts[i];
      });
    }
  }

  // If Masse is 0 (N ≤ SB), all Zahlbeträge are already 0 from distribute or stay as needs?
  // When not short, zahlbetrag stays at restBedarf — but if N ≤ SB, masse < need so we enter shortfall.
  return { mangelfall, sbApplied, warmInc };
}

function run(v: ValidatedInput): KindesunterhaltResult {
  const table = getYearTable(v.year);
  const N = v.unterhaltsrechtlichesNetto;
  const { group: baseGroup, incomeAboveTable } = groupForIncome(table, N);
  const G_base = baseGroup.group;
  let G_adj = clampGroup(G_base + (2 - v.anzahlBerechtigter) + v.gruppenverschiebung);
  let adultGroup: number;
  if (v.otherParentNetto !== null) {
    const combined = groupForIncome(table, N.plus(v.otherParentNetto));
    adultGroup = combined.group.group; // G_combined, no count adjustment
  } else {
    adultGroup = G_base;
  }

  let kids = v.children.map((c, i) => assignBedarf(table, c, i, G_adj, adultGroup));

  // §6.6 Bedarfskontrollbetrag. Comparison BKB is G_adj if any minor, else G_base.
  // Decrease every table-based group in use (G_adj and adult group) by 1, together.
  // Student/override Bedarf is not lowered. Stop at group 1.
  let bkbSteps = 0;
  const hasMinor = v.children.some(isMinor);
  while (true) {
    const sumRest = kids.reduce((a, k) => a.plus(k.restBedarf), d(0));
    const remaining = N.minus(sumRest).minus(v.otherUnterhalt);
    // After steps, comparison group for BKB amount follows the (possibly lowered) group used:
    // SPEC: "BKB of the group used for the comparison (G_adj if there is at least one minor, otherwise G_base)".
    // After decreasing, the "group used for comparison" is the current lowered G_adj / G_base-path.
    // G_base itself is the income group and is also decreased when it's a table group in use
    // (adults at home). The BKB lookup after a drop uses the new comparison group number.
    const comparisonGroup = hasMinor
      ? G_adj
      : kids.some((k) => k.groupUsed !== null && isAdultAtHome(k.src))
        ? adultGroup
        : G_base;
    const bkb = bkbOf(groupByNumber(table, comparisonGroup), v.erwerbstaetig);
    if (remaining.gte(bkb)) break;
    const canDropAdj = hasMinor && G_adj > 1;
    const canDropAdult = kids.some((k) => k.groupUsed !== null && isAdultAtHome(k.src) && (k.groupUsed as number) > 1);
    if (!canDropAdj && !canDropAdult) break;
    if (canDropAdj) G_adj -= 1;
    if (canDropAdult) adultGroup -= 1;
    // When only adults are in play, G_base-path (adultGroup) drops; comparison for next loop uses adultGroup.
    bkbSteps += 1;
    kids = v.children.map((c, i) => assignBedarf(table, c, i, G_adj, adultGroup));
  }

  const bkbComparison = hasMinor
    ? G_adj
    : kids.some((k) => k.groupUsed !== null && isAdultAtHome(k.src))
      ? adultGroup
      : G_base;
  const bkb = bkbOf(groupByNumber(table, bkbComparison), v.erwerbstaetig);

  applyHaftungsanteil(table, v, kids, G_base);
  const { mangelfall, sbApplied, warmInc } = applyLeistungsfaehigkeit(table, v, kids);

  const { sb: sbNotwendig } = selbstbehalt(table, true, v.erwerbstaetig, v.warmmiete);
  const { sb: sbAngemessen } = selbstbehalt(table, false, v.erwerbstaetig, v.warmmiete);

  const sumZahlbetrag = kids.reduce((a, k) => a.plus(k.zahlbetrag), d(0));
  const remainingAfter = N.minus(sumZahlbetrag).minus(v.otherUnterhalt);

  const warnings = [...v.warnings];
  if (incomeAboveTable) {
    warnings.push(
      'Das unterhaltsrechtliche Netto liegt über der höchsten Einkommensgruppe der Düsseldorfer Tabelle. Die Beträge der Gruppe 15 sind eine Untergrenze; der konkrete Bedarf ist nicht Gegenstand dieser Berechnung.',
    );
  }
  if (kids.some((k) => k.haftungsanteilUnknown)) {
    warnings.push(
      'Bei volljährigen Kindern sind beide Eltern barunterhaltspflichtig. Der Haftungsanteil setzt das bereinigte Netto des anderen Elternteils voraus.',
    );
  }
  if (mangelfall) {
    warnings.push(
      'Mangelfall: Das Einkommen reicht nach Abzug des Selbstbehalts nicht, um den Bedarf der ranggleichen Kinder vollständig zu decken. Die Beträge sind anteilig gekürzt.',
    );
  }
  if (bkbSteps > 0) {
    warnings.push(
      `Bedarfskontrollbetrag: Die Einkommensgruppe wurde ${bkbSteps === 1 ? 'einmal' : `${bkbSteps} Mal`} herabgesetzt, damit der Selbstbehalt (Bedarfskontrollbetrag) gewahrt bleibt.`,
    );
  }
  const currentYear = new Date().getFullYear();
  if (v.year !== currentYear) {
    warnings.push(
      `Die Berechnung verwendet die Düsseldorfer Tabelle ${v.year}. Das aktuelle Kalenderjahr ist ${currentYear}.`,
    );
  }

  const childResults: ChildResult[] = kids.map((k) => ({
    index: k.index,
    ageYears: k.src.ageYears,
    altersstufe: altersstufe(k.src.ageYears),
    rank: k.rank,
    privilegedAdult: k.src.privilegedAdult,
    ownHousehold: k.src.ownHousehold,
    studentBedarf: k.studentBedarf,
    groupUsed: k.groupUsed,
    bedarf: toMoney(k.bedarf),
    kindergeldShare: toMoney(k.kindergeldShare),
    childIncome: toMoney(k.src.childIncome),
    restBedarf: toMoney(k.restBedarf),
    zahlbetrag: toMoney(k.zahlbetrag),
    haftungsanteil: k.haftungsanteil === null ? null : toMoney(k.haftungsanteil),
    haftungsanteilUnknown: k.haftungsanteilUnknown,
  }));

  return {
    year: v.year,
    unterhaltsrechtlichesNetto: toMoney(N),
    deductions: toMoney(v.deductions),
    groupBase: G_base,
    groupAdjusted: G_adj,
    bkbSteps,
    bkb: toMoney(bkb),
    incomeAboveTable,
    selbstbehaltNotwendig: toMoney(sbNotwendig),
    selbstbehaltAngemessen: toMoney(sbAngemessen),
    selbstbehaltApplied: toMoney(sbApplied),
    warmmieteIncrease: toMoney(warmInc),
    children: childResults,
    sumZahlbetrag: toMoney(sumZahlbetrag),
    remainingAfterUnterhalt: toMoney(remainingAfter.gt(0) ? remainingAfter : d(0)),
    mangelfall,
    otherUnterhalt: toMoney(v.otherUnterhalt),
    warnings,
  };
}

export function calculateKindesunterhalt(input: KindesunterhaltInput): KindesunterhaltOutcome {
  const v = validateKindesunterhalt(input);
  if (!v.ok || !v.value) {
    return { ok: false, errors: v.errors, warnings: v.warnings };
  }
  const result = run(v.value);
  return { ok: true, result, warnings: result.warnings };
}

export function defaultKindesunterhaltInput(
  overrides: Partial<KindesunterhaltInput> & { children: KindesunterhaltInput['children'] },
): KindesunterhaltInput {
  return {
    year: 2026,
    monthlyNetto: '',
    additionalRetirement: 0,
    workExpenses: 0,
    debts: 0,
    otherDeductions: 0,
    erwerbstaetig: true,
    otherUnterhalt: 0,
    gruppenverschiebung: 0,
    ...overrides,
  };
}

export type { FieldError };
