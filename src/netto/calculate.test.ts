import { describe, expect, it } from 'vitest';
import { calculateNetto, calculateNettoAverage, defaultInput } from './calculate.ts';
import { pvRate } from './social.ts';
import { avCashFromBezugsgröße } from './social.ts';
import {
  getYearParams,
  resolveYearParams,
  YEAR_PARAMS,
  YEAR_PARAM_KEYS,
  RECHTSKREIS_GROESSEN_KEYS,
  SUPPORTED_YEARS,
  DEFAULT_YEAR,
  DEFAULT_AVERAGE_YEARS,
} from './params.ts';
import { d, toMoney } from './money.ts';
import type { NettoInput, NettoResult } from './types.ts';

function calc(overrides: Partial<NettoInput> & { gewinn: NettoInput['gewinn'] }): NettoResult {
  const outcome = calculateNetto(defaultInput(overrides));
  if (!outcome.ok) {
    throw new Error(`unexpected validation failure: ${outcome.errors.map((e) => e.message).join('; ')}`);
  }
  return outcome.result;
}

function expectEuro(actual: { euros: string }, expected: string, label: string) {
  expect(actual.euros, label).toBe(expected);
}

describe('parameter-file completeness (SPEC 11.3)', () => {
  it('every supported year has every key, including West and Ost Rechengrößen', () => {
    expect(SUPPORTED_YEARS).toEqual([2023, 2024, 2025, 2026]);
    const keys = YEAR_PARAM_KEYS;
    expect(keys.length).toBeGreaterThan(20);
    expect(keys).toContain('west');
    expect(keys).toContain('ost');
    for (const year of SUPPORTED_YEARS) {
      const block = YEAR_PARAMS[year];
      const blockKeys = Object.keys(block).sort();
      expect(blockKeys, `year ${year}`).toEqual(keys);
      for (const key of keys) {
        expect(block[key], `${year}.${String(key)}`).toBeDefined();
      }
      for (const rk of ['west', 'ost'] as const) {
        const rkKeys = Object.keys(block[rk]).sort();
        expect(rkKeys, `${year}.${rk}`).toEqual(RECHTSKREIS_GROESSEN_KEYS);
      }
    }
    // 2023–2024 West and Ost Bezugsgröße actually differ; 2025+ are unified.
    expect(YEAR_PARAMS[2023].west.bezugsgrößeAnnual.eq(YEAR_PARAMS[2023].ost.bezugsgrößeAnnual)).toBe(false);
    expect(YEAR_PARAMS[2024].west.bezugsgrößeAnnual.eq(YEAR_PARAMS[2024].ost.bezugsgrößeAnnual)).toBe(false);
    expect(YEAR_PARAMS[2025].west.bezugsgrößeAnnual.eq(YEAR_PARAMS[2025].ost.bezugsgrößeAnnual)).toBe(true);
    expect(YEAR_PARAMS[2026].west.bezugsgrößeAnnual.eq(YEAR_PARAMS[2026].ost.bezugsgrößeAnnual)).toBe(true);
  });

  it('missing a year throws a clear error', () => {
    expect(() => getYearParams(2022)).toThrow(/Kein Parameterblock für das Jahr 2022/);
    expect(() => getYearParams(2027)).toThrow(/Unterstützte Jahre: 2023, 2024, 2025, 2026/);
    const outcome = calculateNetto(defaultInput({ year: 2027, gewinn: 80000 }));
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.errors[0].message).toMatch(/Kein Parameterblock für das Jahr 2027/);
    }
  });

  it(`default year is ${DEFAULT_YEAR}`, () => {
    expect(DEFAULT_YEAR).toBe(2026);
    expect(getYearParams(2026).year).toBe(2026);
  });
});

describe('G1 — GKV minimum, low profit (2026)', () => {
  const r = calc({ gewinn: 10000 });
  it('intermediates and Netto', () => {
    expectEuro(r.kvPvBemessung!, '15820.00', 'Bemessung');
    expect(r.kvPvBemessungNote).toBe('minimum');
    expectEuro(r.kvCash, '2673.58', 'KV');
    expectEuro(r.kvDeductible, '2673.58', 'KV deductible');
    expectEuro(r.pvCash, '664.44', 'PV');
    expectEuro(r.vorsorge, '3338.02', 'Vorsorge');
    expectEuro(r.zve, '6625.00', 'zvE');
    expectEuro(r.festzusetzendeEstUser, '0.00', 'ESt');
    expectEuro(r.soliUser, '0.00', 'Soli');
    expectEuro(r.totalBurden, '3338.02', 'Burden');
    expectEuro(r.nettoAnnual, '6661.98', 'Netto');
    expectEuro(r.nettoMonthly, '555.17', 'monthly');
    expect(r.effectiveBurdenPercent?.percent).toBe('33.38');
  });
});

describe('G2 — Profit above KV-BBG, Soli Milderungszone (2026)', () => {
  const r = calc({ gewinn: 120000 });
  it('intermediates and Netto', () => {
    expectEuro(r.kvPvBemessung!, '69750.00', 'Bemessung');
    expect(r.kvPvBemessungNote).toBe('bbg');
    expectEuro(r.kvCash, '11787.75', 'KV');
    expectEuro(r.pvCash, '2929.50', 'PV');
    expectEuro(r.vorsorge, '14717.25', 'Vorsorge');
    expectEuro(r.zve, '105246.00', 'zvE');
    expectEuro(r.festzusetzendeEstUser, '33067.00', 'ESt');
    expectEuro(r.soliUser, '1513.32', 'Soli');
    expectEuro(r.totalBurden, '49297.57', 'Burden');
    expectEuro(r.nettoAnnual, '70702.43', 'Netto');
    expectEuro(r.nettoMonthly, '5891.87', 'monthly');
    expect(r.effectiveBurdenPercent?.percent).toBe('41.08');
  });
});

