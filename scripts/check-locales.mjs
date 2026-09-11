#!/usr/bin/env node
// Reports key-parity drift between locales/{ru,en,kk}.json (FRONTEND_AUDIT.md
// I2). useI18n()'s t() returns '' on a miss instead of throwing, so a
// missing key shows up as blank UI text, not an error -- this script is the
// only way to actually see the gap.
//
// Informational only, by design: as of 2026-09-11 the real drift is huge
// (hundreds of keys per locale, whole product namespaces missing from
// en/kk), so this does NOT fail CI -- doing that today would just block
// every unrelated PR. Once the content gap is closed, wire `--strict`
// (exits 1 on any drift) into the quality-gate CI job to keep it closed.
//
// Usage: node scripts/check-locales.mjs [--strict] [--full]
//   --strict  exit 1 if any locale is missing keys (off by default)
//   --full    print every missing key, not just the count + a sample

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = path.join(__dirname, '..', 'locales');
const LOCALES = ['ru', 'en', 'kk'];

const strict = process.argv.includes('--strict');
const full = process.argv.includes('--full');

function flatten(obj, prefix = '') {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const keyPath = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flatten(v, keyPath));
    } else {
      keys.push(keyPath);
    }
  }
  return keys;
}

const keySets = {};
for (const locale of LOCALES) {
  const raw = readFileSync(path.join(LOCALES_DIR, `${locale}.json`), 'utf8');
  keySets[locale] = new Set(flatten(JSON.parse(raw)));
}

const allKeys = new Set(LOCALES.flatMap((l) => [...keySets[l]]));

console.log(`Locale key parity (union: ${allKeys.size} keys)\n`);

let anyMissing = false;
for (const locale of LOCALES) {
  const missing = [...allKeys].filter((k) => !keySets[locale].has(k)).sort();
  if (missing.length > 0) anyMissing = true;
  console.log(`${locale}: ${keySets[locale].size} keys, missing ${missing.length}`);
  if (missing.length > 0) {
    const shown = full ? missing : missing.slice(0, 10);
    for (const k of shown) console.log(`  - ${k}`);
    if (!full && missing.length > shown.length) {
      console.log(`  ... and ${missing.length - shown.length} more (run with --full to list all)`);
    }
  }
}

if (strict && anyMissing) {
  console.error('\nlocale key drift found (--strict)');
  process.exit(1);
}
