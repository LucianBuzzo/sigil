import { cards, classes, items, type Card, type StatusKind } from "@sigil/content";
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

export type Ally = Entity & {
  ap: { current: number; max: number };
  deck: Card[];
  hand: Card[];
  discard: Card[];
};

export type EnemyArchetype = "skeleton" | "brute" | "acolyte" | "reaver";
export type RankMutation = "battlemage" | "spellblade" | "reaper" | null;
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
  enemies: Entity[];
  killTarget: number;
  clearedBy: "kills" | "chest";
};

export type GameState = {
  classId: string;
  turn: number;
  phase: "hero" | "enemy" | "reward" | "gameover";
  map: ReturnType<typeof generateBastionMap>;
  party: Ally[];
  activeAllyId: string;
  enemies: Entity[];
  selectedEnemyId: string | null;
  chest: { x: number; y: number };
  floor: number;
  floorSeed: number;
  floorKills: number;
  floorKillTarget: number;
  progression: Progression;
  rewardOptions: RewardChoice[];
  pendingFloor: PendingFloor | null;
  runSummary: null | { floorsCleared: number; kills: number; level: number; rank: number; mutation: RankMutation };
  log: string[];
};

const BASE_AP = 2;
const ENEMY_ATTACK_DAMAGE = 2;
const PARTY_SIZE = 3;

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

function drawCardsForAlly(ally: Ally, count: number): Ally {
  let deck = [...ally.deck];
  let discard = [...ally.discard];
  const hand = [...ally.hand];

  for (let i = 0; i < count; i++) {
    if (deck.length === 0) {
      deck = [...discard];
      discard = [];
    }
    const next = deck.shift();
    if (next) hand.push(next);
  }

  return { ...ally, deck, discard, hand };
}

function mapParty(state: GameState, allyId: string, updater: (ally: Ally) => Ally): Ally[] {
  return state.party.map((a) => (a.id === allyId ? updater(a) : a));
}