describe('G3 — Gewerbe below the Freibetrag (2026)', () => {
  const r = calc({ gewinn: 20000, activity: 'gewerbe', hebesatz: 400 });
  it('intermediates and Netto', () => {
    expectEuro(r.kvCash, '3380.00', 'KV');
    expectEuro(r.pvCash, '840.00', 'PV');
    expectEuro(r.gewerbesteuer, '0.00', 'GewSt');
    expectEuro(r.messbetrag, '0.00', 'Messbetrag');
    expectEuro(r.zve, '15744.00', 'zvE');
    expectEuro(r.festzusetzendeEstUser, '580.00', 'ESt');
    expectEuro(r.soliUser, '0.00', 'Soli');
    expectEuro(r.totalBurden, '4800.00', 'Burden');
    expectEuro(r.nettoAnnual, '15200.00', 'Netto');
    expectEuro(r.nettoMonthly, '1266.67', 'monthly');
    expect(r.effectiveBurdenPercent?.percent).toBe('24.00');
  });
});

describe('G4 — Gewerbe above Freibetrag, Hebesatz 400 % (2026)', () => {
  const r = calc({ gewinn: 80000, activity: 'gewerbe', hebesatz: 400 });
  it('intermediates and Netto', () => {
    expectEuro(r.kvCash, '11787.75', 'KV');
    expectEuro(r.pvCash, '2929.50', 'PV');
    expectEuro(r.messbetrag, '1942.50', 'Messbetrag');
    expectEuro(r.gewerbesteuer, '7770.00', 'GewSt');
    expectEuro(r.zve, '65246.00', 'zvE');
    expectEuro(r.tariflicheEst, '16304.00', 'tarifliche ESt');
    expectEuro(r.gewerbesteuerCredit, '7770.00', '§ 35');
    expectEuro(r.festzusetzendeEst, '8534.00', 'fest');
    expectEuro(r.festzusetzendeEstUser, '8534.00', 'fest user');
    expectEuro(r.soliUser, '0.00', 'Soli');
    expectEuro(r.totalBurden, '31021.25', 'Burden');
    expectEuro(r.nettoAnnual, '48978.75', 'Netto');
    expectEuro(r.nettoMonthly, '4081.56', 'monthly');
    expect(r.effectiveBurdenPercent?.percent).toBe('38.78');
  });
});

describe('G5 — Gewerbe, Hebesatz 500 %, residual GewSt (2026)', () => {
  const r = calc({ gewinn: 80000, activity: 'gewerbe', hebesatz: 500 });
  it('intermediates and Netto', () => {
    expectEuro(r.messbetrag, '1942.50', 'Messbetrag');
    expectEuro(r.gewerbesteuer, '9712.50', 'GewSt');
    expectEuro(r.gewerbesteuerCredit, '7770.00', '§ 35 still 4 × Messbetrag');
    expectEuro(r.festzusetzendeEst, '8534.00', 'fest');
    expectEuro(r.totalBurden, '32963.75', 'Burden');
    expectEuro(r.nettoAnnual, '47036.25', 'Netto');
    expectEuro(r.nettoMonthly, '3919.69', 'monthly');
    expect(r.effectiveBurdenPercent?.percent).toBe('41.20');
  });
});

describe('G6 — Married Splitting, spouse zvE 0 (2026)', () => {
  const r = calc({ gewinn: 80000, married: true, spouseZve: 0, fullKinderfreibetrag: true });
  it('intermediates and Netto', () => {
    expectEuro(r.kvCash, '11787.75', 'KV');
    expectEuro(r.pvCash, '2929.50', 'PV');
    expectEuro(r.pauschbetrag, '72.00', 'Pauschbetrag');
    expectEuro(r.zve, '65210.00', 'zvE');
    expectEuro(r.zveJoint, '65210.00', 'joint zvE');
    expectEuro(r.festzusetzendeEstUser, '9926.00', 'ESt');
    expectEuro(r.soliUser, '0.00', 'Soli');
    expectEuro(r.totalBurden, '24643.25', 'Burden');
    expectEuro(r.nettoAnnual, '55356.75', 'Netto');
    expectEuro(r.nettoMonthly, '4613.06', 'monthly');
    expect(r.effectiveBurdenPercent?.percent).toBe('30.80');
    expect(r.taxShare).toBe('1');
  });
});

describe('G7 — Married Splitting, spouse zvE 40_000 (2026)', () => {
  const r = calc({ gewinn: 80000, married: true, spouseZve: 40000, fullKinderfreibetrag: true });
  it('intermediates and Netto', () => {
    expectEuro(r.zve, '65210.00', 'user zvE');
    expectEuro(r.zveJoint, '105210.00', 'joint');
    expectEuro(r.tariflicheEstJoint, '22948.00', 'joint ESt');
    expectEuro(r.festzusetzendeEst, '22948.00', 'joint fest');
    expectEuro(r.festzusetzendeEstUser, '14223.35', "user's ESt");
    expectEuro(r.soliUser, '0.00', 'Soli');
    expectEuro(r.kvCash, '11787.75', 'KV');
    expectEuro(r.pvCash, '2929.50', 'PV');
    expectEuro(r.totalBurden, '28940.60', 'Burden');
    expectEuro(r.nettoAnnual, '51059.40', 'Netto');
    expectEuro(r.nettoMonthly, '4254.95', 'monthly');
    expect(r.effectiveBurdenPercent?.percent).toBe('36.18');
  });
});

