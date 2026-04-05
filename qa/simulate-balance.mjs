#!/usr/bin/env node
import { chromium } from 'playwright';

const URL = process.env.SIGIL_URL || 'http://localhost:5174/sigil/';
const ITERATIONS = Number(process.env.SIGIL_SIM_ITERS || 20);
const SEED_START = Number(process.env.SIGIL_SIM_SEED_START || 1);
const CLASS_ID = process.env.SIGIL_SIM_CLASS || 'warden';
const MAX_STEPS = Number(process.env.SIGIL_SIM_MAX_STEPS || 300);

const numFromText = (text) => Number((`${text}`.match(/(\d+)/) || [])[1] || 0);

async function runSingle(page, seed) {
  await page.goto(`${URL}?seed=${seed}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForSelector('[data-testid="class-select"]');

  await page.selectOption('[data-testid="class-select"]', CLASS_ID);
  await page.fill('[data-testid="seed-input"]', String(seed));
  await page.click('[data-testid="start-run"]');

  let steps = 0;
  while (steps < MAX_STEPS) {
    steps += 1;

    if (await page.locator('[data-testid="gameover-panel"]').count()) break;

    const apText = (await page.textContent('[data-testid="ap"]')) || '';
    const ap = numFromText(apText.split('/')[0]);

    if (ap <= 0) {
      await page.click('[data-testid="end-turn"]', { force: true });
      await page.waitForTimeout(20);
      continue;
    }

    const cards = page.locator('[data-testid^="card-"]');
    const cardCount = await cards.count();
    if (cardCount > 0) {
      await cards.first().click({ force: true });
      await cards.first().click({ force: true });
      await page.waitForTimeout(20);
    } else {
      await page.click('[data-testid="end-turn"]', { force: true });
      await page.waitForTimeout(20);
    }
  }

  const floor = numFromText((await page.textContent('[data-testid="floor"]')) || '0');
  const turn = numFromText((await page.textContent('[data-testid="turn"]')) || '0');
  const kills = numFromText((await page.textContent('[data-testid="kills"]')) || '0');
  const gameover = (await page.locator('[data-testid="gameover-panel"]').count()) > 0;

  return { seed, classId: CLASS_ID, floor, turn, kills, gameover, steps };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  const results = [];

  for (let i = 0; i < ITERATIONS; i++) {
    const seed = SEED_START + i;
    const r = await runSingle(page, seed);
    results.push(r);
    console.log(`run ${i + 1}/${ITERATIONS} seed=${seed} floor=${r.floor} turns=${r.turn} kills=${r.kills} gameover=${r.gameover}`);
  }

  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const floors = results.map((r) => r.floor);
  const turns = results.map((r) => r.turn);
  const kills = results.map((r) => r.kills);
  const wins = results.filter((r) => !r.gameover).length;

  const summary = {
    iterations: ITERATIONS,
    classId: CLASS_ID,
    seedStart: SEED_START,
    winRate: Number((wins / ITERATIONS).toFixed(3)),
    avgFloor: Number(avg(floors).toFixed(2)),
    avgTurns: Number(avg(turns).toFixed(2)),
    avgKills: Number(avg(kills).toFixed(2)),
    maxFloor: Math.max(...floors),
    minFloor: Math.min(...floors),
  };

  console.log('\n=== Simulation Summary ===');
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await browser.close();
}
