/**
 * Kindesunterhalt view: form, live results, in-memory Netto transfer.
 * No storage, no URL state, no network.
 */
import {
  calculateKindesunterhalt,
  DEFAULT_UNTERHALT_YEAR,
  type ChildInput,
  type KindesunterhaltInput,
  type KindesunterhaltResult,
} from '../kindesunterhalt/index.ts';
import { formatEuro, parseEuroInput } from '../shell/format.ts';
import type { MoneyValue } from '../netto/money.ts';

export interface NettoTransfer {
  monthly: MoneyValue;
  fromAverage: boolean;
}

export interface UnterhaltViewHost {
  getTransfer: () => NettoTransfer | null;
  setView: (view: 'netto' | 'unterhalt') => void;
}

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
  if (hidden) node.setAttribute('hidden', '');
  else node.removeAttribute('hidden');
}

let host: UnterhaltViewHost;
let childCount = 1;
let anzahlTouched = false;
let monthlyOverridden = false;

const form = () => document.getElementById('unterhalt-form') as HTMLFormElement;
const childrenBox = () => document.getElementById('uh-children') as HTMLElement;
const anzahlInput = () => document.getElementById('uh-anzahl') as HTMLInputElement;
const errorsBox = () => document.getElementById('uh-form-errors') as HTMLElement;
const resultsBody = () => document.getElementById('uh-results-body') as HTMLElement;
const resultsPlaceholder = () => document.getElementById('uh-results-placeholder') as HTMLElement;
const sourceHint = () => document.getElementById('uh-netto-source') as HTMLElement;
const nettoInput = () => document.getElementById('uh-netto') as HTMLInputElement;

function euroToInput(money: MoneyValue): string {
  const [w, f = '00'] = money.euros.split('.');
  const grouped = w.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return f === '00' ? grouped : `${grouped},${f}`;
}

function optionalEuro(id: string): { ok: true; value: string | undefined } | { ok: false; message: string } {
  const input = document.getElementById(id) as HTMLInputElement | null;
  const raw = input?.value ?? '';
  if (raw.trim() === '') return { ok: true, value: undefined };
  const parsed = parseEuroInput(raw);
  if (!parsed.ok || parsed.empty || parsed.value === null) {
    return { ok: false, message: 'Bitte eine gültige Zahl eingeben.' };
  }
  return { ok: true, value: parsed.value.toString() };
}

function requiredEuro(id: string): { ok: true; value: string } | { ok: false; empty: boolean; message: string } {
  const input = document.getElementById(id) as HTMLInputElement | null;
  const raw = input?.value ?? '';
  if (raw.trim() === '') return { ok: false, empty: true, message: 'Bitte geben Sie das monatliche Netto ein.' };
  const parsed = parseEuroInput(raw);
  if (!parsed.ok || parsed.empty || parsed.value === null) {
    return { ok: false, empty: false, message: 'Das monatliche Netto ist keine gültige Zahl.' };
  }
  return { ok: true, value: parsed.value.toString() };
}