describe('G8 — Church tax 9 % (NRW) (2026)', () => {
  const r = calc({
    gewinn: 80000,
    churchTax: true,
    bundesland: 'Nordrhein-Westfalen',
  });
  it('intermediates and Netto, iteration converges', () => {
    expectEuro(r.zve, '63865.00', 'zvE');
    expectEuro(r.festzusetzendeEstUser, '15750.00', 'ESt');
    expectEuro(r.kistUser, '1417.50', 'KiSt');
    expect(r.kistRate.percent).toBe('9.00');
    expectEuro(r.soliUser, '0.00', 'Soli');
    expectEuro(r.kvCash, '11787.75', 'KV');
    expectEuro(r.pvCash, '2929.50', 'PV');
    expectEuro(r.totalBurden, '31884.75', 'Burden');
    expectEuro(r.nettoAnnual, '48115.25', 'Netto');
    expectEuro(r.nettoMonthly, '4009.60', 'monthly');
    expect(r.effectiveBurdenPercent?.percent).toBe('39.86');
  });
});

describe('G9 — Three children under 25, PV Abschlag (2026)', () => {
  const r = calc({ gewinn: 80000, childrenUnder25: 3 });
  it('intermediates and Netto', () => {
    expect(r.pvRate.percent).toBe('3.10');
    expectEuro(r.pvCash, '2162.25', 'PV');
    expectEuro(r.kvCash, '11787.75', 'KV');
    expectEuro(r.vorsorge, '13950.00', 'Vorsorge');
    expectEuro(r.zve, '66014.00', 'zvE');
    expectEuro(r.festzusetzendeEstUser, '16616.00', 'ESt');
    expectEuro(r.soliUser, '0.00', 'Soli');
    expectEuro(r.totalBurden, '30566.00', 'Burden');
    expectEuro(r.nettoAnnual, '49434.00', 'Netto');
    expectEuro(r.nettoMonthly, '4119.50', 'monthly');
    expect(r.effectiveBurdenPercent?.percent).toBe('38.21');
  });
});

describe('G10 — PKV (2026)', () => {
  const r = calc({
    gewinn: 80000,
    kvType: 'pkv',
    pkvPremiumMonthly: 700,
    pkvBasisMonthly: 600,
    privatePvMonthly: 150,
  });
  it('intermediates and Netto', () => {
    expectEuro(r.kvCash, '8400.00', 'KV cash');
    expectEuro(r.kvDeductible, '7200.00', 'Basis');
    expectEuro(r.pvCash, '1800.00', 'PV');
    expectEuro(r.vorsorge, '9000.00', 'Vorsorge');
    expectEuro(r.zve, '70964.00', 'zvE');
    expectEuro(r.festzusetzendeEstUser, '18669.00', 'ESt');
    expectEuro(r.soliUser, '0.00', 'Soli');
    expectEuro(r.totalBurden, '28869.00', 'Burden');
    expectEuro(r.nettoAnnual, '51131.00', 'Netto');
    expectEuro(r.nettoMonthly, '4260.92', 'monthly');
    expect(r.effectiveBurdenPercent?.percent).toBe('36.09');
    expect(r.kvPvBemessung).toBeNull();
    expect(r.kvPvBemessungNote).toBe('pkv');
  });
});

describe('G11 — Same facts as G14, tax year 2025', () => {
  const r = calc({ year: 2025, gewinn: 80000 });
  it('intermediates and Netto', () => {
    expectEuro(r.kvPvBemessung!, '66150.00', 'Bemessung');
    expectEuro(r.kvCash, '10914.75', 'KV');
    expectEuro(r.pvCash, '2778.30', 'PV');
    expectEuro(r.vorsorge, '13693.05', 'Vorsorge');
    expectEuro(r.zve, '66270.00', 'zvE');
    expectEuro(r.festzusetzendeEstUser, '16930.00', 'ESt');
    expectEuro(r.soliUser, '0.00', 'Soli');
    expectEuro(r.totalBurden, '30623.05', 'Burden');
    expectEuro(r.nettoAnnual, '49376.95', 'Netto');
    expectEuro(r.nettoMonthly, '4114.75', 'monthly');
    expect(r.effectiveBurdenPercent?.percent).toBe('38.28');
  });
});

describe('G12 — GKV allgemein, 4 % Krankengeld reduction (2026)', () => {
  const r = calc({ gewinn: 80000, kvType: 'gkv_allgemein' });
  it('intermediates and Netto', () => {
    expectEuro(r.kvCash, '12206.25', 'KV cash');
    expectEuro(r.kvDeductible, '11718.00', 'KV deductible');
    expectEuro(r.pvCash, '2929.50', 'PV');
    expectEuro(r.vorsorge, '14647.50', 'Vorsorge');
    expectEuro(r.zve, '65316.00', 'zvE');
    expectEuro(r.festzusetzendeEstUser, '16333.00', 'ESt');
    expectEuro(r.totalBurden, '31468.75', 'Burden');
    expectEuro(r.nettoAnnual, '48531.25', 'Netto');
    expectEuro(r.nettoMonthly, '4044.27', 'monthly');
    expect(r.effectiveBurdenPercent?.percent).toBe('39.34');
  });
});

describe('G13 — Mandatory income-based RV (2026)', () => {
  const r = calc({ gewinn: 80000, rvMode: 'pflicht' });
  it('intermediates and Netto', () => {
    expectEuro(r.rvCash, '14880.00', 'RV');
    expectEuro(r.vorsorge, '29597.25', 'Vorsorge');
    expectEuro(r.zve, '50366.00', 'zvE');
    expectEuro(r.festzusetzendeEstUser, '10677.00', 'ESt');
    expectEuro(r.kvCash, '11787.75', 'KV');
    expectEuro(r.pvCash, '2929.50', 'PV');
    expectEuro(r.totalBurden, '40274.25', 'Burden');
    expectEuro(r.nettoAnnual, '39725.75', 'Netto');
    expectEuro(r.nettoMonthly, '3310.48', 'monthly');
    expect(r.effectiveBurdenPercent?.percent).toBe('50.34');
  });
});

