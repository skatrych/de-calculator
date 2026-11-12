# SPEC: Netto-Einkommen für Selbständige (Germany)

**Version:** 1.0  
**Date:** 2026-11-12  
**Status:** Authoritative specification for implementation and QA.  
**Supported tax years:** 2025 and 2026 (default: 2026).  
**Product:** a usable static web app (German UI) that estimates the annual and monthly net income of a self-employed person under current German tax and social-insurance law.

**Disclaimer (must appear prominently in the UI and the README):**

> Keine Steuerberatung. Diese Berechnung ist eine vereinfachte Schätzung nach den gesetzlichen Regeln und ersetzt keine Steuer- oder Sozialversicherungsberatung. Für die tatsächliche Festsetzung sind das Finanzamt und die jeweiligen Sozialversicherungsträger zuständig. Die Beiträge zur gesetzlichen Kranken- und Pflegeversicherung werden endgültig nach dem Einkommensteuerbescheid bemessen; andere Einnahmen (Kapital, Vermietung) können die Bemessungsgrundlage erhöhen und sind in Version 1 nicht modelliert.

Income-tax figures in the golden tests are computed from the official § 32a EStG formulae with decimal arithmetic. The BMF Lohn- und Einkommensteuerrechner at <https://www.bmf-steuerrechner.de> (module „Berechnung der Einkommensteuer“) was not reachable from the research environment (HTTP 400 / WAF). QA must spot-check at least the isolated tariff table (Section 11.1) against that official calculator.

---

## 1. Purpose

The app answers: *If my annual profit (Gewinn) is X, what is my net income after income tax, Solidaritätszuschlag, church tax, trade tax, and social-insurance contributions, under the rules of year Y?*

The primary user is a self-employed software engineer (Freiberufler or Gewerbetreibender) living in Germany. The app must be usable on a phone and a desktop, with sensible defaults, live results, and a clear breakdown — not a tax-office form.

A second calculator (Kindesunterhalt after the Düsseldorfer Tabelle) is planned next. It is **not** in v1. Architecture stays minimal: share only the app shell and formatting. No plugin framework, no generic calculator registry, and no other calculators.

---

## 2. Scope and non-goals

### In scope (v1)

- Annual **Gewinn** as the single income input (net of Umsatzsteuer).
- Freiberufler vs. Gewerbetreibender, with Gewerbesteuer and the § 35 EStG credit.
- Einkommensteuer after § 32a EStG, for 2025 and 2026, Grundtarif and Splitting.
- Solidaritätszuschlag (Freigrenze and Milderungszone).
- Kirchensteuer (8 % / 9 %), deductible, iterated to a fixed point.
- Gesetzliche KV (freiwillig versicherte Selbständige), with or without Krankengeld, plus a user-editable Zusatzbeitrag.
- Gesetzliche PV with childless surcharge and the 2-to-5-children Abschlag.
- Private KV as an alternative (monthly premium + deductible Basis share + private Pflegepflichtversicherung).
- Rentenversicherung: none, voluntary amount, mandatory income-based, or Regelbeitrag.
- Optional Arbeitslosenversicherung auf Antrag (full or Anlaufphase).
- Sonderausgaben: Vorsorgeaufwendungen after § 10 EStG, Sonderausgaben-Pauschbetrag, other Sonderausgaben as a single input.
- Optional spouse zvE for Splitting.
- Annual and monthly breakdown, effective burden, marginal burden.

### Non-goals (v1)

- Kapitalerträge, Vermietung, Progressionsvorbehalt, außergewöhnliche Belastungen, Kinderbetreuungskosten, Spenden modelling (other than the single „weitere Sonderausgaben“ box).
- Abschreibungen, Investitionsabzugsbetrag, Hinzurechnungen and Kürzungen for Gewerbesteuer (Gewerbeertrag = Gewinn).
- Umsatzsteuer (pass-through). All inputs are **net of USt**.
- Kindergeld, and the Günstigerprüfung Kindergeld vs. Kinderfreibetrag for tarifliche Einkommensteuer. Kinderfreibeträge are applied **only** to the Soli (and KiSt) tax base, as SolzG § 3 Abs. 2 requires. High earners with children may therefore see a slightly higher ESt than the actual assessment. Kindergeld is not added to Netto.
- The pre-2023 Günstigerprüfung for Altersvorsorge (§ 10 Abs. 4a EStG). From 2023 the deductible share is 100 %.
- Künstlersozialkasse (KSK): the artist pays half of RV and of KV/PV. Out of scope; a later addition if needed.
- Mitarbeiter, Personengesellschaften, Mitunternehmerschaften, Körperschaftsteuer.
- Steuervorauszahlungen, Verlustrücktrag, income-averaging (§ 34).
- A 2027 mode. See Section 8: 2027 income-tax tariff is not enacted; 2027 social-insurance Rechengrößen were cabinet-approved on 2026-10-07 and still required Bundesrat consent in the BMAS announcement. Do not add 2027 until both are enacted, then extend the single parameter file.
- English UI (optional later). v1 is German only.
- Any calculator other than this one. The only item on the roadmap is Kindesunterhalt (Düsseldorfer Tabelle).

---

## 3. Product requirements and UX

- Single-page static web app, no backend, German labels, live recalculation as inputs change.
- Usable on a narrow phone: one column, the Netto result pinned or repeated near the top after the first calculation.
- Sensible defaults (Section 4) so a typical Freiberufler can enter only the Gewinn and immediately see a result.
- Results show **annual and monthly** side by side. Annual figures are authoritative. Monthly = annual / 12, commercially rounded to cents. The sum of rounded monthly lines may differ from monthly Netto by a cent; a short note may say so.
- Prominent Netto, then the breakdown, then zvE / tarifliche ESt / § 35 / festzusetzende ESt, then effective and marginal rates.
- The disclaimer is visible without scrolling on a desktop, and is in a footer on every view (including print).
- Invalid inputs (negative premium, Basis share larger than the PKV premium, voluntary RV outside the legal min/max) are blocked with a German error message, not silently clamped, except for the legally required clamps on the KV/PV/RV **assessment base**.
- Year selector: 2025 | 2026. Changing the year reloads defaults for Zusatzbeitrag (the official average) but does not erase the Gewinn or personal situation.
- Print stylesheet is a nice-to-have.
- A tiny CLI that calls the same core is a nice-to-have, not a v1 blocker.

---

## 4. Inputs and defaults

| Input | UI label | Type | Default | Notes |
|---|---|---|---|---|
| Year | Jahr | 2025 \| 2026 | **2026** | Loads the parameter block of Section 7. |
| Profit | Jahresgewinn (netto, ohne USt) | EUR, ≥ 0 | empty, required | Placeholder e.g. `80.000`. Annual Gewinn after Betriebsausgaben, **before** social contributions and tax. |
| Activity | Tätigkeitsart | Freiberufler \| Gewerbe | **Freiberufler** | Software engineers may be either; the user chooses. |
| Hebesatz | Gewerbesteuer-Hebesatz | %, ≥ 0 | **400** | Visible only for Gewerbe. 400 % is the point at which § 35 can fully offset GewSt. |
| Married | Verheiratet, Zusammenveranlagung | bool | **nein** | Splitting after § 32a Abs. 5. |
| Spouse zvE | zvE des Ehepartners | EUR | **0** | Visible if married. Already-determined zu versteuerndes Einkommen of the spouse (after the spouse’s own deductions), **before** combining. See Section 6.7. |
| Church tax | Kirchensteuer | keine \| ja | **keine** | |
| Bundesland | Bundesland | list of 16 Länder | e.g. Nordrhein-Westfalen | Visible if church tax is on. Sets the rate: **8 %** in Bayern and Baden-Württemberg, **9 %** elsewhere. The Land is not otherwise used (no Sachsen special case for self-employed PV — they pay the full rate). |
| Children under 25 | Kinder unter 25 Jahren | integer 0–20 | **0** | Drives the PV Abschlag (capped at 5) and, by default, the Soli/KiSt Kinderfreibetrag count. |
| Parent status | Elterneigenschaft (auch wenn alle Kinder 25 oder älter) | bool | **nein** | Only relevant when „Kinder unter 25“ is 0: a parent with only older children pays 3.6 %, not the 4.2 % childless surcharge. The Abschlag for 2–5 children applies only to children under 25. |
| Age 23+ | Mindestens 23 Jahre alt | bool | **ja** | Childless surcharge applies only from the month after the 23rd birthday. |
| Full Kinderfreibetrag | Vollen Kinderfreibetrag übertragen | bool | **nein** (on if married) | For Soli/KiSt base only. Single default is one parent’s share; check this to use both shares (e.g. other parent transferred). Married: always both shares. |
| KV type | Krankenversicherung | GKV ermäßigt / GKV allgemein / PKV | **GKV ermäßigt (ohne Krankengeld)** | The usual choice for Selbständige. |
| Zusatzbeitrag | Zusatzbeitragssatz | %, ≥ 0 | official average for the year (2.9 % in 2026, 2.5 % in 2025) | GKV only. The user should enter their kassenindividueller Satz; the default is the BMG average, which can be below the actual weighted average. |
| PKV premium | PKV-Beitrag monatlich | EUR | empty, required if PKV | Cash outflow. |
| PKV Basis share | davon Basis-KV (steuerlich abziehbar), monatlich | EUR | empty, required if PKV | Must be ≤ premium. This is the insurer-certified deductible portion. |
| Private PV | Private Pflegepflichtversicherung monatlich | EUR | empty, required if PKV | Cash outflow; fully deductible as Basis-PV. |
| RV | Rentenversicherung | keine / Pflicht (einkommensbezogen) / Regelbeitrag / Freiwillig | **keine** | Optional for most Selbständige; mandatory for some groups (Lehrer, Erzieher, Hebammen, Handwerker, etc., § 2 SGB VI). The app does not decide obligation — the user does. |
| Voluntary RV | Freiwilliger RV-Beitrag monatlich | EUR | empty if Freiwillig | Must be between the year’s min and max (Section 7). |
| AV | Arbeitslosenversicherung auf Antrag | nein / ja (voller Beitrag) / ja (Anlaufphase) | **nein** | Anlaufphase: year of start and the following calendar year, half Bezugsgröße. |
| Other Sonderausgaben | Weitere Sonderausgaben (ohne Vorsorge und Kirchensteuer) | EUR | **0** | Spenden, etc. Combined with KiSt and compared to the Pauschbetrag. |