function consumeAllyAp(state: GameState, allyId: string, amount = 1): GameState {
  return {
    ...state,
    party: mapParty(state, allyId, (ally) => ({
      ...ally,
      ap: {
        ...ally.ap,
        current: Math.max(0, ally.ap.current - amount),
      },
    })),
  };
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
      party: next.party.map((ally) => ({
        ...ally,
        maxHp: ally.maxHp + 2,
        hp: ally.hp + 2,
      })),
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

function canAct(state: GameState): boolean {
  if (state.phase !== "hero" || state.progression.rankChoicePending) return false;
  const ally = state.party.find((a) => a.id === state.activeAllyId);
  return Boolean(ally && ally.hp > 0 && ally.ap.current > 0);
}

function manhattan(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function isWalkable(state: GameState, x: number, y: number, movingAllyId?: string): boolean {
  const tile = state.map.tiles.find((t) => t.x === x && t.y === y);
  if (!tile || tile.kind === "wall") return false;

  if (state.enemies.some((e) => e.hp > 0 && e.x === x && e.y === y)) return false;

  if (
    state.party.some((ally) => ally.hp > 0 && ally.id !== movingAllyId && ally.x === x && ally.y === y)
  ) {
    return false;
  }

  return true;
}

function floorKillTargetFor(floor: number): number {
  return Math.min(6, 2 + floor);
}

function enemyCountForFloor(floor: number): number {
  return Math.min(4, 1 + Math.floor((floor + 1) / 2));
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
  if (floor % 7 === 0) return "reaver";
  if (floor % 5 === 0) return "acolyte";
  if (floor % 3 === 0) return "brute";
  return "skeleton";
}

function spawnEnemyForFloor(
  templateEnemy: Entity,
  floor: number,
  map: ReturnType<typeof generateBastionMap>,
  index: number
): Entity {
  const arch = enemyArchetypeForFloor(floor + index);
  const baseId = `enemy-${floor}-${index + 1}`;
  if (arch === "brute") {
    const hp = 16 + floor * 4;
    return { ...templateEnemy, id: baseId, name: "Bone Brute", hp, maxHp: hp, x: map.enemySpawn.x, y: map.enemySpawn.y + (index % 2), statuses: [] };
  }
  if (arch === "acolyte") {
    const hp = 12 + floor * 3;
    return { ...templateEnemy, id: baseId, name: "Hex Acolyte", hp, maxHp: hp, x: map.enemySpawn.x, y: map.enemySpawn.y + (index % 2), statuses: [{ kind: "slow", duration: 1 }] };
  }
  if (arch === "reaver") {
    const hp = 14 + floor * 3;
    return { ...templateEnemy, id: baseId, name: "Grave Reaver", hp, maxHp: hp, x: map.enemySpawn.x, y: map.enemySpawn.y + (index % 2), statuses: [{ kind: "bleed", duration: 1 }] };
  }
  const hp = 12 + floor * 3;
  return { ...templateEnemy, id: baseId, name: "Skeleton", hp, maxHp: hp, x: map.enemySpawn.x, y: map.enemySpawn.y + (index % 2), statuses: [] };
}

function spawnEnemiesForFloor(state: GameState, floor: number, map: ReturnType<typeof generateBastionMap>): Entity[] {
  const count = enemyCountForFloor(floor);
  const base = state.enemies[0] ?? {
    id: "enemy",
    name: "Skeleton",
    hp: 12,
    maxHp: 12,
    x: map.enemySpawn.x,
    y: map.enemySpawn.y,
    statuses: [],
  };
  const enemies = Array.from({ length: count }, (_, i) => spawnEnemyForFloor(base, floor, map, i));

  const occupied = new Set<string>();
  return enemies.map((enemy, i) => {
    let x = enemy.x;
    let y = enemy.y;
    const candidates = [
      { x, y },
      { x, y: y + 1 },
      { x, y: y - 1 },
      { x: x - 1, y },
      { x: x + 1, y },
      { x: x - 1, y: y + 1 },
      { x: x - 1, y: y - 1 },
    ];
    const chosen = candidates.find((c) => {
      const tile = map.tiles.find((t) => t.x === c.x && t.y === c.y);
      const key = `${c.x},${c.y}`;
      return tile && tile.kind !== "wall" && !occupied.has(key);
    });
    if (chosen) {
      x = chosen.x;
      y = chosen.y;
    }
    occupied.add(`${x},${y}`);
    return { ...enemy, id: `enemy-${floor}-${i + 1}`, x, y };
  });
}

function floorClearByChest(state: GameState): boolean {
  return state.party.some((ally) => ally.hp > 0 && ally.x === state.chest.x && ally.y === state.chest.y);
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
    enemies: spawnEnemiesForFloor(state, floor, map),
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
    next.party = next.party.map((ally) => {
      const newMax = ally.maxHp + 3;
      return { ...ally, maxHp: newMax, hp: Math.min(newMax, ally.hp + 5) };
    });
    next.log = [...next.log, "Reward chosen: Vigor (+max HP, heal)."];
  } else if (choice === "focus") {
    next.party = next.party.map((ally) => ({
      ...ally,
      ap: { max: ally.ap.max + 1, current: ally.ap.current + 1 },
    }));
    next.log = [...next.log, "Reward chosen: Focus (+1 AP this and future turns)."];
  } else {
    next.party = next.party.map((ally) => ({ ...ally, deck: [...ally.deck, cards.find((c) => c.id === "arc-bolt")!] }));
    next.log = [...next.log, "Reward chosen: Armament (+Arc Bolt card per ally)."];
  }

  const healedParty = next.party.map((ally) => {
    const healed = Math.max(2, Math.floor(ally.maxHp * 0.3));
    const bonusDraw = next.progression.rankMutation === "battlemage" ? 1 : 0;
    const restacked = shuffleDeck([...ally.deck, ...ally.discard, ...ally.hand], pending.seed + ally.id.length);
    return drawCardsForAlly(
      {
        ...ally,
        hp: Math.min(ally.maxHp, ally.hp + healed),
        x: pending.map.heroSpawn.x,
        y: pending.map.heroSpawn.y,
        deck: restacked,
        hand: [],
        discard: [],
      },
      1 + bonusDraw
    );
  });

  return {
    ...next,
    turn: next.turn + 1,
    phase: "hero",
    floor: pending.floor,
    floorSeed: pending.seed,
    floorKills: 0,
    floorKillTarget: pending.killTarget,
    map: pending.map,
    chest: pending.chest,
    party: healedParty,
    activeAllyId: healedParty.find((a) => a.hp > 0)?.id ?? next.activeAllyId,
    enemies: pending.enemies,
    selectedEnemyId: pending.enemies[0]?.id ?? null,
    rewardOptions: [],
    pendingFloor: null,
    log: [...next.log, `Descending to Floor ${pending.floor}...`, `Turn ${next.turn + 1} started.`],
  };
}

function checkGameOver(state: GameState): GameState {
  if (state.party.some((ally) => ally.hp > 0)) return state;
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
    log: [...state.log, "Your party has fallen in Bastion."],
  };
}