describe('G14 — Baseline Freiberufler, 80_000, 2026', () => {
  const r = calc({ gewinn: 80000 });
  it('intermediates and Netto', () => {
    expectEuro(r.kvPvBemessung!, '69750.00', 'Bemessung');
    expectEuro(r.kvCash, '11787.75', 'KV');
    expectEuro(r.pvCash, '2929.50', 'PV');
    expectEuro(r.vorsorge, '14717.25', 'Vorsorge');
    expectEuro(r.zve, '65246.00', 'zvE');
    expectEuro(r.tariflicheEst, '16304.00', 'tarifliche ESt');
    expectEuro(r.festzusetzendeEstUser, '16304.00', 'ESt');
    expectEuro(r.soliUser, '0.00', 'Soli');
    expectEuro(r.gewerbesteuer, '0.00', 'GewSt');
    expectEuro(r.totalBurden, '31021.25', 'Burden');
    expectEuro(r.nettoAnnual, '48978.75', 'Netto');
    expectEuro(r.nettoMonthly, '4081.56', 'monthly');
    expect(r.effectiveBurdenPercent?.percent).toBe('38.78');
    expect(r.marginalBurdenPercent?.percent).toBe('41.00');
  });
});

describe('G15 — Reichensteuer zone and full 5.5 % Soli (2026)', () => {
  const r = calc({ gewinn: 400000 });
  it('intermediates and Netto', () => {
    expectEuro(r.kvCash, '11787.75', 'KV');
    expectEuro(r.pvCash, '2929.50', 'PV');
    expectEuro(r.zve, '385246.00', 'zvE');
    expect(r.taxZone).toBe(5);
    expectEuro(r.festzusetzendeEstUser, '153890.00', 'ESt');
    expectEuro(r.soliUser, '8463.95', 'Soli');
    expectEuro(r.totalBurden, '177071.20', 'Burden');
    expectEuro(r.nettoAnnual, '222928.80', 'Netto');
    expectEuro(r.nettoMonthly, '18577.40', 'monthly');
    expect(r.effectiveBurdenPercent?.percent).toBe('44.27');
    expect(r.statutoryMarginalRateLabel).toBe('45 %');
  });
});

describe('G16 — Soli Milderung with Kinderfreibetrag (2026)', () => {
  const r = calc({ gewinn: 120000, childrenUnder25: 2 });
  it('intermediates and Netto', () => {
    expect(r.pvRate.percent).toBe('3.35');
    expectEuro(r.pvCash, '2336.63', 'PV');
    expectEuro(r.vorsorge, '14124.38', 'Vorsorge');
    expectEuro(r.zve, '105839.00', 'zvE');
    expectEuro(r.festzusetzendeEstUser, '33316.00', 'ESt');
    expectEuro(r.festSoli, '29219.00', 'fictitious ESt for Soli');
    expectEuro(r.soliUser, '1055.41', 'Soli');
    expectEuro(r.totalBurden, '48495.79', 'Burden');
    expectEuro(r.nettoAnnual, '71504.21', 'Netto');
    expectEuro(r.nettoMonthly, '5958.68', 'monthly');
    expect(r.effectiveBurdenPercent?.percent).toBe('40.41');
  });
});

describe('G17 — AV auf Antrag, not deductible (2026)', () => {
  const r = calc({ gewinn: 80000, avMode: 'voll' });
  it('intermediates and Netto', () => {
    expectEuro(r.avCash, '1233.96', 'AV');
    expectEuro(r.festzusetzendeEstUser, '16304.00', 'ESt same as G14');
    expectEuro(r.zve, '65246.00', 'zvE same as G14');
    expectEuro(r.deductSonstige, '0.00', 'AV not deductible');
    expectEuro(r.totalBurden, '32255.21', 'Burden');
    expectEuro(r.nettoAnnual, '47744.79', 'Netto');
    expectEuro(r.nettoMonthly, '3978.73', 'monthly');
    expect(r.effectiveBurdenPercent?.percent).toBe('40.32');
  });
});

describe('G18 — 8 % church tax (Bayern / BW) (2026)', () => {
  const r = calc({ gewinn: 80000, churchTax: true, bundesland: 'Bayern' });
  it('intermediates and Netto', () => {
    expectEuro(r.zve, '64017.00', 'zvE');
    expectEuro(r.festzusetzendeEstUser, '15810.00', 'ESt');
    expectEuro(r.kistUser, '1264.80', 'KiSt');
    expect(r.kistRate.percent).toBe('8.00');
    expectEuro(r.soliUser, '0.00', 'Soli');
    expectEuro(r.totalBurden, '31792.05', 'Burden');
    expectEuro(r.nettoAnnual, '48207.95', 'Netto');
    expectEuro(r.nettoMonthly, '4017.33', 'monthly');
    expect(r.effectiveBurdenPercent?.percent).toBe('39.74');
  });
  it('Baden-Württemberg is also 8 %', () => {
    const bw = calc({ gewinn: 80000, churchTax: true, bundesland: 'Baden-Württemberg' });
    expectEuro(bw.kistUser, '1264.80', 'KiSt BW');
    expectEuro(bw.nettoAnnual, '48207.95', 'Netto BW');
  });
});

describe('consistency (SPEC 11.3)', () => {
  it('G4 Netto === G14 Netto', () => {
    const g4 = calc({ gewinn: 80000, activity: 'gewerbe', hebesatz: 400 });
    const g14 = calc({ gewinn: 80000 });
    expect(g4.nettoAnnual.euros).toBe(g14.nettoAnnual.euros);
    expect(g4.nettoAnnual.euros).toBe('48978.75');
  });
  it('G5 burden === G4 burden + 1_942.50', () => {
    const g4 = calc({ gewinn: 80000, activity: 'gewerbe', hebesatz: 400 });
    const g5 = calc({ gewinn: 80000, activity: 'gewerbe', hebesatz: 500 });
    expect(g5.totalBurden.cents - g4.totalBurden.cents).toBe(194250);
  });
  it('G17 burden === G14 burden + 1_233.96', () => {
    const g14 = calc({ gewinn: 80000 });
    const g17 = calc({ gewinn: 80000, avMode: 'voll' });
    expect(g17.totalBurden.cents - g14.totalBurden.cents).toBe(123396);
  });
});

