/**
 * All year-dependent legal parameters in ONE file (SPEC Section 7, 7.10 and 10).
 *
 * A yearly update adds a new block (and golden tests). The calculation
 * pipeline must not need changes. Values are the official figures from
 * the SPEC; do not recompute Höchstbeträge at runtime.
 *
 * For 2023–2024 the block includes West and Ost Bezugsgröße and RV-BBG;
 * resolveYearParams picks the Rechtskreis. From 2025 those figures are
 * nationwide (West and Ost blocks are identical).
 *
 * To add a year (once enacted): copy a YearParams block, fill every field,
 * add it to YEAR_PARAMS and SUPPORTED_YEARS, and extend the golden tests.
 */
import { d, type Decimal } from './money.ts';

export const SUPPORTED_YEARS = [2023, 2024, 2025, 2026] as const;
export type TaxYear = (typeof SUPPORTED_YEARS)[number];

/** Default year in Einzeljahr mode (SPEC Section 4). */
export const DEFAULT_YEAR: TaxYear = 2026;

/**
 * Default Dreijahresdurchschnitt: the last three closed years as of the
 * SPEC date 2026-11-12 (Section 3).
 */
export const DEFAULT_AVERAGE_YEARS: readonly [TaxYear, TaxYear, TaxYear] = [2023, 2024, 2025];

export type Rechtskreis = 'west' | 'ost';
export const DEFAULT_RECHTSKREIS: Rechtskreis = 'west';

/** Bezugsgröße, RV-BBG and derived contributions that differed West/Ost until 2024. */
export interface RechtskreisGroessen {
  bezugsgrößeAnnual: Decimal;
  bezugsgrößeMonthly: Decimal;
  /** Exact: Bezugsgröße / 3. */
  kvMinAnnual: Decimal;
  kvMinMonthlyDisplay: Decimal;
  rvBbgAnnual: Decimal;
  rvBbgMonthly: Decimal;
  regelbeitragMonthly: Decimal;
  rvMaxMonthly: Decimal;
  avFullMonthly: Decimal;
  avAnlaufMonthly: Decimal;
}

/** PV rate schedule for one period (a full year, or one half of 2023). */
export interface PvSchedule {
  baseRate: Decimal;
  childlessSurcharge: Decimal;
  /** 0 when the Abschlag does not apply (2023 H1). */
  abschlagPerChild: Decimal;
  abschlagMaxChildren: number;
}

export interface YearParams {
  year: TaxYear;

  // --- Einkommensteuer, § 32a EStG ---
  grundfreibetrag: Decimal;
  zone2To: Decimal;
  zone3To: Decimal;
  zone4To: Decimal;
  zone2Coeff: Decimal;
  zone3Coeff: Decimal;
  zone3Offset: Decimal;
  zone4Subtract: Decimal;
  zone5Subtract: Decimal;

  // --- Solidaritätszuschlag ---
  soliRate: Decimal;
  soliMilderung: Decimal;
  soliFreigrenzeSingle: Decimal;
  soliFreigrenzeJoint: Decimal;

  // --- Sonderausgaben / Vorsorge ---
  alterCapSingle: Decimal;
  alterCapJoint: Decimal;
  sonstigeVorsorgeCap: Decimal;
  pauschbetragSingle: Decimal;
  pauschbetragJoint: Decimal;
  kfbOneParent: Decimal;
  kfbBothParents: Decimal;

  // --- Gewerbesteuer ---
  gewerbeFreibetrag: Decimal;
  steuermesszahl: Decimal;
  section35Multiplier: Decimal;
  defaultHebesatz: Decimal;

  // --- GKV (nationwide, including KV-BBG / JAEG) ---
  kvGeneralRate: Decimal;
  kvReducedRate: Decimal;
  /** Official BMG average Zusatzbeitrag as a fraction, e.g. 0.029 for 2.9 %. */
  zusatzbeitragDefault: Decimal;
  kvPvBbgAnnual: Decimal;
  kvPvBbgMonthly: Decimal;

  // --- PV ---
  /** One schedule for a stable year; two (H1, H2) for 2023, averaged 6/12+6/12. */
  pvSchedules: readonly [PvSchedule] | readonly [PvSchedule, PvSchedule];

  // --- RV / AV nationwide ---
  rvRate: Decimal;
  /** Geringfügigkeitsgrenze × 18.6 %; nationwide. */
  rvMinMonthly: Decimal;
  avRate: Decimal;

  // --- Rechtskreis (identical West/Ost from 2025) ---
  west: RechtskreisGroessen;
  ost: RechtskreisGroessen;
}

/** Flat parameters after the Rechtskreis has been applied. */
export type ResolvedYearParams = Omit<YearParams, 'west' | 'ost'> & RechtskreisGroessen;

