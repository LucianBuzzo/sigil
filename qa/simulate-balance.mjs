#!/usr/bin/env node
import { chromium } from 'playwright';

const URL = process.env.SIGIL_URL || 'http://localhost:5174/sigil/';
const ITERATIONS = Number(process.env.SIGIL_SIM_ITERS || 20);
const SEED_START = Number(process.env.SIGIL_SIM_SEED_START || 1);
const CLASS_ID = process.env.SIGIL_SIM_CLASS || 'warden';
const MAX_STEPS = Number(process.env.SIGIL_SIM_MAX_STEPS || 300);

const numFromText = (text) => Number((`${text}`.match(/(\d+)/) || [])[1] || 0);

async function safeClick(page, selector, timeout = 1500) {
  try {
    await page.click(selector, { force: true, timeout });
    return true;
  } catch {
    return false;
  }
}

async function clickIfVisible(page, selector) {
  const loc = page.locator(selector);
  if (await loc.count()) {
    return safeClick(page, selector);
  }
  return false;
}

const currentActiveAllyName = async (page) => {
  const text = (await page.textContent('[data-testid="active-ally"]')) || '';
  return text.replace(/^Active Ally:\s*/, '').trim();
};

const currentAp = async (page) => {
  const apText = (await page.textContent('[data-testid="ap"]')) || '';
  return numFromText(apText.split('/')[0]);
};

async function trySwitchToReadyAlly(page) {
  const active = await currentActiveAllyName(page);
  const allies = page.locator('[data-testid^="ally-select-"]');
  const count = await allies.count();
  for (let i = 0; i < count; i += 1) {
    const btn = allies.nth(i);
    const text = (await btn.textContent()) || '';
    if (active && text.includes(active)) continue;
    const apMatch = text.match(/AP\s+(\d+)\/(\d+)/);
    const handMatch = text.match(/Hand\s+(\d+)/);
    const ap = apMatch ? Number(apMatch[1]) : 0;
    const hand = handMatch ? Number(handMatch[1]) : 0;
    if (ap > 0 && hand > 0) {
      await btn.click({ force: true });
      return true;
    }
  }
  return false;
}

async function runSingle(page, seed) {
  await page.goto(`${URL}?seed=${seed}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForSelector('[data-testid="class-select"]');

  await page.selectOption('[data-testid="class-select"]', CLASS_ID);
  await page.fill('[data-testid="seed-input"]', String(seed));
  await page.click('[data-testid="start-run"]');

  let steps = 0;
  let endTurnClicks = 0;
  let noCardSteps = 0;
  let stalledApSteps = 0;
  let moveAttempts = 0;
  let allySwitches = 0;

  while (steps < MAX_STEPS) {
    steps += 1;

    if (await page.locator('[data-testid="gameover-panel"]').count()) break;

    if (await clickIfVisible(page, '[data-testid="rank-choice-reaper"]')) {
      await page.waitForTimeout(10);
      continue;
    }

    if (await clickIfVisible(page, '[data-testid="reward-armament"]')) {
      await page.waitForTimeout(10);
      continue;
    }

    const ap = await currentAp(page);

    if (ap <= 0) {
      endTurnClicks += 1;
      await safeClick(page, '[data-testid="end-turn"]');
      await page.waitForTimeout(20);
      continue;
    }

    const cards = page.locator('[data-testid^="card-"]');
    const cardCount = await cards.count();
    if (cardCount > 0) {
      const played = await safeClick(page, '[data-testid^="card-"]', 2000);
      if (played) {
        await safeClick(page, '[data-testid^="card-"]', 2000);
        await page.waitForTimeout(20);
        continue;
      }
    }

    noCardSteps += 1;
    stalledApSteps += 1;

    const moveOrder = ['[data-testid="move-right"]', '[data-testid="move-down"]', '[data-testid="move-left"]', '[data-testid="move-up"]'];
    let spentApByMove = false;
    for (let i = 0; i < moveOrder.length; i += 1) {
      const beforeAp = await currentAp(page);
      if (beforeAp <= 0) break;
      moveAttempts += 1;
      await safeClick(page, moveOrder[(steps + i) % moveOrder.length]);
      await page.waitForTimeout(20);
      const afterAp = await currentAp(page);
      if (afterAp < beforeAp) {
        spentApByMove = true;
        break;
      }
    }

    if (spentApByMove) continue;

    endTurnClicks += 1;
    await page.click('[data-testid="end-turn"]', { force: true });
    await page.waitForTimeout(20);
  }

  const floor = numFromText((await page.textContent('[data-testid="floor"]')) || '0');
  const turn = numFromText((await page.textContent('[data-testid="turn"]')) || '0');
  const kills = numFromText((await page.textContent('[data-testid="kills"]')) || '0');
  const gameover = (await page.locator('[data-testid="gameover-panel"]').count()) > 0;
  const floorObjective = (await page.textContent('[data-testid="floor-objective"]')) || '';
  const phase = ((await page.textContent('[data-testid="phase"]')) || '').replace(/^Phase:\s*/, '');
  const enemyCount = numFromText((await page.textContent('[data-testid="enemy-count"]')) || '0');
  const apNow = numFromText(((await page.textContent('[data-testid="ap"]')) || '').split('/')[0]);
  const handCount = await page.locator('[data-testid^="card-"]').count();
  const stalled = !gameover && steps >= MAX_STEPS;

  return {
    seed,
    classId: CLASS_ID,
    floor,
    turn,
    kills,
    gameover,
    steps,
    stalled,
    phase,
    enemyCount,
    apNow,
    handCount,
    floorObjective,
    endTurnClicks,
    noCardSteps,
    stalledApSteps,
    moveAttempts,
    allySwitches,
  };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  const results = [];

  for (let i = 0; i < ITERATIONS; i++) {
    const seed = SEED_START + i;
    const r = await runSingle(page, seed);
    results.push(r);
    console.log(`run ${i + 1}/${ITERATIONS} seed=${seed} floor=${r.floor} turns=${r.turn} kills=${r.kills} gameover=${r.gameover} stalled=${r.stalled}`);
  }

  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const floors = results.map((r) => r.floor);
  const turns = results.map((r) => r.turn);
  const kills = results.map((r) => r.kills);
  const wins = results.filter((r) => !r.gameover).length;
  const stalledRuns = results.filter((r) => r.stalled).length;

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
    stalledRate: Number((stalledRuns / ITERATIONS).toFixed(3)),
    avgEndTurnClicks: Number(avg(results.map((r) => r.endTurnClicks)).toFixed(2)),
    avgNoCardSteps: Number(avg(results.map((r) => r.noCardSteps)).toFixed(2)),
    avgMoveAttempts: Number(avg(results.map((r) => r.moveAttempts)).toFixed(2)),
    avgAllySwitches: Number(avg(results.map((r) => r.allySwitches)).toFixed(2)),
  };

  console.log('\n=== Simulation Summary ===');
  console.log(JSON.stringify(summary, null, 2));

  const stalledExample = results.find((r) => r.stalled);
  if (stalledExample) {
    console.log('\n=== Stalled Run Example ===');
    console.log(JSON.stringify(stalledExample, null, 2));
  }
} finally {
  await browser.close();
}
