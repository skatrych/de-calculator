# SPEC: Kindesunterhalt after the Düsseldorfer Tabelle (Germany)

**Version:** 1.0
**Date:** 2026-11-12
**Status:** Authoritative specification for implementation and QA.
**Supported table year:** 2026 only (data is year-keyed so 2027+ can be added without touching the pipeline).
**Product:** a second calculator in the same static web app as Netto-Einkommen für Selbständige. It estimates the monthly **Zahlbetrag** of child maintenance (Kindesunterhalt) that a self-employed barunterhaltspflichtiger parent would pay under the Düsseldorfer Tabelle 2026 and the accompanying Leitlinien, starting from the Netto calculator’s three-year average.

**Disclaimer (must appear prominently in the UI and the README):**

> Keine Rechtsberatung. Die Düsseldorfer Tabelle ist eine Richtlinie ohne Gesetzeskraft. Diese Berechnung ist eine vereinfachte Schätzung nach der Düsseldorfer Tabelle 2026 und den unterhaltsrechtlichen Leitlinien und ersetzt keine anwaltliche oder gerichtliche Beratung. Der Einzelfall — insbesondere die Bereinigung des Einkommens, die Höher- und Herabstufung, der Mangelfall, Mehrbedarf und ein Wechselmodell — kann abweichend zu beurteilen sein. Für die Festsetzung ist das Familiengericht zuständig.

The table, the Zahlbetrag annex, the Selbstbehalte and the official Mangelfall example are transcribed from the OLG Düsseldorf PDF (Stand 01.01.2026). They are not computed approximations. Golden-test expected values in Section 12 are hand-computed from those official figures with decimal arithmetic. If a golden and a correct implementation of the pipeline ever disagree, stop and raise it — do not “fix” the test silently, and do not change official table amounts.

---

## 1. Purpose

The app answers: *Given my monthly unterhaltsrechtliches Nettoeinkommen (by default the Netto calculator’s three-year average, after optional further deductions) and these children, what is the monthly Zahlbetrag per child, and in total, under the Düsseldorfer Tabelle for year Y?*

The primary user is the same self-employed person as in the Netto calculator, typically the parent who pays cash maintenance while the other parent cares for the child (Residenzmodell, § 1606 Abs. 3 Satz 2 BGB). The UI is German, works on a phone and a desktop, has sensible defaults, live results and a clear breakdown.

The Düsseldorfer Tabelle “hat keine Gesetzeskraft, sondern stellt eine Richtlinie dar.” It is the Hilfsmittel used by all Oberlandesgerichte to determine Kindesunterhalt (BGH, 20.09.2023, XII ZB 177/22, cited by NRW Justiz). Results are an estimate, not a court order.

---

## 2. Legal basis and sources

All figures in this SPEC come from the sources below. Do not invent or interpolate amounts.

### 2.1 Primary (authoritative for the table and 2026 amounts)

1. **Düsseldorfer Tabelle, Stand 01.01.2026**, Oberlandesgericht Düsseldorf, including Anmerkungen A–D and the Anhang “Tabelle Zahlbeträge”:
   <https://www.olg-duesseldorf.nrw.de/infos/Duesseldorfer_Tabelle/Tabelle-2026/DT_2026.pdf>
   Landing page: <https://www.olg-duesseldorf.nrw.de/infos/Duesseldorfer_Tabelle/Tabelle-2026/>
2. **Unterhaltsrechtliche Leitlinien der Familiensenate in Nordrhein-Westfalen (Leitlinien NRW), Stand 01.01.2026**, published by OLG Düsseldorf with the table:
   <https://www.olg-duesseldorf.nrw.de/infos/Duesseldorfer_Tabelle/Tabelle-2026/Leitlinien-NRW-2026.pdf>
   These are the companion commentary this product follows. They “haben keine bindende Wirkung.” Other OLG Leitlinien differ on some details (Section 2.4); v1 does not implement a multi-OLG switch.
3. **NRW Justiz announcement**, 02.12.2025, “Neue Düsseldorfer Tabelle ab dem 1. Januar 2026” (explains the +4 € Mindestunterhalt, Kindergeld 259 €, Selbstbehalte unchanged, student Bedarf 990 € unchanged, 4th Altersstufe = 125 % of the 2nd-Stufe Mindestbedarf in group 1):
   <https://www.justiz.nrw.de/mitteilung/2025-12-02-0>

### 2.2 Statute

4. **BGB** §§ 1601–1615, in particular:
   - § 1601 (Unterhaltsverpflichtung gerader Linie)
   - § 1602 (Bedürftigkeit)
   - § 1603 (Leistungsfähigkeit; Abs. 2 Satz 2 = privileged adult children)
   - § 1606 Abs. 3 (Haftungsanteil; Betreuung fulfils the caring parent’s duty)
   - § 1609 (Rangfolge; Nr. 1 = minors and privileged adults)
   - § 1610 (Maß des Unterhalts)
   - § 1612a (Mindestunterhalt, Altersstufen, rounding, month of the birthday)
   - § 1612b (Kindergeld: half if one parent fulfils the duty by Betreuung, otherwise full)
   Individual norms: `https://www.gesetze-im-internet.de/bgb/__1601.html` (replace the number).
5. **Mindestunterhaltsverordnung** (MinUhV), last amended by Art. 1 of the Verordnung of 15.11.2024, BGBl. 2024 I Nr. 359:
   <https://www.gesetze-im-internet.de/minuhv/BJNR218800015.html>
   <https://www.recht.bund.de/bgbl/1/2024/359/VO.html>
   From 1.1.2026: 486 / 558 / 653 € (Altersstufen 1–3). These are the group-1 Bedarfssätze of the table.
6. **Kindergeld 259 €** from 1.1.2026:
   - § 66 Abs. 1 EStG: <https://www.gesetze-im-internet.de/estg/__66.html>
   - § 6 Abs. 1 BKGG: <https://www.gesetze-im-internet.de/bkgg_1996/__6.html>
   - Bundesagentur für Arbeit, Presseinfo Nr. 53, 04.12.2025: <https://www.arbeitsagentur.de/presse/2025-53-kindergeld-steigt-ab-januar-2026>

### 2.3 BGH on the self-employed person’s unterhaltsrechtliches Einkommen

7. **BGH, 02.06.2004, XII ZR 217/01**, FamRZ 2004, 1177: because accounts and Steuerbescheide arrive after the year has closed, “ist es grundsätzlich nicht zu beanstanden, wenn der Tatrichter das häufig stark schwankende Einkommen selbständig Tätiger anhand der Ergebnisse der drei dem jeweiligen Unterhaltszeitraum vorausgehenden Kalenderjahre ermittelt.” The method “darf jedoch nicht als Dogma mißverstanden werden.” If those years do not reliably indicate current income (außergewöhnliche Ereignisse or steuerliche Sondereinflüsse that do not average out), those effects are left out or a different period is used.
8. **BGH, 21.09.2011, XII ZR 121/09**, NJW 2011, 3577: the average and the treatment of tax payments are again not dogma; timing distortions may need a correction.
9. **Leitlinien NRW 2026, Nr. 1.5**: income from self-employment is taken from the GuV or EÜR. For current and future maintenance, a multi-year period is used; “in der Regel sind hierzu drei Jahre ausreichend.” For the past, the income of the respective calendar year is decisive. Linear AfA of assets (not usually buildings) is recognised; interest on the financing of those assets reduces profit; Tilgung only to the extent AfA is not recognised. Steuererstattungen: In-Prinzip as a rule, Für-Prinzip possible for Selbständige (Nr. 1.7).

