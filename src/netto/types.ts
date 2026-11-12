/**
 * Public typed API of the net-income calculation.
 * Kindesunterhalt (Düsseldorfer Tabelle) will consume the intermediate
 * breakdown; this module is the contract.
 */
import type { MoneyValue, PercentValue } from './money.ts';
import type { Bundesland, Rechtskreis, TaxYear } from './params.ts';

export type Activity = 'freiberufler' | 'gewerbe';
export type KvType = 'gkv_ermaessigt' | 'gkv_allgemein' | 'pkv';
export type RvMode = 'keine' | 'pflicht' | 'regelbeitrag' | 'freiwillig';
export type AvMode = 'nein' | 'voll' | 'anlaufphase';
export type TaxZone = 1 | 2 | 3 | 4 | 5;

/**
 * Money inputs accept a decimal string (preferred), a whole number, or a Decimal.
 * Callers should prefer strings for non-integer euros to avoid IEEE-754 issues.
 */
export type EuroInput = string | number;

/**
 * Input for a single tax year (SPEC Section 6.11: YearInput).
 * `NettoInput` is kept as an alias of this name.
 */
export interface YearInput {
  year: number;
  /** Annual Gewinn after Betriebsausgaben, before social contributions and tax, net of USt. */
  gewinn: EuroInput;
  /** West / Ost. Only affects 2023 and 2024; ignored from 2025. Default West. */
  rechtskreis?: Rechtskreis;
  /**
   * Steuerbescheid override (SPEC Section 6.12). If any of the three is set,
   * those cash amounts replace the calculated taxes for Netto. Social
   * contributions and GewSt remain calculated. A provided blank Soli/KiSt
   * is 0; an unset ESt keeps the calculated value.
   */
  override_est?: EuroInput;
  override_soli?: EuroInput;
  override_kist?: EuroInput;
  activity: Activity;
  /** Municipal Hebesatz in percent (e.g. 400). Used only for Gewerbe. Default 400. */
  hebesatz?: EuroInput;
  married: boolean;
  /** Already-determined zvE of the spouse, before combining. Default 0. */
  spouseZve?: EuroInput;
  churchTax: boolean;
  /** Sets the church-tax rate (8 % BY/BW, 9 % otherwise). Default NRW. */
  bundesland?: Bundesland;
  childrenUnder25: number;
  /** Parent with only children 25 or older: 3.6 % PV, not the 4.2 % surcharge. */
  elterneigenschaft: boolean;
  age23Plus: boolean;
  /**
   * For Soli (and optional KiSt) base only. Single default is one parent's share;
   * set true to use both. Married: always both shares, this flag is ignored.
   */
  fullKinderfreibetrag: boolean;
  kvType: KvType;
  /** Zusatzbeitrag as a percent, e.g. 2.9 for 2.9 %. Default: official BMG average. */
  zusatzbeitragPercent?: EuroInput;
  pkvPremiumMonthly?: EuroInput;
  pkvBasisMonthly?: EuroInput;
  privatePvMonthly?: EuroInput;
  rvMode: RvMode;
  voluntaryRvMonthly?: EuroInput;
  avMode: AvMode;
  otherSonderausgaben?: EuroInput;
}

export interface ValidationError {
  field: string;
  message: string;
}

/** Intermediate and final results for one year. All money already rounded per SPEC Section 9. */
export interface YearResult {
  year: TaxYear;

  // --- Assessment bases (shown so the user sees a clamp to min or BBG) ---
  /** KV/PV Bemessung; null when PKV (no statutory assessment). */
  kvPvBemessung: MoneyValue | null;
  kvPvBemessungNote: 'minimum' | 'income' | 'bbg' | 'pkv';

  // --- Social insurance: cash outflows and deductible amounts ---
  kvCash: MoneyValue;
  kvDeductible: MoneyValue;
  kvRate: PercentValue | null;
  pvCash: MoneyValue;
  pvDeductible: MoneyValue;
  pvRate: PercentValue;
  rvCash: MoneyValue;
  avCash: MoneyValue;