---

## 5. Outputs

All money values in EUR with two decimals (income tax itself is a whole euro, displayed as `16.304,00 €`). German grouping and decimal comma in the UI.

| Output | UI label | Definition |
|---|---|---|
| Net income, annual | **Netto-Einkommen (Jahr)** | Gewinn − all cash outflows (Section 6.10). The primary result. |
| Net income, monthly | **Netto-Einkommen (Monat)** | Annual Netto / 12, commercially rounded. |
| Income tax | Festzusetzende Einkommensteuer | After the § 35 credit. For married couples, show both the **joint** tax and the **user’s share** (Section 6.7). Netto uses the user’s share. |
| Solidarity surcharge | Solidaritätszuschlag | User’s share if married. |
| Church tax | Kirchensteuer | User’s share if married. |
| Trade tax | Gewerbesteuer | Full municipal tax (the § 35 credit reduces ESt, not GewSt paid). 0 for Freiberufler. |
| § 35 credit | Steuerermäßigung nach § 35 EStG | Informational. |
| KV | Krankenversicherung | GKV contribution or full PKV premium (cash). |
| PV | Pflegeversicherung | Statutory or private Pflegepflicht. |
| RV | Rentenversicherung | 0 if none. |
| AV | Arbeitslosenversicherung | 0 if none. |
| zvE | Zu versteuerndes Einkommen | After deductions, user’s zvE (and joint zvE if married). |
| Tarifliche ESt | Tarifliche Einkommensteuer | Before § 35. |
| Deductible Vorsorge | Abziehbare Vorsorgeaufwendungen | Informational. |
| Effective burden | Effektive Gesamtbelastung | (Gewinn − Netto) / Gewinn × 100, two decimals. Undefined if Gewinn is 0; show „—“. |
| Marginal burden | Effektive Grenzbelastung | [TotalBurden(Gewinn+100) − TotalBurden(Gewinn)] / 100, as a percentage with two decimals. Re-run the **entire** pipeline at Gewinn+100. Using +100 € avoids one-euro rounding noise. |
| Statutory marginal rate | Tariflicher Grenzsteuersatz | 0 / 14–23.97 % / 23.97–42 % / 42 % / 45 %, according to the zone of the final (user, or half-of-joint) zvE. Informational. |
| Assessment bases | Beitragsbemessung KV/PV, RV | Shown in the breakdown so the user sees a clamp to the minimum or the BBG. |

If Gewinn is 0, social contributions still apply at the GKV/PV minimum (the person remains insured). Netto can be negative. If Gewinn is 0 and the user is not entering a PKV premium, use the GKV minimum. Do not crash.

---

## 6. Calculation pipeline

Use **decimal arithmetic** (for example `decimal.js`, or integer cents where a value is always a whole cent). IEEE-754 floats are forbidden for money and for the § 32a formulae. Recommended precision: at least 20 significant digits. Then apply the rounding rules of Section 9.

Process the steps in this order. Do not deduct Gewerbesteuer from Gewinn (§ 4 Abs. 5b EStG: GewSt is not a Betriebsausgabe). Social contributions are Sonderausgaben after § 10, not Betriebsausgaben.

### 6.1 Load year parameters

Load the block for the selected year from the single parameter file (Section 7).

### 6.2 Statutory KV and PV assessment base

For GKV (and statutory PV):

```
annual_min = Bezugsgröße_year / 3          # exact: 15,820 (2026), 14,980 (2025)
annual_bbg = BBG_KV_year                   # 69,750 (2026), 66,150 (2025)
bemessung  = clamp(Gewinn, annual_min, annual_bbg)
```

`clamp(x, lo, hi) = min(max(x, lo), hi)`.

The legal minimum is 1/90 of the monthly Bezugsgröße per calendar day (§ 240 Abs. 4 SGB V), with a month of 30 days (§ 223 Abs. 2 SGB V), i.e. one third of the Bezugsgröße. The often-quoted monthly figure 1,318.33 € (2026) is 3,955 / 3 rounded to cents; the **annual** figure 15,820 € is exact (47,460 / 3) and is what the calculator uses.

The contribution is legally based on the profit shown in the Einkommensteuerbescheid, and on other income if any. v1 uses only the entered Gewinn. The disclaimer covers the rest.

### 6.3 KV cash and deductible amount

**GKV ermäßigt** (no Krankengeld): rate = 14.0 % + Zusatzbeitrag.  
**GKV allgemein** (with Krankengeld from day 43): rate = 14.6 % + Zusatzbeitrag.

```
kv_cash = commercial_round_cents(bemessung × kv_rate)
```

Deductibility (§ 10 Abs. 1 Nr. 3 Buchst. a Satz 4 EStG): if the general rate applies (Krankengeld claim), **reduce the contribution by 4 %** — that is, multiply by 0.96, not subtract 4 percentage points. The 4 % applies to the whole GKV contribution including Zusatzbeitrag. PV is not reduced.

```
kv_deductible = commercial_round_cents(kv_cash × 0.96)   # if Krankengeld
kv_deductible = kv_cash                                    # if ermäßigt
```

**PKV:**

```
kv_cash        = commercial_round_cents(monthly_premium × 12)
kv_deductible  = commercial_round_cents(monthly_basis    × 12)   # user-entered Basis share
```

No automatic 4 % cut: the Basis share is already the insurer-certified deductible portion.

### 6.4 PV cash and deductible amount

**Statutory PV** (together with GKV), full rate paid by the self-employed (employer/employee split and the Sachsen split do **not** apply):

| Situation | Rate |
|---|---|
| Under 23, no children | 3.6 % |
| Age 23+, childless (no Elterneigenschaft) | 4.2 % = 3.6 % + 0.6 % Zuschlag |
| Elterneigenschaft, 0 or 1 child under 25 | 3.6 % (the 3.6 % for one child is lifelong) |
| 2 children under 25 | 3.35 % |
| 3 children under 25 | 3.10 % |
| 4 children under 25 | 2.85 % |
| 5 or more children under 25 | 2.60 % |

```
pv_cash = commercial_round_cents(bemessung × pv_rate)
pv_deductible = pv_cash    # fully deductible
```

**Private Pflegepflichtversicherung** (with PKV):

```
pv_cash = pv_deductible = commercial_round_cents(monthly_private_pv × 12)
```

### 6.5 RV and AV

Contribution rate for RV: 18.6 % in both 2025 and 2026.

- **Keine:** `rv_cash = 0`.
- **Freiwillig:** `rv_cash = commercial_round_cents(monthly_amount × 12)`, monthly_amount in [Mindestbeitrag, Höchstbeitrag] (Section 7). Reject out-of-range input.
- **Pflicht (einkommensbezogen):** `rv_cash = clamp(commercial_round_cents(Gewinn × 0.186), min_annual, max_annual)` where min_annual = Mindestbeitrag_monthly × 12 and max_annual = Höchstbeitrag_monthly × 12. (If Gewinn is below the Geringfügigkeitsgrenze, the clamp still applies the legal minimum contribution; the app does not model a possible exemption.)
- **Regelbeitrag:** `rv_cash = commercial_round_cents(Regelbeitrag_monthly × 12)`. Regelbeitrag = monthly Bezugsgröße × 18.6 %, commercially rounded to cents (735.63 € / month in 2026, nationwide; the Bezugsgröße has been uniform since 2025).