The Netto calculator already produces the three-year average as the starting point. Further Unterhalt-specific corrections (Ansparabschreibungen, In- vs. Für-Prinzip, Entnahmen as Indiz) stay **out of this calculator**; the user can override the monthly Netto.

### 2.4 Berufsbedingte Aufwendungen — OLG Leitlinien (difference noted, not implemented as a switch)

- **Leitlinien NRW 2026, Nr. 10.2 / 10.2.1:** necessary work expenses that can be objectively separated from private living costs are deducted from Netto “im Rahmen des Angemessenen.” A 5 % Netto pauschale “wird in der Regel nur bei fiktiven Erwerbseinkünften gewährt; ansonsten sind die berufsbedingten Aufwendungen grundsätzlich konkret darzulegen.” Fahrtkosten: public transport as a rule; otherwise 0,42 €/km (§ 5 Abs. 2 S. 1 Nr. 2 JVEG), often 0,28 € from the 31st Entfernungskilometer.
- **Süddeutsche Leitlinien 2026, Nr. 10.2 / 10.2.1** (OLGe Bamberg, Karlsruhe, München, Nürnberg, Stuttgart, Zweibrücken), <https://www.justiz.bayern.de/media/pdf/lebenslagen/suedl_2026.pdf>: the 5 % pauschale “kann” be used “bei Vorliegen entsprechender Anhaltspunkte,” and it is expressly a deduction from “Nettoeinkommen aus **unselbständiger** Arbeit.” Higher amounts must be itemised. Altersvorsorge cap there is a combined 23 % of Brutto (24 % for Elternunterhalt), which is not the NRW split (Section 6.1).

**Product rule for this Selbständigen-Rechner:** no automatic 5 % pauschale (the user is self-employed, Betriebskosten are already inside the Gewinn that fed the Netto calculator, and NRW — the commentary published with the official table — does not grant the pauschale for real self-employed income). The user may enter **concrete** monthly extra amounts. The UI must warn that amounts already deducted as Betriebsausgaben must not be entered again.

---

## 3. Scope and non-goals

### In scope (v1)

- Residenzmodell: one self-employed Barunterhaltspflichtiger, the other parent cares for the minor child.
- Monthly bereinigtes unterhaltsrechtliches Nettoeinkommen, defaulting to the Netto calculator’s three-year-average monthly figure, with a manual override.
- Optional further deductions from that Netto (zusätzliche Altersvorsorge, concrete berufsbedingte Aufwendungen, debts, other), each a monthly euro amount the user enters.
- One or more children: age → Altersstufe (0–5, 6–11, 12–17, 18+); privileged-adult flag; own-household / student flag; optional anrechenbares Einkommen des Kindes.
- Anzahl der Unterhaltsberechtigten (defaults to the number of children entered; the user raises it e.g. if a spouse also has a claim) and the mechanical Höher-/Herabstufung of Section 6.3, plus a manual Gruppenverschiebung.
- Kindergeld 259 €: half for minors, full for adults (§ 1612b, DT Anhang).
- Bedarfskontrollbetrag (Anm. A. III), applied as in Section 6.6.
- Notwendiger and angemessener Selbstbehalt, optional Warmmiete increase, and Mangelfall distribution (Anm. C, Leitlinien NRW Nr. 21 and 24).
- Adult children at home (4th Altersstufe) and students / adults with their own household (Bedarf 990 €). Optional Haftungsanteil if the other parent’s Netto is entered (Leitlinien NRW Nr. 13.3).
- The official 2026 Bedarf table, Zahlbetrag annex, Selbstbehalte and related constants as a year-keyed data module.
- German UI in the same SPA, same privacy and accessibility bar as Netto, optional CLI over the same core.

### Out of scope (v1) — and why

| Item | Why it is out |
| --- | --- |
| Ehegattenunterhalt (Trennungs- / nachehelicher Unterhalt) | Sergii’s stated scope item 2 is Kindesunterhalt only. The Anzahl-Berechtigter field and an optional “sonstiger Unterhalt” amount let the children’s grouping and the Bedarfskontrollbetrag take a spouse into account without computing the spouse’s Bedarf. |
| Betreuungsunterhalt (§ 1615l BGB) | A claim of the caring parent, not of the child. Different Selbstbehalt (1.600 / 1.475 €). Later, if ever. |
| Paritätisches Wechselmodell, and a quantified “erweiterter Umgang” deduction | Requires both incomes, Naturalunterhalt, Mehrkosten, and a different Kindergeld split (Leitlinien NRW Nr. 12, 14). The primary user story is Residenzmodell. Erweiterter Umgang may justify a Herabgruppierung (Nr. 12.5) — the manual Gruppenverschiebung covers that without a second model. |
| Elternunterhalt, Enkelunterhalt | Different Selbstbehalte (2.650 € + a share of the rest). Not Kindesunterhalt. |
| Mehrbedarf / Sonderbedarf (Kita, child’s KV if not family-insured, Studiengebühren, kieferorthopädische Behandlung, …) | DT Anm. A. V and Leitlinien NRW Nr. 11.1, 12.4: table amounts exclude KV/PV contributions and Studiengebühren. v1 shows Tabellenunterhalt / Zahlbetrag only; the UI notes that Mehrbedarf is extra. |
| Concrete Bedarf above group 15 (Netto > 11.200 €) | The 2026 table ends at 11.200 €. v1 uses group 15 as a **floor** and warns that a court may set a higher concrete Bedarf (§ 1610 BGB). Do not invent groups 16+. |
| Multi-OLG Leitlinien switch | The table itself is coordinated nationwide. Differences (e.g. the 5 % pauschale, the 23 % SüdL Altersvorsorge cap) are noted, not branched. |
| Fiktives Einkommen, Erwerbsobliegenheit, Insolvenz, UVG | Case-specific. The user can raise or lower the starting Netto. |
| Ansparabschreibungen, AfA disputes, In- vs. Für-Prinzip for tax refunds | Belong to the construction of unterhaltsrechtliches Einkommen; the Netto is a starting point, and the monthly field is editable. |
| A dynamic title as a percentage of Mindestunterhalt (§ 1612a) as a separate mode | Cheap to *show* the table’s Prozentsatz (100, 105, …) as an informational output; no second calculation mode. |
| Married adult child’s claim against a spouse first (§ 1608) | Out of scope; no “verheiratet” flag on the child. |

---

## 4. Key 2026 figures

### 4.1 Mindestunterhalt / Altersstufen

Statutory Mindestunterhalt (MinUhV § 1, = DT group 1, Altersstufen 1–3), from 1.1.2026:

