#!/usr/bin/env node
/**
 * Licence gate: fails if any installed package has a licence that is not cleared for use in a
 * closed-source app that is sold commercially. Run with `npm run licenses`; CI runs it too.
 *
 * To clear a new licence or package, add it below WITH a reason. Never add GPL/AGPL/LGPL or any
 * "non-commercial" licence.
 */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();

/** Permissive licences: use, modify, sell and keep our own source closed. */
const ALLOWED = new Set([
  'MIT',
  'MIT-0',
  'ISC',
  '0BSD',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'Apache-2.0',
  'BlueOak-1.0.0',
  'CC0-1.0',
  'Unlicense',
  'WTFPL',
  'Python-2.0',
]);

/** Allowed only for the named packages, each with the reason it is safe. */
const EXCEPTIONS = {
  // Build-time browser-support data used by the bundler. Not part of the app's own code;
  // CC-BY-4.0 permits commercial use and requires attribution, given in docs/LICENSES.md.
  'caniuse-lite': 'CC-BY-4.0',
  // Build-time CSS compiler used by the bundler. MPL-2.0 permits commercial use; its copyleft
  // covers only modifications to lightningcss's own files, which we do not make.
  lightningcss: 'MPL-2.0',
};

function licenceOf(pkgPath, lockEntry) {
  let lic = lockEntry.license;
  if (!lic) {
    try {
      const pj = JSON.parse(fs.readFileSync(path.join(root, pkgPath, 'package.json'), 'utf8'));
      lic =
        pj.license ??
        (Array.isArray(pj.licenses) ? pj.licenses.map((l) => l.type).join(' OR ') : undefined);
      if (lic && typeof lic === 'object') lic = lic.type;
    } catch {
      // Optional platform package that is not installed on this machine.
    }
  }
  return lic ? String(lic) : 'UNKNOWN';
}

/** "(A OR B)" is fine if any option is allowed; "A AND B" needs every part allowed. */
function isAllowed(expression) {
  const clean = expression.replace(/[()]/g, '').trim();
  return clean
    .split(/\s+OR\s+/i)
    .some((option) => option.split(/\s+AND\s+/i).every((part) => ALLOWED.has(part.trim())));
}

const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const problems = [];
const counts = {};
let total = 0;

for (const [pkgPath, entry] of Object.entries(lock.packages)) {
  if (!pkgPath) continue;
  total += 1;
  const name = pkgPath.replace(/^.*node_modules\//, '');
  const licence = licenceOf(pkgPath, entry);
  counts[licence] = (counts[licence] ?? 0) + 1;
  if (isAllowed(licence)) continue;
  const base = name.replace(/-(android|darwin|freebsd|linux|win32)-.*$/, '');
  if (EXCEPTIONS[base] === licence) continue;
  problems.push(`${name}@${entry.version}: ${licence}`);
}

if (process.argv.includes('--summary')) {
  for (const [licence, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(String(n).padStart(5), licence);
  }
}

if (problems.length > 0) {
  console.error(
    `\nLicence check FAILED: ${problems.length} package(s) not cleared for a sold app:\n`,
  );
  for (const p of problems) console.error('  ' + p);
  console.error('\nRemove the package, or clear it in scripts/check-licenses.js with a reason.');
  process.exit(1);
}
console.log(
  `Licence check passed: ${total} packages, all cleared for commercial closed-source use.`,
);
