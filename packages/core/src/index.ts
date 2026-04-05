import { cards, items, type Card, type StatusKind } from "@sigil/content";
import { generateBastionMap } from "@sigil/world";

export type StatusEffect = { kind: StatusKind; duration: number };

export type Entity = {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  statuses: StatusEffect[];
};

export type EnemyArchetype = "skeleton" | "brute" | "acolyte";
export type RankMutation = "battlemage" | "spellblade" | null;
export type RewardChoice = "vigor" | "focus" | "armament";

export type Progression = {
  xp: number;
  level: number;
  rank: number;
  kills: number;
  rankChoicePending: boolean;
  rankMutation: RankMutation;
};

export type PendingFloor = {
  floor: number;
  seed: number;
  map: ReturnType<typeof generateBastionMap>;
  chest: { x: number; y: number };
  enemy: Entity;
  killTarget: number;
  clearedBy: "kills" | "chest";
};

export type GameState = {
  turn: number;
  phase: "hero" | "enemy" | "reward" | "gameover";
  ap: { current: number; max: number };
  map: ReturnType<typeof generateBastionMap>;
  hero: Entity;
  enemy: Entity;
  chest: { x: number; y: number };
  floor: number;
  floorSeed: number;
  floorKills: number;
  floorKillTarget: number;
  deck: Card[];
  hand: Card[];
  discard: Card[];
  progression: Progression;
  rewardOptions: RewardChoice[];
  pendingFloor: PendingFloor | null;
  runSummary: null | { floorsCleared: number; kills: number; level: number; rank: number; mutation: RankMutation };
  log: string[];
};

const BASE_AP = 2;
const ENEMY_ATTACK_DAMAGE = 2;

function buildDeckFromItems(loadout: string[]): Card[] {
  const ids = loadout.flatMap((itemId) => items.find((i) => i.id === itemId)?.cards ?? []);
  const expanded = ids.flatMap((id) => [id, id, id, id]);
  return expanded.map((id) => cards.find((c) => c.id === id)!).filter(Boolean);
}

function seededRandom(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleDeck(deck: Card[], seed: number): Card[] {
  const next = [...deck];
  const rand = seededRandom(seed);
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [next[i], next[j]] = [next[j]!, next[i]!];
  }
  return next;
}

function drawCards(state: GameState, count: number): GameState {
  let deck = [...state.deck];
  let discard = [...state.discard];
  const hand = [...state.hand];

  for (let i = 0; i < count; i++) {
    if (deck.length === 0) {
      deck = [...discard];
      discard = [];
    }
    const next = deck.shift();
    if (next) hand.push(next);
  }

  return { ...state, deck, discard, hand };
}

function levelThreshold(level: number): number {
  const table = [0, 10, 25, 45, 70, 100];
  return table[level] ?? 999999;
}

function canRankUp(p: Progression): boolean {
  return p.rank === 1 && p.level >= 3 && p.kills >= 2;
}

function upsertStatus(statuses: StatusEffect[], next: StatusEffect): StatusEffect[] {
  const existing = statuses.find((s) => s.kind === next.kind);
  if (!existing) return [...statuses, next];
  return statuses.map((s) => (s.kind === next.kind ? { ...s, duration: Math.max(s.duration, next.duration) } : s));
}

function hasStatus(entity: Entity, kind: StatusKind): boolean {
  return entity.statuses.some((s) => s.kind === kind && s.duration > 0);
}

function tickStatuses(entity: Entity): Entity {
  let next = { ...entity };

  if (hasStatus(next, "bleed")) {
    next.hp = Math.max(0, next.hp - 1);
  }

  next.statuses = next.statuses
    .map((s) => ({ ...s, duration: s.duration - 1 }))
    .filter((s) => s.duration > 0);

  return next;
}

