/**
 * German UI for the Selbständige net-income calculator.
 * No network, no storage, no URL state. Calculation runs on input.
 */
import {
  BUNDESLAENDER,
  DEFAULT_AVERAGE_YEARS,
  DEFAULT_BUNDESLAND,
  DEFAULT_YEAR,
  SUPPORTED_YEARS,
  calculateNetto,
  calculateNettoAverage,
  defaultInput,
  formatEuro,
  formatPercent,
  formatZusatzbeitrag,
  parseEuroInput,
  parsePercentInput,
  resolveYearParams,
  rechtskreisApplies,
  type AverageOutcome,
  type CalculationOutcome,
  type MultiYearResult,
  type Rechtskreis,
  type YearInput,
  type YearResult,
} from './api.ts';

const form = document.getElementById('calc-form') as HTMLFormElement;
const gewinnFields = document.getElementById('gewinn-fields') as HTMLElement;
const yearTriple = document.getElementById('year-triple') as HTMLSelectElement;
const yearsAverage = document.getElementById('years-average') as HTMLElement;
const yearSingleWrap = document.getElementById('year-single-wrap') as HTMLElement;
const yearSingleOptions = document.getElementById('year-single-options') as HTMLElement;
const rechtskreisWrap = document.getElementById('rechtskreis-wrap') as HTMLElement;
const hebesatzWrap = document.getElementById('hebesatz-wrap') as HTMLElement;
const spouseWrap = document.getElementById('spouse-wrap') as HTMLElement;
const landWrap = document.getElementById('land-wrap') as HTMLElement;
const elternWrap = document.getElementById('eltern-wrap') as HTMLElement;
const kfbWrap = document.getElementById('kfb-wrap') as HTMLElement;
const zusatzWrap = document.getElementById('zusatz-wrap') as HTMLElement;
const zusatzInput = document.getElementById('zusatz') as HTMLInputElement;
const zusatzHint = document.getElementById('zusatz-hint') as HTMLElement;
const pkvWrap = document.getElementById('pkv-wrap') as HTMLElement;
const rvVolWrap = document.getElementById('rv-vol-wrap') as HTMLElement;
const rvVolHint = document.getElementById('rv-vol-hint') as HTMLElement;
const bundesland = document.getElementById('bundesland') as HTMLSelectElement;
const children = document.getElementById('children') as HTMLSelectElement;
const overrideFields = document.getElementById('override-fields') as HTMLElement;
const formErrors = document.getElementById('form-errors') as HTMLElement;
const resultsBody = document.getElementById('results-body') as HTMLElement;
const resultsPlaceholder = document.getElementById('results-placeholder') as HTMLElement;
const sticky = document.getElementById('sticky-netto') as HTMLElement;
const stickyValue = document.getElementById('sticky-netto-value') as HTMLElement;
const stickyLabel = document.getElementById('sticky-netto-label') as HTMLElement;
const stickySub = document.getElementById('sticky-netto-sub') as HTMLElement;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  opts: { className?: string; text?: string; attrs?: Record<string, string> } = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (opts.className) node.className = opts.className;
  if (opts.text !== undefined) node.textContent = opts.text;
  if (opts.attrs) {
    for (const [k, v] of Object.entries(opts.attrs)) node.setAttribute(k, v);
  }
  return node;
}

function hide(node: HTMLElement, hidden: boolean): void {
  node.classList.toggle('is-hidden', hidden);
}

function mode(): 'average' | 'single' {
  const checked = form.querySelector<HTMLInputElement>('input[name="mode"]:checked');
  return checked?.value === 'single' ? 'single' : 'average';
}

function selectedYears(): number[] {
  if (mode() === 'single') {
    const y = form.querySelector<HTMLInputElement>('input[name="year-single"]:checked');
    return [y ? Number(y.value) : DEFAULT_YEAR];
  }
  return yearTriple.value.split(',').map((s) => Number(s.trim()));
}

function needsRechtskreis(): boolean {
  return selectedYears().some((y) => rechtskreisApplies(y));
}

