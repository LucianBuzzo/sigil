import generated from "./generated/maps.json";

export type Tile = { x: number; y: number; kind: "floor" | "wall" | "door" };
export type WorldMap = {
  width: number;
  height: number;
  tiles: Tile[];
  heroSpawn: { x: number; y: number };
  enemySpawn: { x: number; y: number };
  meta: {
    seed: number;
    source: "dungeoneer" | "fallback";
  };
};

type GeneratedBundle = {
  generatedAt: string | null;
  maps: WorldMap[];
};

const bundle = generated as GeneratedBundle;

function fallbackMap(seed = 1): WorldMap {
  const width = 10;
  const height = 8;
  const tiles: Tile[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const border = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      const pillar = (x === 4 && y === 3) || (x === 6 && y === 5);
      tiles.push({ x, y, kind: border || pillar ? "wall" : "floor" });
    }
  }
  if (seed % 2 === 0) {
    const i = tiles.findIndex((t) => t.x === 2 && t.y === 4);
    if (i >= 0) tiles[i] = { ...tiles[i], kind: "wall" };
  }
  return {
    width,
    height,
    tiles,
    heroSpawn: { x: 2, y: 2 },
    enemySpawn: { x: 7, y: 5 },
    meta: { seed, source: "fallback" },
  };
}

export function generateBastionMap(seed = 1): WorldMap {
  const maps = bundle.maps || [];
  if (!maps.length) return fallbackMap(seed);

  const idx = Math.abs(seed) % maps.length;
  const chosen = maps[idx];
  return {
    ...chosen,
    meta: {
      seed,
      source: "dungeoneer",
    },
  };
}