function enemyAct(state: GameState): GameState {
  let next: GameState = {
    ...state,
    phase: "enemy",
    enemies: state.enemies.map((e) => tickStatuses(e)),
    party: state.party.map((a) => tickStatuses(a) as Ally),
    log: [...state.log, "Enemy turn."],
  };

  next = checkGameOver(next);
  if (next.phase === "gameover") return next;

  for (const actingEnemy of next.enemies) {
    if (actingEnemy.hp <= 0) continue;
    let enemyAp = BASE_AP - (hasStatus(actingEnemy, "slow") ? 1 : 0);
    if (enemyAp < 1) enemyAp = 1;

    while (enemyAp > 0) {
      const freshEnemy = next.enemies.find((e) => e.id === actingEnemy.id);
      if (!freshEnemy || freshEnemy.hp <= 0) break;

      const targets = next.party.filter((a) => a.hp > 0);
      if (!targets.length) return checkGameOver(next);
      const target = [...targets].sort((a, b) => manhattan(freshEnemy, a) - manhattan(freshEnemy, b))[0]!;
      const dist = manhattan(freshEnemy, target);

      if (dist <= 1) {
        let dmg = ENEMY_ATTACK_DAMAGE + (freshEnemy.name === "Grave Reaver" ? 1 : 0);
        if (hasStatus(target, "guard")) dmg = Math.max(0, dmg - 1);
        next = {
          ...next,
          party: mapParty(next, target.id, (ally) => ({ ...ally, hp: Math.max(0, ally.hp - dmg) })),
          log: [...next.log, `${freshEnemy.name} attacks ${target.name} for ${dmg}.`],
        };
        next = checkGameOver(next);
        if (next.phase === "gameover") return next;
        enemyAp -= 1;
        continue;
      }

      const candidates = [
        { x: freshEnemy.x + 1, y: freshEnemy.y },
        { x: freshEnemy.x - 1, y: freshEnemy.y },
        { x: freshEnemy.x, y: freshEnemy.y + 1 },
        { x: freshEnemy.x, y: freshEnemy.y - 1 },
      ].filter((p) => {
        const tile = next.map.tiles.find((t) => t.x === p.x && t.y === p.y);
        if (!tile || tile.kind === "wall") return false;
        if (next.enemies.some((e) => e.id !== freshEnemy.id && e.hp > 0 && e.x === p.x && e.y === p.y)) return false;
        if (next.party.some((a) => a.hp > 0 && a.x === p.x && a.y === p.y)) return false;
        return true;
      });

      if (!candidates.length) {
        next = { ...next, log: [...next.log, `${freshEnemy.name} cannot path.`] };
        break;
      }

      candidates.sort((a, b) => manhattan(a, target) - manhattan(b, target));
      const step = candidates[0]!;
      next = {
        ...next,
        enemies: next.enemies.map((e) => (e.id === freshEnemy.id ? { ...e, x: step.x, y: step.y } : e)),
        log: [...next.log, `${freshEnemy.name} advances.`],
      };
      enemyAp -= 1;
    }
  }

  const bonusDraw = next.progression.rankMutation === "battlemage" ? 1 : 0;
  const apMax = BASE_AP + (next.progression.rankMutation === "spellblade" ? 1 : 0);

  const withNextTurn: GameState = {
    ...next,
    turn: next.turn + 1,
    phase: "hero",
    party: next.party.map((ally) => {
      const reset = {
        ...ally,
        ap: { max: ally.ap.max, current: ally.ap.max || apMax },
      };
      return drawCardsForAlly(reset, 1 + bonusDraw);
    }),
  };

  return checkGameOver({
    ...withNextTurn,
    activeAllyId: withNextTurn.party.find((a) => a.hp > 0)?.id ?? withNextTurn.activeAllyId,
    log: [...withNextTurn.log, `Turn ${withNextTurn.turn} started.`],
  });
}