function buildYearPills(): void {
  yearSingleOptions.replaceChildren();
  for (const year of SUPPORTED_YEARS) {
    const id = `year-s-${year}`;
    const input = el('input', {
      attrs: {
        type: 'radio',
        id,
        name: 'year-single',
        value: String(year),
        autocomplete: 'off',
      },
    });
    if (year === DEFAULT_YEAR) input.checked = true;
    const label = el('label', { text: String(year), attrs: { for: id } });
    yearSingleOptions.append(input, label);
  }
}

function buildBundesland(): void {
  bundesland.replaceChildren();
  for (const land of BUNDESLAENDER) {
    const opt = el('option', { text: land, attrs: { value: land } });
    if (land === DEFAULT_BUNDESLAND) opt.selected = true;
    bundesland.append(opt);
  }
}

function buildChildren(): void {
  children.replaceChildren();
  for (let i = 0; i <= 20; i++) {
    const opt = el('option', { text: String(i), attrs: { value: String(i) } });
    if (i === 0) opt.selected = true;
    children.append(opt);
  }
}

function rebuildGewinnFields(): void {
  const years = selectedYears();
  const previous = new Map<string, string>();
  for (const input of gewinnFields.querySelectorAll('input')) {
    const year = input.getAttribute('data-year');
    if (year) previous.set(year, input.value);
  }
  gewinnFields.replaceChildren();
  for (const year of years) {
    const row = el('div', { className: 'gewinn-year' });
    const id = `gewinn-${year}`;
    const label = el('label', { text: String(year), attrs: { for: id } });
    const wrap = el('div', { className: 'input-suffix' });
    const input = el('input', {
      attrs: {
        id,
        type: 'text',
        inputmode: 'decimal',
        autocomplete: 'off',
        placeholder: '80.000',
        'data-year': String(year),
        'aria-label': `Jahresgewinn (netto, ohne USt) ${year}`,
      },
    });
    const prev = previous.get(String(year));
    if (prev) input.value = prev;
    wrap.append(input, el('span', { text: '€' }));
    row.append(label, wrap);
    gewinnFields.append(row);
  }
}

function rebuildOverrideFields(): void {
  const years = selectedYears();
  const previous = new Map<string, { on: boolean; est: string; soli: string; kist: string }>();
  for (const year of years) {
    const on = document.getElementById(`ov-on-${year}`) as HTMLInputElement | null;
    previous.set(String(year), {
      on: on?.checked ?? false,
      est: (document.getElementById(`ov-est-${year}`) as HTMLInputElement | null)?.value ?? '',
      soli: (document.getElementById(`ov-soli-${year}`) as HTMLInputElement | null)?.value ?? '',
      kist: (document.getElementById(`ov-kist-${year}`) as HTMLInputElement | null)?.value ?? '',
    });
  }
  overrideFields.replaceChildren();
  for (const year of years) {
    const prev = previous.get(String(year));
    const box = el('fieldset');
    box.append(el('legend', { text: String(year) }));
    const onId = `ov-on-${year}`;
    const on = el('input', {
      attrs: { id: onId, type: 'checkbox', autocomplete: 'off' },
    });
    on.checked = prev?.on ?? false;
    const onLabel = el('label', { className: 'check' });
    onLabel.append(on, document.createTextNode(' Steuerbescheid für dieses Jahr verwenden'));
    box.append(onLabel);
    const grid = el('div', { attrs: { id: `ov-grid-${year}` } });
    if (!on.checked) grid.classList.add('is-hidden');
    for (const [key, labelText] of [
      ['est', 'Festzusetzende Einkommensteuer'],
      ['soli', 'Solidaritätszuschlag'],
      ['kist', 'Kirchensteuer'],
    ] as const) {
      const field = el('div', { className: 'field' });
      const id = `ov-${key}-${year}`;
      field.append(el('label', { text: labelText, attrs: { for: id } }));
      const wrap = el('div', { className: 'input-suffix' });
      const input = el('input', {
        attrs: { id, type: 'text', inputmode: 'decimal', autocomplete: 'off' },
      });
      const val = prev?.[key] ?? '';
      if (val) input.value = val;
      wrap.append(input, el('span', { text: '€' }));
      field.append(wrap);
      grid.append(field);
    }
    on.addEventListener('change', () => {
      hide(grid, !on.checked);
      recalc();
    });
    box.append(grid);
    overrideFields.append(box);
  }
}