| Altersstufe | Age (completed years) | Legal definition (§ 1612a Abs. 1 Satz 3) | Mindestunterhalt / Group-1 Bedarf |
| --- | --- | --- | --- |
| 1 | 0–5 | until Vollendung of the 6th Lebensjahr | **486 €** |
| 2 | 6–11 | 7th until Vollendung of the 12th Lebensjahr | **558 €** |
| 3 | 12–17 | from the 13th Lebensjahr until majority | **653 €** |
| 4 (table only) | 18+, living with a parent | DT Anm. A. II; not statutory Mindestunterhalt. Group 1 = 125 % of the 2nd-Stufe Mindestbedarf, rounded up: 558 × 1,25 = 697,50 → **698 €** (NRW Justiz announcement). | **698 €** |

§ 1612a Abs. 3: the higher Stufe applies from the **first day of the month** in which the child reaches that Lebensjahr. The user enters the Stufe (or the completed age) that applies in the month they are calculating; the app does not ask for a date of birth (less sensitive, and sufficient).

### 4.2 Bedarf table (monthly €) — official, Stand 01.01.2026

The Prozentsatz is the increase against group-1 Bedarf. Groups 2–5 rise by 5 percentage points each, groups 6–15 by 8 points each, of the group-1 amount. Resulting amounts are rounded **up** to a full euro (§ 1612a Abs. 2 Satz 2 BGB; DT Anm. A. II). The stored data **are** the official PDF amounts (they match this formula exactly; a unit test must prove that, and must fail if a future official table diverges — in which case the official PDF wins and the test is updated).

| Group | Nettoeinkommen | 0–5 | 6–11 | 12–17 | 18+ | % | Bedarfskontrollbetrag |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | up to 2.100 | 486 | 558 | 653 | 698 | 100 | **1.200 / 1.450** |
| 2 | 2.101–2.500 | 511 | 586 | 686 | 733 | 105 | 1.750 |
| 3 | 2.501–2.900 | 535 | 614 | 719 | 768 | 110 | 1.850 |
| 4 | 2.901–3.300 | 559 | 642 | 751 | 803 | 115 | 1.950 |
| 5 | 3.301–3.700 | 584 | 670 | 784 | 838 | 120 | 2.050 |
| 6 | 3.701–4.100 | 623 | 715 | 836 | 894 | 128 | 2.150 |
| 7 | 4.101–4.500 | 661 | 759 | 889 | 950 | 136 | 2.250 |
| 8 | 4.501–4.900 | 700 | 804 | 941 | 1.006 | 144 | 2.350 |
| 9 | 4.901–5.300 | 739 | 849 | 993 | 1.061 | 152 | 2.450 |
| 10 | 5.301–5.700 | 778 | 893 | 1.045 | 1.117 | 160 | 2.550 |
| 11 | 5.701–6.400 | 817 | 938 | 1.098 | 1.173 | 168 | 2.850 |
| 12 | 6.401–7.200 | 856 | 983 | 1.150 | 1.229 | 176 | 3.250 |
| 13 | 7.201–8.200 | 895 | 1.027 | 1.202 | 1.285 | 184 | 3.750 |
| 14 | 8.201–9.700 | 934 | 1.072 | 1.254 | 1.341 | 192 | 4.350 |
| 15 | 9.701–11.200 | 972 | 1.116 | 1.306 | 1.396 | 200 | 5.050 |

Group 1’s Bedarfskontrollbetrag is **1.200 €** if the Pflichtige is not erwerbstätig, **1.450 €** if erwerbstätig (the two necessary Selbstbehalte). Brackets are inclusive on both ends as printed (2.100 is group 1; 2.101 is group 2). Income above 11.200 € uses group 15 as a floor, plus the warning in Section 3.

The table “weist den monatlichen Unterhaltsbedarf aus, bezogen auf **zwei** Unterhaltsberechtigte, ohne Rücksicht auf den Rang.” Bedarf is not the Zahlbetrag (DT Anm. A. I).

### 4.3 Kindergeld and Zahlbetrag annex

Kindergeld in 2026 is **259,00 €** per child, uniform. On the Bedarf:

- **minors:** half, **129,50 €** (§ 1612b Abs. 1 Nr. 1 — one parent fulfils the duty by Betreuung);
- **adults (including privileged adults):** the full **259,00 €** (§ 1612b Abs. 1 Nr. 2). Confirmed by the official Mangelfall example (an 18-year-old in allgemeiner Schulausbildung: 698 − 259 = 439).

Official Zahlbeträge (Bedarf minus that share), from the Anhang — also stored as data, and a unit test must prove `Zahlbetrag = Bedarf − Kindergeldanteil` for every cell:

| Group | 0–5 | 6–11 | 12–17 | 18+ | % |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 356,50 | 428,50 | 523,50 | 439,00 | 100 |
| 2 | 381,50 | 456,50 | 556,50 | 474,00 | 105 |
| 3 | 405,50 | 484,50 | 589,50 | 509,00 | 110 |
| 4 | 429,50 | 512,50 | 621,50 | 544,00 | 115 |
| 5 | 454,50 | 540,50 | 654,50 | 579,00 | 120 |
| 6 | 493,50 | 585,50 | 706,50 | 635,00 | 128 |
| 7 | 531,50 | 629,50 | 759,50 | 691,00 | 136 |
| 8 | 570,50 | 674,50 | 811,50 | 747,00 | 144 |
| 9 | 609,50 | 719,50 | 863,50 | 802,00 | 152 |
| 10 | 648,50 | 763,50 | 915,50 | 858,00 | 160 |
| 11 | 687,50 | 808,50 | 968,50 | 914,00 | 168 |
| 12 | 726,50 | 853,50 | 1.020,50 | 970,00 | 176 |
| 13 | 765,50 | 897,50 | 1.072,50 | 1.026,00 | 184 |
| 14 | 804,50 | 942,50 | 1.124,50 | 1.082,00 | 192 |
| 15 | 842,50 | 986,50 | 1.176,50 | 1.137,00 | 200 |

Default assumption (Residenzmodell): the **caring** parent receives the Kindergeld. v1 does not model the rarer case that the Pflichtige receives it.

### 4.4 Student / own-household Bedarf (DT Anm. A. IV; Leitlinien NRW Nr. 13.1 Abs. 2)

The appropriate Bedarf of a child who is studying (or has their own household) and does **not** live with a parent is, as a rule, **990 €**, including up to **440 €** Warmmiete and, in the Leitlinien, up to 100 € ausbildungs-/berufsbedingte Aufwendungen. It does not include KV/PV or Studiengebühren. It “kann” be raised for a higher Bedarf or the parents’ Lebensstellung — v1 uses 990 € and lets the user override this child’s Bedarf. Unchanged from 2025 (NRW Justiz). Zahlbetrag before Haftungsanteil: 990 − 259 = **731 €** (if the child has no own income).

### 4.5 Selbstbehalte (DT Anm. A. VII; Leitlinien NRW Nr. 21) — **not increased in 2026** (NRW Justiz)

| Situation | Erwerbstätig | Nicht erwerbstätig | Warmmiete included |
| --- | ---: | ---: | ---: |
| **Notwendiger** Selbstbehalt (§ 1603 Abs. 2) — vs. minors and privileged adults | **1.450 €** | **1.200 €** | **520 €** |
| **Angemessener** Selbstbehalt (§ 1603 Abs. 1) — vs. other adult children | **1.750 €** (minimum, either status) | same | **650 €** |

