/**
 * Accessibility and overflow QA for the production bundle.
 * Playwright + axe-core are imported from node_modules (devDependencies)
 * and are never part of the Vite app bundle.
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const BASE = '/de-calculator';

const built = spawnSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' });
if (built.status !== 0) process.exit(built.status ?? 1);

// axe and Playwright must never land in the app bundle.
const assets = path.join(dist, 'assets');
for (const name of existsSync(assets) ? readdirSync(assets) : []) {
  if (!name.endsWith('.js')) continue;
  const src = readFileSync(path.join(assets, name), 'utf8');
  if (/axe-core|@axe-core|axe\.run\s*\(/.test(src)) {
    console.error('check:a11y FAILED: axe-core appears in the app bundle (' + name + ').');
    process.exit(1);
  }
}

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

async function openAllDetails(page) {
  await page.evaluate(() => {
    document.querySelectorAll('details').forEach((d) => {
      d.open = true;
    });
  });
}

async function fillAverage(page) {
  const avgLabel = page.locator('label[for="mode-avg"]');
  if (await avgLabel.count()) await avgLabel.click();
  await page.waitForSelector('#gewinn-2023');
  await page.fill('#gewinn-2023', '80.000');
  await page.fill('#gewinn-2024', '80.000');
  await page.fill('#gewinn-2025', '80.000');
  await page.selectOption('#children', '2');
  await page.waitForSelector('#kfb-wrap:not(.is-hidden)');
  await page.waitForSelector('.headline .amount');
  await openAllDetails(page);
}


async function openUnterhalt(page) {
  await page.locator('#nav-unterhalt').click();
  await page.waitForSelector('#unterhalt-form');
  await page.waitForSelector('#uh-child-0-age');
}

async function fillUnterhaltTwoChildren(page) {
  await openUnterhalt(page);
  await page.fill('#uh-netto', '4000');
  await page.fill('#uh-child-0-age', '4');
  await page.locator('#uh-add-child').click();
  await page.waitForSelector('#uh-child-1-age');
  await page.fill('#uh-child-1-age', '8');
  await page.waitForSelector('#uh-results-body .amount');
  await openAllDetails(page);
}

async function fillUnterhaltMangelfall(page) {
  await openUnterhalt(page);
  await page.fill('#uh-netto', '1750');
  await page.fill('#uh-child-0-age', '18');
  await page.waitForSelector('#uh-child-0-priv-wrap:not(.is-hidden)');
  await page.locator('#uh-child-0-privileged').check();
  await page.locator('#uh-add-child').click();
  await page.waitForSelector('#uh-child-1-age');
  await page.fill('#uh-child-1-age', '7');
  await page.locator('#uh-add-child').click();
  await page.waitForSelector('#uh-child-2-age');
  await page.fill('#uh-child-2-age', '5');
  await page.waitForSelector('#uh-results-body .amount');
  await openAllDetails(page);
}

async function fillUnterhaltAdultFlags(page) {
  await openUnterhalt(page);
  await page.fill('#uh-netto', '4000');
  await page.fill('#uh-child-0-age', '19');
  await page.waitForSelector('#uh-child-0-priv-wrap:not(.is-hidden)');
  await page.waitForSelector('#uh-child-0-own-wrap:not(.is-hidden)');
  await page.locator('#uh-child-0-privileged').check();
  await page.locator('#uh-add-child').click();
  await page.waitForSelector('#uh-child-1-age');
  await page.fill('#uh-child-1-age', '8');
  await page.waitForSelector('#uh-results-body .amount');
  await openAllDetails(page);
}

async function fillSingle(page) {
  await page.locator('label[for="mode-single"]').click();
  await page.waitForSelector('#gewinn-2026');
  await page.fill('#gewinn-2026', '80.000');
  await page.selectOption('#children', '2');
  await page.waitForSelector('#kfb-wrap:not(.is-hidden)');
  await page.waitForSelector('.headline .amount');
  await openAllDetails(page);
}

async function measureOverflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const overflowing = [];
    const rootWidth = doc.clientWidth;
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      // ignore lingering overflow of visually hidden / zero-size
      if (r.width === 0 && r.height === 0) continue;
      const right = r.left + el.scrollWidth;
      if (el.scrollWidth > el.clientWidth + 1 && r.right > rootWidth + 1) {
        overflowing.push({
          tag: el.tagName,
          className: typeof el.className === 'string' ? el.className : '',
          id: el.id,
          scrollW: el.scrollWidth,
          clientW: el.clientWidth,
          right: Math.round(r.right),
        });
      }
    }
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
      overflowing: overflowing.slice(0, 12),
    };
  });
}

async function runAxe(page) {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    description: v.description,
    nodes: v.nodes.length,
    targets: v.nodes.slice(0, 6).map((n) => n.target),
    help: v.help,
  }));
}

const VIEWPORTS = [
  { name: '360', width: 360, height: 800 },
  { name: '390', width: 390, height: 844 },
  { name: '1280', width: 1280, height: 900 },
];

const failures = [];
const report = [];

const { server, port } = await serveDist();
const url = `http://127.0.0.1:${port}${BASE}/`;
const browser = await chromium.launch({ headless: true });

try {
  for (const vp of VIEWPORTS) {
    for (const mode of ['average', 'single']) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        locale: 'de-DE',
      });
      const page = await context.newPage();
      page.on('pageerror', (err) => {
        failures.push(`${vp.name}/${mode} pageerror: ${err}`);
      });
      await page.goto(url, { waitUntil: 'load' });
      if (mode === 'average') await fillAverage(page);
      else await fillSingle(page);
      await page.waitForTimeout(150);

      const overflow = await measureOverflow(page);
      const fits = overflow.scrollWidth <= overflow.clientWidth;
      const axe = await runAxe(page);
      const label = `${vp.name}px ${mode}`;
      report.push({ label, overflow, fits, axe });
      console.log(
        `${label}: scrollWidth=${overflow.scrollWidth} clientWidth=${overflow.clientWidth} ${
          fits ? 'FIT' : 'OVERFLOW'
        }  axe violations=${axe.length}`,
      );
      if (!fits) {
        failures.push(
          `${label}: horizontal overflow (scrollWidth ${overflow.scrollWidth} > clientWidth ${overflow.clientWidth})`,
        );
        if (overflow.overflowing.length) {
          console.log('  overflowing elements:', JSON.stringify(overflow.overflowing, null, 2));
        }
      }
      if (axe.length) {
        failures.push(`${label}: ${axe.length} axe violation(s)`);
        for (const v of axe) {
          console.log(`  axe ${v.id} (${v.impact}, ${v.nodes} nodes): ${v.help}`);
          console.log(`    targets: ${JSON.stringify(v.targets)}`);
        }
      }
      await context.close();
    }

    for (const mode of ['unterhalt-two-children', 'unterhalt-mangelfall', 'unterhalt-adult-flags']) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        locale: 'de-DE',
      });
      const page = await context.newPage();
      page.on('pageerror', (err) => {
        failures.push(`${vp.name}/${mode} pageerror: ${err}`);
      });
      await page.goto(url, { waitUntil: 'load' });
      if (mode === 'unterhalt-two-children') await fillUnterhaltTwoChildren(page);
      else if (mode === 'unterhalt-mangelfall') await fillUnterhaltMangelfall(page);
      else await fillUnterhaltAdultFlags(page);
      await page.waitForTimeout(150);

      const overflow = await measureOverflow(page);
      const fits = overflow.scrollWidth <= overflow.clientWidth;
      const axe = await runAxe(page);
      const label = `${vp.name}px ${mode}`;
      report.push({ label, overflow, fits, axe });
      console.log(
        `${label}: scrollWidth=${overflow.scrollWidth} clientWidth=${overflow.clientWidth} ${
          fits ? 'FIT' : 'OVERFLOW'
        }  axe violations=${axe.length}`,
      );
      if (!fits) {
        failures.push(
          `${label}: horizontal overflow (scrollWidth ${overflow.scrollWidth} > clientWidth ${overflow.clientWidth})`,
        );
        if (overflow.overflowing.length) {
          console.log('  overflowing elements:', JSON.stringify(overflow.overflowing, null, 2));
        }
      }
      if (axe.length) {
        failures.push(`${label}: ${axe.length} axe violation(s)`);
        for (const v of axe) {
          console.log(`  axe ${v.id} (${v.impact}, ${v.nodes} nodes): ${v.help}`);
          console.log(`    targets: ${JSON.stringify(v.targets)}`);
        }
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

if (failures.length) {
  console.error('\ncheck:a11y FAILED:');
  for (const f of failures) console.error(' -', f);
  process.exit(1);
}
console.log('\ncheck:a11y: ok (0 axe violations, no horizontal overflow at 360/390/1280 in Netto and Kindesunterhalt views).');
