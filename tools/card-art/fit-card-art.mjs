#!/usr/bin/env node
/**
 * Fit/crop raw images into Sigil card art slots.
 *
 * Usage:
 *   npm i -D sharp
 *   node tools/card-art/fit-card-art.mjs --input ./raw --output ./apps/client/public/card-art
 */
import fs from 'node:fs';
import path from 'node:path';

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('Missing dependency: sharp. Run: npm i -D sharp');
  process.exit(1);
}

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith('--')) acc.push([cur.slice(2), arr[i + 1]]);
    return acc;
  }, [])
);

const inputDir = path.resolve(args.input || './raw-card-art');
const outputDir = path.resolve(args.output || './apps/client/public/card-art');

if (!fs.existsSync(inputDir)) {
  console.error(`Input folder not found: ${inputDir}`);
  process.exit(1);
}

fs.mkdirSync(outputDir, { recursive: true });

const files = fs.readdirSync(inputDir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
if (!files.length) {
  console.error('No image files found in input folder.');
  process.exit(1);
}

for (const f of files) {
  const inPath = path.join(inputDir, f);
  const id = path.parse(f).name;
  const outPath = path.join(outputDir, `${id}.png`);

  await sharp(inPath)
    .resize(1152, 768, { fit: 'cover', position: 'attention' })
    .png({ compressionLevel: 8 })
    .toFile(outPath);

  console.log(`Wrote ${outPath}`);
}

console.log('Done ✅');