function grantXp(state: GameState, amount: number): GameState {
  let next: GameState = {
    ...state,
    progression: { ...state.progression, xp: state.progression.xp + amount },
  };

  while (next.progression.xp >= levelThreshold(next.progression.level)) {
    const newLevel = next.progression.level + 1;
    if (levelThreshold(newLevel) === 999999) break;

    next = {
      ...next,
      hero: {
        ...next.hero,
        maxHp: next.hero.maxHp + 2,
        hp: next.hero.hp + 2,
      },
      progression: {
        ...next.progression,
        level: newLevel,
      },
      log: [...next.log, `Level up! Reached Level ${newLevel}.`],
    };
  }

  if (canRankUp(next.progression)) {
    next = {
      ...next,
      progression: {
        ...next.progression,
        rankChoicePending: true,
      },
      log: [...next.log, "Rank-up available! Choose battlemage or spellblade."],
    };
  }

  return next;
}

function consumeAp(state: GameState, amount = 1): GameState {
  return {
    ...state,
    ap: {
      ...state.ap,
      current: Math.max(0, state.ap.current - amount),
    },
  };
}

function canAct(state: GameState): boolean {
  return state.phase === "hero" && !state.progression.rankChoicePending && state.ap.current > 0;
}

function manhattan(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function isWalkable(state: GameState, x: number, y: number): boolean {
  const tile = state.map.tiles.find((t) => t.x === x && t.y === y);
  if (!tile || tile.kind === "wall") return false;
  if (state.enemy.hp > 0 && state.enemy.x === x && state.enemy.y === y) return false;
  return true;
}

function floorKillTargetFor(floor: number): number {
  return Math.min(6, 2 + floor);
}

function chooseChestTile(map: ReturnType<typeof generateBastionMap>): { x: number; y: number } {
  const floorTiles = map.tiles.filter((t) => t.kind === "floor");
  if (!floorTiles.length) return { ...map.heroSpawn };

  floorTiles.sort((a, b) => {
    const da = manhattan(a, map.heroSpawn) + manhattan(a, map.enemySpawn);
    const db = manhattan(b, map.heroSpawn) + manhattan(b, map.enemySpawn);
    return db - da;
  });

  const chosen = floorTiles.find((t) => !(t.x === map.heroSpawn.x && t.y === map.heroSpawn.y));
  return chosen ? { x: chosen.x, y: chosen.y } : { ...map.heroSpawn };
}

function enemyArchetypeForFloor(floor: number): EnemyArchetype {
  if (floor % 5 === 0) return "acolyte";
  if (floor % 3 === 0) return "brute";
  return "skeleton";
}

function spawnEnemyForFloor(
  state: GameState,
  floor: number,
  map: ReturnType<typeof generateBastionMap>
): Entity {
  const arch = enemyArchetypeForFloor(floor);
  if (arch === "brute") {
    const hp = 16 + floor * 4;
    return { ...state.enemy, name: "Bone Brute", hp, maxHp: hp, x: map.enemySpawn.x, y: map.enemySpawn.y, statuses: [] };
  }
  if (arch === "acolyte") {
    const hp = 12 + floor * 3;
    return { ...state.enemy, name: "Hex Acolyte", hp, maxHp: hp, x: map.enemySpawn.x, y: map.enemySpawn.y, statuses: [{ kind: "slow", duration: 1 }] };
  }
  const hp = 12 + floor * 3;
  return { ...state.enemy, name: "Skeleton", hp, maxHp: hp, x: map.enemySpawn.x, y: map.enemySpawn.y, statuses: [] };
}

function floorClearByChest(state: GameState): boolean {
  return state.hero.x === state.chest.x && state.hero.y === state.chest.y;
}

function floorClearByKills(state: GameState): boolean {
  return state.floorKills >= state.floorKillTarget;
}

function buildPendingFloor(state: GameState, clearedBy: "kills" | "chest"): PendingFloor {
  const floor = state.floor + 1;
  const seed = state.floorSeed + 1;
  const map = generateBastionMap(seed);
  return {
    floor,
    seed,
    map,
    chest: chooseChestTile(map),
    enemy: spawnEnemyForFloor(state, floor, map),
    killTarget: floorKillTargetFor(floor),
    clearedBy,
  };
}

function toRewardPhase(state: GameState, reason: "kills" | "chest"): GameState {
  const pending = buildPendingFloor(state, reason);
  return {
    ...state,
    phase: "reward",
    pendingFloor: pending,
    rewardOptions: ["vigor", "focus", "armament"],
    log: [
      ...state.log,
      reason === "kills"
        ? `Floor ${state.floor} cleared by kills.`
        : `Floor ${state.floor} cleared by finding the chest.`,
      "Choose a reward before descending.",
    ],
  };
}

function applyReward(state: GameState, choice: RewardChoice): GameState {
  const pending = state.pendingFloor;
  if (!pending) return state;

  let next = { ...state };
  if (choice === "vigor") {
    next.hero = { ...next.hero, maxHp: next.hero.maxHp + 3, hp: Math.min(next.hero.maxHp + 3, next.hero.hp + 5) };
    next.log = [...next.log, "Reward chosen: Vigor (+max HP, heal)."];
  } else if (choice === "focus") {
    next.ap = { max: next.ap.max + 1, current: next.ap.current + 1 };
    next.log = [...next.log, "Reward chosen: Focus (+1 AP this and future turns)."];
  } else {
    next.deck = [...next.deck, cards.find((c) => c.id === "arc-bolt")!];
    next.log = [...next.log, "Reward chosen: Armament (+Arc Bolt card)."];
  }

  const healed = Math.max(2, Math.floor(next.hero.maxHp * 0.3));
  const bonusDraw = next.progression.rankMutation === "battlemage" ? 1 : 0;

  const transitioned: GameState = {
    ...next,
    turn: next.turn + 1,
    phase: "hero",
    floor: pending.floor,
    floorSeed: pending.seed,
    floorKills: 0,
    floorKillTarget: pending.killTarget,
    map: pending.map,
    chest: pending.chest,
    hero: {
      ...next.hero,
      hp: Math.min(next.hero.maxHp, next.hero.hp + healed),
      x: pending.map.heroSpawn.x,
      y: pending.map.heroSpawn.y,
    },
    enemy: pending.enemy,
    deck: shuffleDeck([...next.deck, ...next.discard, ...next.hand], pending.seed),
    hand: [],
    discard: [],
    rewardOptions: [],
    pendingFloor: null,
    log: [...next.log, `Descending to Floor ${pending.floor}...`, `Turn ${next.turn + 1} started.`],
  };

  return drawCards(transitioned, 3 + bonusDraw);
}

function checkGameOver(state: GameState): GameState {
  if (state.hero.hp > 0) return state;
  return {
    ...state,
    phase: "gameover",
    runSummary: {
      floorsCleared: state.floor - 1,
      kills: state.progression.kills,
      level: state.progression.level,
      rank: state.progression.rank,
      mutation: state.progression.rankMutation,
    },
    log: [...state.log, "You have fallen in Bastion."],
  };
}

function enemyAct(state: GameState): GameState {
  let next: GameState = {
    ...state,
    phase: "enemy",
    enemy: tickStatuses(state.enemy),
    hero: tickStatuses(state.hero),
    log: [...state.log, "Enemy turn."],
  };

  next = checkGameOver(next);
  if (next.phase === "gameover") return next;

  let enemyAp = BASE_AP - (hasStatus(next.enemy, "slow") ? 1 : 0);
  if (enemyAp < 1) enemyAp = 1;

  while (enemyAp > 0 && next.enemy.hp > 0 && next.hero.hp > 0) {
    const dist = manhattan(next.enemy, next.hero);

    if (dist <= 1) {
      let dmg = ENEMY_ATTACK_DAMAGE;
      if (hasStatus(next.hero, "guard")) dmg = Math.max(0, dmg - 1);
      next = {
        ...next,
        hero: { ...next.hero, hp: Math.max(0, next.hero.hp - dmg) },
        log: [...next.log, `${next.enemy.name} attacks ${next.hero.name} for ${dmg}.`],
      };
      next = checkGameOver(next);
      if (next.phase === "gameover") return next;
      enemyAp -= 1;
      continue;
    }

    const candidates = [
      { x: next.enemy.x + 1, y: next.enemy.y },
      { x: next.enemy.x - 1, y: next.enemy.y },
      { x: next.enemy.x, y: next.enemy.y + 1 },
      { x: next.enemy.x, y: next.enemy.y - 1 },
    ].filter((p) => isWalkable(next, p.x, p.y));

    if (!candidates.length) {
      next = { ...next, log: [...next.log, `${next.enemy.name} cannot path.`] };
      break;
    }

    candidates.sort((a, b) => manhattan(a, next.hero) - manhattan(b, next.hero));
    const step = candidates[0];
    next = {
      ...next,
      enemy: { ...next.enemy, x: step.x, y: step.y },
      log: [...next.log, `${next.enemy.name} advances.`],
    };
    enemyAp -= 1;
  }

  const bonusDraw = next.progression.rankMutation === "battlemage" ? 1 : 0;
  const nextMaxAp = BASE_AP + (next.progression.rankMutation === "spellblade" ? 1 : 0);

  const withNextTurn: GameState = {
    ...next,
    turn: next.turn + 1,
    phase: "hero",
    ap: { max: nextMaxAp, current: nextMaxAp },
    hero: tickStatuses(next.hero),
  };

  const drawn = drawCards(
    {
      ...withNextTurn,
      log: [...withNextTurn.log, `Turn ${withNextTurn.turn} started.`],
    },
    1 + bonusDraw
  );

  return checkGameOver(drawn);
}

function respawnEnemy(state: GameState): GameState {
  const hp = 12 + state.floor * 3;
  return {
    ...state,
    enemy: {
      ...state.enemy,
      hp,
      maxHp: hp,
      x: state.map.enemySpawn.x,
      y: state.map.enemySpawn.y,
      statuses: [],
    },
    log: [...state.log, `${state.enemy.name} reforms in the dungeon...`],
  };
}

export function canPlayCard(state: GameState, cardId: string): boolean {
  const card = state.hand.find((c) => c.id === cardId);
  if (!card || !canAct(state)) return false;
  const dist = manhattan(state.hero, state.enemy);
  if (card.value === 0 && !card.selfStatus) return true;
  return dist <= card.range;
}

export function getCardRangeTiles(state: GameState, cardId: string): Array<{ x: number; y: number }> {
  const card = state.hand.find((c) => c.id === cardId);
  if (!card) return [];
  const maxR = card.range;
  return state.map.tiles
    .filter((t) => t.kind !== "wall")
    .filter((t) => manhattan({ x: t.x, y: t.y }, state.hero) <= maxR)
    .map((t) => ({ x: t.x, y: t.y }));
}

export function createNewGame(seed = 1): GameState {
  const map = generateBastionMap(seed);
  const deck = shuffleDeck(buildDeckFromItems(["rust-sword", "oak-shield", "apprentice-robe"]), seed);
  const chest = chooseChestTile(map);

  const initial: GameState = {
    turn: 1,
    phase: "hero",
    ap: { max: BASE_AP, current: BASE_AP },
    map,
    chest,
    floor: 1,
    floorSeed: seed,
    floorKills: 0,
    floorKillTarget: floorKillTargetFor(1),
    hero: { id: "hero", name: "Warden", hp: 20, maxHp: 20, ...map.heroSpawn, statuses: [] },
    enemy: { id: "enemy", name: "Skeleton", hp: 14, maxHp: 14, ...map.enemySpawn, statuses: [] },
    deck,
    hand: [],
    discard: [],
    progression: {
      xp: 0,
      level: 1,
      rank: 1,
      kills: 0,
      rankChoicePending: false,
      rankMutation: null,
    },
    rewardOptions: [],
    pendingFloor: null,
    runSummary: null,
    log: ["Battle begins in Bastion.", "Floor objective: defeat enemies or find the treasure chest."],
  };
  return drawCards(initial, 3);
}

export function chooseRankMutation(state: GameState, mutation: Exclude<RankMutation, null>): GameState {
  if (!state.progression.rankChoicePending || state.phase === "gameover") return state;

  let next: GameState = {
    ...state,
    progression: {
      ...state.progression,
      rank: 2,
      rankChoicePending: false,
      rankMutation: mutation,
    },
    log: [...state.log, `Rank up! Chose mutation: ${mutation}.`],
  };

  if (mutation === "spellblade") {
    next = {
      ...next,
      ap: {
        max: next.ap.max + 1,
        current: next.ap.current + 1,
      },
      log: [...next.log, "Spellblade bonus: +1 AP per turn."],
    };
  }

  if (mutation === "battlemage") {
    next = {
      ...drawCards(next, 1),
      log: [...next.log, "Battlemage bonus: draw +1 card on rank-up."],
    };
  }

  return next;
}

export function chooseReward(state: GameState, reward: RewardChoice): GameState {
  if (state.phase !== "reward") return state;
  if (!state.rewardOptions.includes(reward)) return state;
  return applyReward(state, reward);
}

export function endTurn(state: GameState): GameState {
  if (state.phase !== "hero") return state;
  if (state.progression.rankChoicePending) {
    return { ...state, log: [...state.log, "Choose a rank mutation before ending turn."] };
  }
  return enemyAct(state);
}

export function moveHero(state: GameState, dx: number, dy: number): GameState {
  if (!canAct(state)) return state;

  const nx = state.hero.x + dx;
  const ny = state.hero.y + dy;
  if (!isWalkable(state, nx, ny)) {
    return { ...state, log: [...state.log, "Blocked."] };
  }

  const moved = consumeAp({
    ...state,
    hero: { ...state.hero, x: nx, y: ny },
    log: [...state.log, `${state.hero.name} moves.`],
  });

  if (floorClearByChest(moved)) return toRewardPhase(moved, "chest");
  return moved;
}

export function playCard(state: GameState, cardId: string): GameState {
  if (!canAct(state)) return state;

  const idx = state.hand.findIndex((c) => c.id === cardId);
  if (idx < 0) return state;

  const card = state.hand[idx];
  const hand = state.hand.filter((_, i) => i !== idx);

  let next: GameState = {
    ...state,
    hand,
    discard: [...state.discard, card],
  };

  if (card.selfStatus) {
    next = {
      ...next,
      hero: { ...next.hero, statuses: upsertStatus(next.hero.statuses, card.selfStatus) },
      log: [...next.log, `${next.hero.name} gains ${card.selfStatus.kind}.`],
    };
  }

  const dist = manhattan(next.hero, next.enemy);
  let line = `${card.name} fizzles.`;

  if (dist <= card.range && card.value > 0 && next.enemy.hp > 0) {
    const newEnemyHp = Math.max(0, next.enemy.hp - card.value);
    next = { ...next, enemy: { ...next.enemy, hp: newEnemyHp } };
    line = `${next.hero.name} uses ${card.name} for ${card.value} damage.`;

    if (card.applyStatus && newEnemyHp > 0) {
      next = {
        ...next,
        enemy: { ...next.enemy, statuses: upsertStatus(next.enemy.statuses, card.applyStatus) },
        log: [...next.log, `${next.enemy.name} suffers ${card.applyStatus.kind}.`],
      };
    }

    if (newEnemyHp === 0) {
      next = grantXp(
        {
          ...next,
          floorKills: next.floorKills + 1,
          progression: { ...next.progression, kills: next.progression.kills + 1 },
          log: [...next.log, `${next.enemy.name} is defeated! (+5 XP)`],
        },
        5
      );

      if (floorClearByKills(next)) return toRewardPhase(consumeAp({ ...next, log: [...next.log, line] }), "kills");
      next = respawnEnemy(next);
    }
  }

  return consumeAp({ ...next, log: [...next.log, line] });
}