function renderChildSlot(index: number, previous?: { age: string; privileged: boolean; own: boolean; income: string; bedarf: string }): void {
  const box = el('fieldset', { className: 'child-card', attrs: { id: `uh-child-${index}` } });
  box.append(el('legend', { text: `Kind ${index + 1}` }));

  const ageField = el('div', { className: 'field' });
  const ageId = `uh-child-${index}-age`;
  ageField.append(el('label', { text: 'Alter (vollendete Jahre)', attrs: { for: ageId } }));
  const age = el('input', {
    attrs: { id: ageId, type: 'text', inputmode: 'numeric', autocomplete: 'off', 'data-role': 'age' },
  });
  if (previous) age.value = previous.age;
  ageField.append(age);
  box.append(ageField);

  const privWrap = el('div', { className: 'is-hidden', attrs: { id: `uh-child-${index}-priv-wrap` } });
  const privId = `uh-child-${index}-privileged`;
  const privLabel = el('label', { className: 'check', attrs: { for: privId } });
  const priv = el('input', {
    attrs: { id: privId, type: 'checkbox', autocomplete: 'off', 'data-role': 'privileged' },
  });
  if (previous?.privileged) priv.checked = true;
  const privText = el('span', { className: 'check-text' });
  privText.append(
    document.createTextNode(
      'Unverheiratet, lebt im Haushalt eines Elternteils und befindet sich in allgemeiner Schulausbildung (§ 1603 Abs. 2 Satz 2 BGB).',
    ),
  );
  privLabel.append(priv, privText);
  privWrap.append(privLabel);
  box.append(privWrap);

  const ownWrap = el('div', { className: 'is-hidden', attrs: { id: `uh-child-${index}-own-wrap` } });
  const ownId = `uh-child-${index}-own`;
  const ownLabel = el('label', { className: 'check', attrs: { for: ownId } });
  const own = el('input', {
    attrs: { id: ownId, type: 'checkbox', autocomplete: 'off', 'data-role': 'own' },
  });
  if (previous?.own) own.checked = true;
  const ownText = el('span', { className: 'check-text' });
  ownText.append(
    document.createTextNode(
      'Lebt nicht im Haushalt eines Elternteils (Studium / eigener Haushalt) — Bedarf 990 €.',
    ),
  );
  ownLabel.append(own, ownText);
  ownWrap.append(ownLabel);
  box.append(ownWrap);

  const more = el('details', { className: 'more' });
  more.append(el('summary', { text: 'Eigenes Einkommen und konkreter Bedarf (optional)' }));
  const incField = el('div', { className: 'field' });
  const incId = `uh-child-${index}-income`;
  incField.append(el('label', { text: 'Eigenes Einkommen des Kindes', attrs: { for: incId } }));
  const incWrap = el('div', { className: 'input-suffix' });
  const inc = el('input', {
    attrs: { id: incId, type: 'text', inputmode: 'decimal', autocomplete: 'off', 'data-role': 'income' },
  });
  if (previous) inc.value = previous.income;
  incWrap.append(inc, el('span', { className: 'suffix', text: '€' }));
  incField.append(incWrap);
  incField.append(
    el('p', {
      className: 'hint',
      text: 'Anrechenbares Einkommen einschließlich BAföG-Darlehen und Ausbildungsbeihilfen; einen Ausbildungsaufwand von 100 € rechnen Sie selbst ab.',
    }),
  );
  const bedField = el('div', { className: 'field' });
  const bedId = `uh-child-${index}-bedarf`;
  bedField.append(el('label', { text: 'Konkreter Bedarf (optional)', attrs: { for: bedId } }));
  const bedWrap = el('div', { className: 'input-suffix' });
  const bed = el('input', {
    attrs: { id: bedId, type: 'text', inputmode: 'decimal', autocomplete: 'off', 'data-role': 'bedarf' },
  });
  if (previous) bed.value = previous.bedarf;
  bedWrap.append(bed, el('span', { className: 'suffix', text: '€' }));
  bedField.append(bedWrap);
  more.append(incField, bedField);
  box.append(more);

  if (childCount > 1 || index > 0) {
    const remove = el('button', {
      className: 'btn-remove',
      text: 'Kind entfernen',
      attrs: { type: 'button', 'data-remove': String(index) },
    });
    box.append(remove);
  }

  childrenBox().append(box);
  syncChildFlags(index);
}

function ageOf(index: number): number | null {
  const input = document.getElementById(`uh-child-${index}-age`) as HTMLInputElement | null;
  const raw = input?.value.trim() ?? '';
  if (raw === '') return null;
  if (!/^\d+$/.test(raw)) return null;
  return Number(raw);
}

function syncChildFlags(index: number): void {
  const age = ageOf(index);
  const privWrap = document.getElementById(`uh-child-${index}-priv-wrap`);
  const ownWrap = document.getElementById(`uh-child-${index}-own-wrap`);
  if (!privWrap || !ownWrap) return;
  const showOwn = age !== null && age >= 18;
  const showPriv = age !== null && age >= 18 && age <= 20;
  hide(privWrap, !showPriv);
  hide(ownWrap, !showOwn);
  if (!showPriv) {
    const cb = document.getElementById(`uh-child-${index}-privileged`) as HTMLInputElement | null;
    // Leave the checked state so a later valid age restores it; validation reports
    // the conflict if the age is currently incompatible.
    void cb;
  }
}