  // --- Vorsorge and Sonderausgaben ---
  deductAlter: MoneyValue;
  deductBasis: MoneyValue;
  deductSonstige: MoneyValue;
  vorsorge: MoneyValue;
  sonderausgaben: MoneyValue;
  pauschbetrag: MoneyValue;

  // --- Income tax ---
  /** User's zvE, whole euros. */
  zve: MoneyValue;
  zveJoint: MoneyValue;
  taxZone: TaxZone;
  /** Half of joint zvE (floored), when married; otherwise equal to zve. */
  zveForTariff: MoneyValue;
  tariflicheEst: MoneyValue;
  /** Joint tarifliche ESt when married (same as tariflicheEst). */
  tariflicheEstJoint: MoneyValue;
  gewerbesteuerCredit: MoneyValue;
  festzusetzendeEst: MoneyValue;
  festzusetzendeEstUser: MoneyValue;
  soli: MoneyValue;
  soliUser: MoneyValue;
  festSoli: MoneyValue;
  kist: MoneyValue;
  kistUser: MoneyValue;
  kistRate: PercentValue;
  gewerbesteuer: MoneyValue;
  messbetrag: MoneyValue;
  gewerbeertrag: MoneyValue;

  // --- Allocation when married ---
  married: boolean;
  /** User's zvE / joint zvE; 1 if unmarried or joint is 0. */
  taxShare: string;

  // --- Totals ---
  taxes: MoneyValue;
  social: MoneyValue;
  totalBurden: MoneyValue;
  nettoAnnual: MoneyValue;
  nettoMonthly: MoneyValue;

  // --- Rates ---
  /** Null (show „—“) when Gewinn is 0. */
  effectiveBurdenPercent: PercentValue | null;
  marginalBurdenPercent: PercentValue | null;
  /** Zone label: "0 %", "14–23,97 %", "23,97–42 %", "42 %", "45 %". */
  statutoryMarginalRateLabel: string;

  /** Gewinn used, after validation. */
  gewinn: MoneyValue;

  /** True when a Steuerbescheid override is applied to cash ESt/Soli/KiSt. */
  overrideUsed: boolean;
  /** Calculated amounts (before override), always present for the breakdown. */
  festzusetzendeEstUserCalculated: MoneyValue;
  soliUserCalculated: MoneyValue;
  kistUserCalculated: MoneyValue;
}

/** Arithmetic mean of three consecutive years (SPEC Section 6.11). */
export interface MultiYearResult {
  years: TaxYear[];
  perYear: YearResult[];
  /** Headline result: commercial cents of (Netto(Y1)+Netto(Y2)+Netto(Y3))/3. */
  avg_netto: MoneyValue;
  avg_monthly: MoneyValue;
  avg_gewinn: MoneyValue;
  avg_est: MoneyValue;
  avg_soli: MoneyValue;
  avg_kist: MoneyValue;
  avg_gewst: MoneyValue;
  avg_kv: MoneyValue;
  avg_pv: MoneyValue;
  avg_rv: MoneyValue;
  avg_av: MoneyValue;
  avg_burden: MoneyValue;
  /** avg_burden / avg_gewinn × 100; null if avg Gewinn is 0. */
  avg_effective: PercentValue | null;
  /** Marginal burden of the average: each year's Gewinn+100, then re-averaged. */
  avg_marginal: PercentValue | null;
}

/** @deprecated Use YearInput — kept as the SPEC's calculateNetto argument name equivalent. */
export type NettoInput = YearInput;
/** @deprecated Use YearResult. */
export type NettoResult = YearResult;

export type CalculationOutcome =
  | { ok: true; result: YearResult }
  | { ok: false; errors: ValidationError[] };

export type AverageOutcome =
  | { ok: true; result: MultiYearResult }
  | { ok: false; errors: ValidationError[] };

export type { Bundesland, TaxYear, Rechtskreis };
