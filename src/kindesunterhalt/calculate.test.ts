import { describe, expect, it } from 'vitest';
import { Decimal, d, toMoney } from '../netto/money.ts';
import {
  calculateKindesunterhalt,
  defaultKindesunterhaltInput,
} from './calculate.ts';
import {
  ALTERSSTUFEN,
  DEFAULT_UNTERHALT_YEAR,
  YEAR_TABLES,
  altersstufe,
  bkbOf,
  getYearTable,
  groupForIncome,
} from './params.ts';
import { validateKindesunterhalt } from './validate.ts';
import type { ChildInput, KindesunterhaltInput, KindesunterhaltResult } from './types.ts';

function calc(
  overrides: Partial<KindesunterhaltInput> & { monthlyNetto: KindesunterhaltInput['monthlyNetto']; children: ChildInput[] },
): KindesunterhaltResult {
  const outcome = calculateKindesunterhalt(defaultKindesunterhaltInput(overrides));
  if (!outcome.ok) {
    throw new Error(`unexpected validation failure: ${outcome.errors.map((e) => e.message).join('; ')}`);
  }
  return outcome.result;
}

function expectEuro(actual: { euros: string }, expected: string, label: string) {
  expect(actual.euros, label).toBe(expected);
}

function child(ageYears: number, extra: Partial<ChildInput> = {}): ChildInput {
  return { ageYears, ...extra };
}

describe('data-module consistency (SPEC §9, §12)', () => {
  const table = getYearTable(2026);

  it('exposes year-keyed TABLES with 2026 as default', () => {
    expect(DEFAULT_UNTERHALT_YEAR).toBe(2026);
    expect(YEAR_TABLES[2026]).toBe(table);
    expect(table.year).toBe(2026);
    expect(table.groups).toHaveLength(15);
    expect(table.kindergeld.toString()).toBe('259');
    expect(table.studentBedarf.toString()).toBe('990');
  });

  it('every Zahlbetrag equals Bedarf minus the official Kindergeld share', () => {
    for (const g of table.groups) {
      for (const stufe of ALTERSSTUFEN) {
        const kg = stufe === '18+' ? table.kindergeld : table.kindergeld.div(2);
        const expected = g.bedarf[stufe].minus(kg);
        expect(g.zahlbetrag[stufe].equals(expected), `group ${g.group} ${stufe}`).toBe(true);
      }
    }
  });

  it('every Bedarf equals ceil(group-1 Bedarf × percent / 100), and group-1 18+ is ceil(558 × 1.25)', () => {
    const g1 = table.groups[0];
    const ceil = (x: ReturnType<typeof d>) => x.toDecimalPlaces(0, Decimal.ROUND_CEIL);
    expect(g1.bedarf['18+'].equals(ceil(d('558').times('1.25')))).toBe(true);
    for (const g of table.groups) {
      for (const stufe of ALTERSSTUFEN) {
        const expected = ceil(g1.bedarf[stufe].times(g.percent).div(100));
        expect(g.bedarf[stufe].equals(expected), `group ${g.group} ${stufe}: ${g.bedarf[stufe]} vs ${expected}`).toBe(
          true,
        );
      }
    }
  });

  it('income brackets tile 0–11.200 € without gaps or overlaps', () => {
    expect(table.groups[0].min.toString()).toBe('0');
    expect(table.groups[14].max.toString()).toBe('11200');
    for (let i = 0; i < table.groups.length - 1; i++) {
      expect(table.groups[i].max.plus(1).equals(table.groups[i + 1].min), `gap after group ${i + 1}`).toBe(true);
    }
  });

  it('income-bracket boundaries: 2100 → 1, 2101 → 2, 11200 → 15, 11201 → 15 + warning', () => {
    expect(groupForIncome(table, d('2100')).group.group).toBe(1);
    expect(groupForIncome(table, d('2101')).group.group).toBe(2);
    expect(groupForIncome(table, d('11200'))).toEqual({ group: table.groups[14], incomeAboveTable: false });
    expect(groupForIncome(table, d('11201'))).toEqual({ group: table.groups[14], incomeAboveTable: true });
    expect(groupForIncome(table, d('0')).group.group).toBe(1);
    expect(groupForIncome(table, d('-10')).group.group).toBe(1);
  });

  it('group-1 BKB is the necessary Selbstbehalt (1450 erwerbstätig / 1200 otherwise)', () => {
    const g1 = table.groups[0];
    expect(bkbOf(g1, true).toString()).toBe('1450');
    expect(bkbOf(g1, false).toString()).toBe('1200');
  });
});

