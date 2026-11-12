/**
 * UI-facing re-exports of the calculation core and shared formatting.
 * Kindesunterhalt can import the same core from src/netto.
 */
export {
  calculateNetto,
  calculateNettoAverage,
  defaultInput,
  resolveYearParams,
  rechtskreisApplies,
  SUPPORTED_YEARS,
  DEFAULT_YEAR,
  DEFAULT_AVERAGE_YEARS,
  DEFAULT_BUNDESLAND,
  BUNDESLAENDER,
} from '../netto/index.ts';
export type {
  AverageOutcome,
  CalculationOutcome,
  MultiYearResult,
  Rechtskreis,
  YearInput,
  YearResult,
} from '../netto/index.ts';
export {
  formatEuro,
  formatPercent,
  formatZusatzbeitrag,
  parseEuroInput,
  parsePercentInput,
} from '../shell/format.ts';
