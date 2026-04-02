import { cards, items, type Card } from "@sigil/content";
import { generateBastionMap } from "@sigil/world";

export type Entity = {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
};

export type RankMutation = "battlemage" | "spellblade" | null;

export type Progression = {
  xp: number;
  level: number;
  rank: number;
  kills: number;
  rankChoicePending: boolean;
  rankMutation: RankMutation;
};

export type GameState = {
  turn: number;
  phase: "hero" | "enemy";
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
  log: string[];
};

const BASE_AP = 2;
const ENEMY_ATTACK_DAMAGE = 2;

function buildDeckFromItems(loadout: string[]): Card[] {
  const ids = loadout.flatMap((itemId) => items.find((i) => i.id === itemId)?.cards ?? []);
  return ids.map((id) => cards.find((c) => c.id === id)!).filter(Boolean);
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
      log: [
        ...next.log,
        "Rank-up available! Choose a mutation: battlemage or spellblade.",
      ],
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
  return (
    state.phase === "hero" && !state.progression.rankChoicePending && state.ap.current > 0
  );
}

function isWalkable(state: GameState, x: number, y: number): boolean {
  const tile = state.map.tiles.find((t) => t.x === x && t.y === y);
  if (!tile || tile.kind === "wall") return false;
  if (state.enemy.hp > 0 && state.enemy.x === x && state.enemy.y === y) return false;
  return true;
}

function manhattan(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function floorKillTargetFor(floor: number): number {
  return Math.min(6, 2 + floor);
}

function chooseChestTile(
  map: ReturnType<typeof generateBastionMap>
): { x: number; y: number } {
  const floorTiles = map.tiles.filter((t) => t.kind === "floor");
  if (!floorTiles.length) return { ...map.heroSpawn };

  floorTiles.sort((a, b) => {
    const da = manhattan(a, map.heroSpawn) + manhattan(a, map.enemySpawn);
    const db = manhattan(b, map.heroSpawn) + manhattan(b, map.enemySpawn);
    return db - da;
  });

  const chosen = floorTiles.find(
    (t) => !(t.x === map.heroSpawn.x && t.y === map.heroSpawn.y)
  );

  return chosen ? { x: chosen.x, y: chosen.y } : { ...map.heroSpawn };
}

function floorClearByChest(state: GameState): boolean {
  return state.hero.x === state.chest.x && state.hero.y === state.chest.y;
}

function floorClearByKills(state: GameState): boolean {
  return state.floorKills >= state.floorKillTarget;
}

function healHeroBetweenFloors(hero: Entity): Entity {
  const heal = Math.max(2, Math.floor(hero.maxHp * 0.3));
  return { ...hero, hp: Math.min(hero.maxHp, hero.hp + heal) };
}

function spawnEnemyForFloor(
  state: GameState,
  floor: number,
  map: ReturnType<typeof generateBastionMap>
): Entity {
  const hp = 12 + floor * 3;
  return {
    ...state.enemy,
    hp,
    maxHp: hp,
    x: map.enemySpawn.x,
    y: map.enemySpawn.y,
  };
}

function advanceFloor(state: GameState, reason: "kills" | "chest"): GameState {
  const nextFloor = state.floor + 1;
  const nextSeed = state.floorSeed + 1;
  const nextMap = generateBastionMap(nextSeed);
  const nextChest = chooseChestTile(nextMap);
  const nextMaxAp = BASE_AP + (state.progression.rankMutation === "spellblade" ? 1 : 0);
  const bonusDraw = state.progression.rankMutation === "battlemage" ? 1 : 0;

  const transitioned: GameState = {
    ...state,
    floor: nextFloor,
    floorSeed: nextSeed,
    floorKills: 0,
    floorKillTarget: floorKillTargetFor(nextFloor),
    turn: state.turn + 1,
    phase: "hero",
    ap: { max: nextMaxAp, current: nextMaxAp },
    map: nextMap,
    chest: nextChest,
    hero: {
      ...healHeroBetweenFloors({
        ...state.hero,
        x: nextMap.heroSpawn.x,
        y: nextMap.heroSpawn.y,
      }),
    },
    enemy: spawnEnemyForFloor(state, nextFloor, nextMap),
    hand: [],
    discard: [...state.discard, ...state.hand],
    log: [
      ...state.log,
      reason === "kills"
        ? `Floor ${state.floor} cleared by kills.`
        : `Floor ${state.floor} cleared by finding the chest.`,
      `Descending to Floor ${nextFloor}...`,
      `Turn ${state.turn + 1} started.`,
    ],
  };

  return drawCards(transitioned, 3 + bonusDraw);
}

function maybeAdvanceFloor(state: GameState): GameState {
  if (floorClearByKills(state)) return advanceFloor(state, "kills");
  if (floorClearByChest(state)) return advanceFloor(state, "chest");
  return state;
}

function enemyAct(state: GameState): GameState {
  let next: GameState = {
    ...state,
    phase: "enemy",
    log: [...state.log, "Enemy turn."],
  };
  let enemyAp = BASE_AP;

  while (enemyAp > 0 && next.enemy.hp > 0 && next.hero.hp > 0) {
    const dist = manhattan(next.enemy, next.hero);

    if (dist <= 1) {
      next = {
        ...next,
        hero: {
          ...next.hero,
          hp: Math.max(0, next.hero.hp - ENEMY_ATTACK_DAMAGE),
        },
        log: [
          ...next.log,
          `${next.enemy.name} attacks ${next.hero.name} for ${ENEMY_ATTACK_DAMAGE}.`,
        ],
      };
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

    candidates.sort(
      (a, b) => manhattan(a, next.hero) - manhattan(b, next.hero)
    );
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
    hand: [],
    discard: [...next.discard, ...next.hand],
  };

  return drawCards(
    {
      ...withNextTurn,
      log: [...withNextTurn.log, `Turn ${withNextTurn.turn} started.`],
    },
    2 + bonusDraw
  );
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
    },
    log: [...state.log, `${state.enemy.name} reforms in the dungeon...`],
  };
}