function updateVisibility(): void {
  const isAverage = mode() === 'average';
  hide(yearsAverage, !isAverage);
  hide(yearSingleWrap, isAverage);
  hide(rechtskreisWrap, !needsRechtskreis());
  const gewerbe = (document.getElementById('act-gew') as HTMLInputElement).checked;
  hide(hebesatzWrap, !gewerbe);
  hide(spouseWrap, !(document.getElementById('married') as HTMLInputElement).checked);
  hide(landWrap, !(document.getElementById('church') as HTMLInputElement).checked);
  const nChildren = Number(children.value);
  const married = (document.getElementById('married') as HTMLInputElement).checked;
  hide(elternWrap, nChildren !== 0);
  hide(kfbWrap, nChildren === 0 || married);
  const kv = (form.querySelector('input[name="kv"]:checked') as HTMLInputElement).value;
  hide(zusatzWrap, kv === 'pkv');
  hide(pkvWrap, kv !== 'pkv');
  const rv = (document.getElementById('rv') as HTMLSelectElement).value;
  hide(rvVolWrap, rv !== 'freiwillig');
  updateZusatzHint();
  updateRvHint();
}

function updateZusatzHint(): void {
  const years = selectedYears();
  const parts = years.map((y) => {
    const p = resolveYearParams(y);
    return `${y}: ${formatZusatzbeitrag(p.zusatzbeitragDefault).replace('.', ',')} %`;
  });
  zusatzHint.textContent =
    zusatzInput.value.trim() === ''
      ? `Ohne Eintrag gilt je Jahr der amtliche Durchschnitt (${parts.join('; ')}).`
      : 'Dieser Satz wird für alle gewählten Jahre verwendet.';
}

function updateRvHint(): void {
  const years = selectedYears();
  const rk = currentRechtskreis();
  const ranges = years.map((y) => {
    const p = resolveYearParams(y, rk);
    return `${y}: ${p.rvMinMonthly.toFixed(2).replace('.', ',')}–${p.rvMaxMonthly.toFixed(2).replace('.', ',')} €`;
  });
  rvVolHint.textContent = `Zulässiger Monatbeitrag: ${ranges.join('; ')}.`;
}

function currentRechtskreis(): Rechtskreis {
  const ost = document.getElementById('rk-ost') as HTMLInputElement;
  return ost.checked ? 'ost' : 'west';
}

function parseRequiredEuro(raw: string, label: string): { ok: true; value: string } | { ok: false; message: string } {
  const parsed = parseEuroInput(raw);
  if (parsed.empty) return { ok: false, message: `${label} ist erforderlich.` };
  if (!parsed.ok || parsed.value === null) return { ok: false, message: `${label} ist keine gültige Zahl.` };
  if (parsed.value.isNegative()) return { ok: false, message: `${label} darf nicht negativ sein.` };
  return { ok: true, value: parsed.value.toString() };
}

function parseOptionalEuro(raw: string, label: string, defaultValue = '0'): { ok: true; value: string } | { ok: false; message: string } {
  const parsed = parseEuroInput(raw);
  if (parsed.empty) return { ok: true, value: defaultValue };
  if (!parsed.ok || parsed.value === null) return { ok: false, message: `${label} ist keine gültige Zahl.` };
  if (parsed.value.isNegative()) return { ok: false, message: `${label} darf nicht negativ sein.` };
  return { ok: true, value: parsed.value.toString() };
}

