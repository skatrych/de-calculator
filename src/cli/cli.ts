#!/usr/bin/env node
/**
 * Tiny CLI over the same calculateNetto / calculateNettoAverage core.
 * Usage:
 *   npm run cli -- --gewinn 80000
 *   npm run cli -- --jahr 2026 --gewinn 80000
 *   npm run cli -- --jahre 2023,2024,2025 --gewinn 80000
 *   npm run cli -- --jahre 2023,2024,2025 --gewinn 50000,80000,120000
 *   npm run cli -- --gewinn 80000 --json
 */
import {
  DEFAULT_AVERAGE_YEARS,
  DEFAULT_YEAR,
  SUPPORTED_YEARS,
  calculateNetto,
  calculateNettoAverage,
  defaultInput,
  formatEuro,
  formatPercent,
  type YearInput,
} from '../ui/api.ts';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i === -1 || i + 1 >= process.argv.length) return undefined;
  return process.argv[i + 1];
}

function has(name: string): boolean {
  return process.argv.includes(name);
}

function printHelp(): void {
  process.stdout.write(`Netto-Einkommen für Selbständige (keine Steuerberatung).

Verwendung:
  npm run cli -- --gewinn 80000
  npm run cli -- --jahr 2026 --gewinn 80000
  npm run cli -- --jahre 2023,2024,2025 --gewinn 80000
  npm run cli -- --jahre 2023,2024,2025 --gewinn 50000,80000,120000 --rechtskreis west

Optionen:
  --gewinn        Jahresgewinn, ein Wert oder drei Werte (kommagetrennt)
  --jahr          Einzeljahr (${SUPPORTED_YEARS.join(', ')}; Standard ${DEFAULT_YEAR})
  --jahre         Drei aufeinander folgende Jahre (Standard ${DEFAULT_AVERAGE_YEARS.join(',')})
  --rechtskreis   west | ost  (nur 2023/2024)
  --gewerbe       Tätigkeitsart Gewerbe (sonst Freiberufler)
  --hebesatz      Gewerbesteuer-Hebesatz (Standard 400)
  --json          Maschinenlesbare Ausgabe
  --hilfe         Diese Hilfe
`);
}

function main(): void {
  if (has('--hilfe') || has('-h') || has('--help')) {
    printHelp();
    return;
  }
  const gewinnRaw = arg('--gewinn');
  if (!gewinnRaw) {
    process.stderr.write('Bitte --gewinn angeben. --hilfe für die Verwendung.\n');
    process.exitCode = 1;
    return;
  }
  const jahreArg = arg('--jahre');
  const jahrArg = arg('--jahr');
  const useAverage = Boolean(jahreArg) || (!jahrArg && gewinnRaw.includes(','));
  const years = (jahreArg ?? (useAverage ? DEFAULT_AVERAGE_YEARS.join(',') : String(jahrArg ?? DEFAULT_YEAR)))
    .split(',')
    .map((s) => Number(s.trim()));
  const gewinne = gewinnRaw.split(',').map((s) => s.trim());
  if (gewinne.length === 1 && years.length > 1) {
    while (gewinne.length < years.length) gewinne.push(gewinne[0]);
  }
  if (gewinne.length !== years.length) {
    process.stderr.write('Anzahl der Gewinne muss zur Anzahl der Jahre passen.\n');
    process.exitCode = 1;
    return;
  }

  const base = {
    rechtskreis: (arg('--rechtskreis') === 'ost' ? 'ost' : 'west') as 'west' | 'ost',
    activity: (has('--gewerbe') ? 'gewerbe' : 'freiberufler') as YearInput['activity'],
    hebesatz: arg('--hebesatz') ?? 400,
  };

  const inputs: YearInput[] = years.map((year, i) =>
    defaultInput({ ...base, year, gewinn: gewinne[i] }),
  );

  if (years.length === 1) {
    const outcome = calculateNetto(inputs[0]);
    if (!outcome.ok) {
      process.stderr.write(outcome.errors.map((e) => e.message).join('\n') + '\n');
      process.exitCode = 1;
      return;
    }
    const r = outcome.result;
    if (has('--json')) {
      process.stdout.write(JSON.stringify(r, null, 2) + '\n');
      return;
    }
    process.stdout.write(
      `Jahr ${r.year}\n` +
        `Netto (Jahr)     ${formatEuro(r.nettoAnnual)}\n` +
        `Netto (Monat)    ${formatEuro(r.nettoMonthly)}\n` +
        `ESt              ${formatEuro(r.festzusetzendeEstUser)}\n` +
        `Soli             ${formatEuro(r.soliUser)}\n` +
        `KV               ${formatEuro(r.kvCash)}\n` +
        `PV               ${formatEuro(r.pvCash)}\n` +
        `Belastung        ${formatEuro(r.totalBurden)}  (${formatPercent(r.effectiveBurdenPercent)})\n`,
    );
    return;
  }

  const outcome = calculateNettoAverage(inputs);
  if (!outcome.ok) {
    process.stderr.write(outcome.errors.map((e) => e.message).join('\n') + '\n');
    process.exitCode = 1;
    return;
  }
  const r = outcome.result;
  if (has('--json')) {
    process.stdout.write(JSON.stringify(r, null, 2) + '\n');
    return;
  }
  process.stdout.write(
    `Dreijahresdurchschnitt ${r.years.join('–')}\n` +
      `Netto (Jahr)     ${formatEuro(r.avg_netto)}\n` +
      `Netto (Monat)    ${formatEuro(r.avg_monthly)}\n` +
      `ESt (Schnitt)    ${formatEuro(r.avg_est)}\n` +
      `KV (Schnitt)     ${formatEuro(r.avg_kv)}\n` +
      `PV (Schnitt)     ${formatEuro(r.avg_pv)}\n` +
      `Belastung        ${formatEuro(r.avg_burden)}  (${formatPercent(r.avg_effective)})\n\n`,
  );
  for (const y of r.perYear) {
    process.stdout.write(`  ${y.year}: Netto ${formatEuro(y.nettoAnnual)}\n`);
  }
}

main();