Privileged adult (§ 1603 Abs. 2 Satz 2): a **volljähriges unverheiratetes** child, **until Vollendung of the 21st Lebensjahr**, who **lives in the household of a parent** and is in **allgemeiner Schulausbildung** (general school, not Ausbildung or Studium). They are ranked with minors (§ 1609 Nr. 1). Kindergeld is still deducted **in full**.

The necessary or appropriate Selbstbehalt **shall be raised** if the Pflichtige’s own Warmmiete exceeds the included amount and is not unangemessen (DT Anm. A. VII; Leitlinien NRW Nr. 21.5). It is **not** lowered just because actual rent is lower. v1: if the user enters a Warmmiete above the included figure, add the difference; do not try to judge “unangemessen”; do not decrease. If several people share the dwelling, the user enters only their own share (Nr. 21.5 Abs. 2 is not automated).

Ehegatten-, § 1615l- and Elternunterhalt-Selbstbehalte are listed in the PDF (1.600 / 1.475; 2.650 + 70 % of the rest, etc.) and are **out of the v1 calculation**; they are not required in the data module.

---

## 5. Inputs and defaults

### 5.1 Starting Netto

- `year`: table year, default **2026**. Only 2026 is shipped. If the device calendar year is later, show a warning that the table may be outdated.
- `monthlyNetto`: monthly Netto **after** income tax, Soli, church tax, trade tax, and social-insurance contributions (KV, PV, and any RV already modelled in the Netto calculator), **before** the extra unterhaltsrechtliche deductions below. Default, when the user has just computed it in the same page session: the Netto calculator’s **three-year-average monthly** figure (`AverageOutcome`, the official figure). If only a single year was computed, offer that figure with a note that courts typically use three years (Section 2.3). Always editable. If the Netto calculator has not been used, the field is empty until the user types a value (required).

This transfer is **in memory only**. No storage, no URL parameter.

### 5.2 Deductions to unterhaltsrechtliches Einkommen (optional, default 0)

All monthly, ≥ 0. The UI explains that these are **additional** to what is already in `monthlyNetto`, and shows the NRW caps as guidance — it does not compute them automatically (that would need Brutto and a legal judgement):

| Field | Guidance (Leitlinien NRW Nr. 10) |
| --- | --- |
| `additionalRetirement` (zusätzliche Altersvorsorge) | **Primary** (Nr. 10.1.2 Abs. 2): a person not in the statutory RV may as a rule put about **20 % of Brutto** toward primary Altersvorsorge; a person in the RV may add the statutory contribution rate on income above the BBG. **Secondary** (Abs. 3): as a rule **4 % of Brutto**, and for Kindesunterhalt only if the Mindestbedarf of minors / privileged adults is covered. Only actual payments. (SüdL uses a combined 23 % cap — not implemented.) |
| `workExpenses` (berufsbedingte Aufwendungen) | Concrete only; no 5 % pauschale (Section 2.4). Do not re-enter Betriebsausgaben. |
| `debts` (Schulden / Tilgung) | Case-specific (Nr. 10.4). Vs. minors and privileged adults, debts are “regelmäßig nur dann voll berücksichtigungsfähig, wenn der Mindestunterhalt sichergestellt wird.” The engine deducts what the user enters; if that causes a Mangelfall, the result itself shows the consequence. |
| `otherDeductions` | Catch-all (e.g. Umgangskosten far above the Kindergeld share, Nr. 10.7), labelled as such. |

`unterhaltsrechtlichesNetto = monthlyNetto − Σ deductions`, floored at 0. If the sum of deductions exceeds `monthlyNetto`, keep the typed values, show an error, and hide results (same pattern as the Netto calculator’s validation).

`erwerbstaetig`: default **true** (a working Selbständige). Controls the necessary Selbstbehalt and group-1 Bedarfskontrollbetrag.

`warmmiete`: optional. See Section 4.5.

`otherUnterhalt`: optional monthly amount already paid to other claimants (e.g. a titled Ehegattenunterhalt). Used for the Bedarfskontrollbetrag and for residual Leistungsfähigkeit; **not** included in the Mangelfall distribution among the children (v1 distributes only among the children entered).

### 5.3 Children and grouping

For each child:

- `ageYears`: completed years, integer, 0–99 (the Unterhaltspflicht can outlast Kindergeld’s usual end at 25; warn if > 27, do not block).
- Or, equivalently, a direct Altersstufe control. If both are shown, they stay in sync.
- `privilegedAdult`: shown when 18 ≤ age ≤ 20. Label, in substance: “Unverheiratet, lebt im Haushalt eines Elternteils und befindet sich in allgemeiner Schulausbildung (§ 1603 Abs. 2 Satz 2 BGB).” Default **unchecked** (do not guess). Invalid outside 18–20: error.
- `ownHousehold`: shown when age ≥ 18. Label: “Lebt nicht im Haushalt eines Elternteils (Studium / eigener Haushalt) — Bedarf 990 €.” Default unchecked. If both `ownHousehold` and `privilegedAdult` are set, that is inconsistent (privileged status requires living with a parent): error.
- `childIncome`: optional anrechenbares Einkommen of the child (Leitlinien NRW Nr. 12.2, 13.2: including BAföG-Darlehen and Ausbildungsbeihilfen, in full; the user nets any 100 € Ausbildungsaufwand themselves). Default 0.
- `bedarfOverride`: optional concrete Bedarf, for the “kann nach oben abgewichen werden” case on 990 €, or a court-agreed figure. Default empty = table / 990.

`anzahlBerechtigter`: default = number of children in the form; integer ≥ 1. The user may set it higher than the number of children (spouse or further children not itemised) or, rarely, lower. This is what drives automatic grouping.

`gruppenverschiebung`: integer, default 0, typically in −5…+5. Applied **on top of** the automatic rule. Lets the user reflect a court practice or erweiterten Umgang (Nr. 12.5) without a second model.

`otherParentNetto`: optional monthly bereinigtes Netto of the other parent. Used only for the Haftungsanteil of **adult** children (Section 6.8). Ignored for minors in Residenzmodell (the caring parent fulfils their duty by Betreuung).

---

## 6. Calculation pipeline (normative)

Use `decimal.js` (same settings as the Netto calculator: precision 40, `ROUND_HALF_UP`). Reuse `src/netto/money.ts` helpers; do not introduce IEEE-754 money. Every step is deterministic and I/O-free.

**Altersstufe** from `ageYears`: 0–5 → `0-5`; 6–11 → `6-11`; 12–17 → `12-17`; ≥ 18 → `18+`.

**Rank** of a child (§ 1609):

- Rang 1: age < 18, or (`privilegedAdult` and 18 ≤ age ≤ 20 and not `ownHousehold`);
- Rang 4: every other adult child.

### 6.1 Unterhaltsrechtliches Einkommen

```
N = monthlyNetto − additionalRetirement − workExpenses − debts − otherDeductions
```

If any input is invalid (Section 8), stop and return the validation errors. If `N` is 0 and inputs are valid, proceed (the Zahlbetrag will be 0 via Mangelfall).

### 6.2 Base income group

`G_base` = the unique group whose bracket contains `N`. If `N` > 11.200, `G_base = 15` and set a warning (`incomeAboveTable`). If `N` ≤ 0, `G_base = 1`.

### 6.3 Höher- / Herabstufung