function pv(base: string, surcharge: string, abschlag: string): PvSchedule {
  return {
    baseRate: d(base),
    childlessSurcharge: d(surcharge),
    abschlagPerChild: d(abschlag),
    abschlagMaxChildren: 5,
  };
}

function rk(g: {
  bezugsgrößeAnnual: number;
  bezugsgrößeMonthly: number;
  kvMinAnnual: number;
  kvMinMonthlyDisplay: string;
  rvBbgAnnual: number;
  rvBbgMonthly: number;
  regelbeitragMonthly: string;
  rvMaxMonthly: string;
  avFullMonthly: string;
  avAnlaufMonthly: string;
}): RechtskreisGroessen {
  return {
    bezugsgrößeAnnual: d(g.bezugsgrößeAnnual),
    bezugsgrößeMonthly: d(g.bezugsgrößeMonthly),
    kvMinAnnual: d(g.kvMinAnnual),
    kvMinMonthlyDisplay: d(g.kvMinMonthlyDisplay),
    rvBbgAnnual: d(g.rvBbgAnnual),
    rvBbgMonthly: d(g.rvBbgMonthly),
    regelbeitragMonthly: d(g.regelbeitragMonthly),
    rvMaxMonthly: d(g.rvMaxMonthly),
    avFullMonthly: d(g.avFullMonthly),
    avAnlaufMonthly: d(g.avAnlaufMonthly),
  };
}

function params2023(): YearParams {
  return {
    year: 2023,
    grundfreibetrag: d(10908),
    zone2To: d(15999),
    zone3To: d(62809),
    zone4To: d(277825),
    zone2Coeff: d('979.18'),
    zone3Coeff: d('192.59'),
    zone3Offset: d('966.53'),
    zone4Subtract: d('9972.98'),
    zone5Subtract: d('18307.73'),

    soliRate: d('0.055'),
    soliMilderung: d('0.119'),
    soliFreigrenzeSingle: d(17543),
    soliFreigrenzeJoint: d(35086),

    alterCapSingle: d(26528),
    alterCapJoint: d(53056),
    sonstigeVorsorgeCap: d(2800),
    pauschbetragSingle: d(36),
    pauschbetragJoint: d(72),
    kfbOneParent: d(4476),
    kfbBothParents: d(8952),

    gewerbeFreibetrag: d(24500),
    steuermesszahl: d('0.035'),
    section35Multiplier: d(4),
    defaultHebesatz: d(400),

    kvGeneralRate: d('0.146'),
    kvReducedRate: d('0.140'),
    zusatzbeitragDefault: d('0.016'),
    kvPvBbgAnnual: d(59850),
    kvPvBbgMonthly: d('4987.50'),

    // H1 pre-PUEG (no Abschlag); H2 PUEG from 1 July. Annual = (H1+H2)/2.
    pvSchedules: [
      pv('0.0305', '0.0035', '0'),
      pv('0.0340', '0.0060', '0.0025'),
    ],

    rvRate: d('0.186'),
    rvMinMonthly: d('96.72'),
    avRate: d('0.026'),

    west: rk({
      bezugsgrößeAnnual: 40740,
      bezugsgrößeMonthly: 3395,
      kvMinAnnual: 13580,
      kvMinMonthlyDisplay: '1131.67',
      rvBbgAnnual: 87600,
      rvBbgMonthly: 7300,
      regelbeitragMonthly: '631.47',
      rvMaxMonthly: '1357.80',
      avFullMonthly: '88.27',
      avAnlaufMonthly: '44.14',
    }),
    ost: rk({
      bezugsgrößeAnnual: 39480,
      bezugsgrößeMonthly: 3290,
      kvMinAnnual: 13160,
      kvMinMonthlyDisplay: '1096.67',
      rvBbgAnnual: 85200,
      rvBbgMonthly: 7100,
      regelbeitragMonthly: '611.94',
      rvMaxMonthly: '1320.60',
      avFullMonthly: '85.54',
      avAnlaufMonthly: '42.77',
    }),
  };
}

