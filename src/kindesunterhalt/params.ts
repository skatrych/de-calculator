/**
 * Year-keyed Düsseldorfer Tabelle data (SPEC Section 4 and 9).
 * Official amounts transcribed from the OLG Düsseldorf PDF, Stand 01.01.2026.
 * Stored as decimal strings — never IEEE-754 floats.
 */
import { d, type Decimal } from '../netto/money.ts';

export const SUPPORTED_UNTERHALT_YEARS = [2026] as const;
export type UnterhaltYear = (typeof SUPPORTED_UNTERHALT_YEARS)[number];
export const DEFAULT_UNTERHALT_YEAR: UnterhaltYear = 2026;

export type Altersstufe = '0-5' | '6-11' | '12-17' | '18+';
export const ALTERSSTUFEN: Altersstufe[] = ['0-5', '6-11', '12-17', '18+'];

export interface IncomeGroup {
  group: number;
  min: Decimal;
  max: Decimal;
  percent: number;
  bedarf: Record<Altersstufe, Decimal>;
  zahlbetrag: Record<Altersstufe, Decimal>;
  /** Groups 2–15. Group 1 uses the erwerbstätig-specific fields. */
  bedarfskontrollbetrag?: Decimal;
  bkbErwerbstaetig?: Decimal;
  bkbNichtErwerbstaetig?: Decimal;
}

export interface YearTable {
  year: UnterhaltYear;
  kindergeld: Decimal;
  groups: IncomeGroup[];
  studentBedarf: Decimal;
  studentWarmmieteIncluded: Decimal;
  selbstbehalt: {
    notwendigErwerbstaetig: Decimal;
    notwendigNichtErwerbstaetig: Decimal;
    notwendigWarmmieteIncluded: Decimal;
    angemessen: Decimal;
    angemessenWarmmieteIncluded: Decimal;
  };
}

function stufen(b05: string, b611: string, b1217: string, b18: string): Record<Altersstufe, Decimal> {
  return { '0-5': d(b05), '6-11': d(b611), '12-17': d(b1217), '18+': d(b18) };
}

function grp(
  group: number,
  min: string,
  max: string,
  percent: number,
  bedarf: [string, string, string, string],
  zahlbetrag: [string, string, string, string],
  bkb: string | { erwerb: string; nicht: string },
): IncomeGroup {
  const g: IncomeGroup = {
    group,
    min: d(min),
    max: d(max),
    percent,
    bedarf: stufen(...bedarf),
    zahlbetrag: stufen(...zahlbetrag),
  };
  if (typeof bkb === 'string') {
    g.bedarfskontrollbetrag = d(bkb);
  } else {
    g.bkbErwerbstaetig = d(bkb.erwerb);
    g.bkbNichtErwerbstaetig = d(bkb.nicht);
  }
  return g;
}

const TABLE_2026: YearTable = {
  year: 2026,
  kindergeld: d('259'),
  studentBedarf: d('990'),
  studentWarmmieteIncluded: d('440'),
  selbstbehalt: {
    notwendigErwerbstaetig: d('1450'),
    notwendigNichtErwerbstaetig: d('1200'),
    notwendigWarmmieteIncluded: d('520'),
    angemessen: d('1750'),
    angemessenWarmmieteIncluded: d('650'),
  },
  groups: [
    grp(1, '0', '2100', 100, ['486', '558', '653', '698'], ['356.50', '428.50', '523.50', '439.00'], {
      erwerb: '1450',
      nicht: '1200',
    }),
    grp(2, '2101', '2500', 105, ['511', '586', '686', '733'], ['381.50', '456.50', '556.50', '474.00'], '1750'),
    grp(3, '2501', '2900', 110, ['535', '614', '719', '768'], ['405.50', '484.50', '589.50', '509.00'], '1850'),
    grp(4, '2901', '3300', 115, ['559', '642', '751', '803'], ['429.50', '512.50', '621.50', '544.00'], '1950'),
    grp(5, '3301', '3700', 120, ['584', '670', '784', '838'], ['454.50', '540.50', '654.50', '579.00'], '2050'),
    grp(6, '3701', '4100', 128, ['623', '715', '836', '894'], ['493.50', '585.50', '706.50', '635.00'], '2150'),
    grp(7, '4101', '4500', 136, ['661', '759', '889', '950'], ['531.50', '629.50', '759.50', '691.00'], '2250'),
    grp(8, '4501', '4900', 144, ['700', '804', '941', '1006'], ['570.50', '674.50', '811.50', '747.00'], '2350'),
    grp(9, '4901', '5300', 152, ['739', '849', '993', '1061'], ['609.50', '719.50', '863.50', '802.00'], '2450'),
    grp(10, '5301', '5700', 160, ['778', '893', '1045', '1117'], ['648.50', '763.50', '915.50', '858.00'], '2550'),
    grp(11, '5701', '6400', 168, ['817', '938', '1098', '1173'], ['687.50', '808.50', '968.50', '914.00'], '2850'),
    grp(12, '6401', '7200', 176, ['856', '983', '1150', '1229'], ['726.50', '853.50', '1020.50', '970.00'], '3250'),
    grp(13, '7201', '8200', 184, ['895', '1027', '1202', '1285'], ['765.50', '897.50', '1072.50', '1026.00'], '3750'),
    grp(14, '8201', '9700', 192, ['934', '1072', '1254', '1341'], ['804.50', '942.50', '1124.50', '1082.00'], '4350'),
    grp(15, '9701', '11200', 200, ['972', '1116', '1306', '1396'], ['842.50', '986.50', '1176.50', '1137.00'], '5050'),
  ],
};

export const YEAR_TABLES: Record<UnterhaltYear, YearTable> = {
  2026: TABLE_2026,
};

export function isUnterhaltYear(year: number): year is UnterhaltYear {
  return (SUPPORTED_UNTERHALT_YEARS as readonly number[]).includes(year);
}

export function getYearTable(year: number): YearTable {
  if (!isUnterhaltYear(year)) {
    throw new Error(
      `Kein Tabellenjahr ${year}. Unterstützte Jahre: ${SUPPORTED_UNTERHALT_YEARS.join(', ')}.`,
    );
  }
  return YEAR_TABLES[year];
}

export function bkbOf(group: IncomeGroup, erwerbstaetig: boolean): Decimal {
  if (group.group === 1) {
    return erwerbstaetig ? group.bkbErwerbstaetig! : group.bkbNichtErwerbstaetig!;
  }
  return group.bedarfskontrollbetrag!;
}

export function groupByNumber(table: YearTable, n: number): IncomeGroup {
  const g = table.groups.find((x) => x.group === n);
  if (!g) throw new Error(`Unbekannte Einkommensgruppe ${n}.`);
  return g;
}

/** SPEC 6.2: unique group whose bracket contains N. N ≤ 0 → 1; N > table max → 15. */
export function groupForIncome(table: YearTable, income: Decimal): { group: IncomeGroup; incomeAboveTable: boolean } {
  const top = table.groups[table.groups.length - 1];
  if (income.lte(0)) return { group: table.groups[0], incomeAboveTable: false };
  if (income.gt(top.max)) return { group: top, incomeAboveTable: true };
  const g = table.groups.find((x) => income.gte(x.min) && income.lte(x.max));
  if (!g) throw new Error(`Keine Einkommensgruppe für ${income.toString()}.`);
  return { group: g, incomeAboveTable: false };
}

export function altersstufe(ageYears: number): Altersstufe {
  if (ageYears <= 5) return '0-5';
  if (ageYears <= 11) return '6-11';
  if (ageYears <= 17) return '12-17';
  return '18+';
}
