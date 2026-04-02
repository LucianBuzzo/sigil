import { cards, items, type Card } from "@sigil/content";
import { generateBastionMap } from "@sigil/world";

export type Entity = { id: string; name: string; hp: number; x: number; y: number };
export type GameState = {
  turn: number;
  map: ReturnType<typeof generateBastionMap>;
  hero: Entity;
  enemy: Entity;
  deck: Card[];
  hand: Card[];
  discard: Card[];
  log: string[];
};

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

export function createNewGame(seed = 1): GameState {
  const map = generateBastionMap(seed);
  const deck = buildDeckFromItems(["rust-sword", "oak-shield", "apprentice-robe"]);
  const initial: GameState = {
    turn: 1,
    map,
    hero: { id: "hero", name: "Warden", hp: 20, ...map.heroSpawn },
    enemy: { id: "enemy", name: "Skeleton", hp: 14, ...map.enemySpawn },
    deck,
    hand: [],
    discard: [],
    log: ["Battle begins in Bastion."]
  };
  return drawCards(initial, 3);
}

export function endTurn(state: GameState): GameState {
  const toDiscard = [...state.hand];
  const s1 = { ...state, hand: [], discard: [...state.discard, ...toDiscard], turn: state.turn + 1 };
  return { ...drawCards(s1, 2), log: [...state.log, `Turn ${s1.turn} started.`] };
}

export function moveHero(state: GameState, dx: number, dy: number): GameState {
  const nx = state.hero.x + dx;
  const ny = state.hero.y + dy;
  const tile = state.map.tiles.find((t) => t.x === nx && t.y === ny);
  if (!tile || tile.kind === "wall") return { ...state, log: [...state.log, "Blocked."] };
  return { ...state, hero: { ...state.hero, x: nx, y: ny } };
}

export function playCard(state: GameState, cardId: string): GameState {
  const idx = state.hand.findIndex((c) => c.id === cardId);
  if (idx < 0) return state;
  const card = state.hand[idx];
  const hand = state.hand.filter((_, i) => i !== idx);
  let enemy = state.enemy;
  const dist = Math.abs(state.hero.x - state.enemy.x) + Math.abs(state.hero.y - state.enemy.y);
  let line = `${card.name} fizzles.`;
  if (dist <= card.range && card.value > 0) {
    enemy = { ...enemy, hp: Math.max(0, enemy.hp - card.value) };
    line = `${state.hero.name} uses ${card.name} for ${card.value} damage.`;
  }
  return {
    ...state,
    hand,
    enemy,
    discard: [...state.discard, card],
    log: [...state.log, line]
  };
}