**AV auf Antrag** (§ 345b, § 341 Abs. 2, § 28a SGB III):

```
monthly_base = Bezugsgröße_monthly          # or half, in Anlaufphase
av_monthly   = commercial_round_cents(monthly_base × 0.026)
av_cash      = commercial_round_cents(av_monthly × 12)
```

2026 full: 3,955 × 2.6 % = **102.83 € / month** (1,233.96 € / year).  
2026 Anlaufphase: **51.42 € / month**.  
2025 full: 3,745 × 2.6 % = **97.37 € / month**.

AV is a „sonstige Vorsorgeaufwendung“ (§ 10 Abs. 1 Nr. 3a). It is only deductible if there is room under the 2,800 € cap after Basis-KV/PV (almost never, for a self-employed GKV member). It is always a cash outflow.

### 6.6 Deductible Vorsorgeaufwendungen (§ 10 EStG)

**Altersvorsorge** (RV, including voluntary and Regelbeitrag), § 10 Abs. 3: 100 % deductible from 2023, up to the Höchstbeitrag zur knappschaftlichen Rentenversicherung, rounded **up** to a whole euro: **30,826 €** (2026), **29,344 €** (2025). The cap **doubles** for Zusammenveranlagung (61,652 / 58,688). v1 applies the doubled cap to the **user’s** RV only. If the spouse also has substantial Altersvorsorge already reflected in spouse zvE, this can be slightly generous. Document in the UI help, do not ask for spouse RV in v1.

```
cap_alter     = Höchstbetrag × (2 if married else 1)
deduct_alter  = min(rv_cash, cap_alter)
```

**Basis-KV and PV**, and the 1,900 / 2,800 cap, § 10 Abs. 4:

The 2,800 € cap applies to self-employed persons who pay their own KV (no employer subsidy). The 1,900 € cap is for employees with an employer subsidy; v1 always uses **2,800 €** (and does not double it — only the user’s Basis-KV/PV is entered).

```
basis = kv_deductible + pv_deductible
if basis >= 2800:
    deduct_basis    = basis          # fully deductible, § 10 Abs. 4 Satz 4
    deduct_sonstige = 0              # Nr. 3a (AV, etc.) cannot be deducted
else:
    deduct_basis    = basis
    deduct_sonstige = min(av_cash, 2800 - basis)
```

```
vorsorge = deduct_alter + deduct_basis + deduct_sonstige
```

### 6.7 Sonderausgaben-Pauschbetrag, spouse zvE, Kirchensteuer iteration, and ESt

Pauschbetrag (§ 10c EStG): **36 €** single, **72 €** married. It covers Sonderausgaben of § 10 Abs. 1 Nr. 4, 5, 7, 9, Abs. 1a and § 10b — including Kirchensteuer — and is used only if actual amounts are not higher. It is **not** a Vorsorge deduction.

```
pausch = 72 if married else 36
```

**Known simplification:** if the user enters a pre-computed spouse zvE that already includes the spouse’s 36 € Pauschbetrag, applying 72 € on the user’s side can over-deduct 36 €. When spouse zvE is 0, 72 € is correct.

Kirchensteuer is a percentage of **festzusetzende ESt** (after § 35), not including Soli, and is itself a deductible Sonderausgabe. That is circular. Iterate to a fixed point:

```
kist = 0
repeat up to 30 times:
    sa   = max(pausch, other_sonderausgaben + kist)
    zve  = floor_euro(Gewinn - vorsorge - sa)     # not below 0
    zve_joint = zve + floor_euro(spouse_zve)      # spouse_zve is 0 if unmarried
    if married:
        half = floor_euro(zve_joint / 2)
        est  = 2 × tariff(half, year)             # tariff already floors to a euro
    else:
        est  = tariff(zve, year)
    credit = gewerbesteuer_credit(est, …)         # § 35, Section 6.8; 0 if Freiberufler
    fest   = max(0, est - credit)                 # may have cents if the credit has cents
    kist_new = commercial_round_cents(kist_rate × fest)   if church member else 0
    stop when kist_new == kist
    kist = kist_new
```

`kist_rate` is 0.08 or 0.09. If there is no church tax, the loop runs once with kist = 0.

**Income-tax tariff** `tariff(x, year)` implements § 32a Abs. 1 exactly. `x` is already a whole euro. The result is floored to a whole euro. Formulae and zone boundaries: Section 7.

**Splitting** is § 32a Abs. 5: twice the tax on half the joint zvE, after half is floored to a whole euro by Abs. 1.

**Allocation for Netto when married and spouse zvE > 0:**

```
share      = zve / zve_joint          # user’s zvE over joint zvE; 1 if joint is 0
est_user   = commercial_round_cents(fest × share)
soli_user  = commercial_round_cents(soli × share)
kist_user  = commercial_round_cents(kist × share)
```

Show joint and allocated amounts. If spouse zvE is 0, share = 1. This allocation is illustrative: the Finanzamt assesses jointly.

### 6.8 Gewerbesteuer and the § 35 credit

Only if Tätigkeitsart is Gewerbe. Hinzurechnungen and Kürzungen are ignored: Gewerbeertrag = Gewinn.

```
gewerbeertrag = floor_to_100_euros(Gewinn)          # § 11 Abs. 1 GewStG
taxable       = max(0, gewerbeertrag - 24,500)      # Freibetrag, natural persons
Messbetrag    = taxable × 0.035                     # Steuermesszahl 3.5 %; result is at most 2 decimal places
GewSt         = commercial_round_cents(Messbetrag × Hebesatz / 100)
```

§ 35 EStG credit:

```
four         = 4.0 × Messbetrag
proportional = (positive_gewerbliche / sum_of_positive_Einkünfte) × tarifliche_ESt
credit       = min(four, GewSt, proportional, tarifliche_ESt)
```

For v1, `positive_gewerbliche` is the user’s Gewinn if positive, else 0. `sum_of_positive_Einkünfte` is that Gewinn plus spouse zvE if the spouse zvE is positive. If only the user has positive income, proportional = tarifliche ESt (full). At a Hebesatz of 400 %, `four == GewSt`, so the credit equals the GewSt unless tarifliche ESt is smaller. At a Hebesatz above 400 %, a residual GewSt remains. The credit reduces festzusetzende ESt; the user still **pays** the full GewSt to the municipality.

### 6.9 Solidaritätszuschlag

Rate 5.5 %, Milderung 11.9 %, Freigrenze from Section 7. „Bruchteile eines Cents bleiben außer Ansatz“ (§ 4 SolzG 1995): floor to cents. Soli is due only if the assessment base **exceeds** the Freigrenze (`>` not `≥`).

```
if fest_soli <= Freigrenze:          # 20,350 single / 40,700 joint in 2026
    soli = 0
else:
    soli = floor_cents( min(0.055 × fest_soli, 0.119 × (fest_soli - Freigrenze)) )
```

The Milderungszone ends when `0.055 × ESt = 0.119 × (ESt − Freigrenze)`, i.e. at `ESt = Freigrenze × 11.9/6.4 = Freigrenze × 1.859375`. For 2026 single: 37,838.28125 € of ESt. Above that, the full 5.5 % applies.

**Assessment base `fest_soli`:** SolzG § 3 Abs. 2 requires the ESt that **would** be assessed if Kinderfreibeträge after § 32 Abs. 6 were always deducted. Kindergeld is ignored here.

```
kfb_per_child = (both-parents amount if married or „voller Kinderfreibetrag“ else one-parent amount)
                # 2026: 9,756 / 4,878;  2025: 9,600 / 4,800
kfb           = kfb_per_child × number_of_children          # same child count as the KFB input, default = Kinder unter 25
zve_soli      = floor_euro(Gewinn - vorsorge - sa - kfb)    # not below 0; sa as after KiSt convergence
# then tariff (and Splitting, and § 35 recomputed on this fictitious ESt) → fest_soli
```

If there are no children, `fest_soli = fest` (the real festzusetzende ESt, after § 35).

KiSt uses the same fictitious Kinderfreibetrag reduction of the tax base in the official Land rules; for v1 apply it to Soli as above, and also compute KiSt on a fictitious `fest` that uses `zve_soli` **instead of** `zve` when children > 0, inside the same iteration (sa still uses the real KiSt). If this coupling is implemented, the golden tests in Section 11 that have both KiSt and children must be recomputed and the SPEC updated; **v1 golden tests never combine KiSt with children**, so implementing KiSt-on-fictitious-ESt is optional and must not change the published golden cases. Minimum requirement: Kinderfreibetrag on the **Soli** base.

### 6.10 Netto and rates

Cash outflows:

