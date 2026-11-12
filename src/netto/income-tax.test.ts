import { describe, expect, it } from 'vitest';
import { d, floorEuro, toMoney } from './money.ts';
import { resolveYearParams } from './params.ts';
import { tariff, tariffSplitting, soliOn } from './income-tax.ts';

describe('§ 32a tariff 2026 Grundtarif (SPEC 11.1)', () => {
  const p = resolveYearParams(2026);
  const cases: [number, number, string, number][] = [
    [0, 1, '0', 0],
    [12348, 1, '0', 0],
    [12349, 2, '0.1400091451', 0],
    [17799, 2, '1034.8720234851', 1034],
    [17800, 3, '1035.1097017310', 1035],
    [30000, 3, '4217.1339781310', 4217],
    [50000, 3, '10548.3312181310', 10548],
    [69878, 3, '18213.0629991710', 18213],
    [69879, 4, '18213.55', 18213],
    [80000, 4, '22464.37', 22464],
    [100000, 4, '30864.37', 30864],
    [105246, 4, '33067.69', 33067],
    [277825, 4, '105550.87', 105550],
    [277826, 5, '105551.32', 105551],
    [400000, 5, '160529.62', 160529],
  ];

  for (const [zve, zone, rawExpected, est] of cases) {
    it(`zvE ${zve} → zone ${zone}, ESt ${est}`, () => {
      const r = tariff(d(zve), p);
      expect(r.zone).toBe(zone);
      expect(r.est.eq(est)).toBe(true);
      const places = rawExpected.includes('.') ? rawExpected.split('.')[1].length : 0;
      expect(r.raw.toFixed(places)).toBe(d(rawExpected).toFixed(places));
    });
  }
});

describe('§ 32a tariff 2026 Splitting (SPEC 11.1)', () => {
  const p = resolveYearParams(2026);
  it('joint 80_000 → 14_418', () => {
    const r = tariffSplitting(d(80000), p);
    expect(r.half.eq(40000)).toBe(true);
    expect(r.est.eq(14418)).toBe(true);
    expect(tariff(d(40000), p).est.eq(7209)).toBe(true);
  });
  it('joint 160_000 → 44_928', () => {
    const r = tariffSplitting(d(160000), p);
    expect(r.half.eq(80000)).toBe(true);
    expect(r.est.eq(44928)).toBe(true);
  });
});

describe('§ 32a tariff 2025 Grundtarif (SPEC 11.1)', () => {
  const p = resolveYearParams(2025);
  const cases: [number, number, string, number][] = [
    [0, 1, '0', 0],
    [12096, 1, '0', 0],
    [12097, 2, '0.1400093230', 0],
    [17443, 2, '1015.1283831070', 1015],
    [17444, 3, '1015.3697017664', 1015],
    [30000, 3, '4303.5657590336', 4303],
    [50000, 3, '10691.3531510336', 10691],
    [68480, 3, '17849.7741118016', 17849],
    [68481, 4, '17850.10', 17850],
    [80000, 4, '22688.08', 22688],
    [277825, 4, '105774.58', 105774],
    [277826, 5, '105775.03', 105775],
    [400000, 5, '160753.33', 160753],
  ];

  for (const [zve, zone, rawExpected, est] of cases) {
    it(`zvE ${zve} → zone ${zone}, ESt ${est}`, () => {
      const r = tariff(d(zve), p);
      expect(r.zone).toBe(zone);
      expect(r.est.eq(est)).toBe(true);
      const places = rawExpected.includes('.') ? rawExpected.split('.')[1].length : 0;
      expect(r.raw.toFixed(places)).toBe(d(rawExpected).toFixed(places));
    });
  }
});

describe('§ 32a tariff 2025 Splitting (SPEC 11.1)', () => {
  const p = resolveYearParams(2025);
  it('joint 80_000 → 14_640', () => {
    expect(tariffSplitting(d(80000), p).est.eq(14640)).toBe(true);
  });
  it('joint 160_000 → 45_376', () => {
    expect(tariffSplitting(d(160000), p).est.eq(45376)).toBe(true);
  });
});

describe('isolated Soli 2026 single, no children (SPEC 11.1)', () => {
  const p = resolveYearParams(2026);
  it('ESt 20_350 → 0 (does not exceed Freigrenze)', () => {
    expect(soliOn(d(20350), p, false).eq(0)).toBe(true);
  });
  it('ESt 20_351 → 0.11', () => {
    expect(toMoney(soliOn(d(20351), p, false)).euros).toBe('0.11');
  });
  it('ESt 33_067 → 1_513.32 (Milderung)', () => {
    expect(toMoney(soliOn(d(33067), p, false)).euros).toBe('1513.32');
  });
  it('ESt 37_839 → 2_081.14 (full 5.5 %)', () => {
    expect(toMoney(soliOn(d(37839), p, false)).euros).toBe('2081.14');
  });
  it('ESt 153_890 → 8_463.95', () => {
    expect(toMoney(soliOn(d(153890), p, false)).euros).toBe('8463.95');
  });
});