DT Anm. A. I and Leitlinien NRW Nr. 11.2 Abs. 3 say only that with more or fewer than two Berechtigte, “können Ab- oder Zuschläge durch Einstufung in niedrigere/höhere Gruppen erfolgen.” They do **not** prescribe the step size. The **product default**, which is widespread practice and is always overridable, is **one group per Berechtigter away from two**:

```
G_adj = G_base + (2 − anzahlBerechtigter) + gruppenverschiebung
G_adj = clamp(G_adj, 1, 15)
```

So 1 Berechtigter → +1; 2 → 0; 3 → −1; 4 → −2. If this hits the ceiling because `G_base` is already 15, stay at 15 (and the `incomeAboveTable` warning already applies when N > 11.200). If it hits the floor, stay at 1; Mangelfall (6.7) may then apply.

**Adults at home use a different group** (Leitlinien NRW Nr. 13.1 Abs. 1): their Bedarf “ist nach dem zusammengerechneten Einkommen (**ohne Höher- oder Herabgruppierung**) zu bemessen.” With only this parent’s income entered, that is `G_base`. If `otherParentNetto` is entered, `G_combined` is the group of `N + otherParentNetto` (no count adjustment, clamp / floor as in 6.2), and the adult’s Bedarf group is `G_combined`, subject to the cap in 6.8.

**Minors** (and only minors) use `G_adj`.

**Own-household / student adults** use the 990 € Bedarf (or `bedarfOverride`), not a table group.

### 6.4 Bedarf per child

1. If `bedarfOverride` is set, use it.
2. Else if the child is 18+ and `ownHousehold`, use 990 €.
3. Else look up Bedarf in the year table at (`0-5` | `6-11` | `12-17` | `18+`) and the group from 6.3.

### 6.5 Kindergeld, child’s income, provisional Zahlbetrag

```
kgShare     = (age ≥ 18) ? kindergeld : kindergeld / 2    // 259,00 or 129,50
restBedarf  = max(0, Bedarf − childIncome − kgShare)
```

`restBedarf` is the provisional Zahlbetrag (and the Mangelfall Einsatzbetrag uses the **group-1** equivalent of the same formula — Section 6.7).

### 6.6 Bedarfskontrollbetrag (DT Anm. A. III)

The Bedarfskontrollbetrag “ist nicht identisch mit dem Eigenbedarf.” It “soll eine ausgewogene Verteilung des Einkommens … gewährleisten.” If, “unter Berücksichtigung auch anderer Unterhaltspflichten,” it is undershot, “kann der Tabellenbetrag der nächst niedrigeren Gruppe, deren Bedarfskontrollbetrag nicht unterschritten wird, angesetzt werden.” The product **applies** this (the “kann” is the table’s wording; applying it is the standard mechanical reading), downward only:

```
remaining = N − Σ restBedarf(all children) − otherUnterhalt
BKB       = Bedarfskontrollbetrag of the group used for the comparison
            (G_adj if there is at least one minor, otherwise G_base;
             group 1: 1.450 if erwerbstaetig else 1.200)
```

While `remaining < BKB` and at least one table group is still above 1: decrease **every** table-based group in use (`G_adj` and, if used, `G_base` / `G_combined`) by 1, recompute Bedarf and restBedarf (6.4–6.5), and re-test. Stop at group 1 even if BKB is still undershot (then 6.7 may apply). Student 990 € Bedarf is not lowered by this loop.

### 6.7 Selbstbehalt, Leistungsfähigkeit, Mangelfall

Selbstbehalt `SB`:

- If there is **any Rang-1** child: `SB = notwendig` (1.450 or 1.200).
- If there are **only Rang-4** children: `SB = angemessen` (1.750).
- If `warmmiete` is entered and exceeds the amount included in that SB (520 or 650), `SB += warmmiete − included`.

Process **Rang 1 first** (§ 1609):

```
masse_1 = max(0, N − SB_notwendig_adjusted)
need_1  = Σ restBedarf of Rang-1 children
```

If `masse_1 < need_1` (absolute Mangelfall, Leitlinien NRW Nr. 24.1 / DT Anm. C):

- Einsatzbetrag of each Rang-1 child = **Mindestunterhalt Zahlbetrag** of that child’s Altersstufe (group-1 restBedarf, with the same Kindergeld rule and childIncome): Leitlinien NRW Nr. 24.2, and the official example in Anm. C.
  - Minor 0–5: 356,50; 6–11: 428,50; 12–17: 523,50 (if childIncome is 0).
  - Privileged adult at home: 439,00 (698 − 259).
  - Privileged? A privileged adult in own household is inconsistent (rejected). A student is not Rang 1.
- `Zahlbetrag_i = masse_1 × Einsatz_i / Σ Einsatz`, commercial rounding to cents (`ROUND_HALF_UP`). If the rounded cents do not sum to `masse_1` because of a leftover cent, adjust the child with the largest leftover (largest-remainder) so the sum equals the Masse. The official example sums exactly to 300,00 €.
- Every Rang-4 child receives **0**.

If `masse_1 ≥ need_1`, each Rang-1 child receives their full (post-BKB) restBedarf.

Then **Rang 4**, only if Rang 1 is fully covered (or there is no Rang 1):

```
masse_4 = max(0, N − SB_angemessen_adjusted − Σ Zahlbetrag_Rang1 − otherUnterhalt)
need_4  = Σ restBedarf of Rang-4 children (after Haftungsanteil, 6.8)
```

If `masse_4 < need_4`, distribute `masse_4` in the ratio of those restBedarf figures (Nr. 24.2: “der nach den allgemeinen Regeln bestimmte offene Bedarf,” not Mindestunterhalt). If `masse_4 ≥ need_4`, each Rang-4 child receives their restBedarf (after 6.8).

### 6.8 Haftungsanteil for adult children (Leitlinien NRW Nr. 13.3; § 1606 Abs. 3 Satz 1)

Both parents owe cash maintenance to an adult child. If `otherParentNetto` is **not** entered, report the child’s **Restbedarf** (6.5, after BKB) as `restBedarf`, and set this parent’s `zahlbetrag` equal to that Restbedarf **only as an upper reference**, with an explicit flag `haftungsanteilUnknown: true` and a UI note: “Bei volljährigen Kindern sind beide Eltern barunterhaltspflichtig. Der Haftungsanteil setzt das bereinigte Netto des anderen Elternteils voraus.” Do not silently treat this parent as solely liable.

If `otherParentNetto` **is** entered:

1. Restbedarf after Kindergeld and child’s income, Bedarf group as in 6.3–6.6.
2. Sockel: 1.750 € each, or the necessary Selbstbehalt for a privileged adult, “wenn der Bedarf der Kinder nach der ersten Einkommensgruppe andernfalls nicht gedeckt werden kann” (Nr. 13.3 Abs. 3) — i.e. lower the sockel to 1.450 / 1.200 only when that is needed to reach group-1 Bedarf.
3. `capacity_P = max(0, N − sockel_P)`; `capacity_O = max(0, otherParentNetto − sockel_O)`.
4. This parent’s share = `Restbedarf × capacity_P / (capacity_P + capacity_O)` if the denominator is > 0, else 0 (cents, commercial).
5. **Cap** (Nr. 13.1 Abs. 1): at most the Zahlbetrag that would follow from **this parent’s income alone** (G_base, ohne Höher-/Herabstufung, same Kindergeld). For a 990 € Bedarf the cap is the Restbedarf itself (731 € if no child income).
6. That share then goes into 6.7’s Rang-4 (or Rang-1, if privileged) Leistungsfähigkeit check.