describe('validation (SPEC 11.3)', () => {
  it('rejects Basis share > PKV premium', () => {
    const o = calculateNetto(
      defaultInput({
        gewinn: 80000,
        kvType: 'pkv',
        pkvPremiumMonthly: 700,
        pkvBasisMonthly: 800,
        privatePvMonthly: 150,
      }),
    );
    expect(o.ok).toBe(false);
    if (!o.ok) expect(o.errors.some((e) => /Basis-Anteil/.test(e.message))).toBe(true);
  });

  it('rejects voluntary RV outside min/max', () => {
    const tooLow = calculateNetto(
      defaultInput({ gewinn: 80000, rvMode: 'freiwillig', voluntaryRvMonthly: '50' }),
    );
    expect(tooLow.ok).toBe(false);
    const tooHigh = calculateNetto(
      defaultInput({ gewinn: 80000, rvMode: 'freiwillig', voluntaryRvMonthly: '2000' }),
    );
    expect(tooHigh.ok).toBe(false);
  });

  it('accepts voluntary RV at the official bounds', () => {
    const p = resolveYearParams(2026);
    const atMin = calculateNetto(
      defaultInput({ gewinn: 80000, rvMode: 'freiwillig', voluntaryRvMonthly: p.rvMinMonthly.toString() }),
    );
    expect(atMin.ok).toBe(true);
    const atMax = calculateNetto(
      defaultInput({ gewinn: 80000, rvMode: 'freiwillig', voluntaryRvMonthly: p.rvMaxMonthly.toString() }),
    );
    expect(atMax.ok).toBe(true);
  });

  it('empty required Gewinn does not produce a fake result', () => {
    const o = calculateNetto(defaultInput({ gewinn: '' }));
    expect(o.ok).toBe(false);
    if (!o.ok) expect(o.errors.some((e) => e.field === 'gewinn')).toBe(true);
  });

  it('rejects missing PKV fields', () => {
    const o = calculateNetto(defaultInput({ gewinn: 80000, kvType: 'pkv' }));
    expect(o.ok).toBe(false);
    if (!o.ok) {
      expect(o.errors.some((e) => e.field === 'pkvPremiumMonthly')).toBe(true);
      expect(o.errors.some((e) => e.field === 'pkvBasisMonthly')).toBe(true);
      expect(o.errors.some((e) => e.field === 'privatePvMonthly')).toBe(true);
    }
  });
});

describe('Gewinn 0, GKV (SPEC 11.3)', () => {
  it('contributions at the minimum, ESt 0, Netto negative', () => {
    const r = calc({ gewinn: 0 });
    expectEuro(r.kvPvBemessung!, '15820.00', 'min Bemessung');
    expect(r.kvPvBemessungNote).toBe('minimum');
    expectEuro(r.kvCash, '2673.58', 'KV');
    expectEuro(r.pvCash, '664.44', 'PV');
    expectEuro(r.festzusetzendeEstUser, '0.00', 'ESt');
    expect(r.nettoAnnual.cents).toBeLessThan(0);
    expect(r.effectiveBurdenPercent).toBeNull();
    expectEuro(r.nettoAnnual, '-3338.02', 'negative Netto = −min socials');
  });
});

describe('Zusatzbeitrag direction (SPEC 11.3)', () => {
  it('raising Zusatzbeitrag raises KV cash and typically lowers zvE / ESt', () => {
    const low = calc({ gewinn: 80000, zusatzbeitragPercent: '2.9' });
    const high = calc({ gewinn: 80000, zusatzbeitragPercent: '3.9' });
    expect(high.kvCash.cents).toBeGreaterThan(low.kvCash.cents);
    expect(high.zve.cents).toBeLessThan(low.zve.cents);
    expect(high.festzusetzendeEstUser.cents).toBeLessThanOrEqual(low.festzusetzendeEstUser.cents);
  });
});

describe('Freiberufler never produces GewSt (SPEC 11.3)', () => {
  it('regardless of Gewinn and Hebesatz', () => {
    for (const gewinn of [0, 20000, 80000, 400000]) {
      const r = calc({ gewinn, activity: 'freiberufler', hebesatz: 900 });
      expectEuro(r.gewerbesteuer, '0.00', `Gewinn ${gewinn}`);
      expectEuro(r.messbetrag, '0.00', `Messbetrag ${gewinn}`);
      expectEuro(r.gewerbesteuerCredit, '0.00', `credit ${gewinn}`);
    }
  });
});

describe('PV rates 2026 (SPEC 11.3 and 6.4)', () => {
  const p = resolveYearParams(2026);
  it('0 children, under 23: 3.6 %', () => {
    expect(toMoney(pvRate(false, 0, false, p).times(100)).euros).toBe('3.60');
  });
  it('0 children, 23+, no Elterneigenschaft: 4.2 %', () => {
    expect(toMoney(pvRate(true, 0, false, p).times(100)).euros).toBe('4.20');
  });
  it('0 children, 23+, Elterneigenschaft: 3.6 %', () => {
    expect(toMoney(pvRate(true, 0, true, p).times(100)).euros).toBe('3.60');
  });
  it('1 child under 25: 3.6 %', () => {
    expect(toMoney(pvRate(true, 1, false, p).times(100)).euros).toBe('3.60');
  });
  it('2 children: 3.35 %', () => {
    expect(toMoney(pvRate(true, 2, false, p).times(100)).euros).toBe('3.35');
  });
  it('3 children: 3.10 %', () => {
    expect(toMoney(pvRate(true, 3, false, p).times(100)).euros).toBe('3.10');
  });
  it('4 children: 2.85 %', () => {
    expect(toMoney(pvRate(true, 4, false, p).times(100)).euros).toBe('2.85');
  });
  it('5 children: 2.60 %', () => {
    expect(toMoney(pvRate(true, 5, false, p).times(100)).euros).toBe('2.60');
  });
  it('6 children same as 5: 2.60 %', () => {
    expect(pvRate(true, 6, false, p).eq(pvRate(true, 5, false, p))).toBe(true);
  });
});