function sharedInputBase(): Omit<YearInput, 'year' | 'gewinn'> | { errors: string[] } {
  const errors: string[] = [];
  const married = (document.getElementById('married') as HTMLInputElement).checked;
  const activity = (document.getElementById('act-gew') as HTMLInputElement).checked ? 'gewerbe' : 'freiberufler';
  const hebesatz = parseOptionalEuro((document.getElementById('hebesatz') as HTMLInputElement).value, 'Der Gewerbesteuer-Hebesatz', '400');
  if (!hebesatz.ok) errors.push(hebesatz.message);
  const spouse = parseOptionalEuro((document.getElementById('spouse-zve') as HTMLInputElement).value, 'Das zvE des Ehepartners');
  if (!spouse.ok) errors.push(spouse.message);
  const otherSa = parseOptionalEuro((document.getElementById('other-sa') as HTMLInputElement).value, 'Weitere Sonderausgaben');
  if (!otherSa.ok) errors.push(otherSa.message);

  const kv = (form.querySelector('input[name="kv"]:checked') as HTMLInputElement).value as YearInput['kvType'];
  let zusatzbeitragPercent: string | undefined;
  if (kv !== 'pkv' && zusatzInput.value.trim() !== '') {
    const z = parsePercentInput(zusatzInput.value);
    if (!z.ok || z.empty || z.value === null) {
      errors.push('Der Zusatzbeitragssatz ist keine gültige Zahl.');
    } else if (z.value.isNegative()) {
      errors.push('Der Zusatzbeitragssatz darf nicht negativ sein.');
    } else {
      zusatzbeitragPercent = z.value.toString();
    }
  }

  let pkvPremiumMonthly: string | undefined;
  let pkvBasisMonthly: string | undefined;
  let privatePvMonthly: string | undefined;
  if (kv === 'pkv') {
    const prem = parseRequiredEuro((document.getElementById('pkv-premium') as HTMLInputElement).value, 'Der PKV-Beitrag monatlich');
    const basis = parseRequiredEuro((document.getElementById('pkv-basis') as HTMLInputElement).value, 'Der Basis-Anteil der PKV');
    const ppv = parseRequiredEuro((document.getElementById('ppv') as HTMLInputElement).value, 'Die private Pflegepflichtversicherung');
    if (!prem.ok) errors.push(prem.message);
    else pkvPremiumMonthly = prem.value;
    if (!basis.ok) errors.push(basis.message);
    else pkvBasisMonthly = basis.value;
    if (!ppv.ok) errors.push(ppv.message);
    else privatePvMonthly = ppv.value;
  }

  const rvMode = (document.getElementById('rv') as HTMLSelectElement).value as YearInput['rvMode'];
  let voluntaryRvMonthly: string | undefined;
  if (rvMode === 'freiwillig') {
    const v = parseRequiredEuro((document.getElementById('rv-vol') as HTMLInputElement).value, 'Der freiwillige RV-Beitrag');
    if (!v.ok) errors.push(v.message);
    else voluntaryRvMonthly = v.value;
  }

  if (errors.length) return { errors };

  return {
    rechtskreis: currentRechtskreis(),
    activity,
    hebesatz: hebesatz.ok ? hebesatz.value : '400',
    married,
    spouseZve: spouse.ok ? spouse.value : '0',
    churchTax: (document.getElementById('church') as HTMLInputElement).checked,
    bundesland: bundesland.value as YearInput['bundesland'],
    childrenUnder25: Number(children.value),
    elterneigenschaft: (document.getElementById('eltern') as HTMLInputElement).checked,
    age23Plus: (document.getElementById('age23') as HTMLInputElement).checked,
    fullKinderfreibetrag: married || (document.getElementById('kfb-full') as HTMLInputElement).checked,
    kvType: kv,
    zusatzbeitragPercent,
    pkvPremiumMonthly,
    pkvBasisMonthly,
    privatePvMonthly,
    rvMode,
    voluntaryRvMonthly,
    avMode: (document.getElementById('av') as HTMLSelectElement).value as YearInput['avMode'],
    otherSonderausgaben: otherSa.ok ? otherSa.value : '0',
  };
}

function yearInputFor(year: number, base: Omit<YearInput, 'year' | 'gewinn'>): YearInput | { errors: string[] } {
  const input = document.getElementById(`gewinn-${year}`) as HTMLInputElement | null;
  const parsed = parseRequiredEuro(input?.value ?? '', `Der Jahresgewinn ${year}`);
  if (!parsed.ok) return { errors: [parsed.message] };

  const built: YearInput = defaultInput({
    ...base,
    year,
    gewinn: parsed.value,
  });

  const on = document.getElementById(`ov-on-${year}`) as HTMLInputElement | null;
  if (on?.checked) {
    const est = parseOptionalEuro((document.getElementById(`ov-est-${year}`) as HTMLInputElement).value, `ESt ${year}`, '');
    const soli = parseOptionalEuro((document.getElementById(`ov-soli-${year}`) as HTMLInputElement).value, `Soli ${year}`, '');
    const kist = parseOptionalEuro((document.getElementById(`ov-kist-${year}`) as HTMLInputElement).value, `KiSt ${year}`, '');
    const errs: string[] = [];
    if (!est.ok) errs.push(est.message);
    if (!soli.ok) errs.push(soli.message);
    if (!kist.ok) errs.push(kist.message);
    if (errs.length) return { errors: errs };
    // Group is set: entered ESt is used; blank Soli/KiSt → 0. If ESt is blank, leave unset (calculated).
    if (est.ok && est.value !== '') built.override_est = est.value;
    built.override_soli = soli.ok && soli.value !== '' ? soli.value : '0';
    built.override_kist = kist.ok && kist.value !== '' ? kist.value : '0';
  }
  return built;
}