describe('age and Altersstufe boundaries (SPEC §12)', () => {
  it('maps completed years to the official Altersstufen', () => {
    expect(altersstufe(0)).toBe('0-5');
    expect(altersstufe(5)).toBe('0-5');
    expect(altersstufe(6)).toBe('6-11');
    expect(altersstufe(11)).toBe('6-11');
    expect(altersstufe(12)).toBe('12-17');
    expect(altersstufe(17)).toBe('12-17');
    expect(altersstufe(18)).toBe('18+');
    expect(altersstufe(21)).toBe('18+');
  });
});

describe('golden cases G1–G15 (SPEC §7, normative)', () => {
  it('G1: N=4000, two minors aged 4 and 8 → 493.50 + 585.50 = 1079.00, group 6', () => {
    const r = calc({ monthlyNetto: 4000, children: [child(4), child(8)] });
    expect(r.groupBase).toBe(6);
    expect(r.groupAdjusted).toBe(6);
    expect(r.bkbSteps).toBe(0);
    expectEuro(r.children[0].zahlbetrag, '493.50', 'child 4');
    expectEuro(r.children[1].zahlbetrag, '585.50', 'child 8');
    expectEuro(r.sumZahlbetrag, '1079.00', 'sum');
    expect(r.mangelfall).toBe(false);
    expect(r.incomeAboveTable).toBe(false);
  });

  it('G2: N=4000, one child aged 10 → Höherstufung to group 7, 629.50', () => {
    const r = calc({ monthlyNetto: 4000, children: [child(10)] });
    expect(r.groupBase).toBe(6);
    expect(r.groupAdjusted).toBe(7);
    expectEuro(r.children[0].zahlbetrag, '629.50', 'child 10');
    expectEuro(r.sumZahlbetrag, '629.50', 'sum');
  });

  it('G3: N=4000, three minors aged 3, 9, 15 → Herabstufung to group 5, 1649.50', () => {
    const r = calc({ monthlyNetto: 4000, children: [child(3), child(9), child(15)] });
    expect(r.groupBase).toBe(6);
    expect(r.groupAdjusted).toBe(5);
    expectEuro(r.children[0].zahlbetrag, '454.50', 'age 3');
    expectEuro(r.children[1].zahlbetrag, '540.50', 'age 9');
    expectEuro(r.children[2].zahlbetrag, '654.50', 'age 15');
    expectEuro(r.sumZahlbetrag, '1649.50', 'sum');
  });

  it('G4: N=3301, two minors 16 and 17 → BKB drops group 5 to 4, each 621.50', () => {
    const r = calc({ monthlyNetto: 3301, children: [child(16), child(17)] });
    expect(r.groupBase).toBe(5);
    // After BKB: group 4
    expect(r.groupAdjusted).toBe(4);
    expect(r.bkbSteps).toBe(1);
    expectEuro(r.children[0].zahlbetrag, '621.50', 'age 16');
    expectEuro(r.children[1].zahlbetrag, '621.50', 'age 17');
    expectEuro(r.sumZahlbetrag, '1243.00', 'sum');
  });

  it('G5: official Mangelfall, N=1750, privileged 18 + ages 7 and 5, Masse 300', () => {
    const r = calc({
      monthlyNetto: 1750,
      children: [child(18, { privilegedAdult: true }), child(7), child(5)],
    });
    expect(r.mangelfall).toBe(true);
    expectEuro(r.children[0].zahlbetrag, '107.60', 'privileged 18');
    expectEuro(r.children[1].zahlbetrag, '105.02', 'age 7');
    expectEuro(r.children[2].zahlbetrag, '87.38', 'age 5');
    expectEuro(r.sumZahlbetrag, '300.00', 'sum equals Masse');
    expect(r.children[0].rank).toBe(1);
    expect(r.children[1].rank).toBe(1);
    expect(r.children[2].rank).toBe(1);
  });

  it('G6: N=4000, age 22 at home → no +1, Restbedarf 635, haftungsanteilUnknown', () => {
    const r = calc({ monthlyNetto: 4000, children: [child(22)] });
    expect(r.groupBase).toBe(6);
    expect(r.groupAdjusted).toBe(7); // +1 from anzahlBerechtigter=1, but adult uses G_base
    expect(r.children[0].groupUsed).toBe(6);
    expect(r.children[0].rank).toBe(4);
    expectEuro(r.children[0].bedarf, '894.00', 'bedarf group 6');
    expectEuro(r.children[0].restBedarf, '635.00', 'rest');
    expectEuro(r.children[0].zahlbetrag, '635.00', 'zahlbetrag');
    expect(r.children[0].haftungsanteilUnknown).toBe(true);
    expect(r.warnings.some((w) => w.includes('Haftungsanteil'))).toBe(true);
  });

  it('G7: N=5000, student aged 20, own household → 731, student flag, haftungsanteilUnknown', () => {
    const r = calc({ monthlyNetto: 5000, children: [child(20, { ownHousehold: true })] });
    expectEuro(r.children[0].bedarf, '990.00', 'student bedarf');
    expectEuro(r.children[0].zahlbetrag, '731.00', '731 = 990 − 259');
    expect(r.children[0].studentBedarf).toBe(true);
    expect(r.children[0].groupUsed).toBeNull();
    expect(r.children[0].haftungsanteilUnknown).toBe(true);
    expect(r.children[0].rank).toBe(4);
    expect(r.warnings.some((w) => w.includes('Haftungsanteil'))).toBe(true);
  });

  it('G8: N=3300, privileged 19 + minor 10 → 544 + 512.50 = 1056.50 (no BKB drop)', () => {
    const r = calc({
      monthlyNetto: 3300,
      children: [child(19, { privilegedAdult: true }), child(10)],
    });
    expect(r.groupBase).toBe(4);
    expect(r.groupAdjusted).toBe(4);
    expect(r.bkbSteps).toBe(0);
    expectEuro(r.children[0].zahlbetrag, '544.00', 'privileged');
    expectEuro(r.children[1].zahlbetrag, '512.50', 'minor');
    expectEuro(r.sumZahlbetrag, '1056.50', 'sum');
    expect(r.children[0].rank).toBe(1);
    expect(r.children[1].rank).toBe(1);
    // Adult at home uses G_base (same as 4 here); no Höherstufung for the adult.
    expect(r.children[0].groupUsed).toBe(4);
    expect(r.children[1].groupUsed).toBe(4);
  });

  it('G9: N=15000, ages 6 and 12 → group 15 floor + warning, 2163.00', () => {
    const r = calc({ monthlyNetto: 15000, children: [child(6), child(12)] });
    expect(r.groupBase).toBe(15);
    expect(r.groupAdjusted).toBe(15);
    expect(r.incomeAboveTable).toBe(true);
    expectEuro(r.children[0].zahlbetrag, '986.50', 'age 6');
    expectEuro(r.children[1].zahlbetrag, '1176.50', 'age 12');
    expectEuro(r.sumZahlbetrag, '2163.00', 'sum');
    expect(r.warnings.some((w) => w.includes('Gruppe 15') || w.includes('höchsten Einkommensgruppe'))).toBe(true);
  });

  it('G10: N=2100, two children aged 2, Mangelfall Masse 650, each 325.00', () => {
    const r = calc({ monthlyNetto: 2100, children: [child(2), child(2)] });
    expect(r.mangelfall).toBe(true);
    expectEuro(r.children[0].zahlbetrag, '325.00', 'first');
    expectEuro(r.children[1].zahlbetrag, '325.00', 'second');
    expectEuro(r.sumZahlbetrag, '650.00', 'sum');
  });

  it('G11: 4800 − 200 − 100 = 4500, ages 8 and 14, group 7, 1389.00', () => {
    const r = calc({
      monthlyNetto: 4800,
      additionalRetirement: 200,
      debts: 100,
      children: [child(8), child(14)],
    });
    expectEuro(r.unterhaltsrechtlichesNetto, '4500.00', 'N');
    expect(r.groupBase).toBe(7);
    expect(r.groupAdjusted).toBe(7);
    expectEuro(r.children[0].zahlbetrag, '629.50', 'age 8');
    expectEuro(r.children[1].zahlbetrag, '759.50', 'age 14');
    expectEuro(r.sumZahlbetrag, '1389.00', 'sum');
  });

  it('G12: N=6000, four Berechtigte, minors use G_adj 9, privileged 19 uses G_base 11 (914 not 802)', () => {
    const r = calc({
      monthlyNetto: 6000,
      children: [child(4), child(7), child(13), child(19, { privilegedAdult: true })],
    });
    expect(r.groupBase).toBe(11);
    expect(r.groupAdjusted).toBe(9);
    expect(r.children[0].groupUsed).toBe(9);
    expect(r.children[1].groupUsed).toBe(9);
    expect(r.children[2].groupUsed).toBe(9);
    expect(r.children[3].groupUsed).toBe(11);
    expectEuro(r.children[0].zahlbetrag, '609.50', 'age 4');
    expectEuro(r.children[1].zahlbetrag, '719.50', 'age 7');
    expectEuro(r.children[2].zahlbetrag, '863.50', 'age 13');
    expectEuro(r.children[3].zahlbetrag, '914.00', 'privileged at G_base 11, not 802');
    expectEuro(r.sumZahlbetrag, '3106.50', 'sum');
  });

  it('G13: student, N=5000, otherParentNetto=3000 → Haftungsanteil 527.94', () => {
    const r = calc({
      monthlyNetto: 5000,
      otherParentNetto: 3000,
      children: [child(21, { ownHousehold: true })],
    });
    expectEuro(r.children[0].bedarf, '990.00', 'bedarf');
    expectEuro(r.children[0].restBedarf, '731.00', 'rest');
    expect(r.children[0].haftungsanteilUnknown).toBe(false);
    expectEuro(r.children[0].haftungsanteil!, '527.94', 'share');
    expectEuro(r.children[0].zahlbetrag, '527.94', 'zahlbetrag');
    expectEuro(r.sumZahlbetrag, '527.94', 'sum');
  });

  it('G14: mixed ranks, N=3000, minor 8 + adult 22, BKB 4→3, 484.50 + 509.00 = 993.50 + flag', () => {
    const r = calc({
      monthlyNetto: 3000,
      children: [child(8), child(22)],
    });
    expect(r.groupBase).toBe(4);
    expect(r.groupAdjusted).toBe(3);
    expect(r.bkbSteps).toBe(1);
    expect(r.children[0].groupUsed).toBe(3); // minor: G_adj 4 dropped to 3
    expect(r.children[1].groupUsed).toBe(3); // adult: G_base 4 dropped to 3
    expect(r.children[0].rank).toBe(1);
    expect(r.children[1].rank).toBe(4);
    expectEuro(r.children[0].zahlbetrag, '484.50', 'minor group 3');
    expectEuro(r.children[1].zahlbetrag, '509.00', 'adult group 3');
    expectEuro(r.sumZahlbetrag, '993.50', 'sum');
    expect(r.children[1].haftungsanteilUnknown).toBe(true);
    expect(r.warnings.some((w) => w.includes('Haftungsanteil'))).toBe(true);
    expect(r.mangelfall).toBe(false);
  });

  it('G15: N=2000, age 5, G_adj 2, warmmiete 700, BKB drop to 1, SB 1630, 356.50', () => {
    const r = calc({ monthlyNetto: 2000, warmmiete: 700, children: [child(5)] });
    expect(r.groupBase).toBe(1);
    expect(r.groupAdjusted).toBe(1);
    expect(r.bkbSteps).toBe(1);
    expectEuro(r.selbstbehaltApplied, '1630.00', 'SB 1450+180');
    expectEuro(r.warmmieteIncrease, '180.00', 'warmmiete increase');
    expectEuro(r.children[0].zahlbetrag, '356.50', 'group 1 0-5');
    expectEuro(r.sumZahlbetrag, '356.50', 'sum');
    expect(r.mangelfall).toBe(false);
  });
});

