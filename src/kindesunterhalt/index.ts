export { calculateKindesunterhalt, defaultKindesunterhaltInput, distributeProportionally } from './calculate.ts';
export {
  ALTERSSTUFEN,
  DEFAULT_UNTERHALT_YEAR,
  SUPPORTED_UNTERHALT_YEARS,
  YEAR_TABLES,
  altersstufe,
  bkbOf,
  getYearTable,
  groupByNumber,
  groupForIncome,
  isUnterhaltYear,
} from './params.ts';
export type { Altersstufe, IncomeGroup, YearTable } from './params.ts';
export { validateKindesunterhalt } from './validate.ts';
export type {
  ChildInput,
  ChildResult,
  EuroInput,
  FieldError,
  KindesunterhaltInput,
  KindesunterhaltOutcome,
  KindesunterhaltResult,
  Rank,
} from './types.ts';