function showErrors(messages: string[]): void {
  formErrors.replaceChildren();
  for (const m of messages) formErrors.append(el('p', { text: m }));
  formErrors.hidden = messages.length === 0;
}

function bemessungNote(r: YearResult): string {
  if (r.kvPvBemessungNote === 'minimum') return ' (Mindestbemessung)';
  if (r.kvPvBemessungNote === 'bbg') return ' (Beitragsbemessungsgrenze)';
  return '';
}

function appendBreakdownTable(parent: HTMLElement, r: YearResult, caption: string): void {
  const table = el('table', { className: 'break' });
  const cap = el('caption', { className: 'section-title', text: caption });
  const thead = el('thead');
  const hr = el('tr');
  hr.append(el('th', { text: '' }), el('th', { text: 'Jahr' }), el('th', { text: 'Monat' }));
  thead.append(hr);
  const body = el('tbody');
  const rows: Array<[string, YearResult[keyof YearResult] | undefined, boolean?]> = [
    ['Gewinn', r.gewinn],
    ['Krankenversicherung', r.kvCash],
    ['Pflegeversicherung', r.pvCash],
    ['Rentenversicherung', r.rvCash],
    ['Arbeitslosenversicherung', r.avCash],
    ['Festzusetzende Einkommensteuer', r.festzusetzendeEstUser],
    ['Solidaritätszuschlag', r.soliUser],
    ['Kirchensteuer', r.kistUser],
    ['Gewerbesteuer', r.gewerbesteuer],
  ];
  for (const [label, money] of rows) {
    if (!money || typeof money !== 'object' || !('cents' in money)) continue;
    const tr = el('tr');
    tr.append(
      el('td', { text: label }),
      el('td', { text: formatEuro(money), className: 'cent' }),
      el('td', { text: formatEuro(monthlyFrom(money.cents)), className: 'cent' }),
    );
    body.append(tr);
  }
  const burden = el('tr', { className: 'total' });
  burden.append(
    el('td', { text: 'Abzüge insgesamt' }),
    el('td', { text: formatEuro(r.totalBurden), className: 'cent' }),
    el('td', { text: formatEuro(monthlyFrom(r.totalBurden.cents)), className: 'cent' }),
  );
  const netto = el('tr', { className: 'total netto-row' });
  netto.append(
    el('td', { text: 'Netto-Einkommen' }),
    el('td', { text: formatEuro(r.nettoAnnual), className: 'cent' }),
    el('td', { text: formatEuro(r.nettoMonthly), className: 'cent' }),
  );
  body.append(burden, netto);
  table.append(cap, thead, body);
  parent.append(table);
  parent.append(
    el(
      'p',
      {
        className: 'note',
        text: 'Monatswerte = Jahresbetrag ÷ 12, kaufmännisch auf Cent. Die Summe der gerundeten Monatszeilen kann um einen Cent vom monatlichen Netto abweichen.',
      },
    ),
  );
}

/** Commercial cents of annual cents / 12 (half away from 0). */
function monthlyFrom(annualCents: number): number {
  const sign = annualCents < 0 ? -1 : 1;
  const abs = Math.abs(annualCents);
  const q = abs / 12;
  return sign * Math.round(q);
}

