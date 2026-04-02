#!/usr/bin/env node
import { chromium } from 'playwright';

const URL = process.env.SIGIL_URL || 'http://localhost:5173';

function parseTileId(id) {
  const m = id.match(/tile-(\d+)-(\d+)/);
  if (!m) return null;
  return { x: Number(m[1]), y: Number(m[2]) };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForSelector('[data-testid="battle-grid"]');

  const getHeroPos = async () => {
    const tile = await page.locator('[data-testid^="tile-"]', { hasText: '🧙' }).first();
    const id = await tile.getAttribute('data-testid');
    if (!id) throw new Error('Hero tile id missing');
    const pos = parseTileId(id);
    if (!pos) throw new Error(`Cannot parse hero tile id: ${id}`);
    return pos;
  };

  const start = await getHeroPos();

  const attempts = ['move-up', 'move-right', 'move-down', 'move-left'];
  let moved = false;

  for (const control of attempts) {
    await page.click(`[data-testid="${control}"]`);
    await page.waitForTimeout(100);
    const now = await getHeroPos();
    if (now.x !== start.x || now.y !== start.y) {
      moved = true;
      break;
    }
  }

  if (!moved) throw new Error('Hero did not move after trying all directions');
  console.log('PASS smoke-movement');
} finally {
  await browser.close();
}