v1 does not implement the “wertende Veränderung” of Nr. 13.3 Abs. 4, nor a deduction of Unterhalt to vorrangig Berechtigte from the other parent’s income beyond what the user has already netted.

### 6.9 Rounding of the displayed result

- Table Zahlbeträge keep the official **half-euro** amounts (356,50 etc.). Do **not** round them to a full euro.
- Mangelfall and Haftungsanteil: commercial cents, as in 6.7–6.8.
- Leitlinien NRW Nr. 25 (“Der Unterhaltsbetrag ist auf volle Euro zu runden”) describes court-order practice. The UI may mention it; the **primary** displayed Zahlbetrag matches the official annex and the official Mangelfall cents. Do not hide the 50-cent official figures behind Nr. 25.

---

## 7. Outputs

For the whole case:

- `unterhaltsrechtlichesNetto` (N)
- `G_base`, `G_adj`, any BKB steps actually taken, `incomeAboveTable`
- Selbstbehalt used (and any Warmmiete increase)
- `sumZahlbetrag`, `remainingAfterUnterhalt` (= N − sum − otherUnterhalt), BKB of the final comparison group, and whether that BKB is still undershot
- `mangelfall`: boolean, and the Masse and Einsatzbeträge if true
- the table Prozentsatz of the (minor) group, informational
- warnings and notes as flags (Haftungsanteil unknown, income above table, table year ≠ calendar year, privileged-adult checkbox visible but unchecked, deductions guidance)

For each child:

- Altersstufe, rank, Bedarf (and which group / 990 / override), Kindergeldanteil, childIncome, `restBedarf`, `zahlbetrag` (what **this** parent pays), and, where relevant, `haftungsanteilUnknown` and the other parent’s implied share

Breakdown must be visible: a user can see how 4.000 €, two children aged 4 and 8, became 493,50 + 585,50 = 1.079,00 € (golden G1).

---

## 8. Validation

German messages, same interaction pattern as the Netto calculator (results hidden while a blocking error is shown; no silent clamp).

- `monthlyNetto` required, numeric, ≥ 0, at most 10.000.000. Comma or point as decimal separator, `de-DE` grouping allowed, as in Netto.
- Each deduction ≥ 0; sum of deductions ≤ `monthlyNetto`.
- At least one child, at most 12 (raise only if a real case needs more).
- `ageYears` an integer 0–99; `privilegedAdult` only for 18–20; `ownHousehold` only for ≥ 18; the two flags mutually exclusive.
- `anzahlBerechtigter` an integer 1–20.
- `gruppenverschiebung` an integer, |value| ≤ 14.
- `otherParentNetto`, `warmmiete`, `childIncome`, `bedarfOverride`, `otherUnterhalt`: if present, ≥ 0.
- Empty optional fields = 0 / unset, not an error.

---

## 9. Data-module design

Year-keyed, parallel to `src/netto/params.ts`. Suggested (names may change, the separation may not):

```
src/kindesunterhalt/
  params.ts          # TABLES[2026] = { kindergeld, groups[15], selbstbehalt, studentBedarf, … }
  types.ts
  money re-export    # from src/netto/money.ts
  calculate.ts       # calculateKindesunterhalt(input): Outcome — the only pipeline
  validate.ts
  calculate.test.ts  # Section 12 goldens, table consistency, age/group boundaries
  index.ts
```

`TABLES` is a `Record<year, YearTable>`. Adding 2027 means a new block, a new entry in `SUPPORTED_YEARS`, and new goldens — not a pipeline change. Store **official euro amounts as decimal strings** (`"356.50"`), never as IEEE floats.

Sketch (normative content, not obligatory identifiers):

```ts
interface IncomeGroup {
  group: 1 | 2 | /* … */ 15;
  min: Decimal;            // inclusive; 0 for group 1
  max: Decimal;            // inclusive; 11200 for group 15
  percent: number;         // 100, 105, … 200
  bedarf: Record<'0-5' | '6-11' | '12-17' | '18+', Decimal>;
  zahlbetrag: Record<'0-5' | '6-11' | '12-17' | '18+', Decimal>; // annex, after KG
  bedarfskontrollbetrag: Decimal;            // groups 2–15
  bkbErwerbstaetig?: Decimal;                // group 1 only: 1450
  bkbNichtErwerbstaetig?: Decimal;           // group 1 only: 1200
}

interface YearTable {
  year: 2026;
  kindergeld: Decimal;                 // 259
  groups: IncomeGroup[];               // length 15
  studentBedarf: Decimal;              // 990
  studentWarmmieteIncluded: Decimal;   // 440
  selbstbehalt: {
    notwendigErwerbstaetig: Decimal;           // 1450
    notwendigNichtErwerbstaetig: Decimal;      // 1200
    notwendigWarmmieteIncluded: Decimal;       // 520
    angemessen: Decimal;                       // 1750
    angemessenWarmmieteIncluded: Decimal;      // 650
  };
}
```

Unit tests on the data module (not goldens):

- Every `zahlbetrag[stufe] === bedarf[stufe] − (stufe === '18+' ? kindergeld : kindergeld/2)`.
- Every `bedarf[stufe] === ceil(group1[stufe] × percent / 100)` for all 15 groups (and group-1 `18+ === ceil(558 × 1.25)`).
- Brackets tile from 0 to 11.200 without gaps or overlaps: `groups[i].max + 1 === groups[i+1].min`.

---

## 10. Architecture, UI, accessibility, privacy

Follow the Netto SPEC’s architecture decisions. No plugin framework, no calculator registry, no new backend.

- **Share:** Vite / TypeScript / GitHub Pages, `decimal.js`, `src/netto/money.ts`, `src/shell/format.ts` (`de-DE`), the thin app shell (header, a simple nav between the two calculators, footer with the **Unterhalt** disclaimer **and** the existing privacy note).
- **Do not share** tax logic. Kindesunterhalt has its own folder and its own core, as the Netto SPEC already reserved (the folder name `src/kindesunterhalt/` is preferred over the earlier placeholder `src/unterhalt/`).
- **Optional CLI** wrapping `calculateKindesunterhalt`, same as Netto. Nice-to-have.
- **German UI**, vanilla TypeScript + the existing HTML/CSS. A second view (or a clearly separated section) in the same SPA. From the Netto results: a button “Dieses monatliche Durchschnitts-Netto für Kindesunterhalt verwenden” copies the figure in memory and switches view.
- Live results on input, a breakdown (Section 7), mobile-first. Defaults as in Section 5. Do not ask for the child’s name or date of birth.
- **Accessibility:** the same bar as Netto (`npm run check:a11y` — axe-core clean, no horizontal overflow at 360 / 390 / 1280, real labels, heading order, landmarks). Extend the a11y and UI tests to the new form (at least two children, Mangelfall result, adult-child flags).
- **Privacy is a release blocker**, identical to the Netto SPEC: 100 % client-side; no cookies, no `localStorage` / `sessionStorage` / IndexedDB; no form values in the URL; no analytics; no third-party resources (fonts, CDN); CSP `default-src 'self'; connect-src 'none'; form-action 'none'` (and the existing `script-src` without `unsafe-inline`); `Referrer-Policy: no-referrer`. The five QA acceptance checks in the Netto SPEC’s Privacy section apply to this view as well. `npm run check:privacy` stays green. A correct Zahlbetrag that stores data or talks to a network **fails acceptance**.