function appendTaxDetails(parent: HTMLElement, r: YearResult): void {
  parent.append(el('h3', { className: 'section-title', text: 'Steuerliche Zwischenwerte' }));
  const table = el('table', { className: 'break' });
  const body = el('tbody');
  const lines: Array<[string, string]> = [
    ['Zu versteuerndes Einkommen', formatEuro(r.zve)],
    ...(r.married ? [['Gemeinsames zvE', formatEuro(r.zveJoint)] as [string, string]] : []),
    ['Tarifliche Einkommensteuer', formatEuro(r.tariflicheEst)],
    ['Steuerermäßigung nach § 35 EStG', formatEuro(r.gewerbesteuerCredit)],
    ['Festzusetzende Einkommensteuer', formatEuro(r.festzusetzendeEstUser)],
    ['Abziehbare Vorsorgeaufwendungen', formatEuro(r.vorsorge)],
    [
      'Beitragsbemessung KV/PV',
      r.kvPvBemessung ? `${formatEuro(r.kvPvBemessung)}${bemessungNote(r)}` : 'PKV (keine gesetzliche Bemessung)',
    ],
    ['Tariflicher Grenzsteuersatz', r.statutoryMarginalRateLabel],
  ];
  if (r.overrideUsed) {
    lines.push(
      ['Berechnete ESt (ohne Bescheid)', formatEuro(r.festzusetzendeEstUserCalculated)],
      ['Berechneter Soli (ohne Bescheid)', formatEuro(r.soliUserCalculated)],
    );
  }
  if (r.married) {
    lines.push(['Anteil an der gemeinsamen Steuer', r.taxShare === '1' ? '100 %' : r.taxShare]);
  }
  for (const [k, v] of lines) {
    const tr = el('tr');
    tr.append(el('td', { text: k }), el('td', { text: v, className: 'cent' }));
    body.append(tr);
  }
  table.append(body);
  parent.append(table);
}

function renderYearResult(r: YearResult, headlineTitle: string): HTMLElement {
  const wrap = el('div');
  const head = el('div', { className: 'headline' });
  head.append(el('p', { className: 'eyebrow', text: headlineTitle }));
  head.append(el('div', { className: 'amount', text: formatEuro(r.nettoAnnual) }));
  head.append(el('p', { className: 'sub', text: `${formatEuro(r.nettoMonthly)}  ·  Monat` }));
  wrap.append(head);
  const rates = el('div', { className: 'rates' });
  const e1 = el('div', { className: 'rate-card' });
  e1.append(el('dt', { text: 'Effektive Gesamtbelastung' }), el('dd', { text: formatPercent(r.effectiveBurdenPercent) }));
  const e2 = el('div', { className: 'rate-card' });
  e2.append(
    el('dt', { text: 'Effektive Grenzbelastung' }),
    el('dd', { text: formatPercent(r.marginalBurdenPercent) }),
  );
  rates.append(e1, e2);
  wrap.append(rates);
  appendBreakdownTable(wrap, r, 'Aufschlüsselung');
  appendTaxDetails(wrap, r);
  return wrap;
}

