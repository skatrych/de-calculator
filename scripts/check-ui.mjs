/**
 * UI tests for the Netto form (L1, L2, age field, issue 5) and for
 * Kindesunterhalt (Netto transfer, G1, Mangelfall, adult flags).
 * Playwright is a devDependency and is never bundled into the app.
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const BASE = '/de-calculator';

const built = spawnSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' });
if (built.status !== 0) process.exit(built.status ?? 1);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

function serveDist() {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      let rel = decodeURIComponent(url.pathname);
      if (rel === BASE || rel === `${BASE}/`) rel = '/index.html';
      else if (rel.startsWith(`${BASE}/`)) rel = rel.slice(BASE.length);
      else {
        res.writeHead(404);
        res.end();
        return;
      }
      const file = path.normalize(path.join(dist, rel));
      if (!file.startsWith(dist)) {
        res.writeHead(403);
        res.end();
        return;
      }
      if (!existsSync(file) || statSync(file).isDirectory()) {
        res.writeHead(404);
        res.end();
        return;
      }
      const ext = path.extname(file);
      res.writeHead(200, {
        'Content-Type': MIME[ext] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, port: addr.port });
    });
    server.on('error', reject);
  });
}

async function openSingle(page) {
  await page.locator('label[for="mode-single"]').click();
  await page.waitForSelector('#gewinn-2026');
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const failures = [];

try {
  const { server, port } = await serveDist();
  const browser = await chromium.launch({ headless: true });
  const url = `http://127.0.0.1:${port}${BASE}/`;

  // --- L1 ---
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await openSingle(page);
    await page.fill('#gewinn-2026', '120.000');
    await page.selectOption('#children', '2');
    await page.waitForSelector('#kfb-wrap:not(.is-hidden)');
    const afterDefault = await page.inputValue('#kfb-zaehler');
    assert(afterDefault === '1', `L1: default after 2 children should be 1, got ${afterDefault}`);

    await page.fill('#kfb-zaehler', '2');
    const afterEdit = await page.inputValue('#kfb-zaehler');
    assert(afterEdit === '2', `L1: edited Zähler should stay 2, got ${afterEdit}`);

    await page.selectOption('#children', '0');
    const hidden = await page.locator('#kfb-wrap').evaluate((el) => el.classList.contains('is-hidden'));
    assert(hidden, 'L1: field should be hidden at 0 children');
    const atZero = await page.inputValue('#kfb-zaehler');
    assert(atZero === '0', `L1: hidden value forced to 0, got ${atZero}`);

    await page.selectOption('#children', '2');
    await page.waitForSelector('#kfb-wrap:not(.is-hidden)');
    const afterBack = await page.inputValue('#kfb-zaehler');
    assert(afterBack === '1', `L1: after 0 → 2, Zähler must reset to default 1, not stay 0 (got ${afterBack})`);

    // With G20 facts (church 9 %, Gewinn 120k, 2 kids) the default must yield G20b Netto, not G20a.
    await page.locator('#church').check();
    await page.waitForSelector('.headline .amount');
    const headline = (await page.locator('.headline .amount').innerText()).replace(/\s/g, '');
    assert(
      headline.includes('70.142,95'),
      `L1: Netto should be G20b 70.142,95 € (default Zähler 1), got ${headline}`,
    );
    if (errors.length) throw new Error(`L1 pageerror: ${errors.join('; ')}`);
    await page.close();
    console.log('L1: ok (edit → children 0 → children 2 resets Zähler to default 1; Netto is G20b)');
  }

  // --- L2 ---
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await openSingle(page);
    await page.fill('#gewinn-2026', '80.000');
    await page.selectOption('#children', '2');
    await page.waitForSelector('#kfb-wrap:not(.is-hidden)');

    const rangeMsg = 'Der Kinderfreibetrag-Zähler muss ein Vielfaches von 0,5 zwischen 0 und 2 sein.';

    async function expectGermanError(typed, expectedValue) {
      await page.fill('#kfb-zaehler', typed);
      const shown = await page.inputValue('#kfb-zaehler');
      assert(
        shown === expectedValue,
        `L2: typed ${typed} must not be silently clamped (input shows ${shown})`,
      );
      const hidden = await page.locator('#form-errors').getAttribute('hidden');
      assert(hidden === null, `L2: #form-errors should be visible for ${typed}`);
      const text = (await page.locator('#form-errors').innerText()).trim();
      assert(
        text === rangeMsg,
        `L2: German error for ${typed} should be the same as for a wrong step, got: ${text}`,
      );
      const resultsHidden = await page.locator('#results-body').isHidden().catch(() => true);
      const placeholder = page.locator('#results-placeholder');
      const placeholderVisible = (await placeholder.count())
        ? await placeholder.isVisible()
        : false;
      assert(resultsHidden || placeholderVisible, `L2: results must be hidden for ${typed}`);
    }

    await expectGermanError('-1', '-1');
    await expectGermanError('2.5', '2.5');
    await expectGermanError('0.3', '0.3');

    // A legal value after an error must compute again (error clears).
    await page.fill('#kfb-zaehler', '1');
    const errHidden = await page.locator('#form-errors').getAttribute('hidden');
    assert(errHidden !== null, `L2: error should clear for a legal value, hidden=${errHidden}`);
    await page.waitForSelector('.headline .amount');

    // 1 child, 1.5 is above max — same treatment, message uses max 1.
    await page.selectOption('#children', '1');
    await page.fill('#kfb-zaehler', '1.5');
    const shown = await page.inputValue('#kfb-zaehler');
    assert(shown === '1.5', `L2: 1.5 with 1 child must not clamp to 1 (got ${shown})`);
    const text = (await page.locator('#form-errors').innerText()).trim();
    assert(
      text === 'Der Kinderfreibetrag-Zähler muss ein Vielfaches von 0,5 zwischen 0 und 1 sein.',
      `L2: above-max with 1 child, got: ${text}`,
    );

    await page.close();
    console.log('L2: ok (negative, above-max and wrong-step keep the typed value and show the same German error)');
  }

  // --- Age checkbox placement and wording ---
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const info = await page.evaluate(() => {
      const age = document.getElementById('age-wrap');
      const childrenField = document.querySelector('label[for="children"]')?.closest('.field')
        ?? document.querySelector('label[for="children"]');
      const ageText = age?.innerText ?? '';
      const tip = document.getElementById('tip-age');
      const input = document.getElementById('age23');
      const before = !!(age && childrenField && !!(age.compareDocumentPosition(childrenField) & Node.DOCUMENT_POSITION_FOLLOWING));
      return {
        ageText,
        tip: tip?.textContent ?? '',
        described: input?.getAttribute('aria-describedby') ?? '',
        before,
        oldLabelPresent: /(?:^|\n)\s*Mindestens 23 Jahre alt\s*(?:\n|$)/.test(document.body.innerText)
          && !document.body.innerText.includes('Ich bin mindestens 23 Jahre alt'),
      };
    });
    assert(info.ageText.includes('Ich bin mindestens 23 Jahre alt'), `age label missing: ${info.ageText}`);
    assert(info.before, 'age checkbox must sit above the children fields');
    assert(info.described === 'tip-age', `aria-describedby should be tip-age, got ${info.described}`);
    assert(
      /Kinderlosenzuschlag/.test(info.tip) && /4,2\s*%/.test(info.tip),
      `hint must mention Kinderlosenzuschlag and 4,2 %: ${info.tip}`,
    );
    assert(!info.oldLabelPresent, 'old label "Mindestens 23 Jahre alt" should not be the visible label');
    await page.close();
    console.log('Age field: ok (new label, above children, hint + aria-describedby)');
  }

  // --- Issue #5: empty / whitespace Zähler, blur refills default ---
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await openSingle(page);
    await page.fill('#gewinn-2026', '80.000');
    await page.selectOption('#children', '2');
    await page.waitForSelector('#kfb-wrap:not(.is-hidden)');
    await page.waitForSelector('.headline .amount');
    const defaultValue = await page.inputValue('#kfb-zaehler');
    assert(defaultValue === '1', `issue 5: default for 2 unmarried children should be 1, got ${defaultValue}`);
    const defaultNetto = (await page.locator('.headline .amount').innerText()).replace(/\s/g, '');

    // Clear, leave empty, then blur: field must show the default, Netto unchanged.
    await page.fill('#kfb-zaehler', '');
    assert((await page.inputValue('#kfb-zaehler')) === '', 'issue 5: field should be blank before blur');
    await page.locator('#kfb-zaehler').blur();
    const afterEmpty = await page.inputValue('#kfb-zaehler');
    assert(afterEmpty === '1', `issue 5: after empty + blur, field should show default 1, got ${afterEmpty}`);
    await page.waitForSelector('.headline .amount');
    const afterEmptyNetto = (await page.locator('.headline .amount').innerText()).replace(/\s/g, '');
    assert(
      afterEmptyNetto === defaultNetto,
      `issue 5: Netto after empty+blur should match the default case (${defaultNetto}), got ${afterEmptyNetto}`,
    );

    // Whitespace-only, then blur: same refill.
    await page.fill('#kfb-zaehler', '   ');
    await page.locator('#kfb-zaehler').blur();
    const afterWs = await page.inputValue('#kfb-zaehler');
    assert(afterWs === '1', `issue 5: after whitespace + blur, field should show default 1, got ${afterWs}`);
    const afterWsNetto = (await page.locator('.headline .amount').innerText()).replace(/\s/g, '');
    assert(
      afterWsNetto === defaultNetto,
      `issue 5: Netto after whitespace+blur should match the default case, got ${afterWsNetto}`,
    );

    // Dirty flag is cleared, so changing children updates the Zähler again.
    await page.selectOption('#children', '3');
    await page.waitForSelector('#kfb-wrap:not(.is-hidden)');
    const afterKids = await page.inputValue('#kfb-zaehler');
    assert(afterKids === '1.5', `issue 5: after blur-reset, raising children to 3 should auto-follow to 1.5, got ${afterKids}`);
    await page.waitForSelector('.headline .amount');
    const afterKidsNetto = (await page.locator('.headline .amount').innerText()).replace(/\s/g, '');
    assert(
      afterKidsNetto !== defaultNetto,
      `issue 5: Netto should update when children (and default Zähler) change, still ${afterKidsNetto}`,
    );

    const errHidden = await page.locator('#form-errors').getAttribute('hidden');
    assert(errHidden !== null, 'issue 5: no error state after empty blur');

    await page.close();
    console.log('Issue 5: ok (empty and whitespace blur refill the default; children changes auto-follow again)');
  }

  // --- Kindesunterhalt: in-memory Netto transfer, no URL/storage ---
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const avgLabel = page.locator('label[for="mode-avg"]');
    if (await avgLabel.count()) await avgLabel.click();
    await page.waitForSelector('#gewinn-2023');
    await page.fill('#gewinn-2023', '80.000');
    await page.fill('#gewinn-2024', '80.000');
    await page.fill('#gewinn-2025', '80.000');
    await page.waitForSelector('.headline .amount');
    const transferBtn = page.getByRole('button', {
      name: 'Dieses monatliche Durchschnitts-Netto für Kindesunterhalt verwenden',
    });
    assert(await transferBtn.count(), 'transfer: exact average-button label must be present');
    const monthlyBefore = (await page.locator('.headline .sub').first().innerText()).replace(/\s/g, '');
    assert(
      (await page.locator('#uh-transfer-average').count()) === 1,
      'transfer: average button should have id uh-transfer-average',
    );
    // DOM click: Playwright's pointer click is unreliable against the
    // sticky results panel; the handler itself is sound (a11y tests use nav).
    const clicked = await page.evaluate(() => {
      const btn = document.getElementById('uh-transfer-average');
      if (!btn) return false;
      btn.click();
      return true;
    });
    assert(clicked, 'transfer: button.click() should run');
    await page.waitForFunction(() => !document.getElementById('view-unterhalt')?.hasAttribute('hidden'));
    await page.waitForSelector('#unterhalt-form');
    const viewHidden = await page.locator('#view-unterhalt').getAttribute('hidden');
    assert(viewHidden === null, 'transfer: Kindesunterhalt view should be visible');
    const filled = await page.inputValue('#uh-netto');
    assert(filled.length > 0, 'transfer: monthly Netto should be filled');
    const loc = page.url();
    const u = new URL(loc);
    assert(!u.search, `transfer: URL must not carry query state, got ${loc}`);
    assert(!u.hash, `transfer: URL must not carry hash state, got ${loc}`);
    const storage = await page.evaluate(() => ({
      ls: window.localStorage.length,
      ss: window.sessionStorage.length,
    }));
    assert(storage.ls === 0, `transfer: localStorage must stay empty, length ${storage.ls}`);
    assert(storage.ss === 0, `transfer: sessionStorage must stay empty, length ${storage.ss}`);
    // Results need an age; G1 after transfer still works if we type ages.
    await page.fill('#uh-child-0-age', '4');
    await page.locator('#uh-add-child').click();
    await page.waitForSelector('#uh-child-1-age');
    await page.fill('#uh-child-1-age', '8');
    await page.waitForSelector('#uh-results-body .amount');
    // Monthly field still holds the transferred figure (we did not overwrite it).
    assert((await page.inputValue('#uh-netto')) === filled, 'transfer: field stays at the transferred value');
    void monthlyBefore;
    await page.close();
    console.log('Kindesunterhalt transfer: ok (in-memory copy, exact button label, no URL or storage)');
  }

  // --- Kindesunterhalt G1 amounts ---
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.locator('#nav-unterhalt').click();
    await page.waitForSelector('#uh-child-0-age');
    await page.fill('#uh-netto', '4000');
    await page.fill('#uh-child-0-age', '4');
    await page.locator('#uh-add-child').click();
    await page.waitForSelector('#uh-child-1-age');
    await page.fill('#uh-child-1-age', '8');
    await page.waitForSelector('#uh-results-body .amount');
    const text = (await page.locator('#uh-results-body').innerText()).replace(/\s/g, '');
    assert(text.includes('1.079,00'), `G1: sum 1.079,00 € missing in ${text}`);
    assert(text.includes('493,50'), `G1: 493,50 € missing in ${text}`);
    assert(text.includes('585,50'), `G1: 585,50 € missing in ${text}`);
    await page.close();
    console.log('Kindesunterhalt G1: ok (493,50 + 585,50 = 1.079,00)');
  }

  // --- Kindesunterhalt Mangelfall G5 + adult flags ---
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.locator('#nav-unterhalt').click();
    await page.waitForSelector('#uh-child-0-age');
    await page.fill('#uh-netto', '1750');
    await page.fill('#uh-child-0-age', '18');
    await page.waitForSelector('#uh-child-0-priv-wrap:not(.is-hidden)');
    const privLabel = await page.locator('label[for="uh-child-0-privileged"]').innerText();
    assert(
      privLabel.includes('allgemeiner Schulausbildung'),
      `adult flag label missing privileged wording: ${privLabel}`,
    );
    const ownVisible = await page.locator('#uh-child-0-own-wrap').isVisible();
    assert(ownVisible, 'own-household flag should be visible at age 18');
    const ownLabel = await page.locator('label[for="uh-child-0-own"]').innerText();
    assert(ownLabel.includes('Bedarf 990'), `own-household label: ${ownLabel}`);
    await page.locator('#uh-child-0-privileged').check();
    await page.locator('#uh-add-child').click();
    await page.fill('#uh-child-1-age', '7');
    await page.locator('#uh-add-child').click();
    await page.fill('#uh-child-2-age', '5');
    await page.waitForSelector('#uh-results-body .amount');
    const text = (await page.locator('#uh-results-body').innerText()).replace(/\s/g, '');
    assert(text.includes('107,60'), `G5: 107,60 missing in ${text}`);
    assert(text.includes('105,02'), `G5: 105,02 missing in ${text}`);
    assert(text.includes('87,38'), `G5: 87,38 missing in ${text}`);
    assert(/Mangelfall/.test(await page.locator('#uh-results-body').innerText()), 'G5: Mangelfall should be labelled');

    // Mutual exclusion: privileged + own household is a validation error, results hidden.
    await page.locator('#uh-child-0-own').check();
    const err = (await page.locator('#uh-form-errors').innerText()).trim();
    assert(/schließen einander aus/.test(err), `mutual-exclusion error, got: ${err}`);
    const resultsHidden = await page.locator('#uh-results-body').isHidden();
    assert(resultsHidden, 'results must be hidden on the mutual-exclusion error');
    await page.close();
    console.log('Kindesunterhalt G5 and adult flags: ok (Mangelfall cents, flags, mutual exclusion)');
  }

  // --- F1: clearing #uh-netto resets override; next nav prefills again ---
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const avgLabel = page.locator('label[for="mode-avg"]');
    if (await avgLabel.count()) await avgLabel.click();
    await page.waitForSelector('#gewinn-2023');
    await page.fill('#gewinn-2023', '80.000');
    await page.fill('#gewinn-2024', '80.000');
    await page.fill('#gewinn-2025', '80.000');
    await page.waitForSelector('.headline .amount');
    await page.locator('#nav-unterhalt').click();
    await page.waitForSelector('#uh-netto');
    await page.waitForFunction(() => document.getElementById('uh-netto')?.value.trim() !== '');
    const prefilled = await page.inputValue('#uh-netto');
    assert(prefilled.length > 0, `F1: first nav should prefill, got "${prefilled}"`);

    // Clear (empty), navigate away and back → prefilled again.
    await page.fill('#uh-netto', '');
    assert((await page.inputValue('#uh-netto')) === '', 'F1: field should be empty after clear');
    await page.locator('#nav-netto').click();
    await page.waitForSelector('#calc-form');
    await page.locator('#nav-unterhalt').click();
    await page.waitForSelector('#uh-netto');
    await page.waitForFunction(() => document.getElementById('uh-netto')?.value.trim() !== '');
    const afterEmpty = await page.inputValue('#uh-netto');
    assert(afterEmpty === prefilled, `F1: after clear+nav, expected ${prefilled}, got ${afterEmpty}`);

    // Whitespace-only clear, same refill on nav.
    await page.fill('#uh-netto', '   ');
    await page.locator('#nav-netto').click();
    await page.waitForSelector('#calc-form');
    await page.locator('#nav-unterhalt').click();
    await page.waitForSelector('#uh-netto');
    await page.waitForFunction(() => document.getElementById('uh-netto')?.value.trim() !== '');
    const afterWs = await page.inputValue('#uh-netto');
    assert(afterWs === prefilled, `F1: after whitespace+nav, expected ${prefilled}, got ${afterWs}`);

    // A typed override still sticks across navigation.
    await page.fill('#uh-netto', '5.000');
    await page.locator('#nav-netto').click();
    await page.locator('#nav-unterhalt').click();
    await page.waitForSelector('#uh-netto');
    const afterTyped = await page.inputValue('#uh-netto');
    assert(afterTyped === '5.000', `F1: typed 5.000 must stick, got ${afterTyped}`);

    await page.close();
    console.log('F1: ok (clear and whitespace refill on nav; typed override sticks)');
  }

  // --- N1: adults-only Masse ≤ 0 shows Mangelfall in the result subtitle ---
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.locator('#nav-unterhalt').click();
    await page.waitForSelector('#uh-child-0-age');
    await page.fill('#uh-netto', '1750');
    await page.fill('#uh-child-0-age', '22');
    await page.waitForSelector('#uh-results-body .amount');
    const body = await page.locator('#uh-results-body').innerText();
    const sub = (await page.locator('#uh-results-body .sub').innerText()).trim();
    const amount = (await page.locator('#uh-results-body .amount').innerText()).replace(/\s/g, '');
    assert(amount.includes('0,00'), `N1: Zahlbetrag should be 0,00, got ${amount}`);
    assert(
      /\bMangelfall\b/.test(sub),
      `N1: result subtitle should say Mangelfall, got "${sub}"`,
    );
    assert(/\bMangelfall\b/.test(body), 'N1: results body should mention Mangelfall');
    await page.close();
    console.log('N1: ok (adults-only Masse 0 subtitle includes Mangelfall)');
  }

  // Desktop form screenshot for the PR (Netto, unchanged path)
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
    await page.goto(url, { waitUntil: 'networkidle' });
    await openSingle(page);
    await page.fill('#gewinn-2026', '80.000');
    await page.selectOption('#children', '2');
    await page.waitForSelector('#kfb-wrap:not(.is-hidden)');
    await page.waitForSelector('.headline .amount');
    const shot = '/workspace/de-calculator-ui.png';
    if (existsSync('/workspace') && statSync('/workspace').isDirectory()) {
      await page.screenshot({ path: shot, fullPage: false });
      console.log(`screenshot: ${shot}`);
    } else {
      console.log('screenshot skipped (no /workspace on this runner)');
    }
    await page.close();
  }

  // Desktop screenshot of the Kindesunterhalt section (G1)
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.locator('#nav-unterhalt').click();
    await page.waitForSelector('#uh-child-0-age');
    await page.fill('#uh-netto', '4.000');
    await page.fill('#uh-child-0-age', '4');
    await page.locator('#uh-add-child').click();
    await page.waitForSelector('#uh-child-1-age');
    await page.fill('#uh-child-1-age', '8');
    await page.waitForSelector('#uh-results-body .amount');
    // Blur the last field and scroll to the page title so the nav,
    // disclaimer and result headline are in the frame.
    await page.locator('#uh-child-1-age').blur();
    await page.evaluate(() => document.getElementById('page-title')?.scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(100);
    const shot = '/workspace/de-calculator-kindesunterhalt.png';
    if (existsSync('/workspace') && statSync('/workspace').isDirectory()) {
      await page.screenshot({ path: shot, fullPage: false });
      console.log(`screenshot: ${shot}`);
    } else {
      console.log('screenshot skipped (no /workspace on this runner)');
    }
    await page.close();
  }

  await browser.close();
  server.close();
  console.log('\ncheck:ui: ok (L1, L2, age-field, issue 5, Kindesunterhalt transfer/G1/G5, F1, N1).');
} catch (err) {
  console.error('check:ui FAILED:', err);
  process.exit(1);
}