function snapshotChildren(): { age: string; privileged: boolean; own: boolean; income: string; bedarf: string }[] {
  const snaps = [];
  for (let i = 0; i < childCount; i++) {
    const age = (document.getElementById(`uh-child-${i}-age`) as HTMLInputElement | null)?.value ?? '';
    const privileged = (document.getElementById(`uh-child-${i}-privileged`) as HTMLInputElement | null)?.checked ?? false;
    const own = (document.getElementById(`uh-child-${i}-own`) as HTMLInputElement | null)?.checked ?? false;
    const income = (document.getElementById(`uh-child-${i}-income`) as HTMLInputElement | null)?.value ?? '';
    const bedarf = (document.getElementById(`uh-child-${i}-bedarf`) as HTMLInputElement | null)?.value ?? '';
    snaps.push({ age, privileged, own, income, bedarf });
  }
  return snaps;
}

function rebuildChildren(nextCount: number, snaps?: ReturnType<typeof snapshotChildren>): void {
  const prev = snaps ?? snapshotChildren();
  childCount = Math.max(1, Math.min(12, nextCount));
  childrenBox().replaceChildren();
  for (let i = 0; i < childCount; i++) {
    renderChildSlot(i, prev[i]);
  }
  if (!anzahlTouched) anzahlInput().value = String(childCount);
}

function parseChildren(): ChildInput[] | { errors: string[] } {
  const children: ChildInput[] = [];
  const errors: string[] = [];
  for (let i = 0; i < childCount; i++) {
    const ageRaw = ((document.getElementById(`uh-child-${i}-age`) as HTMLInputElement | null)?.value ?? '').trim();
    if (ageRaw === '') {
      errors.push(`Bitte geben Sie das Alter von Kind ${i + 1} ein.`);
      continue;
    }
    if (!/^\d+$/.test(ageRaw)) {
      errors.push(`Das Alter von Kind ${i + 1} muss eine ganze Zahl sein.`);
      continue;
    }
    const ageYears = Number(ageRaw);
    const privileged = (document.getElementById(`uh-child-${i}-privileged`) as HTMLInputElement | null)?.checked ?? false;
    const own = (document.getElementById(`uh-child-${i}-own`) as HTMLInputElement | null)?.checked ?? false;
    const incomeRaw = (document.getElementById(`uh-child-${i}-income`) as HTMLInputElement | null)?.value ?? '';
    const bedarfRaw = (document.getElementById(`uh-child-${i}-bedarf`) as HTMLInputElement | null)?.value ?? '';
    const child: ChildInput = { ageYears };
    if (privileged) child.privilegedAdult = true;
    if (own) child.ownHousehold = true;
    if (incomeRaw.trim() !== '') {
      const p = parseEuroInput(incomeRaw);
      if (!p.ok || p.empty || p.value === null) {
        errors.push(`Das eigene Einkommen von Kind ${i + 1} ist keine gültige Zahl.`);
      } else {
        child.childIncome = p.value.toString();
      }
    }
    if (bedarfRaw.trim() !== '') {
      const p = parseEuroInput(bedarfRaw);
      if (!p.ok || p.empty || p.value === null) {
        errors.push(`Der Bedarf von Kind ${i + 1} ist keine gültige Zahl.`);
      } else {
        child.bedarfOverride = p.value.toString();
      }
    }
    children.push(child);
  }
  if (errors.length) return { errors };
  return children;
}

