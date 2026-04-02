#!/usr/bin/env node
import { spawn } from 'node:child_process';

const scripts = [
  'qa/smoke/smoke-load.mjs',
  'qa/smoke/smoke-movement.mjs',
  'qa/smoke/smoke-turn-cards.mjs',
  'qa/smoke/smoke-combat.mjs',
];

function run(script) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [script], { stdio: 'inherit', env: process.env });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${script} failed (${code})`))));
  });
}

for (const s of scripts) {
  await run(s);
}

console.log('\nAll smoke QA scripts passed ✅');