describe('additional required tests (SPEC §12)', () => {
  it('gruppenverschiebung −1 on G1 facts → group 5, 454.50 + 540.50 = 995.00', () => {
    const r = calc({
      monthlyNetto: 4000,
      gruppenverschiebung: -1,
      children: [child(4), child(8)],
    });
    expect(r.groupAdjusted).toBe(5);
    expectEuro(r.children[0].zahlbetrag, '454.50', 'age 3');
    expectEuro(r.children[1].zahlbetrag, '540.50', 'age 8');
    expectEuro(r.sumZahlbetrag, '995.00', 'sum');
  });

  it('N ≤ Selbstbehalt → every Zahlbetrag is 0', () => {
    const r = calc({ monthlyNetto: 1400, children: [child(8)] });
    expectEuro(r.children[0].zahlbetrag, '0.00', 'below SB');
    expectEuro(r.sumZahlbetrag, '0.00', 'sum');
    expect(r.mangelfall).toBe(true);
  });

  it('N1: adults-only Masse ≤ 0 is Mangelfall with Zahlbetrag 0', () => {
    const exact = calc({ monthlyNetto: 1750, children: [child(22)] });
    expectEuro(exact.selbstbehaltApplied, '1750.00', 'angemessener SB');
    expectEuro(exact.children[0].zahlbetrag, '0.00', 'exact SB');
    expectEuro(exact.sumZahlbetrag, '0.00', 'sum');
    expect(exact.mangelfall).toBe(true);
    expect(exact.children[0].rank).toBe(4);

    const below = calc({ monthlyNetto: '1749.99', children: [child(22)] });
    expectEuro(below.children[0].zahlbetrag, '0.00', 'below SB');
    expectEuro(below.sumZahlbetrag, '0.00', 'sum');
    expect(below.mangelfall).toBe(true);
  });

  it('child income that wipes Restbedarf → Zahlbetrag 0', () => {
    const r = calc({ monthlyNetto: 4000, children: [child(8, { childIncome: 1000 })] });
    expectEuro(r.children[0].restBedarf, '0.00', 'wiped');
    expectEuro(r.children[0].zahlbetrag, '0.00', 'zero');
  });

  it('age 5 / 6 / 11 / 12 / 17 / 18 boundaries produce the matching Altersstufe and Bedarf', () => {
    const ages = [
      { age: 5, stufe: '0-5', bedarf: '623.00' },
      { age: 6, stufe: '6-11', bedarf: '715.00' },
      { age: 11, stufe: '6-11', bedarf: '715.00' },
      { age: 12, stufe: '12-17', bedarf: '836.00' },
      { age: 17, stufe: '12-17', bedarf: '836.00' },
      { age: 18, stufe: '18+', bedarf: '894.00' },
    ] as const;
    for (const a of ages) {
      const r = calc({
        monthlyNetto: 4000,
        anzahlBerechtigter: 2, // keep G_adj = G_base = 6, no Höherstufung
        children: [child(a.age, a.age >= 18 ? { privilegedAdult: true } : {})],
      });
      expect(r.children[0].altersstufe, `age ${a.age}`).toBe(a.stufe);
      expectEuro(r.children[0].bedarf, a.bedarf, `bedarf age ${a.age}`);
      if (a.age >= 18) {
        // Adult uses G_base 6 even though G_adj is 6 here too (2 Berechtigte).
        expect(r.children[0].groupUsed).toBe(6);
      }
    }
  });
});