function params2024(): YearParams {
  return {
    year: 2024,
    grundfreibetrag: d(11784),
    zone2To: d(17005),
    zone3To: d(66760),
    zone4To: d(277825),
    zone2Coeff: d('954.80'),
    zone3Coeff: d('181.19'),
    zone3Offset: d('991.21'),
    zone4Subtract: d('10636.31'),
    zone5Subtract: d('18971.06'),

    soliRate: d('0.055'),
    soliMilderung: d('0.119'),
    soliFreigrenzeSingle: d(18130),
    soliFreigrenzeJoint: d(36260),

    alterCapSingle: d(27566),
    alterCapJoint: d(55132),
    sonstigeVorsorgeCap: d(2800),
    pauschbetragSingle: d(36),
    pauschbetragJoint: d(72),
    kfbOneParent: d(4770),
    kfbBothParents: d(9540),

    gewerbeFreibetrag: d(24500),
    steuermesszahl: d('0.035'),
    section35Multiplier: d(4),
    defaultHebesatz: d(400),

    kvGeneralRate: d('0.146'),
    kvReducedRate: d('0.140'),
    zusatzbeitragDefault: d('0.017'),
    kvPvBbgAnnual: d(62100),
    kvPvBbgMonthly: d(5175),

    pvSchedules: [pv('0.034', '0.006', '0.0025')],

    rvRate: d('0.186'),
    rvMinMonthly: d('100.07'),
    avRate: d('0.026'),

    west: rk({
      bezugsgrößeAnnual: 42420,
      bezugsgrößeMonthly: 3535,
      kvMinAnnual: 14140,
      kvMinMonthlyDisplay: '1178.33',
      rvBbgAnnual: 90600,
      rvBbgMonthly: 7550,
      regelbeitragMonthly: '657.51',
      rvMaxMonthly: '1404.30',
      avFullMonthly: '91.91',
      avAnlaufMonthly: '45.96',
    }),
    ost: rk({
      bezugsgrößeAnnual: 41580,
      bezugsgrößeMonthly: 3465,
      kvMinAnnual: 13860,
      kvMinMonthlyDisplay: '1155.00',
      rvBbgAnnual: 89400,
      rvBbgMonthly: 7450,
      regelbeitragMonthly: '644.49',
      rvMaxMonthly: '1385.70',
      avFullMonthly: '90.09',
      avAnlaufMonthly: '45.05',
    }),
  };
}

function nationwide2025or2026(westLike: RechtskreisGroessen): { west: RechtskreisGroessen; ost: RechtskreisGroessen } {
  // From 2025 the Bezugsgröße is unified; West and Ost are stored identically
  // so every year block has every key.
  return { west: westLike, ost: { ...westLike } };
}

function params2025(): YearParams {
  const unified = nationwide2025or2026(
    rk({
      bezugsgrößeAnnual: 44940,
      bezugsgrößeMonthly: 3745,
      kvMinAnnual: 14980,
      kvMinMonthlyDisplay: '1248.33',
      rvBbgAnnual: 96600,
      rvBbgMonthly: 8050,
      regelbeitragMonthly: '696.57',
      rvMaxMonthly: '1497.30',
      avFullMonthly: '97.37',
      avAnlaufMonthly: '48.69',
    }),
  );
  return {
    year: 2025,
    grundfreibetrag: d(12096),
    zone2To: d(17443),
    zone3To: d(68480),
    zone4To: d(277825),
    zone2Coeff: d('932.30'),
    zone3Coeff: d('176.64'),
    zone3Offset: d('1015.13'),
    zone4Subtract: d('10911.92'),
    zone5Subtract: d('19246.67'),

    soliRate: d('0.055'),
    soliMilderung: d('0.119'),
    soliFreigrenzeSingle: d(19950),
    soliFreigrenzeJoint: d(39900),

    alterCapSingle: d(29344),
    alterCapJoint: d(58688),
    sonstigeVorsorgeCap: d(2800),
    pauschbetragSingle: d(36),
    pauschbetragJoint: d(72),
    kfbOneParent: d(4800),
    kfbBothParents: d(9600),

    gewerbeFreibetrag: d(24500),
    steuermesszahl: d('0.035'),
    section35Multiplier: d(4),
    defaultHebesatz: d(400),

    kvGeneralRate: d('0.146'),
    kvReducedRate: d('0.140'),
    zusatzbeitragDefault: d('0.025'),
    kvPvBbgAnnual: d(66150),
    kvPvBbgMonthly: d('5512.50'),

    pvSchedules: [pv('0.036', '0.006', '0.0025')],

    rvRate: d('0.186'),
    rvMinMonthly: d('103.42'),
    avRate: d('0.026'),

    ...unified,
  };
}