```
taxes        = est_user + soli_user + kist_user + GewSt     # est_user is festzusetzende, after § 35
social       = kv_cash + pv_cash + rv_cash + av_cash
total_burden = taxes + social
Netto        = Gewinn - total_burden
effective_%  = total_burden / Gewinn × 100                  # two decimals, commercial
marginal_%   = (total_burden(Gewinn+100) - total_burden(Gewinn)) / 100 × 100
```

Do not subtract the § 35 credit as a separate cash item: it already reduced `est_user`.

---

## 7. Parameter tables

Every value below is taken from an official source. If a later official change contradicts this table, the enacted law wins and this file must be updated in one place: the parameter module.

### 7.1 Einkommensteuer, § 32a EStG

Rounding, both years (§ 32a Abs. 1 Sätze 1, 3–6): zvE is first rounded **down** to a whole euro. `y` is one ten-thousandth of (zvE − Grundfreibetrag). `z` is one ten-thousandth of (zvE − the zone-2 upper bound). `x` is the floored zvE. The resulting tax is rounded **down** to a whole euro. Splitting: twice the tax on half the joint zvE (§ 32a Abs. 5).

**2026** — § 32a EStG in the version applicable from VZ 2026, <https://www.gesetze-im-internet.de/estg/__32a.html> (Steuerfortentwicklungsgesetz of 23.12.2024, BGBl. 2024 I Nr. 449, Art. 2). Confirmed by BMF, <https://www.bundesfinanzministerium.de/Content/DE/Standardartikel/Themen/Steuern/das-aendert-sich-2026.html>.

| Zone | zvE from | to | Formula |
|---|---|---|---|
| 1 | 0 | 12,348 (Grundfreibetrag) | 0 |
| 2 | 12,349 | 17,799 | `(914.51 × y + 1,400) × y` with `y = (zvE − 12,348) / 10,000` |
| 3 | 17,800 | 69,878 | `(173.10 × z + 2,397) × z + 1,034.87` with `z = (zvE − 17,799) / 10,000` |
| 4 | 69,879 | 277,825 | `0.42 × x − 11,135.63` |
| 5 | 277,826 and above | — | `0.45 × x − 19,470.38` |

**2025** — Steuerfortentwicklungsgesetz Art. 1; official text in EStH 2025 (BMF), <https://esth.bundesfinanzministerium.de/esth/2025/A-Einkommensteuergesetz/IV-Tarif-31-34b/Paragraf-32a/paragraf-32a.html>, and the DRV historical statute, <https://rvrecht.deutsche-rentenversicherung.de/SharedDocs/rvRecht/05_Normen_und_Vertraege/02_C-K/EStG/0032a/0032a_2025_01_01.html>. The live gesetze-im-internet.de page already shows the 2026 wording.

| Zone | zvE from | to | Formula |
|---|---|---|---|
| 1 | 0 | 12,096 (Grundfreibetrag) | 0 |
| 2 | 12,097 | 17,443 | `(932.30 × y + 1,400) × y` with `y = (zvE − 12,096) / 10,000` |
| 3 | 17,444 | 68,480 | `(176.64 × z + 2,397) × z + 1,015.13` with `z = (zvE − 17,443) / 10,000` |
| 4 | 68,481 | 277,825 | `0.42 × x − 10,911.92` |
| 5 | 277,826 and above | — | `0.45 × x − 19,246.67` |

### 7.2 Solidaritätszuschlag, SolzG 1995

| Item | 2025 | 2026 | Source |
|---|---|---|---|
| Rate | 5.5 % | 5.5 % | § 4 Satz 1 SolzG 1995, <https://www.gesetze-im-internet.de/solzg_1995/__4.html> |
| Milderung | 11.9 % of (ESt − Freigrenze) | same | § 4 Satz 2 SolzG 1995 |
| Freigrenze, single | 19,950 € | 20,350 € | 2026: § 3 Abs. 3 SolzG 1995, <https://www.gesetze-im-internet.de/solzg_1995/__3.html>. 2025: SteFeG of 23.12.2024 Art. 3, first applied in VZ 2025 (LStH 2026, BMF, <https://ao.bundesfinanzministerium.de/lsth/2026/B-Anhaenge/Anhang-27/I/anhang-27-I.html> § 6 Abs. 26–27). |
| Freigrenze, joint | 39,900 € | 40,700 € | same |
| Rounding | fractions of a cent discarded | same | § 4 Satz 3 SolzG 1995 |

### 7.3 Kirchensteuer

| Land | Rate | Source |
|---|---|---|
| Baden-Württemberg, Bayern | 8 % of festzusetzende ESt | Landeskirchensteuerbeschlüsse / KirchStG; overview: Deutsche Bischofskonferenz, <https://www.dbk.de/themen/kirche-und-geld/kirchensteuer>. Bayerisches KirchStG: <https://www.gesetze-bayern.de/Content/Document/BayKirchStG/true>. |
| All other Länder | 9 % | same |

Deductible as Sonderausgabe: § 10 Abs. 1 Nr. 4 EStG, <https://www.gesetze-im-internet.de/estg/__10.html>.

### 7.4 Sonderausgaben, other than church tax

| Item | 2025 | 2026 | Source |
|---|---|---|---|
| Altersvorsorge, 100 % deductible | from 2023 | from 2023 | § 10 Abs. 3 Satz 6 EStG |
| Höchstbetrag Altersvorsorge, single | 29,344 € | 30,826 € | § 10 Abs. 3 Satz 1: Höchstbeitrag zur knappschaftlichen RV, rounded **up** to a euro. 2026: ceil(124,800 × 24.7 %) = ceil(30,825.60) = 30,826. 2025: ceil(118,800 × 24.7 %) = ceil(29,343.60) = 29,344. DRV, <https://www.deutsche-rentenversicherung.de/DRV/DE/Ueber-uns-und-Presse/Presse/Meldungen/2026/260420-vorsorgen-und-steuern-sparen>. Knappschaft BBG: SVBezGrV. Knappschaft rate 24.7 %: RVBeitrSBek 2026, <https://www.gesetze-im-internet.de/rvbeitrsbek_2026/BJNR1230A0025.html> (BGBl. 2025 I Nr. 291). |
| Höchstbetrag, joint | 58,688 € | 61,652 € | § 10 Abs. 3 Satz 2 (doubled) |
| Sonstige Vorsorge cap, self-employed | 2,800 € | 2,800 € | § 10 Abs. 4 Satz 1 EStG |
| Sonstige Vorsorge cap, with employer KV subsidy | 1,900 € | 1,900 € | § 10 Abs. 4 Satz 2 — not used in v1 |
| Basis-KV 4 % reduction if Krankengeld | yes | yes | § 10 Abs. 1 Nr. 3 Buchst. a Satz 4 EStG |
| Sonderausgaben-Pauschbetrag | 36 € / 72 € | 36 € / 72 € | § 10c EStG, <https://www.gesetze-im-internet.de/estg/__10c.html> |
| Kinderfreibetrag, one parent (sächlich + BEA) | 4,800 € | 4,878 € | § 32 Abs. 6 EStG, <https://www.gesetze-im-internet.de/estg/__32.html>; BMF Monatsbericht Feb 2026, <https://www.bundesfinanzministerium.de/Monatsberichte/Ausgabe/2026/02/Inhalte/Kapitel-2-Analysen/2-5-wichtigste-steuerliche-aenderungen-2026.html> (3,336+1,464 / 3,414+1,464) |
| Kinderfreibetrag, both parents | 9,600 € | 9,756 € | same |

### 7.5 Gewerbesteuer

| Item | Value | Source |
|---|---|---|
| Rounding of Gewerbeertrag | down to a full 100 € | § 11 Abs. 1 GewStG, <https://www.gesetze-im-internet.de/gewstg/__11.html> |
| Freibetrag (natural persons, partnerships) | 24,500 € | § 11 Abs. 1 Nr. 1 GewStG |
| Steuermesszahl | 3.5 % | § 11 Abs. 2 GewStG |
| Default Hebesatz | 400 % | Product default; the user enters the municipal rate |
| Not a Betriebsausgabe | yes | § 4 Abs. 5b EStG, <https://www.gesetze-im-internet.de/estg/__4.html> |
| § 35 multiplier | 4.0 × Messbetrag | § 35 Abs. 1 EStG, <https://www.gesetze-im-internet.de/estg/__35.html> |
| § 35 caps | actual GewSt, and the proportional tarifliche ESt | § 35 Abs. 1 Sätze 1, 2 and 5 |

### 7.6 Gesetzliche Krankenversicherung

