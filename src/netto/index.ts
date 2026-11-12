/**
 * Public API of the Selbständige net-income core.
 * Kindesunterhalt will consume MultiYearResult.avg_netto (SPEC Section 13).
 */
export { calculateNetto, calculateNettoAverage, defaultInput } from './calculate.ts';
export { tariff, tariffSplitting, soliOn, statutoryMarginalRateLabel } from './income-tax.ts';
export { pvRate, avCashFromBezugsgröße } from './social.ts';
export { computeGewerbesteuer, section35Credit } from './gewerbesteuer.ts';
export { validateInput } from './validate.ts';
export {
  getYearParams,
  resolveYearParams,
  isTaxYear,
  rechtskreisApplies,
  YEAR_PARAMS,
  YEAR_PARAM_KEYS,
  RECHTSKREIS_GROESSEN_KEYS,
  SUPPORTED_YEARS,
  DEFAULT_YEAR,
  DEFAULT_AVERAGE_YEARS,
  DEFAULT_RECHTSKREIS,
  BUNDESLAENDER,
  DEFAULT_BUNDESLAND,
  churchTaxRate,
  CONSTANTS,
} from './params.ts';
export type { YearParams, ResolvedYearParams, TaxYear, Bundesland, Rechtskreis, PvSchedule, RechtskreisGroessen } from './params.ts';
export {
  d,
  Decimal,
  floorEuro,
  floorTo100Euros,
  floorCents,
  commercialCents,
  commercialPercent,
  clamp,
  toMoney,
  toPercent,
  moneyFromCents,
} from './money.ts';
export type { MoneyValue, PercentValue } from './money.ts';
export type {
  YearInput,
  YearResult,
  MultiYearResult,
  NettoInput,
  NettoResult,
  CalculationOutcome,
  AverageOutcome,
  ValidationError,
  Activity,
  KvType,
  RvMode,
  AvMode,
  TaxZone,
  EuroInput,
} from './types.ts';