function spawnReinforcement(state: GameState): GameState {
  const nextIdx = state.floorKills + state.enemies.length + 1;
  const reinforcement = spawnEnemyForFloor(
    state.enemies[0] ?? { id: "enemy", name: "Skeleton", hp: 10, maxHp: 10, x: state.map.enemySpawn.x, y: state.map.enemySpawn.y, statuses: [] },
    state.floor,
    state.map,
    nextIdx
  );
  return {
    ...state,
    enemies: [...state.enemies, reinforcement],
    selectedEnemyId: state.selectedEnemyId ?? reinforcement.id,
    log: [...state.log, `${reinforcement.name} joins the battle...`],
  };
}

function getActiveAlly(state: GameState): Ally | null {
  return state.party.find((a) => a.id === state.activeAllyId) ?? null;
}

export function selectActiveAlly(state: GameState, allyId: string): GameState {
  if (!state.party.some((a) => a.id === allyId && a.hp > 0)) return state;
  return { ...state, activeAllyId: allyId };
}

export function selectEnemyTarget(state: GameState, enemyId: string): GameState {
  if (!state.enemies.some((e) => e.id === enemyId && e.hp > 0)) return state;
  return { ...state, selectedEnemyId: enemyId };
}

export function canPlayCard(state: GameState, cardId: string): boolean {
  const ally = getActiveAlly(state);
  if (!ally || !canAct(state)) return false;
  const card = ally.hand.find((c) => c.id === cardId);
  if (!card) return false;
  const target = state.enemies.find((e) => e.id === state.selectedEnemyId && e.hp > 0) ?? state.enemies.find((e) => e.hp > 0);
  if (card.value === 0 && !card.selfStatus) return true;
  if (!target) return false;
  return manhattan(ally, target) <= card.range;
}

export function getCardRangeTiles(state: GameState, cardId: string): Array<{ x: number; y: number }> {
  const ally = getActiveAlly(state);
  if (!ally) return [];
  const card = ally.hand.find((c) => c.id === cardId);
  if (!card) return [];
  const maxR = card.range;
  return state.map.tiles
    .filter((t) => t.kind !== "wall")
    .filter((t) => manhattan({ x: t.x, y: t.y }, ally) <= maxR)
    .map((t) => ({ x: t.x, y: t.y }));
}