describe('tariff floors zvE first', () => {
  const p = resolveYearParams(2026);
  it('non-integer zvE is floored before the formula', () => {
    const a = tariff(d('80000.99'), p);
    const b = tariff(d(80000), p);
    expect(a.est.eq(b.est)).toBe(true);
    expect(floorEuro(d('80000.99')).eq(80000)).toBe(true);
  });
});

describe('§ 32a tariff 2024 Grundtarif (SPEC 11.1)', () => {
  const p = resolveYearParams(2024);
  const cases: [number, number, string, number][] = [
    [0, 1, '0', 0],
    [11784, 1, '0', 0],
    [11785, 2, '0.1400095480', 0],
    [17005, 2, '991.2074138680', 991],
    [17006, 3, '991.4497018119', 991],
    [30000, 3, '4412.0870982975', 4412],
    [50000, 3, '10872.6727182975', 10872],
    [66760, 3, '17402.9507092975', 17402],
    [66761, 4, '17403.31', 17403],
    [80000, 4, '22963.69', 22963],
    [277825, 4, '106050.19', 106050],
    [277826, 5, '106050.64', 106050],
    [400000, 5, '161028.94', 161028],
  ];
  for (const [zve, zone, rawExpected, est] of cases) {
    it(`zvE ${zve} → zone ${zone}, ESt ${est}`, () => {
      const r = tariff(d(zve), p);
      expect(r.zone).toBe(zone);
      expect(r.est.eq(est)).toBe(true);
      const places = rawExpected.includes('.') ? rawExpected.split('.')[1].length : 0;
      expect(r.raw.toFixed(places)).toBe(d(rawExpected).toFixed(places));
    });
  }
});

describe('§ 32a tariff 2024 Splitting (SPEC 11.1)', () => {
  const p = resolveYearParams(2024);
  it('joint 80_000 → 14_922', () => {
    expect(tariffSplitting(d(80000), p).est.eq(14922)).toBe(true);
  });
  it('joint 160_000 → 45_926', () => {
    expect(tariffSplitting(d(160000), p).est.eq(45926)).toBe(true);
  });
});

describe('§ 32a tariff 2023 Grundtarif (SPEC 11.1)', () => {
  const p = resolveYearParams(2023);
  const cases: [number, number, string, number][] = [
    [0, 1, '0', 0],
    [10908, 1, '0', 0],
    [10909, 2, '0.1400097918', 0],
    [15999, 2, '966.5266238958', 966],
    [16000, 3, '966.7697019259', 966],
    [30000, 3, '4700.1000271259', 4700],
    [50000, 3, '11343.0410631259', 11343],
    [62809, 3, '16406.87305099', 16406],
    [62810, 4, '16407.22', 16407],
    [80000, 4, '23627.02', 23627],
    [277825, 4, '106713.52', 106713],
    [277826, 5, '106713.97', 106713],
    [400000, 5, '161692.27', 161692],
  ];
  for (const [zve, zone, rawExpected, est] of cases) {
    it(`zvE ${zve} → zone ${zone}, ESt ${est}`, () => {
      const r = tariff(d(zve), p);
      expect(r.zone).toBe(zone);
      expect(r.est.eq(est)).toBe(true);
      const places = rawExpected.includes('.') ? rawExpected.split('.')[1].length : 0;
      expect(r.raw.toFixed(places)).toBe(d(rawExpected).toFixed(places));
    });
  }
});

describe('§ 32a tariff 2023 Splitting (SPEC 11.1)', () => {
  const p = resolveYearParams(2023);
  it('joint 80_000 → 15_656', () => {
    expect(tariffSplitting(d(80000), p).est.eq(15656)).toBe(true);
  });
  it('joint 160_000 → 47_254', () => {
    expect(tariffSplitting(d(160000), p).est.eq(47254)).toBe(true);
  });
});

describe('isolated Soli 2023 and 2024 (SPEC 11.1)', () => {
  it('2023: ESt 17_543 → 0; ESt 18_760 → 144.82 (Milderung)', () => {
    const p = resolveYearParams(2023);
    expect(soliOn(d(17543), p, false).eq(0)).toBe(true);
    expect(toMoney(soliOn(d(18760), p, false)).euros).toBe('144.82');
  });
  it('2024: ESt 17_810 → 0; ESt 18_130 → 0; ESt 18_131 → 0.11', () => {
    const p = resolveYearParams(2024);
    expect(soliOn(d(17810), p, false).eq(0)).toBe(true);
    expect(soliOn(d(18130), p, false).eq(0)).toBe(true);
    expect(toMoney(soliOn(d(18131), p, false)).euros).toBe('0.11');
  });
});