function collect(): KindesunterhaltInput | { errors: string[]; emptyNetto?: boolean; emptyAge?: boolean } {
  const errors: string[] = [];
  const netto = requiredEuro('uh-netto');
  if (!netto.ok && !netto.empty) errors.push(netto.message);

  const retirement = optionalEuro('uh-retirement');
  const work = optionalEuro('uh-work');
  const debts = optionalEuro('uh-debts');
  const otherDed = optionalEuro('uh-other-ded');
  const warm = optionalEuro('uh-warmmiete');
  const otherUh = optionalEuro('uh-other-uh');
  const otherParent = optionalEuro('uh-other-parent');
  for (const x of [retirement, work, debts, otherDed, warm, otherUh, otherParent]) {
    if (!x.ok) errors.push(x.message);
  }

  const kids = parseChildren();
  if ('errors' in kids) errors.push(...kids.errors);

  const anzahlRaw = anzahlInput().value.trim();
  let anzahlBerechtigter: number | undefined;
  if (anzahlRaw === '') {
    anzahlBerechtigter = childCount;
  } else if (!/^\d+$/.test(anzahlRaw)) {
    errors.push('Die Anzahl der Unterhaltsberechtigten muss eine ganze Zahl zwischen 1 und 20 sein.');
  } else {
    anzahlBerechtigter = Number(anzahlRaw);
  }

  const gruppeRaw = ((document.getElementById('uh-gruppe') as HTMLInputElement | null)?.value ?? '').trim();
  let gruppenverschiebung = 0;
  if (gruppeRaw !== '') {
    const normalized = gruppeRaw.replace('−', '-').replace('–', '-');
    if (!/^-?\d+$/.test(normalized)) {
      errors.push('Die Gruppenverschiebung muss eine ganze Zahl zwischen −14 und 14 sein.');
    } else {
      gruppenverschiebung = Number(normalized);
    }
  }

  if (!netto.ok && netto.empty) {
    // Same pattern as the Netto form: empty required starting field → placeholder, no error.
    return { errors: [], emptyNetto: true };
  }
  if (errors.length) return { errors };
  if (!netto.ok) return { errors: [netto.message] };
  if ('errors' in kids) return { errors: kids.errors };

  const erwerb = (document.getElementById('uh-erwerb') as HTMLInputElement).checked;

  return {
    year: DEFAULT_UNTERHALT_YEAR,
    monthlyNetto: netto.value,
    additionalRetirement: retirement.ok ? retirement.value : undefined,
    workExpenses: work.ok ? work.value : undefined,
    debts: debts.ok ? debts.value : undefined,
    otherDeductions: otherDed.ok ? otherDed.value : undefined,
    erwerbstaetig: erwerb,
    warmmiete: warm.ok ? warm.value : undefined,
    otherUnterhalt: otherUh.ok ? otherUh.value : undefined,
    children: kids,
    anzahlBerechtigter,
    gruppenverschiebung,
    otherParentNetto: otherParent.ok ? otherParent.value : undefined,
  };
}

function showErrors(messages: string[]): void {
  const box = errorsBox();
  if (!messages.length) {
    box.replaceChildren();
    box.hidden = true;
    return;
  }
  box.replaceChildren();
  for (const m of messages) box.append(el('p', { text: m }));
  box.hidden = false;
}

function hideResults(placeholder?: string): void {
  hide(resultsBody(), true);
  resultsBody().replaceChildren();
  if (placeholder) resultsPlaceholder().textContent = placeholder;
  hide(resultsPlaceholder(), false);
}

function rankLabel(rank: 1 | 4, privileged: boolean): string {
  if (rank === 1 && privileged) return 'Rang 1 (privilegiert)';
  if (rank === 1) return 'Rang 1';
  return 'Rang 4';
}

