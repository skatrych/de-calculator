# de-calculator

Rechner für deutsche Finanzfragen (keine Steuerberatung).

1. **Netto-Einkommen für Selbständige** (Steuerjahre 2023–2026; Standard: Dreijahresdurchschnitt, vollständig im Browser, ohne Speicherung) — Spezifikation: [docs/SPEC-netto-selbststaendige.md](docs/SPEC-netto-selbststaendige.md). Referenzrechnung: [docs/reference_calc.py](docs/reference_calc.py).
2. **Kindesunterhalt** (Düsseldorfer Tabelle) — geplant; nutzt den Dreijahresdurchschnitt des Netto (`MultiYearResult.avg_netto`) als Ausgangswert.

## Keine Steuerberatung

Diese Berechnung ist eine vereinfachte Schätzung nach den gesetzlichen Regeln und ersetzt keine Steuer- oder Sozialversicherungsberatung. Für die tatsächliche Festsetzung sind das Finanzamt und die jeweiligen Sozialversicherungsträger zuständig. Die Beiträge zur gesetzlichen Kranken- und Pflegeversicherung werden endgültig nach dem Einkommensteuerbescheid bemessen; andere Einnahmen (Kapital, Vermietung) können die Bemessungsgrundlage erhöhen und sind in Version 1 nicht modelliert.

## Datenschutz

Diese Anwendung läuft vollständig in Ihrem Browser. Es gibt keinen Server, der Ihre Angaben entgegennimmt. Es werden keine Cookies gesetzt und keine Daten im Browser gespeichert (kein localStorage, sessionStorage oder IndexedDB). Ihre Eingaben stehen nicht in der Adresszeile und werden nicht an Dritte übermittelt. Es gibt keine Analyse- oder Trackingdienste. Nach dem Schließen oder Neuladen der Seite sind die Eingaben gelöscht.

## Entwicklung

Voraussetzung: Node.js 22 oder neuer.

```bash
npm install
npm test          # Vitest, alle Goldfälle G1–G20 und M1–M4 sowie der isolierte Tarif
npm run typecheck
npm run dev       # http://localhost:5173/de-calculator/
npm run build     # statische Seite nach dist/, Basis-Pfad /de-calculator/
npm run check:privacy
npm run check:a11y  # axe + no horizontal overflow at 360/390/1280 (needs Playwright Chromium)

npm run preview
```

Optionales CLI über denselben Berechnungskern:

```bash
npm run cli -- --gewinn 80000
npm run cli -- --jahre 2023,2024,2025 --gewinn 50000,80000,120000
npm run cli -- --jahr 2026 --gewinn 80000 --json
```

## Jahresupdate

Alle gesetzlichen Zahlen stehen in **einer** Datei: [`src/netto/params.ts`](src/netto/params.ts). Ein neues Steuerjahr (sobald Gesetz und Rechengrößen verkündet sind) wird als weiterer Block dort eingetragen, in `SUPPORTED_YEARS` aufgenommen und um Goldfälle ergänzt. Die Berechnungspipeline selbst bleibt unverändert. Für 2023 und 2024 enthält der Block West- und Ost-Rechengrößen (Bezugsgröße, RV-BBG); ab 2025 sind sie bundeseinheitlich.

## Berechnungs-API

- `calculateNetto(input: YearInput): CalculationOutcome` — ein Steuerjahr (Abschnitte 6.1–6.10 der SPEC).
- `calculateNettoAverage(years: YearInput[]): AverageOutcome` — drei aufeinander folgende Jahre, arithmetisches Mittel (`MultiYearResult.avg_netto`, Abschnitt 6.11). Das ist der Ausgangswert für den geplanten Kindesunterhalt-Rechner.

Optionale Felder `override_est`, `override_soli`, `override_kist` ersetzen die festzusetzenden Steuern eines Jahres durch die Werte des Steuerbescheids.

Optionales Feld `kfbZaehler` (Kinderfreibetrag-Zähler laut Steuerbescheid, Vielfaches von 0,5, höchstens gleich der Zahl der Kinder unter 25): steuert nur den Kinderfreibetrag für Soli und Kirchensteuer. Standard: Kinder unter 25 × 0,5 (unverheiratet) bzw. × 1,0 (verheiratet). Die Pflegeversicherung bleibt bei `childrenUnder25`.

## Deployment (GitHub Pages)

Der Workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) führt Typprüfung, Tests, Build und die Datenschutzprüfung aus und veröffentlicht `dist/` mit `actions/deploy-pages` (Basis-Pfad `/de-calculator/`). Pages muss im Repository einmalig aktiviert werden.