function renderAverage(r: MultiYearResult): HTMLElement {
  const wrap = el('div');
  const head = el('div', { className: 'headline' });
  head.append(el('p', { className: 'eyebrow', text: 'Dreijahresdurchschnitt (Jahr)' }));
  head.append(el('div', { className: 'amount', text: formatEuro(r.avg_netto) }));
  head.append(el('p', { className: 'sub', text: `${formatEuro(r.avg_monthly)}  ·  Dreijahresdurchschnitt (Monat)` }));
  wrap.append(head);

  const label = el('p', { className: 'avg-label' });
  label.append(el('strong', { text: 'Dreijahresdurchschnitt' }));
  label.append(
    document.createTextNode(
      ' des Netto-Einkommens (arithmetisches Mittel der drei Jahres-Nettos). Das ist die übliche Grundlage für den ',
    ),
  );
  label.append(el('strong', { text: 'laufenden Unterhalt' }));
  label.append(
    document.createTextNode(
      ' nach der Rechtsprechung des BGH und den Düsseldorfer Leitlinien, und eine transparente Auswertung der Unterlagen, die ',
    ),
  );
  label.append(el('strong', { text: 'Banken' }));
  label.append(
    document.createTextNode(
      ' in der Regel (zwei bis drei Steuerbescheide) verlangen. ',
    ),
  );
  label.append(el('strong', { text: 'Nicht' }));
  label.append(document.createTextNode(' die gesetzliche Bemessung für '));
  label.append(el('strong', { text: 'Elterngeld' }));
  label.append(
    document.createTextNode(
      ' (§ 2b Abs. 2 BEEG: letzter abgeschlossener Veranlagungszeitraum) und ',
    ),
  );
  label.append(el('strong', { text: 'nicht' }));
  label.append(document.createTextNode(' für '));
  label.append(el('strong', { text: 'Bürgergeld' }));
  label.append(
    document.createTextNode(
      ' (§ 41a SGB II: Prognose für den Bewilligungszeitraum, in der Regel sechs Monate).',
    ),
  );
  wrap.append(label);

  const rates = el('div', { className: 'rates rates-single' });
  const e1 = el('div', { className: 'rate-card' });
  e1.append(el('dt', { text: 'Effektive Gesamtbelastung' }), el('dd', { text: formatPercent(r.avg_effective) }));
  rates.append(e1);
  wrap.append(rates);

  const table = el('table', { className: 'break' });
  table.append(el('caption', { className: 'section-title', text: 'Durchschnitt je Position' }));
  const thead = el('thead');
  const hr = el('tr');
  hr.append(el('th', { text: '' }), el('th', { text: 'Jahr' }), el('th', { text: 'Monat' }));
  thead.append(hr);
  const body = el('tbody');
  const avgRows: Array<[string, MultiYearResult[keyof MultiYearResult]]> = [
    ['Gewinn', r.avg_gewinn],
    ['Krankenversicherung', r.avg_kv],
    ['Pflegeversicherung', r.avg_pv],
    ['Rentenversicherung', r.avg_rv],
    ['Arbeitslosenversicherung', r.avg_av],
    ['Festzusetzende Einkommensteuer', r.avg_est],
    ['Solidaritätszuschlag', r.avg_soli],
    ['Kirchensteuer', r.avg_kist],
    ['Gewerbesteuer', r.avg_gewst],
    ['Abzüge insgesamt', r.avg_burden],
    ['Dreijahresdurchschnitt Netto', r.avg_netto],
  ];
  for (const [labelText, money] of avgRows) {
    if (!money || typeof money !== 'object' || !('cents' in money)) continue;
    const tr = el('tr', {
      className: labelText.startsWith('Dreijahres') || labelText.startsWith('Abzüge') ? 'total' : '',
    });
    const monthly = labelText.startsWith('Dreijahres') ? r.avg_monthly.cents : monthlyFrom(money.cents);
    tr.append(
      el('td', { text: labelText }),
      el('td', { text: formatEuro(money), className: 'cent' }),
      el('td', { text: formatEuro(monthly), className: 'cent' }),
    );
    body.append(tr);
  }
  table.append(thead, body);
  wrap.append(table);
  wrap.append(
    el('p', {
      className: 'note',
      text: 'Monatswerte = Jahresbetrag ÷ 12, kaufmännisch auf Cent. Die Summe der gerundeten Monatszeilen kann um einen Cent vom monatlichen Durchschnitt abweichen.',
    }),
  );

  wrap.append(el('h3', { className: 'section-title', text: 'Ergebnis je Jahr' }));
  const grid = el('div', { className: 'year-grid cols-3' });
  for (const y of r.perYear) {
    const card = el('article', { className: 'year-card' });
    const h = el('h3', { text: String(y.year) });
    if (y.overrideUsed) h.append(el('span', { className: 'flag', text: 'laut Steuerbescheid' }));
    card.append(h);
    const rows: Array<[string, string, boolean?]> = [
      ['Gewinn', formatEuro(y.gewinn)],
      ['KV', formatEuro(y.kvCash)],
      ['PV', formatEuro(y.pvCash)],
      ['RV', formatEuro(y.rvCash)],
      ['ESt', formatEuro(y.festzusetzendeEstUser)],
      ['Soli', formatEuro(y.soliUser)],
      ['KiSt', formatEuro(y.kistUser)],
      ['GewSt', formatEuro(y.gewerbesteuer)],
      ['Grenzbelastung', formatPercent(y.marginalBurdenPercent)],
      ['Netto (Jahr)', formatEuro(y.nettoAnnual), true],
      ['Netto (Monat)', formatEuro(y.nettoMonthly), true],
    ];
    for (const [k, v, strong] of rows) {
      const row = el('div', { className: strong ? 'row strong' : 'row' });
      row.append(el('span', { text: k }), el('span', { text: v }));
      card.append(row);
    }
    if (y.overrideUsed) {
      card.append(
        el('p', {
          className: 'note',
          text: `Berechnet: ESt ${formatEuro(y.festzusetzendeEstUserCalculated)}, Soli ${formatEuro(y.soliUserCalculated)}.`,
        }),
      );
    }
    grid.append(card);
  }
  wrap.append(grid);
  return wrap;
}