describe('validation (SPEC §8, §12)', () => {
  it('rejects missing monthlyNetto', () => {
    const o = calculateKindesunterhalt(defaultKindesunterhaltInput({ monthlyNetto: '', children: [child(8)] }));
    expect(o.ok).toBe(false);
    if (!o.ok) {
      expect(o.errors[0].field).toBe('monthlyNetto');
      expect(o.errors[0].message).toMatch(/monatliche Netto/i);
    }
  });

  it('rejects negative monthlyNetto without silent clamp', () => {
    const o = calculateKindesunterhalt(defaultKindesunterhaltInput({ monthlyNetto: -1, children: [child(8)] }));
    expect(o.ok).toBe(false);
    if (!o.ok) expect(o.errors.some((e) => e.field === 'monthlyNetto')).toBe(true);
  });

  it('rejects deductions that exceed monthlyNetto and hides results', () => {
    const o = calculateKindesunterhalt(
      defaultKindesunterhaltInput({ monthlyNetto: 1000, debts: 600, workExpenses: 500, children: [child(8)] }),
    );
    expect(o.ok).toBe(false);
    if (!o.ok) {
      expect(o.errors.some((e) => e.field === 'deductions')).toBe(true);
      expect(o.errors[0].message).toMatch(/Abzüge/i);
    }
  });

  it('rejects zero children and more than 12 children', () => {
    const none = calculateKindesunterhalt({ year: 2026, monthlyNetto: 4000, children: [] });
    expect(none.ok).toBe(false);
    const many = calculateKindesunterhalt({
      year: 2026,
      monthlyNetto: 4000,
      children: Array.from({ length: 13 }, () => child(5)),
    });
    expect(many.ok).toBe(false);
    if (!many.ok) expect(many.errors[0].message).toMatch(/12/);
  });

  it('rejects age outside 0–99, and warns (does not block) when age > 27', () => {
    const bad = calculateKindesunterhalt(defaultKindesunterhaltInput({ monthlyNetto: 4000, children: [child(100)] }));
    expect(bad.ok).toBe(false);
    const warn = calculateKindesunterhalt(defaultKindesunterhaltInput({ monthlyNetto: 4000, children: [child(28)] }));
    expect(warn.ok).toBe(true);
    if (warn.ok) expect(warn.warnings.some((w) => w.includes('27'))).toBe(true);
  });

  it('rejects privilegedAdult outside 18–20 and ownHousehold on a minor', () => {
    const p = calculateKindesunterhalt(
      defaultKindesunterhaltInput({ monthlyNetto: 4000, children: [child(17, { privilegedAdult: true })] }),
    );
    expect(p.ok).toBe(false);
    const h = calculateKindesunterhalt(
      defaultKindesunterhaltInput({ monthlyNetto: 4000, children: [child(16, { ownHousehold: true })] }),
    );
    expect(h.ok).toBe(false);
  });

  it('rejects privilegedAdult and ownHousehold together', () => {
    const o = calculateKindesunterhalt(
      defaultKindesunterhaltInput({
        monthlyNetto: 4000,
        children: [child(19, { privilegedAdult: true, ownHousehold: true })],
      }),
    );
    expect(o.ok).toBe(false);
    if (!o.ok) expect(o.errors[0].message).toMatch(/schließen einander aus/);
  });

  it('rejects anzahlBerechtigter outside 1–20 and gruppenverschiebung outside ±14', () => {
    const a = calculateKindesunterhalt(
      defaultKindesunterhaltInput({ monthlyNetto: 4000, anzahlBerechtigter: 0, children: [child(8)] }),
    );
    expect(a.ok).toBe(false);
    const g = calculateKindesunterhalt(
      defaultKindesunterhaltInput({ monthlyNetto: 4000, gruppenverschiebung: 15, children: [child(8)] }),
    );
    expect(g.ok).toBe(false);
  });

  it('rejects negative optional money fields when present', () => {
    const o = calculateKindesunterhalt(
      defaultKindesunterhaltInput({ monthlyNetto: 4000, otherParentNetto: -10, children: [child(8)] }),
    );
    expect(o.ok).toBe(false);
  });

  it('validateKindesunterhalt surfaces German messages and field names', () => {
    const v = validateKindesunterhalt({ year: 1999, monthlyNetto: '', children: [] });
    expect(v.ok).toBe(false);
    expect(v.errors.every((e) => e.message.length > 0 && e.field.length > 0)).toBe(true);
  });
});