function renderResult(r: KindesunterhaltResult): HTMLElement {
  const wrap = el('div');
  const head = el('div', { className: 'headline' });
  head.append(el('h2', { className: 'eyebrow', text: 'Kindesunterhalt (Zahlbetrag, Monat)' }));
  head.append(el('div', { className: 'amount', text: formatEuro(r.sumZahlbetrag) }));
  const subBits = [`Düsseldorfer Tabelle ${r.year}`];
  if (r.mangelfall) subBits.push('Mangelfall');
  if (r.incomeAboveTable) subBits.push('Gruppe 15 als Untergrenze');
  head.append(el('p', { className: 'sub', text: subBits.join(' · ') }));
  wrap.append(head);

  const list = el('div', { className: 'child-results' });
  r.children.forEach((c, i) => {
    const card = el('article', { className: 'child-result' });
    card.append(el('h3', { text: `Kind ${i + 1} · ${c.ageYears} Jahre · Altersstufe ${c.altersstufe}` }));
    const dl = el('dl', { className: 'facts' });
    const rows: [string, string][] = [
      ['Rang', rankLabel(c.rank, c.privilegedAdult)],
      ['Bedarf', formatEuro(c.bedarf) + (c.studentBedarf ? ' (Student / eigener Haushalt)' : c.groupUsed ? ` (Gruppe ${c.groupUsed})` : '')],
      ['Kindergeldanteil', formatEuro(c.kindergeldShare)],
    ];
    if (c.childIncome.cents !== 0) rows.push(['Eigenes Einkommen', formatEuro(c.childIncome)]);
    rows.push(['Restbedarf', formatEuro(c.restBedarf)]);
    if (c.haftungsanteil) rows.push(['Haftungsanteil', formatEuro(c.haftungsanteil)]);
    rows.push(['Zahlbetrag', formatEuro(c.zahlbetrag)]);
    for (const [dt, dd] of rows) {
      dl.append(el('dt', { text: dt }), el('dd', { text: dd }));
    }
    card.append(dl);
    if (c.haftungsanteilUnknown) {
      card.append(
        el('p', {
          className: 'hint flag',
          text: 'Bei volljährigen Kindern sind beide Eltern barunterhaltspflichtig. Der Haftungsanteil setzt das bereinigte Netto des anderen Elternteils voraus. Der angezeigte Zahlbetrag ist die Obergrenze (Restbedarf), nicht fest der Anteil dieses Elternteils.',
        }),
      );
    }
    list.append(card);
  });
  wrap.append(list);

  const table = el('table', { className: 'break' });
  table.append(el('caption', { className: 'section-title', text: 'Aufschlüsselung' }));
  const tbody = el('tbody');
  const rows: [string, string][] = [
    ['Unterhaltsrechtliches Netto', formatEuro(r.unterhaltsrechtlichesNetto)],
    ['Einkommensgruppe (Grund)', String(r.groupBase)],
    ['Einkommensgruppe nach Anzahl / Verschiebung', String(r.groupAdjusted)],
  ];
  if (r.bkbSteps > 0) {
    rows.push(['Herabsetzung nach Bedarfskontrollbetrag', `${r.bkbSteps} ${r.bkbSteps === 1 ? 'Stufe' : 'Stufen'}`]);
  }
  rows.push(
    ['Bedarfskontrollbetrag', formatEuro(r.bkb)],
    ['Selbstbehalt', formatEuro(r.selbstbehaltApplied)],
  );
  if (r.warmmieteIncrease.cents > 0) {
    rows.push(['davon Erhöhung durch Warmmiete', formatEuro(r.warmmieteIncrease)]);
  }
  rows.push(
    ['Summe Zahlbetrag', formatEuro(r.sumZahlbetrag)],
    ['Verbleibendes Einkommen', formatEuro(r.remainingAfterUnterhalt)],
  );
  if (r.mangelfall) {
    rows.push(['Mangelfall', 'Ja — anteilig gekürzt']);
  }
  for (const [k, v] of rows) {
    const tr = el('tr');
    tr.append(el('th', { text: k, attrs: { scope: 'row' } }), el('td', { text: v, className: 'cent' }));
    tbody.append(tr);
  }
  table.append(tbody);
  wrap.append(table);

  if (r.warnings.length) {
    const ul = el('ul', { className: 'warn-list' });
    // Deduplicate the Haftungsanteil note if already shown per child? Keep case-level warnings.
    for (const w of r.warnings) ul.append(el('li', { text: w }));
    wrap.append(ul);
  }
  return wrap;
}