| Item | 2025 | 2026 | Source |
|---|---|---|---|
| General rate (with Krankengeld) | 14.6 % | 14.6 % | § 241 SGB V, <https://www.gesetze-im-internet.de/sgb_5/__241.html> |
| Ermäßigt (no Krankengeld) | 14.0 % | 14.0 % | § 243 SGB V, <https://www.gesetze-im-internet.de/sgb_5/__243.html> |
| Official average Zusatzbeitrag (BMG) | 2.5 % | 2.9 % | GKV-Spitzenverband, <https://www.gkv-spitzenverband.de/krankenversicherung/kv_grundprinzipien/finanzierung/zusatzbeitragssatz/zusatzbeitragssatz.jsp>; BMG, <https://www.bundesgesundheitsministerium.de/beitraege> (2026: 2.9 %). The actual membership-weighted average can be higher (GKV-SV quoted 3.13 % at the 2026 new-year change). The default is the official BMG figure; the user overrides it. |
| BBG KV/PV, annual | 66,150 € | 69,750 € | Equals JAEG after § 6 Abs. 7 SGB V: SVBezGrV 2025 § 2 Abs. 2, <https://www.gesetze-im-internet.de/svbezgrv_2025/BJNR16D0A0024.html> (BGBl. 2024 I Nr. 365); SVBezGrV 2026 § 2 Abs. 2, <https://www.gesetze-im-internet.de/svbezgrv_2026/BJNR1160A0025.html> (BGBl. 2025 I Nr. 278); BMG, <https://www.bundesgesundheitsministerium.de/beitraege>. |
| BBG KV/PV, monthly | 5,512.50 € | 5,812.50 € | same |
| Bezugsgröße, annual | 44,940 € | 47,460 € | SVBezGrV 2025 / 2026 § 1; BMAS, <https://www.bmas.de/DE/Service/Presse/Pressemitteilungen/2025/sozialversicherungsrechengroessen-2026.html> |
| Bezugsgröße, monthly | 3,745 € | 3,955 € | same |
| Mindestbemessungsgrundlage, annual | 14,980 € | 15,820 € | § 240 Abs. 4 SGB V (1/90 of monthly Bezugsgröße per day × 30 = Bezugsgröße / 3), <https://www.gesetze-im-internet.de/sgb_5/__240.html>. Exact. |
| Mindestbemessungsgrundlage, monthly (display) | 1,248.33 € | 1,318.33 € | 3,745/3 and 3,955/3, rounded to cents. BMG 2026 table uses 1,318.33 € and minimum contributions 222.80 € (ermäßigt + 2.9 %) / 230.71 € (allgemein + 2.9 %), which matches 1,318.33 × 16.9 % and 17.5 %. |
| Assessment | profit from the Steuerbescheid | same | § 240 Abs. 4a SGB V |

Cross-check, 2026, official average Zusatzbeitrag, BMG table: Höchstbeitrag ermäßigt 982.31 € / month = 5,812.50 × 16.9 %; allgemein 1,017.19 € = 5,812.50 × 17.5 %. The annual calculator uses the annual BBG and produces the same monthly amounts when divided by 12 and commercially rounded.

### 7.7 Pflegeversicherung

| Item | 2025 | 2026 | Source |
|---|---|---|---|
| Base rate | 3.6 % | 3.6 % | PBAV 2025 § 1, <https://www.gesetze-im-internet.de/pbav_2025/__1.html> (BGBl. 2024 I Nr. 446), setting the § 55 Abs. 1 SGB XI rate at 3.6 % from 1.1.2025. The consolidated § 55 still shows the statutory 3.4 %; the ordinance is the operative rate. BMG, <https://www.bundesgesundheitsministerium.de/themen/pflege/online-ratgeber-pflege/die-pflegeversicherung/finanzierung>, confirms the 3.6 % rate „seit dem 1. Januar 2025“ and lists the same child-related rates for the current period. No later ordinance changing the 2026 rate was found. |
| Childless surcharge (age 23+) | +0.6 pp → 4.2 % | same | § 55 Abs. 3 Satz 1 SGB XI, <https://www.gesetze-im-internet.de/sgb_11/__55.html> |
| Abschlag, 2nd to 5th child under 25 | −0.25 pp each | same | § 55 Abs. 3 Satz 4 SGB XI. Resulting rates: 3.35 / 3.10 / 2.85 / 2.60 %. |
| Self-employed share | full rate | full rate | No employer. The Sachsen 1.3/2.3 split applies only to employees (BMG). |
| BBG | same as KV | same as KV | § 55 Abs. 2 SGB XI |

### 7.8 Rentenversicherung and Arbeitslosenversicherung

| Item | 2025 | 2026 | Source |
|---|---|---|---|
| RV rate (allgemeine RV) | 18.6 % | 18.6 % | RVBeitrSBek 2026, <https://www.gesetze-im-internet.de/rvbeitrsbek_2026/BJNR1230A0025.html>; DRV Nord, 18.12.2025, <https://www.deutsche-rentenversicherung.de/Nord/DE/Presse/Pressemitteilungen-und-Pressearchiv/Pressemitteilungen/20251218_Aenderung-RV-01012026>. 2025: the same 18.6 % (ninth year in a row, per that DRV release). |
| Knappschaft rate (for the § 10 cap only) | 24.7 % | 24.7 % | RVBeitrSBek 2026 |
| BBG allgemeine RV, annual | 96,600 € | 101,400 € | SVBezGrV 2025 / 2026 § 4 |
| BBG allgemeine RV, monthly | 8,050 € | 8,450 € | same |
| BBG knappschaftlich, annual | 118,800 € | 124,800 € | SVBezGrV 2025 / 2026 § 4 |
| Regelbeitrag, monthly | 696.57 € | 735.63 € | Bezugsgröße_monthly × 18.6 %, commercial cents. 3,745 × 0.186 = 696.57; 3,955 × 0.186 = 735.63. Nationwide (unified Bezugsgröße). |
| Freiwillig / Pflicht min, monthly | 103.42 € | 112.16 € | 2026 official: DRV Nord 18.12.2025 (112.16 €). Method: Geringfügigkeitsgrenze × 18.6 %, commercial cents. 2026 Geringfügigkeitsgrenze 603 € (DRV, Mindestlohn 13.90 €). 2025: 556 × 0.186 = 103.416 → 103.42 (Geringfügigkeitsgrenze 556 €, DRV: „steigt von 556 auf 603“). |
| Freiwillig / Pflicht max, monthly | 1,497.30 € | 1,571.70 € | BBG_monthly × 18.6 %. 2026 official: DRV Nord 18.12.2025 (1,571.70 € = 8,450 × 0.186). 2025: 8,050 × 0.186 = 1,497.30. |
| AV rate | 2.6 % | 2.6 % | § 341 Abs. 2 SGB III, <https://www.gesetze-im-internet.de/sgb_3/__341.html> |
| AV on request, monthly full | 97.37 € | 102.83 € | § 345b SGB III, <https://www.gesetze-im-internet.de/sgb_3/__345b.html>: Bezugsgröße × 2.6 %. 3,955 × 0.026 = 102.83; 3,745 × 0.026 = 97.37. |
| AV Anlaufphase, monthly | 48.69 € | 51.42 € | § 345b Satz 2: half Bezugsgröße, in the calendar year of starting and the following calendar year. 1,977.50 × 0.026 = 51.415 → 51.42; 1,872.50 × 0.026 = 48.685 → 48.69. |

### 7.9 Values that are not guessed

No parameter in the tables above is marked UNVERIFIED. The following are **specified product rules**, not unverified law:

- Kirchensteuer rounding: commercially to cents. Some Länder round to a whole euro; a 1-euro difference is possible.
- KiSt combined with Kinderfreibetrag is not in the golden tests (Section 6.9).
- Spouse-zvE simplifications (Sections 4 and 6.7).
- 2025 voluntary RV min 103.42 € is computed from the same official method DRV publishes for 2026, not from a separate 2025 DRV press line.

---

## 8. 2027 — not a supported year