describe('money helpers stay at official half-euros (SPEC §6, §15)', () => {
  it('toMoney preserves 50-cent official Zahlbeträge', () => {
    expect(toMoney(d('493.50')).euros).toBe('493.50');
    expect(toMoney(d('1079')).euros).toBe('1079.00');
  });
});

describe('decision goldens (PR #9 decisions 1 and 8)', () => {
  it('D1: privileged-adult Haftungsanteil falls back to the necessary Selbstbehalt', () => {
    // Hand-computed from the 2026 table and SPEC §6.3–6.8 (decision 1).
    //
    // Facts: N = 2.000, otherParentNetto = 1.900, one privileged adult aged 19
    // at home (not ownHousehold), erwerbstätig, no deductions, no Warmmiete,
    // no child income, anzahlBerechtigter = 1, gruppenverschiebung = 0.
    //
    // 6.1  N = 2.000.
    // 6.2  G_base = 1 (bracket 0–2.100).
    // 6.3  G_adj = 1 + (2 − 1) = 2, unused: the adult’s Bedarf group is
    //      G_combined of N + otherParentNetto = 2.000 + 1.900 = 3.900
    //      → group 6 (3.701–4.100), ohne Höher-/Herabstufung.
    //
    // 6.4–6.5 and 6.6 (BKB), starting at group 6. Kindergeld is the full
    // 259,00 (age ≥ 18). Official 18+ cells:
    //
    //   group  Bedarf  Restbedarf (= Bedarf − 259)  remaining (= 2.000 − Rest)  BKB    test
    //   6      894     635                          1.365                       2.150  1.365 < 2.150 → drop
    //   5      838     579                          1.421                       2.050  1.421 < 2.050 → drop
    //   4      803     544                          1.456                       1.950  1.456 < 1.950 → drop
    //   3      768     509                          1.491                       1.850  1.491 < 1.850 → drop
    //   2      733     474                          1.526                       1.750  1.526 < 1.750 → drop
    //   1      698     439                          1.561                       1.450  1.561 ≥ 1.450 → stop
    //
    // After BKB: groupUsed = 1, Restbedarf = 439,00, bkbSteps = 5.
    //
    // 6.8 Haftungsanteil, sockel (decision 1). Group-1 Restbedarf of this
    // child (same 698 − 259) is 439,00. Capacities above the appropriate
    // Selbstbehalt 1.750:
    //   capacity_P = max(0, 2.000 − 1.750) = 250
    //   capacity_O = max(0, 1.900 − 1.750) = 150
    //   sum = 400  <  439  → both parents fall back to the necessary
    //   Selbstbehalt 1.450 (erwerbstätig).
    // Capacities at 1.450:
    //   capacity_P = 2.000 − 1.450 = 550
    //   capacity_O = 1.900 − 1.450 = 450
    //   sum = 1.000
    // Share = Restbedarf × 550 / 1.000 = 439 × 550 / 1.000 = 241,45
    // (exact to the cent; commercial rounding does not change it).
    // Cap: Zahlbetrag from this parent’s income alone at G_base = 1
    // (ohne Höher-/Herabstufung) = 698 − 259 = 439,00; 241,45 < 439, not binding.
    //
    // 6.7  Privileged adult is Rang 1 → notwendiger SB 1.450.
    // masse_1 = max(0, 2.000 − 1.450) = 550 ≥ 241,45 → full share, no Mangelfall.
    // Expected: haftungsanteil = zahlbetrag = 241,45, haftungsanteilUnknown = false.
    const r = calc({
      monthlyNetto: 2000,
      otherParentNetto: 1900,
      children: [child(19, { privilegedAdult: true })],
    });
    expect(r.groupBase).toBe(1);
    expect(r.children[0].groupUsed).toBe(1);
    expect(r.children[0].rank).toBe(1);
    expect(r.bkbSteps).toBe(5);
    expectEuro(r.children[0].bedarf, '698.00', 'group-1 Bedarf 18+');
    expectEuro(r.children[0].restBedarf, '439.00', '698 − 259');
    expect(r.children[0].haftungsanteilUnknown).toBe(false);
    expectEuro(r.children[0].haftungsanteil!, '241.45', 'share after sockel fallback');
    expectEuro(r.children[0].zahlbetrag, '241.45', 'zahlbetrag');
    expectEuro(r.sumZahlbetrag, '241.45', 'sum');
    expect(r.mangelfall).toBe(false);
  });

  it('D8: adults-only BKB re-tests against the lowered adult table group', () => {
    // Hand-computed from the 2026 table and SPEC §6.6 (decision 8).
    //
    // Facts: N = 2.950, two non-privileged adults at home (ages 22 and 25),
    // no otherParentNetto, erwerbstätig, no deductions, no Warmmiete,
    // anzahlBerechtigter = 2, gruppenverschiebung = 0. No minors, so the
    // BKB comparison is the adult table group (starts as G_base; after a
    // drop, the lowered group — not the original G_base).
    //
    // 6.1  N = 2.950.
    // 6.2  G_base = 4 (bracket 2.901–3.300). G_adj = 4 + (2 − 2) = 4,
    //      unused for at-home adults (Nr. 13.1: ohne Höher-/Herabstufung).
    //      Adult group starts at G_base = 4.
    //
    // Official 18+ cells and BKB (groups 2–4, erwerbstätig):
    //   group  Bedarf  Restbedarf (= Bedarf − 259)  BKB
    //   4      803     544                          1.950
    //   3      768     509                          1.850
    //   2      733     474                          1.750
    //
    // Provisional (group 4): Restbedarf 544 × 2 = 1.088.
    // remaining = 2.950 − 1.088 = 1.862  <  BKB 1.950  → drop every
    // table-based group in use (the adult group) by 1, to group 3.
    //
    // After the drop (group 3): Restbedarf 509 × 2 = 1.018.
    // remaining = 2.950 − 1.018 = 1.932.
    // Decision 8: re-test against the BKB of the current (lowered) group 3,
    // which is 1.850.  1.932 ≥ 1.850  → stop at group 3.  bkbSteps = 1.
    //
    // (If the comparison kept the original G_base BKB of 1.950, 1.932 < 1.950
    // would drop again to group 2, Restbedarf 474 × 2 = 948, remaining
    // 2.002 ≥ 1.950, and each Zahlbetrag would be 474,00 — a different result.)
    //
    // 6.8  otherParentNetto is not entered: haftungsanteilUnknown = true,
    // zahlbetrag reported as Restbedarf 509,00 (upper reference).
    //
    // 6.7  Only Rang-4 children → angemessener SB 1.750.
    // masse_4 = max(0, 2.950 − 1.750) = 1.200  ≥  need 1.018  → full
    // Restbedarf each, no Mangelfall.
    // Expected: groupUsed = 3, each zahlbetrag = 509,00, Summe 1.018,00,
    // BKB of the final comparison group = 1.850,00.
    const r = calc({
      monthlyNetto: 2950,
      children: [child(22), child(25)],
    });
    expect(r.groupBase).toBe(4);
    expect(r.groupAdjusted).toBe(4);
    expect(r.bkbSteps).toBe(1);
    expect(r.children[0].groupUsed).toBe(3);
    expect(r.children[1].groupUsed).toBe(3);
    expect(r.children[0].rank).toBe(4);
    expect(r.children[1].rank).toBe(4);
    expectEuro(r.bkb, '1850.00', 'BKB of lowered group 3, not original group 4');
    expectEuro(r.children[0].bedarf, '768.00', 'group-3 Bedarf 18+');
    expectEuro(r.children[1].bedarf, '768.00', 'group-3 Bedarf 18+');
    expectEuro(r.children[0].restBedarf, '509.00', '768 − 259');
    expectEuro(r.children[1].restBedarf, '509.00', '768 − 259');
    expectEuro(r.children[0].zahlbetrag, '509.00', 'adult 22');
    expectEuro(r.children[1].zahlbetrag, '509.00', 'adult 25');
    expectEuro(r.sumZahlbetrag, '1018.00', 'sum');
    expect(r.children[0].haftungsanteilUnknown).toBe(true);
    expect(r.children[1].haftungsanteilUnknown).toBe(true);
    expect(r.mangelfall).toBe(false);
  });
});