export function createNewGame(seed = 1, classId = "warden"): GameState {
  const map = generateBastionMap(seed);
  const selectedClass = classes.find((c) => c.id === classId) ?? classes[0]!;
  const baseDeck = buildDeckFromItems(selectedClass.items);
  const party: Ally[] = Array.from({ length: PARTY_SIZE }, (_, i) => {
    const id = `ally-${i + 1}`;
    const deck = shuffleDeck(baseDeck, seed + i * 13);
    const ally: Ally = {
      id,
      name: `Ally ${i + 1}`,
      hp: 20,
      maxHp: 20,
      x: map.heroSpawn.x,
      y: map.heroSpawn.y + i,
      statuses: [],
      ap: { max: BASE_AP, current: BASE_AP },
      deck,
      hand: [],
      discard: [],
    };
    return drawCardsForAlly(ally, 3);
  });

  const initialEnemies = spawnEnemiesForFloor(
    {
      classId: selectedClass.id,
      turn: 1,
      phase: "hero",
      map,
      party,
      activeAllyId: party[0]!.id,
      enemies: [],
      selectedEnemyId: null,
      chest: chooseChestTile(map),
      floor: 1,
      floorSeed: seed,
      floorKills: 0,
      floorKillTarget: floorKillTargetFor(1),
      progression: { xp: 0, level: 1, rank: 1, kills: 0, rankChoicePending: false, rankMutation: null },
      rewardOptions: [],
      pendingFloor: null,
      runSummary: null,
      log: [],
    },
    1,
    map
  );

  return {
    classId: selectedClass.id,
    turn: 1,
    phase: "hero",
    map,
    chest: chooseChestTile(map),
    floor: 1,
    floorSeed: seed,
    floorKills: 0,
    floorKillTarget: floorKillTargetFor(1),
    party,
    activeAllyId: party[0]!.id,
    enemies: initialEnemies,
    selectedEnemyId: initialEnemies[0]?.id ?? null,
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
      party: next.party.map((ally) => ({
        ...ally,
        ap: {
          max: ally.ap.max + 1,
          current: ally.ap.current + 1,
        },
      })),
      log: [...next.log, "Spellblade bonus: +1 AP per turn."],
    };
  }

  if (mutation === "battlemage") {
    next = {
      ...next,
      party: next.party.map((ally) => drawCardsForAlly(ally, 1)),
      log: [...next.log, "Battlemage bonus: draw +1 card on rank-up."],
    };
  }

  if (mutation === "reaper") {
    next = {
      ...next,
      log: [...next.log, "Reaper bonus: attack cards deal +1 damage."],
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

  const ally = getActiveAlly(state);
  if (!ally) return state;

  const nx = ally.x + dx;
  const ny = ally.y + dy;
  if (!isWalkable(state, nx, ny, ally.id)) {
    return { ...state, log: [...state.log, "Blocked."] };
  }

  const moved = consumeAllyAp(
    {
      ...state,
      party: mapParty(state, ally.id, (a) => ({ ...a, x: nx, y: ny })),
      log: [...state.log, `${ally.name} moves.`],
    },
    ally.id
  );

  if (floorClearByChest(moved)) return toRewardPhase(moved, "chest");
  return moved;
}

export function playCard(state: GameState, cardId: string): GameState {
  if (!canAct(state)) return state;

  const ally = getActiveAlly(state);
  if (!ally) return state;

  const idx = ally.hand.findIndex((c) => c.id === cardId);
  if (idx < 0) return state;

  const card = ally.hand[idx]!;
  const hand = ally.hand.filter((_, i) => i !== idx);

  let next: GameState = {
    ...state,
    party: mapParty(state, ally.id, (a) => ({
      ...a,
      hand,
      discard: [...a.discard, card],
    })),
  };

  if (card.selfStatus) {
    next = {
      ...next,
      party: mapParty(next, ally.id, (a) => ({ ...a, statuses: upsertStatus(a.statuses, card.selfStatus!) })),
      log: [...next.log, `${ally.name} gains ${card.selfStatus.kind}.`],
    };
  }

  const liveAlly = next.party.find((a) => a.id === ally.id)!;
  const target =
    next.enemies.find((e) => e.id === next.selectedEnemyId && e.hp > 0) ??
    next.enemies.find((e) => e.hp > 0) ??
    null;

  let line = `${card.name} fizzles.`;

  if (target && manhattan(liveAlly, target) <= card.range && card.value > 0 && target.hp > 0) {
    const bonusDamage = next.progression.rankMutation === "reaper" && card.kind === "attack" ? 1 : 0;
    const totalDamage = card.value + bonusDamage;
    const newEnemyHp = Math.max(0, target.hp - totalDamage);
    next = { ...next, enemies: next.enemies.map((e) => (e.id === target.id ? { ...e, hp: newEnemyHp } : e)) };
    line = `${ally.name} uses ${card.name} on ${target.name} for ${totalDamage} damage.`;

    if (card.applyStatus && newEnemyHp > 0) {
      next = {
        ...next,
        enemies: next.enemies.map((e) =>
          e.id === target.id ? { ...e, statuses: upsertStatus(e.statuses, card.applyStatus!) } : e
        ),
        log: [...next.log, `${target.name} suffers ${card.applyStatus.kind}.`],
      };
    }

    if (newEnemyHp === 0) {
      next = grantXp(
        {
          ...next,
          floorKills: next.floorKills + 1,
          progression: { ...next.progression, kills: next.progression.kills + 1 },
          enemies: next.enemies.filter((e) => e.id !== target.id),
          selectedEnemyId:
            next.selectedEnemyId === target.id
              ? next.enemies.find((e) => e.id !== target.id && e.hp > 0)?.id ?? null
              : next.selectedEnemyId,
          log: [...next.log, `${target.name} is defeated! (+5 XP)`],
        },
        5
      );

      if (floorClearByKills(next)) {
        return toRewardPhase(consumeAllyAp({ ...next, log: [...next.log, line] }, ally.id), "kills");
      }
      next = spawnReinforcement(next);
    }
  }

  return consumeAllyAp({ ...next, log: [...next.log, line] }, ally.id);
}