describe('official AV monthly figures match the Bezugsgröße formula', () => {
  it('2026 full and Anlaufphase', () => {
    const p = resolveYearParams(2026);
    expect(toMoney(avCashFromBezugsgröße(p, false)).euros).toBe('1233.96');
    expect(toMoney(avCashFromBezugsgröße(p, true)).euros).toBe(
      toMoney(p.avAnlaufMonthly.times(12)).euros,
    );
  });
  it('2025 full', () => {
    const p = resolveYearParams(2025);
    expect(toMoney(avCashFromBezugsgröße(p, false)).euros).toBe(
      toMoney(p.avFullMonthly.times(12)).euros,
    );
  });
});

describe('Regelbeitrag and Pflicht-RV clamps', () => {
  it('Regelbeitrag 2026 is 735.63 × 12', () => {
    const r = calc({ gewinn: 80000, rvMode: 'regelbeitrag' });
    expectEuro(r.rvCash, '8827.56', 'Regelbeitrag annual');
  });
  it('Pflicht-RV at a very low Gewinn still applies the minimum contribution', () => {
    const r = calc({ gewinn: 1000, rvMode: 'pflicht' });
    const minAnnual = resolveYearParams(2026).rvMinMonthly.times(12);
    expect(r.rvCash.euros).toBe(toMoney(minAnnual).euros);
  });
});

describe('PV rates for every year 2023–2026 (SPEC 11.3)', () => {
  it('2023 rates as exact fractions (childless 23+ is 3.70 %, 1 child is 3.225 %)', () => {
    const p = resolveYearParams(2023);
    expect(pvRate(false, 0, false, p).eq(d('0.03225'))).toBe(true); // under 23
    expect(pvRate(true, 0, false, p).eq(d('0.037'))).toBe(true); // childless 23+
    expect(pvRate(true, 0, true, p).eq(d('0.03225'))).toBe(true); // Elterneigenschaft
    expect(pvRate(true, 1, false, p).eq(d('0.03225'))).toBe(true);
    expect(pvRate(true, 2, false, p).eq(d('0.031'))).toBe(true);
    expect(pvRate(true, 3, false, p).eq(d('0.02975'))).toBe(true);
    expect(pvRate(true, 4, false, p).eq(d('0.0285'))).toBe(true);
    expect(pvRate(true, 5, false, p).eq(d('0.02725'))).toBe(true);
    expect(pvRate(true, 6, false, p).eq(pvRate(true, 5, false, p))).toBe(true);
  });
  it('2024 childless 23+ is 4.0 %; other 2024 rates', () => {
    const p = resolveYearParams(2024);
    expect(pvRate(true, 0, false, p).eq(d('0.040'))).toBe(true);
    expect(pvRate(false, 0, false, p).eq(d('0.034'))).toBe(true);
    expect(pvRate(true, 1, false, p).eq(d('0.034'))).toBe(true);
    expect(pvRate(true, 2, false, p).eq(d('0.0315'))).toBe(true);
    expect(pvRate(true, 3, false, p).eq(d('0.0290'))).toBe(true);
    expect(pvRate(true, 4, false, p).eq(d('0.0265'))).toBe(true);
    expect(pvRate(true, 5, false, p).eq(d('0.0240'))).toBe(true);
    expect(pvRate(true, 6, false, p).eq(pvRate(true, 5, false, p))).toBe(true);
  });
  it('2025 and 2026 childless 23+ is 4.2 %', () => {
    for (const year of [2025, 2026]) {
      const p = resolveYearParams(year);
      expect(pvRate(true, 0, false, p).eq(d('0.042')), String(year)).toBe(true);
      expect(pvRate(false, 0, false, p).eq(d('0.036')), String(year)).toBe(true);
      expect(pvRate(true, 1, false, p).eq(d('0.036')), String(year)).toBe(true);
      expect(pvRate(true, 2, false, p).eq(d('0.0335')), String(year)).toBe(true);
      expect(pvRate(true, 3, false, p).eq(d('0.0310')), String(year)).toBe(true);
      expect(pvRate(true, 4, false, p).eq(d('0.0285')), String(year)).toBe(true);
      expect(pvRate(true, 5, false, p).eq(d('0.0260')), String(year)).toBe(true);
      expect(pvRate(true, 6, false, p).eq(pvRate(true, 5, false, p))).toBe(true);
    }
  });
});

describe('2023 GKV minimum, Rechtskreis Ost vs West (SPEC 11.3)', () => {
  it('West: Bemessung 13_580, KV 2_118.48, PV 502.46, Netto 7_379.06, ESt 0', () => {
    const r = calc({ year: 2023, gewinn: 10000, rechtskreis: 'west' });
    expectEuro(r.kvPvBemessung!, '13580.00', 'Bemessung West');
    expectEuro(r.kvCash, '2118.48', 'KV');
    expectEuro(r.pvCash, '502.46', 'PV');
    expect(r.pvRate.percent).toBe('3.70');
    expectEuro(r.festzusetzendeEstUser, '0.00', 'ESt');
    expectEuro(r.nettoAnnual, '7379.06', 'Netto');
  });
  it('Ost: Bemessung 13_160, KV 2_052.96, PV 486.92, Netto 7_460.12, ESt 0', () => {
    const r = calc({ year: 2023, gewinn: 10000, rechtskreis: 'ost' });
    expectEuro(r.kvPvBemessung!, '13160.00', 'Bemessung Ost');
    expectEuro(r.kvCash, '2052.96', 'KV');
    expectEuro(r.pvCash, '486.92', 'PV');
    expectEuro(r.festzusetzendeEstUser, '0.00', 'ESt');
    expectEuro(r.nettoAnnual, '7460.12', 'Netto');
  });
});