---

## 11. Edge cases (expected behaviour)

- `N` = 0 or `N` ≤ Selbstbehalt: Mangelfall, Masse 0, every Zahlbetrag 0.
- Income on a bracket boundary: 2.100 → group 1; 2.101 → group 2; 11.200 → group 15; 11.201 → group 15 + warning.
- Age boundaries: 5 → 0–5; 6 → 6–11; 11 → 6–11; 12 → 12–17; 17 → 12–17; 18 → 18+.
- One child: automatic +1 group (G2). Three children: −1 (G3). Four: −2 for **minors**; the at-home adult stays on `G_base` (G12).
- BKB lowers the group after count-adjustment (G4, G14). It never raises it. At group 1 it stops; Mangelfall may follow (G10).
- Mixed ranks (minor + non-privileged adult): Rang 1 is paid first with the necessary Selbstbehalt; Rang 4 only from what is left above the **appropriate** Selbstbehalt (G14).
- Privileged 18-year-old: necessary Selbstbehalt, full Kindergeld, Rang 1 (G5, G8, G12).
- Adult student, own household: Bedarf 990, full Kindergeld, appropriate Selbstbehalt, both parents liable (G7, G13).
- Child’s income ≥ Bedarf − Kindergeldanteil: Zahlbetrag 0.
- `ownHousehold` + `privilegedAdult`: rejected (Section 8).
- Höherstufung that would go to group 16: stay at 15.
- Warmmiete raises SB, never lowers it (G15). If the raised SB causes Mangelfall, apply 6.7.
- `otherUnterhalt` reduces remaining income for BKB and Masse, but is not a child Einsatzbetrag.

---

## 12. Golden test cases

All amounts in euro. Unless a case says otherwise: year 2026, erwerbstätig, no extra deductions, no Warmmiete override, no childIncome, no Bedarf override, no otherParentNetto, no otherUnterhalt, `anzahlBerechtigter` = number of children, `gruppenverschiebung` = 0, Kindergeld received by the caring parent, Residenzmodell. “Group” after count-adjustment and, where it triggers, after BKB, is stated.

Hand-computed from the official Bedarf / Zahlbetrag tables in Section 4 and the official Mangelfall example. A Vitest case for each row; the expected values below are normative.

### G1 — two minors, default two Berechtigte, no BKB, no Mangel (happy path)

`N` = 4.000 (group 6, 3.701–4.100). Children 4 and 8 years. No grouping change. BKB 2.150. SB 1.450.

- Age 4 (0–5): Bedarf 623, Zahlbetrag **493,50**
- Age 8 (6–11): Bedarf 715, Zahlbetrag **585,50**
- Summe **1.079,00**. Remaining 2.921,00 ≥ 2.150. Masse 4.000 − 1.450 = 2.550 > 1.079. No Mangelfall.

### G2 — one minor, Höherstufung +1

`N` = 4.000 (`G_base` 6 → `G_adj` 7). Child 10 years.

- Bedarf 759, Zahlbetrag **629,50**. Remaining 3.370,50 ≥ BKB 2.250. No Mangelfall.

### G3 — three minors, Herabstufung −1

`N` = 4.000 (`G_base` 6 → `G_adj` 5). Children 3, 9, 15.

- Age 3: **454,50**; age 9: **540,50**; age 15: **654,50**
- Summe **1.649,50**. Remaining 2.350,50 ≥ BKB 2.050. No Mangelfall.

### G4 — Bedarfskontrollbetrag lowers the group

`N` = 3.301 (`G_base` = 5, two 16- and 17-year-olds, no count change).

- Group 5 provisional: Zahlbetrag 654,50 × 2 = 1.309,00; remaining 3.301 − 1.309 = 1.992 < BKB 2.050 → drop to group 4.
- Group 4: 621,50 × 2 = **1.243,00**; remaining 2.058 ≥ BKB 1.950. Masse 3.301 − 1.450 = 1.851 > 1.243. Each child **621,50**.

### G5 — official Mangelfall example (DT Anm. C), including a privileged adult

Copied from the official Anmerkungen, which are the expected values. `N` = 1.750. Three children living with the other parent, who receives the Kindergeld and is neither unterhaltsberechtigt nor barunterhaltspflichtig: K1 = 18 years, in allgemeiner Schulausbildung (privileged); K2 = 7 years; K3 = 5 years.

- Necessary SB 1.450. Masse **300,00**.
- Einsatzbeträge (group-1 Zahlbeträge): K1 698 − 259 = **439,00**; K2 558 − 129,50 = **428,50**; K3 486 − 129,50 = **356,50**; sum **1.224,00**.
- K1: 439,00 × 300 / 1.224 = **107,60**
- K2: 428,50 × 300 / 1.224 = **105,02**
- K3: 356,50 × 300 / 1.224 = **87,38**
- Summe **300,00**.

### G6 — non-privileged adult at home, no Höherstufung, Haftungsanteil unknown

`N` = 4.000. One child, 22 years, at home, not privileged. `G_base` = 6; **no** +1 (Nr. 13.1: ohne Höhergruppierung). Appropriate SB 1.750.

- Bedarf 894, Kindergeld 259, Restbedarf **635,00**.
- `haftungsanteilUnknown: true`. Display 635,00 as Restbedarf / upper reference, with the Section 6.8 note. Remaining 3.365 ≥ BKB 2.150. 4.000 − 1.750 = 2.250 > 635.

### G7 — student with own household

`N` = 5.000. One child, 20 years, `ownHousehold`, not privileged. Bedarf 990. Restbedarf **731,00**. Appropriate SB 1.750. `haftungsanteilUnknown: true`. 5.000 − 1.750 = 3.250 > 731. (5.000 is group 9; the 990 € Bedarf does not use that group.)

### G8 — privileged adult at home plus a minor, full Kindergeld on the adult

`N` = 3.300 (`G_base` = 4). Children: 19 (privileged, at home) and 10. Two Berechtigte, no count change. Both land in group 4 (the adult would use `G_base` anyway).

- Age 19: 803 − 259 = **544,00** (Rang 1, full Kindergeld)
- Age 10: 642 − 129,50 = **512,50**
- Summe **1.056,50**. Remaining 2.243,50 ≥ BKB 1.950. SB 1.450 (Rang 1 is present). No Mangelfall.

### G9 — income above the table

`N` = 15.000, children 6 and 12. `G_base` = 15, `incomeAboveTable`. Two Berechtigte, no change.

- Age 6: **986,50**; age 12: **1.176,50**; Summe **2.163,00**. Remaining 12.837 ≥ BKB 5.050. Warning that a concrete Bedarf may be higher.

### G10 — Mangelfall at the group-1 floor, two equal minors

`N` = 2.100 (top of group 1). Two children, both age 2. No count change (two Berechtigte). Group-1 Zahlbetrag 356,50 × 2 = 713,00. Remaining 2.100 − 713 = 1.387 < BKB 1.450; cannot drop below group 1.

