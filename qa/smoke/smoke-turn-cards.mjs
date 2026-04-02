#!/usr/bin/env node
import { chromium } from 'playwright';

const URL = process.env.SIGIL_URL || 'http://localhost:5173';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForSelector('[data-testid="turn"]');

  const turnTextBefore = (await page.textContent('[data-testid="turn"]')) || '';
  const before = Number((turnTextBefore.match(/(\d+)/) || [])[1] || 0);

  await page.click('[data-testid="end-turn"]');
  await page.waitForTimeout(150);

  const turnTextAfter = (await page.textContent('[data-testid="turn"]')) || '';
  const after = Number((turnTextAfter.match(/(\d+)/) || [])[1] || 0);

  if (after <= before) throw new Error(`Turn did not increment (${before} -> ${after})`);

  const cardCount = await page.locator('[data-testid^="card-"]').count();
  if (cardCount < 1) throw new Error('No cards in hand after ending turn');

  console.log('PASS smoke-turn-cards');
} finally {
  await browser.close();
}