- **Income-tax tariff 2027:** a government draft (Regierungsentwurf eines Einkommensteuerreformgesetzes 2027) existed in 2026 and was not enacted as of the research for this SPEC. Do not implement 2027 ESt figures from the draft.
- **Social-insurance Rechengrößen 2027:** the cabinet decided the ordinance on 2026-10-07 (BMAS, <https://www.bmas.de/DE/Service/Presse/Pressemitteilungen/2026/bundeskabinett-beschliesst-sozialversicherungsrechengroessen-2027.html>) and at that time still needed Bundesrat consent. Proposed figures (for information only, **not** for the app until published in the BGBl): Bezugsgröße 49,560 € / 4,130 €; RV-BBG 106,200 € / 8,850 €; KV JAEG § 6 Abs. 7 = 72,900 €; KV-BBG 76,500 € / 6,375 € (this BBG equals JAEG § 6 Abs. 7 plus 3,600 €, which is already the formula in the current § 223 Abs. 4 SGB V for 2027, <https://www.gesetze-im-internet.de/sgb_5/__223.html>). Knappschaft-BBG 130,800 €.

When 2027 is enacted, add a third block to the single parameter file and extend the golden tests. Do not invent a tariff.

---

## 9. Rounding rules (normative)

| Quantity | Rule |
|---|---|
| zvE | Down to a whole euro (§ 32a Abs. 1 Satz 1) |
| Half of joint zvE, before the tariff | Down to a whole euro (Abs. 1 applied to the half) |
| Tarifliche ESt | Compute with high-precision decimals, then down to a whole euro (§ 32a Abs. 1 Satz 6) |
| Gewerbeertrag | Down to a full 100 € |
| Messbetrag | Exact (3.5 % of a multiple of 100 is at most two decimal places: `.00` or `.50`) |
| GewSt, social contributions, KiSt, deductible 96 % amount, allocated joint tax | Commercial (kaufmännisch, half away from 0 / ROUND_HALF_UP) to cents |
| Soli | Down to cents (fractions of a cent discarded) |
| § 35 credit | `min(...)` left at cents; festzusetzende ESt = tarifliche ESt − credit, no further rounding |
| Monthly display | Annual / 12, commercial to cents |
| Percentages (effective, marginal) | Commercial to two decimal places |
| Altersvorsorge Höchstbetrag (already in the params) | Already rounded **up** to a euro in Section 7; do not recompute at runtime unless the parameter file says so |

---

## 10. Architecture

Already decided; refine only as follows.

- **One static web app, no backend.** TypeScript, Vite. Deploy to GitHub Pages (`vite build`, configurable `base`).
- **Pure calculation module, separate from the UI.** The UI imports one function, e.g. `calculateNetto(input): Result`. The function is deterministic, has no I/O, and is the only place the pipeline lives.
- **Year parameters in one data file** (e.g. `src/netto/params.ts`) with a `2025` and a `2026` block. A yearly legal update must not require touching the pipeline, only this file (and new golden tests).
- **Decimal arithmetic** in the core. Vitest tests the core, including every golden case in Section 11 and the isolated tariff table.
- **German UI**, vanilla TypeScript + HTML + CSS is preferred (no React/Vue requirement). Accessible labels, `de-DE` number formatting, the disclaimer in the footer.
- **Optional CLI** (`src/cli/`) wrapping the same `calculateNetto`. Nice-to-have.
- **No plugin framework, no calculator registry.** The only planned second product is Kindesunterhalt. Share only what the two will actually share:
  - Vite / TypeScript / GitHub Pages tooling
  - `de-DE` number formatting
  - a thin app shell (header, a simple nav, footer with the disclaimer)
  - Kindersunterhalt, when it comes, gets its own folder (`src/unterhalt/`) and its own core. It does not share tax logic with this calculator.
- Suggested layout (names may change, the separation may not):

```
netto-calc/
  SPEC.md                 # this file
  reference_calc.py       # research aid that produced Section 11; not the product
  package.json
  vite.config.ts
  index.html
  src/
    shell/                # header, footer, formatting
    netto/
      params.ts
      money.ts            # decimal helpers, rounding
      income-tax.ts       # § 32a, Soli, KiSt iteration
      social.ts
      gewerbesteuer.ts
      calculate.ts        # pipeline
      calculate.test.ts
      income-tax.test.ts
    ui/                   # form + results, German
    cli/                  # optional
```

- README: how to run, how to deploy, the disclaimer, and a one-line pointer at SPEC.md.
- License and repo location are the product owner’s choice; GitHub Pages is the deploy target.

---

## 11. Tests

The core is not done until every test in this section passes exactly (cents for money, whole euros for tarifliche ESt).

**Common defaults** unless a case overrides them: year 2026, Freiberufler, not married, spouse zvE 0, no church tax, 0 children, no Elterneigenschaft, age 23+, GKV ermäßigt, Zusatzbeitrag = official average, no RV, no AV, other Sonderausgaben 0, Hebesatz 400 %, full Kinderfreibetrag only if married.

### 11.1 Isolated income-tax tariff

These are zvE → tarifliche ESt only. QA should check a sample against <https://www.bmf-steuerrechner.de> („Berechnung der Einkommensteuer“).

**2026, Grundtarif**

| zvE | Zone | raw (before floor) | ESt |
|---|---|---|---|
| 0 | 1 | 0 | 0 |
| 12,348 | 1 | 0 | 0 |
| 12,349 | 2 | 0.1400091451 | 0 |
| 17,799 | 2 | 1,034.8720234851 | 1,034 |
| 17,800 | 3 | 1,035.1097017310 | 1,035 |
| 30,000 | 3 | 4,217.1339781310 | 4,217 |
| 50,000 | 3 | 10,548.3312181310 | 10,548 |
| 69,878 | 3 | 18,213.0629991710 | 18,213 |
| 69,879 | 4 | 18,213.55 | 18,213 |
| 80,000 | 4 | 22,464.37 | 22,464 |
| 100,000 | 4 | 30,864.37 | 30,864 |
| 105,246 | 4 | 33,067.69 | 33,067 |
| 277,825 | 4 | 105,550.87 | 105,550 |
| 277,826 | 5 | 105,551.32 | 105,551 |
| 400,000 | 5 | 160,529.62 | 160,529 |

**2026, Splitting:** joint zvE 80,000 → half 40,000 → ESt 2 × 7,209 = **14,418**. Joint 160,000 → half 80,000 → 2 × 22,464 = **44,928**.

**2025, Grundtarif**

| zvE | Zone | raw | ESt |
|---|---|---|---|
| 0 | 1 | 0 | 0 |
| 12,096 | 1 | 0 | 0 |
| 12,097 | 2 | 0.1400093230 | 0 |
| 17,443 | 2 | 1,015.1283831070 | 1,015 |
| 17,444 | 3 | 1,015.3697017664 | 1,015 |
| 30,000 | 3 | 4,303.5657590336 | 4,303 |
| 50,000 | 3 | 10,691.3531510336 | 10,691 |
| 68,480 | 3 | 17,849.7741118016 | 17,849 |
| 68,481 | 4 | 17,850.10 | 17,850 |
| 80,000 | 4 | 22,688.08 | 22,688 |
| 277,825 | 4 | 105,774.58 | 105,774 |
| 277,826 | 5 | 105,775.03 | 105,775 |
| 400,000 | 5 | 160,753.33 | 160,753 |

**2025, Splitting:** joint 80,000 → **14,640**. Joint 160,000 → **45,376**.

**Isolated Soli, 2026, single, no children** (on festzusetzende ESt):

| ESt | Soli |
|---|---|
| 20,350 | 0 (does not exceed Freigrenze) |
| 20,351 | floor_cents(0.119 × 1) = 0.11 |
| 33,067 | floor_cents(min(1,818.685, 1,513.323)) = **1,513.32** (Milderung) |
| 37,839 | full 5.5 %: floor_cents(2,081.145) = **2,081.14** (at/above 20,350 × 1.859375) |
| 153,890 | floor_cents(8,463.950) = **8,463.95** |

### 11.2 Golden end-to-end cases

Expected values were computed from this pipeline with Python `Decimal` (see `reference_calc.py`). Worked steps are part of the expected result: a test that only asserts Netto is not enough; assert the intermediate amounts listed as **Expected**.

#### G1 — GKV minimum, low profit (2026)

Inputs: defaults, Gewinn **10,000**.

- Bemessung = 15,820 (minimum, Gewinn is below).
- KV = 15,820 × 16.9 % = **2,673.58** (100 % deductible, ermäßigt).
- PV = 15,820 × 4.2 % = **664.44**.
- Vorsorge = 3,338.02 ≥ 2,800, fully deductible.
- sa = 36, zvE = floor(10,000 − 3,338.02 − 36) = **6,625** < Grundfreibetrag.
- ESt 0, Soli 0, KiSt 0, GewSt 0.

**Expected:** KV 2,673.58; PV 664.44; ESt 0; Soli 0; Burden 3,338.02; **Netto 6,661.98**; monthly Netto 555.17; effective 33.38 %.

#### G2 — Profit above KV-BBG, and Soli Milderungszone (2026)

Inputs: defaults, Gewinn **120,000**.

- Bemessung = **69,750** (BBG).
- KV = 69,750 × 16.9 % = **11,787.75**; PV = 69,750 × 4.2 % = **2,929.50**; Vorsorge = 14,717.25.
- zvE = floor(120,000 − 14,717.25 − 36) = **105,246**.
- Zone 4: 0.42 × 105,246 − 11,135.63 = 33,067.69 → ESt **33,067**.
- Soli Milderung: 0.055 × 33,067 = 1,818.685; 0.119 × (33,067 − 20,350) = 1,513.323 → floor cents **1,513.32**. (ESt 33,067 is below 37,838.28, so Milderung applies.)

**Expected:** KV 11,787.75; PV 2,929.50; ESt 33,067; Soli 1,513.32; Burden 49,297.57; **Netto 70,702.43**; monthly 5,891.87; effective 41.08 %.

#### G3 — Gewerbe below the Freibetrag (2026)

Inputs: defaults, Tätigkeitsart **Gewerbe**, Gewinn **20,000**, Hebesatz 400 %.

- Bemessung = 20,000 (between min and BBG).
- KV = 20,000 × 16.9 % = **3,380.00**; PV = 20,000 × 4.2 % = **840.00**; Vorsorge = 4,220.00.
- Gewerbeertrag 20,000 − 24,500 → taxable 0; Messbetrag 0; GewSt **0**.
- zvE = floor(20,000 − 4,220 − 36) = **15,744**.
- Zone 2: y = (15,744 − 12,348) / 10,000 = 0.3396; raw = (914.51 × 0.3396 + 1,400) × 0.3396 = 580.9087556016 → ESt **580**.
- Soli 0.

**Expected:** GewSt 0; ESt 580; KV 3,380.00; PV 840.00; Burden 4,800.00; **Netto 15,200.00**; monthly 1,266.67; effective 24.00 %.

#### G4 — Gewerbe above the Freibetrag, Hebesatz 400 % (2026)

Inputs: defaults, **Gewerbe**, Gewinn **80,000**, Hebesatz **400 %**.

- Bemessung = 69,750; KV **11,787.75**; PV **2,929.50**; Vorsorge 14,717.25. Same socials as G14.
- Gewerbeertrag 80,000; taxable 55,500; Messbetrag = 55,500 × 3.5 % = **1,942.50**; GewSt = 1,942.50 × 4.00 = **7,770.00**.
- zvE = floor(80,000 − 14,717.25 − 36) = **65,246**.
- Zone 3: z = (65,246 − 17,799) / 10,000 = 4.7447; raw = (173.10 × 4.7447 + 2,397) × 4.7447 + 1,034.87 = 16,304.7739273790 → tarifliche ESt **16,304**.
- § 35: min(4 × 1,942.50, 7,770.00, 16,304) = **7,770.00**; festzusetzende ESt = **8,534.00**.
- Soli on 8,534: 0.

**Expected:** tarifliche ESt 16,304; credit 7,770.00; fest 8,534.00; GewSt 7,770.00; KV 11,787.75; PV 2,929.50; Burden 31,021.25; **Netto 48,978.75**; monthly 4,081.56; effective 38.78 %.

**Consistency:** G4 Netto **equals** G14 Netto. At 400 % the § 35 credit exactly offsets GewSt, so the cash position matches a Freiberufler with the same Gewinn.

#### G5 — Gewerbe, Hebesatz 500 %, residual GewSt (2026)

Same as G4 except Hebesatz **500 %**.

- Messbetrag still 1,942.50; GewSt = 1,942.50 × 5.00 = **9,712.50**.
- § 35 still 4 × 1,942.50 = **7,770.00** (capped below actual GewSt); fest still **8,534.00**.
- Extra cash vs G4: 1,942.50.

**Expected:** GewSt 9,712.50; fest 8,534.00; Burden 32,963.75; **Netto 47,036.25**; monthly 3,919.69; effective 41.20 %. Burden(G5) = Burden(G4) + 1,942.50.

#### G6 — Married Splitting, spouse zvE 0 (2026)

Inputs: defaults, Gewinn **80,000**, verheiratet, spouse zvE **0**.

- Socials as G14 (KV 11,787.75, PV 2,929.50). Altersvorsorge cap 61,652 (unused).
- Pauschbetrag 72; zvE = floor(80,000 − 14,717.25 − 72) = **65,210**. Joint = 65,210.
- Half = 32,605. Zone 3: z = (32,605 − 17,799) / 10,000 = 1.4806; raw = 4,963.3339279160 → 4,963; Splitting ESt = **9,926**.
- Soli: 9,926 ≤ 40,700 → 0. Share = 1.

**Expected:** ESt 9,926; Soli 0; Burden 24,643.25; **Netto 55,356.75**; monthly 4,613.06; effective 30.80 %. Compare G14 (Netto 48,978.75): Splitting with a non-earning spouse is worth 6,378 € of ESt.

#### G7 — Married Splitting, spouse zvE 40,000 (2026)

Inputs: as G6, spouse zvE **40,000**.

- User zvE still **65,210**; joint = 105,210; half = 52,605.
- z = (52,605 − 17,799) / 10,000 = 3.4806; raw = 11,474.9013679160 → 11,474; joint ESt = **22,948**.
- Soli: 22,948 ≤ 40,700 → 0.
- Share = 65,210 / 105,210; est_user = commercial_cents(22,948 × 65,210 / 105,210) = **14,223.35**.

**Expected:** joint ESt 22,948; user’s ESt 14,223.35; KV 11,787.75; PV 2,929.50; Burden 28,940.60; **Netto 51,059.40**; monthly 4,254.95; effective 36.18 %.

#### G8 — Church tax 9 % (e.g. NRW) (2026)

Inputs: defaults, Gewinn **80,000**, Kirchensteuer ja, 9 %.

- Vorsorge 14,717.25. Iteration (commercial cents, deduct KiSt as Sonderausgabe):

| iter | sa | zvE | raw | ESt | KiSt = 9 % × ESt |
|---|---|---|---|---|---|
| 0 | 36 | 65,246 | 16,304.7739273790 | 16,304 | 1,467.36 |
| 1 | 1,467.36 | 63,815 | 15,730.2496751360 | 15,730 | 1,415.70 |
| 2 | 1,415.70 | 63,867 | 15,751.0027401440 | 15,751 | 1,417.59 |
| 3 | 1,417.59 | 63,865 | 15,750.2043722360 | 15,750 | 1,417.50 |
| 4 | 1,417.50 | 63,865 | 15,750.2043722360 | 15,750 | 1,417.50 (stable) |

Check: floor(80,000 − 14,717.25 − 1,417.50) = floor(63,865.25) = 63,865; 0.09 × 15,750 = 1,417.50 exactly. Soli 0 (15,750 ≤ 20,350).

**Expected:** ESt 15,750; KiSt 1,417.50; KV 11,787.75; PV 2,929.50; Burden 31,884.75; **Netto 48,115.25**; monthly 4,009.60; effective 39.86 %.

#### G9 — Three children under 25, PV Abschlag (2026)

Inputs: defaults, Gewinn **80,000**, Kinder unter 25 = **3**, single (one-parent KFB).

- PV rate 3.10 %; PV = 69,750 × 0.0310 = **2,162.25**; KV 11,787.75; Vorsorge 13,950.00.
- zvE = floor(80,000 − 13,950 − 36) = **66,014**.
- z = (66,014 − 17,799) / 10,000 = 4.8215; raw = 16,616.0373554750 → ESt **16,616**.
- Soli-KFB = 3 × 4,878 = 14,634; fictitious zvE = 51,380; fictitious ESt 11,036 ≤ 20,350 → Soli **0** (the KFB path runs, but Soli is 0 either way; G16 tests a non-zero Soli effect).

**Expected:** PV 2,162.25; ESt 16,616; Soli 0; Burden 30,566.00; **Netto 49,434.00**; monthly 4,119.50; effective 38.21 %.

#### G10 — PKV (2026)

Inputs: defaults, Gewinn **80,000**, KV = **PKV**, monthly premium **700**, Basis share **600**, private PV **150**.

- KV cash = 8,400.00; deductible Basis = 7,200.00; PV cash = deductible = 1,800.00; Vorsorge = 9,000.00 ≥ 2,800.
- zvE = floor(80,000 − 9,000 − 36) = **70,964**.
- Zone 4: 0.42 × 70,964 − 11,135.63 = 18,669.25 → ESt **18,669**. Soli 0 (18,669 ≤ 20,350).

**Expected:** KV 8,400.00; PV 1,800.00; ESt 18,669; Soli 0; Burden 28,869.00; **Netto 51,131.00**; monthly 4,260.92; effective 36.09 %.

#### G11 — Same facts as G14, tax year 2025

Inputs: G14 facts, Jahr **2025** (Zusatzbeitrag default 2.5 %).

- Bemessung = 66,150; KV = 66,150 × 16.5 % = **10,914.75**; PV = 66,150 × 4.2 % = **2,778.30**; Vorsorge 13,693.05.
- zvE = floor(80,000 − 13,693.05 − 36) = **66,270**.
- 2025 zone 3: z = (66,270 − 17,443) / 10,000 = 4.8827; raw = (176.64 × 4.8827 + 2,397) × 4.8827 + 1,015.13 = 16,930.1936209856 → ESt **16,930**.
- Soli: 16,930 ≤ 19,950 → 0.

**Expected:** KV 10,914.75; PV 2,778.30; ESt 16,930; Burden 30,623.05; **Netto 49,376.95**; monthly 4,114.75; effective 38.28 %. Compare G14 (2026 Netto 48,978.75): 2025 is 398.20 € higher on these facts, mainly because of the lower KV-BBG and lower Zusatzbeitrag (social is cheaper) offsetting a slightly higher ESt.

#### G12 — GKV allgemein, 4 % Krankengeld reduction (2026)

Inputs: defaults, Gewinn **80,000**, GKV **allgemein** (14.6 % + 2.9 %).

- KV cash = 69,750 × 17.5 % = **12,206.25**; deductible = 12,206.25 × 0.96 = **11,718.00** exactly.
- PV 2,929.50; Vorsorge 14,647.50.
- zvE = floor(80,000 − 14,647.50 − 36) = **65,316**.
- z = 4.7517; raw = 16,333.0597152590 → ESt **16,333**. Soli 0.

**Expected:** KV cash 12,206.25; KV deductible 11,718.00; PV 2,929.50; ESt 16,333; Burden 31,468.75; **Netto 48,531.25**; monthly 4,044.27; effective 39.34 %.

#### G13 — Mandatory income-based RV (2026)

Inputs: defaults, Gewinn **80,000**, RV = **Pflicht (einkommensbezogen)**.

- RV = 80,000 × 18.6 % = **14,880.00** (between 1,345.92 and 18,860.40). Fully deductible (cap 30,826).
- KV 11,787.75; PV 2,929.50; Vorsorge = 14,880 + 14,717.25 = **29,597.25**.
- zvE = floor(80,000 − 29,597.25 − 36) = **50,366**.
- z = 3.2567; raw = 10,677.0949254590 → ESt **10,677**. Soli 0.

**Expected:** RV 14,880.00; ESt 10,677; KV 11,787.75; PV 2,929.50; Burden 40,274.25; **Netto 39,725.75**; monthly 3,310.48; effective 50.34 %.

#### G14 — Baseline Freiberufler, 80,000, 2026

Inputs: all defaults, Gewinn **80,000**.

- Bemessung 69,750; KV **11,787.75**; PV **2,929.50**; Vorsorge 14,717.25.
- zvE **65,246**; tarifliche ESt **16,304** (work in G4); Soli 0; GewSt 0.

**Expected:** ESt 16,304; KV 11,787.75; PV 2,929.50; Burden 31,021.25; **Netto 48,978.75**; monthly 4,081.56; effective 38.78 %.

**Marginal burden:** at Gewinn 80,100, total burden = 31,062.25. Grenzbelastung = (31,062.25 − 31,021.25) / 100 = **41.00 %**. (Social contributions are already at the BBG, so the margin is tax only. The +1 € increment is *not* used: ESt flooring makes it noisy.)

#### G15 — Reichensteuer zone and full 5.5 % Soli (2026)

Inputs: defaults, Gewinn **400,000**.

- Socials at BBG: KV 11,787.75; PV 2,929.50; Vorsorge 14,717.25.
- zvE = floor(400,000 − 14,717.25 − 36) = **385,246**.
- Zone 5: 0.45 × 385,246 − 19,470.38 = 153,890.32 → ESt **153,890**.
- Soli, full 5.5 % (153,890 ≫ 37,838): 0.055 × 153,890 = 8,463.950 → floor cents **8,463.95**.

**Expected:** ESt 153,890; Soli 8,463.95; Burden 177,071.20; **Netto 222,928.80**; monthly 18,577.40; effective 44.27 %.

#### G16 — Soli Milderung with Kinderfreibetrag (2026)

(This is the “G19” computation; numbered G16 here as a required golden case.)

Inputs: defaults, Gewinn **120,000**, Kinder unter 25 = **2**, single (KFB = 2 × 4,878 = 9,756).

- PV rate 3.35 %; PV = 69,750 × 0.0335 = **2,336.625** → **2,336.63**; KV 11,787.75; Vorsorge 14,124.38.
- zvE = floor(120,000 − 14,124.38 − 36) = **105,839**.
- Zone 4: 0.42 × 105,839 − 11,135.63 = 33,316.75 → ESt **33,316**.
- Fictitious zvE for Soli = floor(120,000 − 14,124.38 − 36 − 9,756) = **96,083**; fictitious ESt = 0.42 × 96,083 − 11,135.63 = 29,219.23 → **29,219**.
- Soli Milderung: 0.055 × 29,219 = 1,607.045; 0.119 × (29,219 − 20,350) = 1,055.411 → **1,055.41**.
- Compare G2 (no children, Soli 1,513.32): the Kinderfreibetrag reduces Soli by 457.91 €, and the PV Abschlag reduces PV by 592.87 €.

**Expected:** PV 2,336.63; ESt 33,316; Soli 1,055.41; Burden 48,495.79; **Netto 71,504.21**; monthly 5,958.68; effective 40.41 %.

#### G17 — AV auf Antrag, not deductible (2026) — optional extra

Inputs: G14 plus AV = ja (voller Beitrag).

- AV monthly 102.83, annual **1,233.96**. Basis-KV/PV 14,717.25 ≥ 2,800 → AV is **not** deductible. zvE and ESt identical to G14.
- Burden = G14 burden + 1,233.96 = **32,255.21**.

**Expected:** AV 1,233.96; ESt 16,304; Burden 32,255.21; **Netto 47,744.79**; monthly 3,978.73; effective 40.32 %.

#### G18 — 8 % church tax (Bayern / Baden-Württemberg) (2026) — optional extra

Inputs: G14 plus Kirchensteuer 8 %. Converges at zvE 64,017, ESt **15,810**, KiSt **1,264.80** (0.08 × 15,810). Soli 0.

**Expected:** ESt 15,810; KiSt 1,264.80; Burden 31,792.05; **Netto 48,207.95**; monthly 4,017.33; effective 39.74 %.

The required set is **G1–G16** (16 cases). G17 and G18 are recommended. Together they cover: GKV minimum, profit above BBG, Gewerbe below and above the Freibetrag, residual GewSt above 400 %, married Splitting (spouse 0 and spouse with income), Soli Milderungszone, Soli at 5.5 %, Soli with Kinderfreibetrag, church tax 8 % and 9 %, childless and with children, PKV, 2025 vs 2026, the 4 % Krankengeld cut, mandatory RV, and non-deductible AV.

### 11.3 Other tests the developer must include

- Parameter-file completeness: every year block has every key; missing a year throws a clear error.
- Validation: Basis share > PKV premium is rejected; voluntary RV outside min/max is rejected; empty required Gewinn does not produce a fake result.
- Gewinn 0, GKV: contributions at the minimum, ESt 0, Netto negative.
- Changing only the Zusatzbeitrag changes KV cash (and zvE, and ESt) in the expected direction.
- Freiberufler never produces GewSt, regardless of Gewinn and Hebesatz.
- PV rates for 0 (under 23), 0 (23+), 1, 2, 3, 4, 5, 6 children (6 same as 5).
- G4 Netto === G14 Netto; G5 burden === G4 burden + 1,942.50; G17 burden === G14 burden + 1,233.96.

---

## 12. Known limitations (document in the UI help)

1. Other income (Kapital, Vermietung) is not in the KV/PV base; the Steuerbescheid would include it.
2. No Kindergeld and no Günstigerprüfung against Kinderfreibetrag for tarifliche ESt. Soli (required) and optionally KiSt use the Kinderfreibetrag. High earners with children may see a slightly high ESt.
3. Spouse zvE is a simplified joint assessment (Sections 4 and 6.7).
4. No GewSt Hinzurechnungen; Gewerbeertrag = Gewinn.
5. Kirchensteuer rounding may differ by Land by about 1 €.
6. KSK is out of scope.
7. Pflicht-RV exemption below the Geringfügigkeitsgrenze is not modelled; the minimum contribution is applied.
8. The default Zusatzbeitrag is the official BMG average, which can be below the user’s kassenindividueller Satz.

---

## 13. Roadmap

The only planned follow-up product is:

- **Kindesunterhalt nach der Düsseldorfer Tabelle.**

No other calculators. When that work starts, give it its own core and a short SPEC of its own; reuse only the shell and formatting (Section 10).

---

## 14. Implementation notes for the developer and for QA

- Implement the pipeline in Section 6 exactly. If a golden-test expected value and a correct implementation of the pipeline ever disagree, stop and raise it — do not “fix” the test silently, and do not change the legal formulae to match a rounded guess.
- `reference_calc.py` in this folder is a research aid that produced Section 11. The product is TypeScript. If the script and this SPEC ever disagree, **this SPEC wins**.
- QA: run Vitest; manually spot-check Section 11.1 against the BMF calculator; walk through G1, G2, G4, G6, G8, G10, G14 in the UI (annual and monthly, disclaimer present, defaults, mobile width); confirm GitHub Pages builds as a static site.
- Do not contact tax offices, and do not present results as advice.