function updateSticky(label: string, annual: string, monthly: string): void {
  stickyLabel.textContent = label;
  stickyValue.textContent = annual;
  stickySub.textContent = `${monthly} / Monat`;
  hide(sticky, false);
}

function hideResults(placeholder?: string): void {
  hide(resultsBody, true);
  hide(resultsPlaceholder, false);
  if (placeholder) resultsPlaceholder.textContent = placeholder;
  hide(sticky, true);
}

function recalc(): void {
  updateVisibility();
  const base = sharedInputBase();
  if ('errors' in base) {
    showErrors(base.errors);
    hideResults();
    return;
  }

  const years = selectedYears();
  const inputs: YearInput[] = [];
  const errors: string[] = [];
  for (const year of years) {
    const built = yearInputFor(year, base);
    if ('errors' in built) errors.push(...built.errors);
    else inputs.push(built);
  }

  const anyGewinnMissing = years.some((y) => {
    const input = document.getElementById(`gewinn-${y}`) as HTMLInputElement | null;
    return !input || input.value.trim() === '';
  });
  if (anyGewinnMissing) {
    showErrors([]);
    hideResults(
      mode() === 'average'
        ? 'Geben Sie für jedes der drei Jahre einen Jahresgewinn ein — das Ergebnis erscheint sofort.'
        : 'Geben Sie Ihren Jahresgewinn ein — das Ergebnis erscheint sofort.',
    );
    return;
  }

  if (errors.length) {
    showErrors(errors);
    hideResults();
    return;
  }

  if (mode() === 'average') {
    const outcome: AverageOutcome = calculateNettoAverage(inputs);
    if (!outcome.ok) {
      showErrors(outcome.errors.map((e) => e.message));
      hideResults();
      return;
    }
    showErrors([]);
    resultsBody.replaceChildren(renderAverage(outcome.result));
    hide(resultsBody, false);
    hide(resultsPlaceholder, true);
    updateSticky('Dreijahresdurchschnitt', formatEuro(outcome.result.avg_netto), formatEuro(outcome.result.avg_monthly));
  } else {
    const outcome: CalculationOutcome = calculateNetto(inputs[0]);
    if (!outcome.ok) {
      showErrors(outcome.errors.map((e) => e.message));
      hideResults();
      return;
    }
    showErrors([]);
    resultsBody.replaceChildren(renderYearResult(outcome.result, `Netto-Einkommen (Jahr) · ${outcome.result.year}`));
    hide(resultsBody, false);
    hide(resultsPlaceholder, true);
    updateSticky('Netto-Einkommen', formatEuro(outcome.result.nettoAnnual), formatEuro(outcome.result.nettoMonthly));
  }
}

function onModeOrYearChange(): void {
  rebuildGewinnFields();
  rebuildOverrideFields();
  updateVisibility();
  recalc();
}

function init(): void {
  buildYearPills();
  buildBundesland();
  buildChildren();
  // Default triple already selected in HTML (2023–2025 = DEFAULT_AVERAGE_YEARS).
  yearTriple.value = DEFAULT_AVERAGE_YEARS.join(',');
  rebuildGewinnFields();
  rebuildOverrideFields();
  updateVisibility();

  form.addEventListener('click', (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.classList.contains('help-btn')) {
      event.preventDefault();
      event.stopPropagation();
      target.focus();
    }
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    recalc();
  });
  form.addEventListener('input', () => recalc());
  form.addEventListener('change', (event) => {
    const t = event.target;
    if (
      t instanceof HTMLInputElement &&
      (t.name === 'mode' || t.name === 'year-single')
    ) {
      onModeOrYearChange();
      return;
    }
    if (t === yearTriple) {
      onModeOrYearChange();
      return;
    }
    recalc();
  });
}

init();