function recalc(): void {
  const collected = collect();
  if ('errors' in collected) {
    if (collected.emptyNetto) {
      showErrors([]);
      hideResults(
        'Geben Sie Ihr monatliches unterhaltsrechtliches Netto und das Alter der Kinder ein — das Ergebnis erscheint sofort.',
      );
      return;
    }
    showErrors(collected.errors);
    hideResults();
    return;
  }
  const outcome = calculateKindesunterhalt(collected);
  if (!outcome.ok) {
    showErrors(outcome.errors.map((e) => e.message));
    hideResults();
    return;
  }
  showErrors([]);
  resultsBody().replaceChildren(renderResult(outcome.result));
  hide(resultsBody(), false);
  hide(resultsPlaceholder(), true);
}

function setSourceNote(fromAverage: boolean | null, filled: boolean): void {
  const hint = sourceHint();
  if (!filled || fromAverage === null) {
    hint.textContent = '';
    hint.hidden = true;
    return;
  }
  if (fromAverage) {
    hint.textContent = 'Übernommen aus dem Dreijahresdurchschnitt des Netto-Rechners (Monat). Sie können den Betrag jederzeit überschreiben.';
  } else {
    hint.textContent =
      'Übernommen aus einem einzelnen Jahr des Netto-Rechners. Gerichte legen in der Regel den Durchschnitt von drei Jahren zugrunde. Sie können den Betrag jederzeit überschreiben.';
  }
  hint.hidden = false;
}

/** Fill the monthly Netto from a just-computed figure and show the Unterhalt view. */
export function applyNettoTransfer(transfer: NettoTransfer): void {
  nettoInput().value = euroToInput(transfer.monthly);
  monthlyOverridden = false;
  setSourceNote(transfer.fromAverage, true);
  host.setView('unterhalt');
  recalc();
  nettoInput().focus();
}

/** If the monthly field is still empty, offer the last in-memory Netto figure. */
export function offerDefaultNetto(): void {
  const transfer = host.getTransfer();
  if (!transfer) return;
  if (nettoInput().value.trim() === '' && !monthlyOverridden) {
    nettoInput().value = euroToInput(transfer.monthly);
      setSourceNote(transfer.fromAverage, true);
    recalc();
  }
}

export function initKindesunterhalt(viewHost: UnterhaltViewHost): void {
  host = viewHost;
  rebuildChildren(1, []);
  anzahlInput().value = '1';

  const f = form();
  f.addEventListener('submit', (event) => {
    event.preventDefault();
    recalc();
  });
  f.addEventListener('click', (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.classList.contains('help-btn')) {
      event.preventDefault();
      event.stopPropagation();
      target.focus();
    }
    if (target instanceof HTMLElement && target.classList.contains('btn-remove')) {
      const idx = Number(target.getAttribute('data-remove'));
      const snaps = snapshotChildren().filter((_, i) => i !== idx);
      rebuildChildren(snaps.length || 1, snaps);
      recalc();
    }
  });
  f.addEventListener('input', (event) => {
    const t = event.target;
    if (t === anzahlInput()) anzahlTouched = anzahlInput().value.trim() !== '';
    if (t === nettoInput()) {
      // F1: clearing (empty or whitespace) drops the override so the next
      // navigation can prefill from the in-memory Netto figure again.
      // A typed non-empty value still sticks across navigation.
      const empty = nettoInput().value.trim() === '';
      monthlyOverridden = !empty;
      if (empty) setSourceNote(null, false);
    }
    if (t instanceof HTMLInputElement && t.dataset.role === 'age') {
      const id = t.id; // uh-child-N-age
      const idx = Number(id.split('-')[2]);
      if (!Number.isNaN(idx)) syncChildFlags(idx);
    }
    recalc();
  });
  f.addEventListener('change', () => recalc());

  anzahlInput().addEventListener('blur', () => {
    if (anzahlInput().value.trim() !== '') return;
    anzahlTouched = false;
    anzahlInput().value = String(childCount);
    recalc();
  });

  document.getElementById('uh-add-child')?.addEventListener('click', () => {
    if (childCount >= 12) return;
    rebuildChildren(childCount + 1);
    recalc();
  });

  recalc();
}

export { hide as hideElement };
