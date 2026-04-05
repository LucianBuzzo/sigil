#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('./apps/client/public/card-art');
fs.mkdirSync(outDir, { recursive: true });

const defs = {
  slash: {
    bg: ['#240b36', '#4a00e0'],
    glyph: '⚔',
    title: 'SLASH'
  },
  lunge: {
    bg: ['#0f2027', '#2c5364'],
    glyph: '➤',
    title: 'LUNGE'
  },
  'shield-bash': {
    bg: ['#1f4037', '#99f2c8'],
    glyph: '🛡',
    title: 'SHIELD BASH'
  },
  parry: {
    bg: ['#232526', '#414345'],
    glyph: '✦',
    title: 'PARRY'
  },
  'arc-bolt': {
    bg: ['#1a2a6c', '#b21f1f'],
    glyph: '⚡',
    title: 'ARC BOLT'
  }
};

for (const [id, cfg] of Object.entries(defs)) {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1152" height="768" viewBox="0 0 1152 768">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${cfg.bg[0]}"/>
      <stop offset="100%" stop-color="${cfg.bg[1]}"/>
    </linearGradient>
    <filter id="noise">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer>
        <feFuncA type="table" tableValues="0 0.06"/>
      </feComponentTransfer>
    </filter>
  </defs>
  <rect width="1152" height="768" fill="url(#g)"/>
  <rect width="1152" height="768" filter="url(#noise)"/>
  <circle cx="576" cy="384" r="190" fill="rgba(255,255,255,0.12)"/>
  <text x="576" y="430" text-anchor="middle" font-size="160" fill="white" font-family="Georgia,serif">${cfg.glyph}</text>
  <rect x="40" y="40" width="1072" height="688" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="6" rx="16"/>
  <text x="576" y="700" text-anchor="middle" font-size="48" letter-spacing="3" fill="rgba(255,255,255,0.95)" font-family="Inter,system-ui,sans-serif" font-weight="700">${cfg.title}</text>
</svg>`;

  fs.writeFileSync(path.join(outDir, `${id}.svg`), svg.trimStart());
  console.log(`Wrote ${id}.svg`);
}

console.log('Placeholder art generated ✅');