export function createNewGame(seed = 1): GameState {
  const map = generateBastionMap(seed);
  const deck = buildDeckFromItems(["rust-sword", "oak-shield", "apprentice-robe"]);
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
    hero: { id: "hero", name: "Warden", hp: 20, maxHp: 20, ...map.heroSpawn },
    enemy: {
      id: "enemy",
      name: "Skeleton",
      hp: 14,
      maxHp: 14,
      ...map.enemySpawn,
    },
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
    log: [
      "Battle begins in Bastion.",
      "Floor objective: defeat enemies or find the treasure chest.",
    ],
  };
  return drawCards(initial, 3);
}

export function chooseRankMutation(
  state: GameState,
  mutation: Exclude<RankMutation, null>
): GameState {
  if (!state.progression.rankChoicePending) return state;

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

export function endTurn(state: GameState): GameState {
  if (state.phase !== "hero") return state;
  if (state.progression.rankChoicePending) {
    return {
      ...state,
      log: [...state.log, "Choose a rank mutation before ending turn."],
    };
  }
  return enemyAct(state);
}

export function moveHero(state: GameState, dx: number, dy: number): GameState {
  if (!canAct(state)) return state;

  const nx = state.hero.x + dx;
  const ny = state.hero.y + dy;

  if (!isWalkable(state, nx, ny)) {
    return {
      ...state,
      log: [...state.log, "Blocked."],
    };
  }

  const moved = consumeAp({
    ...state,
    hero: { ...state.hero, x: nx, y: ny },
    log: [...state.log, `${state.hero.name} moves.`],
  });

  if (floorClearByChest(moved)) {
    return advanceFloor(moved, "chest");
  }

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

  const dist = manhattan(next.hero, next.enemy);
  let line = `${card.name} fizzles.`;

  if (dist <= card.range && card.value > 0 && next.enemy.hp > 0) {
    const newEnemyHp = Math.max(0, next.enemy.hp - card.value);
    next = {
      ...next,
      enemy: { ...next.enemy, hp: newEnemyHp },
    };
    line = `${next.hero.name} uses ${card.name} for ${card.value} damage.`;

    if (newEnemyHp === 0) {
      next = grantXp(
        {
          ...next,
          floorKills: next.floorKills + 1,
          progression: {
            ...next.progression,
            kills: next.progression.kills + 1,
          },
          log: [...next.log, `${next.enemy.name} is defeated! (+5 XP)`],
        },
        5
      );

      if (floorClearByKills(next)) {
        return advanceFloor(consumeAp({ ...next, log: [...next.log, line] }), "kills");
      }

      next = respawnEnemy(next);
    }
  }

  return consumeAp({
    ...next,
    log: [...next.log, line],
  });
}
