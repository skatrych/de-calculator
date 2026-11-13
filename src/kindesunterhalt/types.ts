import type { MoneyValue } from '../netto/money.ts';
import type { Altersstufe } from './params.ts';

export type { MoneyValue };
export type EuroInput = string | number;

export interface ChildInput {
  /** Completed years of age (0–99). */
  ageYears: number;
  /** § 1603 Abs. 2 Satz 2: 18–20, unmarried, lives with a parent, general schooling. */
  privilegedAdult?: boolean;
  /** Lives independently (Studium / eigener Haushalt) — Bedarf 990 €. Mutually exclusive with privilegedAdult. */
  ownHousehold?: boolean;
  childIncome?: EuroInput;
  bedarfOverride?: EuroInput;
}

export interface KindesunterhaltInput {
  year: number;
  /** Monthly cleaned Netto, after tax and social contributions, before §6.1 deductions. */
  monthlyNetto: EuroInput;
  additionalRetirement?: EuroInput;
  workExpenses?: EuroInput;
  debts?: EuroInput;
  otherDeductions?: EuroInput;
  /** Default true. */
  erwerbstaetig?: boolean;
  warmmiete?: EuroInput;
  otherUnterhalt?: EuroInput;
  children: ChildInput[];
  /** Default: children.length. Includes other Unterhaltsberechtigte beyond the listed children. */
  anzahlBerechtigter?: number;
  /** Manual override of the automatic ±1-group shift. Default 0. */
  gruppenverschiebung?: number;
  /** Optional. When set, Haftungsanteil is computed. */
  otherParentNetto?: EuroInput;
}

export type Rank = 1 | 4;

export interface ChildResult {
  index: number;
  ageYears: number;
  altersstufe: Altersstufe;
  rank: Rank;
  privilegedAdult: boolean;
  ownHousehold: boolean;
  studentBedarf: boolean;
  groupUsed: number | null;
  bedarf: MoneyValue;
  kindergeldShare: MoneyValue;
  childIncome: MoneyValue;
  restBedarf: MoneyValue;
  zahlbetrag: MoneyValue;
  haftungsanteil: MoneyValue | null;
  haftungsanteilUnknown: boolean;
}

export interface KindesunterhaltResult {
  year: number;
  unterhaltsrechtlichesNetto: MoneyValue;
  deductions: MoneyValue;
  groupBase: number;
  groupAdjusted: number;
  bkbSteps: number;
  bkb: MoneyValue;
  incomeAboveTable: boolean;
  selbstbehaltNotwendig: MoneyValue;
  selbstbehaltAngemessen: MoneyValue;
  selbstbehaltApplied: MoneyValue;
  warmmieteIncrease: MoneyValue;
  children: ChildResult[];
  sumZahlbetrag: MoneyValue;
  remainingAfterUnterhalt: MoneyValue;
  mangelfall: boolean;
  otherUnterhalt: MoneyValue;
  warnings: string[];
}

export interface FieldError {
  field: string;
  message: string;
}

export type KindesunterhaltOutcome =
  | { ok: true; result: KindesunterhaltResult; warnings: string[] }
  | { ok: false; errors: FieldError[]; warnings?: string[] };
