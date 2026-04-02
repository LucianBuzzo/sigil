#!/usr/bin/env node
import { chromium } from 'playwright';

const URL = process.env.SIGIL_URL || 'http://localhost:5173';

function hpNum(text) {
  return Number((text.match(/(\d+)/) || [])[1] || 0);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForSelector('[data-testid="enemy-hp"]');

  const hpBefore = hpNum((await page.textContent('[data-testid="enemy-hp"]')) || '');
  const logBefore = await page.locator('[data-testid="combat-log"] div').count();

  const cards = page.locator('[data-testid^="card-"]');
  const count = await cards.count();
  if (count < 1) throw new Error('No cards available to play');

  await cards.first().click();
  await page.waitForTimeout(150);

  const hpAfter = hpNum((await page.textContent('[data-testid="enemy-hp"]')) || '');
  const logAfter = await page.locator('[data-testid="combat-log"] div').count();

  if (hpAfter === hpBefore && logAfter <= logBefore) {
    throw new Error('Playing card produced no observable state change');
  }

  console.log('PASS smoke-combat');
} finally {
  await browser.close();
}