function avgOf(years: Array<Partial<import('./types.ts').YearInput> & { year: number; gewinn: number | string }>) {
  const outcome = calculateNettoAverage(years.map((y) => defaultInput(y)));
  if (!outcome.ok) {
    throw new Error(`average failed: ${outcome.errors.map((e) => e.message).join('; ')}`);
  }
  return outcome.result;
}

describe('M1 — 2024–2026, equal Gewinn 80_000 (SPEC 11.4)', () => {
  const r = avgOf([
    { year: 2024, gewinn: 80000 },
    { year: 2025, gewinn: 80000 },
    { year: 2026, gewinn: 80000 },
  ]);
  it('2024 intermediates', () => {
    const y = r.perYear[0];
    expect(y.year).toBe(2024);
    expectEuro(y.kvPvBemessung!, '62100.00', 'Bemessung');
    expectEuro(y.kvCash, '9749.70', 'KV');
    expectEuro(y.pvCash, '2484.00', 'PV');
    expectEuro(y.vorsorge, '12233.70', 'Vorsorge');
    expectEuro(y.zve, '67730.00', 'zvE');
    expectEuro(y.festzusetzendeEstUser, '17810.00', 'ESt');
    expectEuro(y.soliUser, '0.00', 'Soli');
    expectEuro(y.totalBurden, '30043.70', 'Burden');
    expectEuro(y.nettoAnnual, '49956.30', 'Netto');
    expectEuro(y.nettoMonthly, '4163.03', 'monthly');
    expect(y.effectiveBurdenPercent?.percent).toBe('37.55');
  });
  it('2025 identical to G11', () => {
    const y = r.perYear[1];
    expect(y.year).toBe(2025);
    expectEuro(y.kvCash, '10914.75', 'KV');
    expectEuro(y.pvCash, '2778.30', 'PV');
    expectEuro(y.festzusetzendeEstUser, '16930.00', 'ESt');
    expectEuro(y.nettoAnnual, '49376.95', 'Netto');
  });
  it('2026 identical to G14', () => {
    const y = r.perYear[2];
    expect(y.year).toBe(2026);
    expectEuro(y.kvCash, '11787.75', 'KV');
    expectEuro(y.pvCash, '2929.50', 'PV');
    expectEuro(y.festzusetzendeEstUser, '16304.00', 'ESt');
    expectEuro(y.nettoAnnual, '48978.75', 'Netto');
  });
  it('averages', () => {
    expectEuro(r.avg_gewinn, '80000.00', 'Gewinn');
    expectEuro(r.avg_est, '17014.67', 'ESt');
    expectEuro(r.avg_soli, '0.00', 'Soli');
    expectEuro(r.avg_kv, '10817.40', 'KV');
    expectEuro(r.avg_pv, '2730.60', 'PV');
    expectEuro(r.avg_burden, '30562.67', 'Burden');
    expectEuro(r.avg_netto, '49437.33', 'Dreijahres-Netto');
    expectEuro(r.avg_monthly, '4119.78', 'monthly');
    expect(r.avg_effective?.percent).toBe('38.20');
  });
});

describe('M2 — 2023–2025, equal Gewinn 80_000, mid-2023 PV (SPEC 11.4)', () => {
  const r = avgOf([
    { year: 2023, gewinn: 80000 },
    { year: 2024, gewinn: 80000 },
    { year: 2025, gewinn: 80000 },
  ]);
  it('2023 intermediates (weighted PV 3.70 %)', () => {
    const y = r.perYear[0];
    expect(y.year).toBe(2023);
    expectEuro(y.kvPvBemessung!, '59850.00', 'Bemessung');
    expectEuro(y.kvCash, '9336.60', 'KV');
    expect(y.pvRate.percent).toBe('3.70');
    expectEuro(y.pvCash, '2214.45', 'PV');
    expectEuro(y.vorsorge, '11551.05', 'Vorsorge');
    expectEuro(y.zve, '68412.00', 'zvE');
    expectEuro(y.festzusetzendeEstUser, '18760.00', 'ESt');
    expectEuro(y.soliUser, '144.82', 'Soli');
    expectEuro(y.totalBurden, '30455.87', 'Burden');
    expectEuro(y.nettoAnnual, '49544.13', 'Netto');
    expectEuro(y.nettoMonthly, '4128.68', 'monthly');
    expect(y.effectiveBurdenPercent?.percent).toBe('38.07');
  });
  it('2024 and 2025 as in M1; averages', () => {
    expectEuro(r.perYear[1].nettoAnnual, '49956.30', '2024');
    expectEuro(r.perYear[2].nettoAnnual, '49376.95', '2025');
    expectEuro(r.avg_gewinn, '80000.00', 'Gewinn');
    expectEuro(r.avg_est, '17833.33', 'ESt');
    expectEuro(r.avg_soli, '48.27', 'Soli');
    expectEuro(r.avg_kv, '10000.35', 'KV');
    expectEuro(r.avg_pv, '2492.25', 'PV');
    expectEuro(r.avg_burden, '30374.21', 'Burden');
    expectEuro(r.avg_netto, '49625.79', 'Dreijahres-Netto');
    expectEuro(r.avg_monthly, '4135.48', 'monthly');
    expect(r.avg_effective?.percent).toBe('37.97');
  });
  it('default average years are 2023–2025', () => {
    expect(DEFAULT_AVERAGE_YEARS).toEqual([2023, 2024, 2025]);
  });
});

