#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const prompts = JSON.parse(fs.readFileSync(path.join(root, 'tools/card-art/prompts.json'), 'utf8'));
const outDir = path.join(root, 'apps/client/public/card-art');

let missing = 0;
for (const c of prompts.cards) {
  const p = path.join(outDir, `${c.id}.png`);
  if (!fs.existsSync(p)) {
    console.log(`MISSING: ${p}`);
    missing++;
  } else {
    const size = fs.statSync(p).size;
    console.log(`OK: ${c.id}.png (${Math.round(size/1024)} KB)`);
  }
}

if (missing) {
  console.log(`\n${missing} art file(s) missing.`);
  process.exit(1);
}

console.log('\nAll required card art files present ✅');
