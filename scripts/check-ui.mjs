/**
 * UI tests for L1 (Zähler reset after children 0 → >0) and L2
 * (no silent clamp; German validation error). Playwright is a
 * devDependency and is never bundled into the app.
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

  // Desktop form screenshot for the PR
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

  await browser.close();
  server.close();
  console.log('\ncheck:ui: ok (L1, L2, age-field placement, issue 5 empty Zähler).');
} catch (err) {
  console.error('check:ui FAILED:', err);
  process.exit(1);
}