function params2026(): YearParams {
  const unified = nationwide2025or2026(
    rk({
      bezugsgrößeAnnual: 47460,
      bezugsgrößeMonthly: 3955,
      kvMinAnnual: 15820,
      kvMinMonthlyDisplay: '1318.33',
      rvBbgAnnual: 101400,
      rvBbgMonthly: 8450,
      regelbeitragMonthly: '735.63',
      rvMaxMonthly: '1571.70',
      avFullMonthly: '102.83',
      avAnlaufMonthly: '51.42',
    }),
  );
  return {
    year: 2026,
    grundfreibetrag: d(12348),
    zone2To: d(17799),
    zone3To: d(69878),
    zone4To: d(277825),
    zone2Coeff: d('914.51'),
    zone3Coeff: d('173.10'),
    zone3Offset: d('1034.87'),
    zone4Subtract: d('11135.63'),
    zone5Subtract: d('19470.38'),

    soliRate: d('0.055'),
    soliMilderung: d('0.119'),
    soliFreigrenzeSingle: d(20350),
    soliFreigrenzeJoint: d(40700),

    alterCapSingle: d(30826),
    alterCapJoint: d(61652),
    sonstigeVorsorgeCap: d(2800),
    pauschbetragSingle: d(36),
    pauschbetragJoint: d(72),
    kfbOneParent: d(4878),
    kfbBothParents: d(9756),

    gewerbeFreibetrag: d(24500),
    steuermesszahl: d('0.035'),
    section35Multiplier: d(4),
    defaultHebesatz: d(400),

    kvGeneralRate: d('0.146'),
    kvReducedRate: d('0.140'),
    zusatzbeitragDefault: d('0.029'),
    kvPvBbgAnnual: d(69750),
    kvPvBbgMonthly: d('5812.50'),

    pvSchedules: [pv('0.036', '0.006', '0.0025')],

    rvRate: d('0.186'),
    rvMinMonthly: d('112.16'),
    avRate: d('0.026'),

    ...unified,
  };
}

export const YEAR_PARAMS: Record<TaxYear, YearParams> = {
  2023: params2023(),
  2024: params2024(),
  2025: params2025(),
  2026: params2026(),
};

/**
 * Load the parameter block for a tax year (before Rechtskreis resolution).
 * Throws a clear error if the year is missing — never silently fall back.
 */
export function getYearParams(year: number): YearParams {
  if (isTaxYear(year)) {
    return YEAR_PARAMS[year];
  }
  throw new Error(
    `Kein Parameterblock für das Jahr ${year}. Unterstützte Jahre: ${SUPPORTED_YEARS.join(', ')}.`,
  );
}

/**
 * Apply the West/Ost Rechtskreis. From 2025 the figures are nationwide
 * (the selector is ignored). Default Rechtskreis: West.
 */
export function resolveYearParams(year: number, rechtskreis: Rechtskreis = DEFAULT_RECHTSKREIS): ResolvedYearParams {
  const block = getYearParams(year);
  const rkChosen = block.year <= 2024 ? (rechtskreis === 'ost' ? block.ost : block.west) : block.west;
  const rest = { ...block };
  delete (rest as { west?: unknown }).west;
  delete (rest as { ost?: unknown }).ost;
  return { ...rest, ...rkChosen };
}

export function isTaxYear(year: number): year is TaxYear {
  return (SUPPORTED_YEARS as readonly number[]).includes(year);
}

/** Whether the Rechtskreis still affects Bezugsgröße / RV-BBG. */
export function rechtskreisApplies(year: number): boolean {
  return year === 2023 || year === 2024;
}

/** All top-level keys a year block must have (for the completeness test). */
export const YEAR_PARAM_KEYS = Object.keys(YEAR_PARAMS[DEFAULT_YEAR]).sort() as (keyof YearParams)[];

export const RECHTSKREIS_GROESSEN_KEYS = Object.keys(YEAR_PARAMS[2023].west).sort() as (keyof RechtskreisGroessen)[];

export const BUNDESLAENDER = [
  'Baden-Württemberg',
  'Bayern',
  'Berlin',
  'Brandenburg',
  'Bremen',
  'Hamburg',
  'Hessen',
  'Mecklenburg-Vorpommern',
  'Niedersachsen',
  'Nordrhein-Westfalen',
  'Rheinland-Pfalz',
  'Saarland',
  'Sachsen',
  'Sachsen-Anhalt',
  'Schleswig-Holstein',
  'Thüringen',
] as const;

export type Bundesland = (typeof BUNDESLAENDER)[number];

export const DEFAULT_BUNDESLAND: Bundesland = 'Nordrhein-Westfalen';

/** 8 % in Bayern and Baden-Württemberg, 9 % elsewhere (SPEC Section 7.3). */
export function churchTaxRate(land: Bundesland): Decimal {
  if (land === 'Bayern' || land === 'Baden-Württemberg') {
    return d('0.08');
  }
  return d('0.09');
}

export const CONSTANTS = {
  zone2Linear: d(1400),
  zone3Linear: d(2397),
  zone4Rate: d('0.42'),
  zone5Rate: d('0.45'),
  krankengeldDeductibleShare: d('0.96'),
  maxChildrenInput: 20,
  averageYearCount: 3,
} as const;
