#!/usr/bin/env node
/**
 * Fails the build if the production bundle talks to a server, persists data,
 * or is missing the required CSP / privacy note (SPEC Privacy section).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;

const FORBIDDEN = [
  'fetch(',
  'XMLHttpRequest',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'document.cookie',
  'navigator.sendBeacon',
  'WebSocket',
];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}

let failed = false;
const files = walk(DIST);
const jsFiles = files.filter((f) => extname(f) === '.js');
const htmlFiles = files.filter((f) => extname(f) === '.html');

if (jsFiles.length === 0) {
  console.error('check-privacy: no JS files in dist/. Run the build first.');
  process.exit(1);
}

for (const file of jsFiles) {
  const src = readFileSync(file, 'utf8');
  for (const pat of FORBIDDEN) {
    if (src.includes(pat)) {
      console.error(`FORBIDDEN pattern ${JSON.stringify(pat)} in ${file}`);
      failed = true;
    }
  }
}

const index = htmlFiles.find((f) => f.endsWith('index.html'));
if (!index) {
  console.error('check-privacy: dist/index.html missing.');
  process.exit(1);
}
const html = readFileSync(index, 'utf8');
const required = [
  "default-src 'self'",
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  'name="referrer" content="no-referrer"',
  'autocomplete="off"',
  'Diese Anwendung läuft vollständig in Ihrem Browser',
  'Es werden keine Cookies gesetzt',
];
for (const needle of required) {
  if (!html.includes(needle)) {
    console.error(`MISSING in dist/index.html: ${JSON.stringify(needle)}`);
    failed = true;
  }
}

if (html.includes("unsafe-inline") || html.includes('unsafe-eval')) {
  console.error('CSP must not allow unsafe-inline or unsafe-eval.');
  failed = true;
}

if (failed) {
  process.exit(1);
}
console.log(`check-privacy: ok (${jsFiles.length} JS file(s), CSP and privacy note present).`);
