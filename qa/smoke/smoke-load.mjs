#!/usr/bin/env node
import { chromium } from 'playwright';

const URL = process.env.SIGIL_URL || 'http://localhost:5173';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForSelector('[data-testid="app-root"]', { timeout: 10_000 });

  const title = await page.textContent('h2');
  const mapSource = await page.textContent('p');

  if (!title?.includes('Sigil')) throw new Error('Title missing Sigil heading');
  if (!mapSource?.toLowerCase().includes('map source')) throw new Error('Map source text missing');

  console.log('PASS smoke-load');
} finally {
  await browser.close();
}