describe('M3 — 2023–2025, Steuerbescheid override on 2023 (SPEC 11.4)', () => {
  const r = avgOf([
    { year: 2023, gewinn: 80000, override_est: 18500, override_soli: 0, override_kist: 0 },
    { year: 2024, gewinn: 80000 },
    { year: 2025, gewinn: 80000 },
  ]);
  it('2023 uses override taxes; socials unchanged; calculated figures kept', () => {
    const y = r.perYear[0];
    expect(y.overrideUsed).toBe(true);
    expectEuro(y.kvCash, '9336.60', 'KV');
    expectEuro(y.pvCash, '2214.45', 'PV');
    expectEuro(y.festzusetzendeEstUser, '18500.00', 'ESt override');
    expectEuro(y.soliUser, '0.00', 'Soli override');
    expectEuro(y.kistUser, '0.00', 'KiSt override');
    expectEuro(y.festzusetzendeEstUserCalculated, '18760.00', 'calculated ESt');
    expectEuro(y.soliUserCalculated, '144.82', 'calculated Soli');
    expectEuro(y.totalBurden, '30051.05', 'Burden');
    expectEuro(y.nettoAnnual, '49948.95', 'Netto');
  });
  it('2024 and 2025 have no override; averages', () => {
    expect(r.perYear[1].overrideUsed).toBe(false);
    expect(r.perYear[2].overrideUsed).toBe(false);
    expectEuro(r.perYear[1].nettoAnnual, '49956.30', '2024');
    expectEuro(r.perYear[2].nettoAnnual, '49376.95', '2025');
    expectEuro(r.avg_est, '17746.67', 'ESt');
    expectEuro(r.avg_soli, '0.00', 'Soli');
    expectEuro(r.avg_kv, '10000.35', 'KV');
    expectEuro(r.avg_pv, '2492.25', 'PV');
    expectEuro(r.avg_burden, '30239.27', 'Burden');
    expectEuro(r.avg_netto, '49760.73', 'Dreijahres-Netto');
    expectEuro(r.avg_monthly, '4146.73', 'monthly');
    expect(r.avg_effective?.percent).toBe('37.80');
  });
  it('average Netto is 134.94 € higher than M2', () => {
    const m2 = avgOf([
      { year: 2023, gewinn: 80000 },
      { year: 2024, gewinn: 80000 },
      { year: 2025, gewinn: 80000 },
    ]);
    expect(r.avg_netto.cents - m2.avg_netto.cents).toBe(13494);
  });
});

describe('M4 — 2023–2025, varying profits 50_000 / 80_000 / 120_000 (SPEC 11.4)', () => {
  const r = avgOf([
    { year: 2023, gewinn: 50000 },
    { year: 2024, gewinn: 80000 },
    { year: 2025, gewinn: 120000 },
  ]);
  it('2023, Gewinn 50_000', () => {
    const y = r.perYear[0];
    expectEuro(y.kvPvBemessung!, '50000.00', 'Bemessung');
    expect(y.kvPvBemessungNote).toBe('income');
    expectEuro(y.kvCash, '7800.00', 'KV');
    expectEuro(y.pvCash, '1850.00', 'PV');
    expectEuro(y.vorsorge, '9650.00', 'Vorsorge');
    expectEuro(y.zve, '40314.00', 'zvE');
    expectEuro(y.festzusetzendeEstUser, '7933.00', 'ESt');
    expectEuro(y.soliUser, '0.00', 'Soli');
    expectEuro(y.totalBurden, '17583.00', 'Burden');
    expectEuro(y.nettoAnnual, '32417.00', 'Netto');
  });
  it('2024 as in M1; 2025 at 120_000', () => {
    expectEuro(r.perYear[1].nettoAnnual, '49956.30', '2024');
    const y = r.perYear[2];
    expect(y.year).toBe(2025);
    expectEuro(y.kvPvBemessung!, '66150.00', 'Bemessung');
    expectEuro(y.kvCash, '10914.75', 'KV');
    expectEuro(y.pvCash, '2778.30', 'PV');
    expectEuro(y.vorsorge, '13693.05', 'Vorsorge');
    expectEuro(y.zve, '106270.00', 'zvE');
    expectEuro(y.festzusetzendeEstUser, '33721.00', 'ESt');
    expectEuro(y.soliUser, '1638.74', 'Soli');
    expectEuro(y.totalBurden, '49052.79', 'Burden');
    expectEuro(y.nettoAnnual, '70947.21', 'Netto');
  });
  it('averages', () => {
    expectEuro(r.avg_gewinn, '83333.33', 'Gewinn');
    expectEuro(r.avg_est, '19821.33', 'ESt');
    expectEuro(r.avg_soli, '546.25', 'Soli');
    expectEuro(r.avg_kv, '9488.15', 'KV');
    expectEuro(r.avg_pv, '2370.77', 'PV');
    expectEuro(r.avg_burden, '32226.50', 'Burden');
    expectEuro(r.avg_netto, '51106.84', 'Dreijahres-Netto');
    expectEuro(r.avg_monthly, '4258.90', 'monthly');
    expect(r.avg_effective?.percent).toBe('38.67');
  });
});

describe('calculateNettoAverage rejection (SPEC 11.3)', () => {
  it('rejects a list that is not three consecutive supported years', () => {
    const two = calculateNettoAverage([defaultInput({ year: 2024, gewinn: 80000 }), defaultInput({ year: 2025, gewinn: 80000 })]);
    expect(two.ok).toBe(false);
    const gap = calculateNettoAverage([
      defaultInput({ year: 2023, gewinn: 80000 }),
      defaultInput({ year: 2024, gewinn: 80000 }),
      defaultInput({ year: 2026, gewinn: 80000 }),
    ]);
    expect(gap.ok).toBe(false);
    const future = calculateNettoAverage([
      defaultInput({ year: 2025, gewinn: 80000 }),
      defaultInput({ year: 2026, gewinn: 80000 }),
      defaultInput({ year: 2027, gewinn: 80000 }),
    ]);
    expect(future.ok).toBe(false);
  });
});