- SB 1.450. Masse 2.100 − 1.450 = **650,00** < 713 → Mangelfall.
- Einsatz 356,50 + 356,50 = 713,00. Each: 356,50 × 650 / 713 = **325,00**. Summe **650,00**.

### G11 — extra deductions from the Netto-calculator starting point

Netto-calculator monthly average 4.800. User deducts 200 zusätzliche Altersvorsorge and 100 debts. `N` = 4.500 (group 7, 4.101–4.500). Children 8 and 14. Two Berechtigte.

- Age 8: **629,50**; age 14: **759,50**; Summe **1.389,00**. Remaining 3.111 ≥ BKB 2.250. No Mangelfall.

### G12 — four Berechtigte: minors Herabgestuft, adult not

`N` = 6.000 (`G_base` = 11, 5.701–6.400). Children 4, 7, 13, and 19 privileged at home. `anzahlBerechtigter` = 4 → `G_adj` = 9 for **minors**. The privileged adult’s Bedarf uses `G_base` = 11 (ohne Herabgruppierung).

- Age 4, group 9: **609,50**
- Age 7, group 9: **719,50**
- Age 13, group 9: **863,50**
- Age 19, group 11: 1.173 − 259 = **914,00** (not the group-9 802,00)
- Summe **3.106,50**. Remaining 2.893,50 ≥ BKB of `G_adj` (2.450). Rang 1 for all four (19 is privileged). SB 1.450. 6.000 − 1.450 = 4.550 > 3.106,50. No Mangelfall.

### G13 — Haftungsanteil of a student, both incomes known

`N` = 5.000, `otherParentNetto` = 3.000. One child, 21, `ownHousehold`. Restbedarf 990 − 259 = 731,00. Sockel = appropriate SB 1.750 each.

- Capacity P = 5.000 − 1.750 = 3.250; O = 3.000 − 1.750 = 1.250; sum 4.500.
- This parent’s share: 731 × 3.250 / 4.500 = 527,944… → **527,94**.
- Cap (Restbedarf itself) 731,00, not binding. `haftungsanteilUnknown: false`. Zahlbetrag **527,94**. 5.000 − 1.750 = 3.250 > 527,94. No Mangelfall.

### G14 — mixed ranks, BKB, then appropriate Selbstbehalt for the adult

`N` = 3.000 (`G_base` = 4). Children: 8 (minor) and 22 (at home, not privileged). Two Berechtigte, `G_adj` = 4. Adult also uses `G_base` = 4.

- Provisional: minor 512,50; adult Restbedarf 803 − 259 = 544,00; sum 1.056,50. Remaining 1.943,50 < BKB 1.950 → drop **both** table groups to 3.
- Group 3: minor **484,50**; adult Restbedarf 768 − 259 = **509,00**; sum 993,50. Remaining 2.006,50 ≥ BKB 1.850.
- Rang 1 (minor) is fully payable (Masse vs. necessary SB 1.450: 1.550 > 484,50).
- Rang 4 available: 3.000 − 1.750 − 484,50 = 765,50 ≥ 509,00 → adult **509,00** (Haftungsanteil unknown: report 509,00 as Restbedarf with the 6.8 note; the expected `zahlbetrag` in the test is 509,00 with the flag set).
- Summe **993,50**.

### G15 — Warmmiete raises the necessary Selbstbehalt, no Mangelfall

`N` = 2.000. One child, age 5. `G_base` = 1 → `G_adj` = 2. `warmmiete` = 700 (> 520).

- Group 2 provisional: 381,50; remaining 1.618,50 < BKB 1.750 → drop to group 1: **356,50**. Remaining 1.643,50 ≥ BKB 1.450.
- SB = 1.450 + (700 − 520) = **1.630**. Masse 2.000 − 1.630 = 370 ≥ 356,50. Zahlbetrag **356,50**. No Mangelfall.

(If `warmmiete` were 800, SB would be 1.730, Masse 270 < 356,50, and the single child would receive 270,00 in a Mangelfall. Not a separate required golden; a unit test of this variant is welcome.)

### Other required tests (not numbered goldens)

- Data-module consistency (Section 9).
- Age and income-bracket boundaries (Section 11).
- Validation messages (Section 8), including the mutually exclusive adult flags and deductions exceeding Netto.
- `N` ≤ SB → all Zahlbeträge 0.
- Child income wiping out Restbedarf.
- `gruppenverschiebung` of −1 on G1’s facts (two children, `N` = 4.000) yields group 5 Zahlbeträge 454,50 + 540,50 = 995,00.

---

## 13. Known limitations (document in the UI help)

- The table is a Richtlinie, not a statute. Courts can deviate.
- The ±1-group rule is a product default, not a sentence in the 2026 Anmerkungen.
- The starting Netto is only as good as the Netto calculator (and the user’s override). Unterhalt-specific Gewinn corrections are not modelled.
- Mehrbedarf, Wechselmodell, Ehegatten- and Betreuungsunterhalt are not included.
- Above 11.200 € the result is a floor.
- Haftungsanteil without the other parent’s Netto cannot be completed.
- Leitlinien other than NRW 2026 may treat work-expense pauschales and Altersvorsorge caps differently (Section 2.4).
- Rounding of a court title may follow Leitlinien NRW Nr. 25 (full euro).

---

## 14. Implementation notes for the developer and for QA

- Implement the pipeline in Section 6 exactly. Official table cells in Section 4 are transcribed from the PDF; if a test “recomputes” a cell and disagrees with the PDF, the PDF wins.
- QA: Vitest for every golden G1–G15 and the data-module tests; walk through G1, G4, G5, G6, G10, G12, G13 and G14 in the UI (breakdown visible, disclaimer and privacy note present, Netto-average transfer works and does not write a URL or storage, mobile width); `check:privacy` and `check:a11y` green on the new view.
- Do not present results as advice. Do not contact courts or Jugendämter.
- Privacy failures are release blockers.

---

## 15. Product decisions already taken

These are decided so implementation can start. Sergii can override any of them.

1. **Residenzmodell only** in v1; Wechselmodell is out (Section 3).
2. **NRW Leitlinien 2026** are the commentary that accompanies the official table; no multi-OLG switch. No automatic 5 % work-expense pauschale for this Selbständigen-Rechner.
3. **±1 group per Berechtigter away from two** is the default Höher-/Herabstufung, always overridable.
4. **Bedarfskontrollbetrag is applied** mechanically (the table’s “kann”).
5. **Adults at home are not Höher-/Herabgestuft** (Leitlinien NRW Nr. 13.1), even when minors in the same case are.
6. **Haftungsanteil** is computed only when the other parent’s Netto is entered; otherwise the Restbedarf is shown with a clear note.
7. **Primary displayed amounts** follow the official Zahlbetrag annex (including 50-cent figures) and the official Mangelfall cents, not Leitlinien Nr. 25.
8. **Same SPA, same privacy bar, in-memory Netto transfer, no date of birth, no child’s name.**

---

## 16. Roadmap

- 2027 table, when OLG Düsseldorf publishes it: a new year block and goldens only.
- Possible later items (not v1): Ehegattenunterhalt, Betreuungsunterhalt, Wechselmodell, Mehrbedarf line items, a multi-year table comparison.
