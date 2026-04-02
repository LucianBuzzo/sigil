#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dungeoneer from 'dungeoneer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outFile = path.resolve(__dirname, '../src/generated/maps.json');

const seeds = Array.from({ length: 24 }, (_, i) => i + 1);

function toSigilMap(seed, js) {
  const tiles = [];
  for (let x = 0; x < js.tiles.length; x++) {
    const col = js.tiles[x] || [];
    for (let y = 0; y < col.length; y++) {
      const tile = col[y];
      if (!tile) continue;
      tiles.push({ x, y, kind: tile.type });
    }
  }

  const floors = tiles.filter((t) => t.kind === 'floor');
  const heroSpawn = floors[0] ? { x: floors[0].x, y: floors[0].y } : { x: 1, y: 1 };
  const enemySpawn = floors.at(-1) ? { x: floors.at(-1).x, y: floors.at(-1).y } : { x: 2, y: 2 };

  return {
    seed,
    width: js.tiles.length,
    height: js.tiles[0]?.length || 0,
    tiles,
    heroSpawn,
    enemySpawn,
    meta: { seed, source: 'dungeoneer' },
  };
}

const maps = [];
for (const seed of seeds) {
  try {
    const dungeon = dungeoneer.build({
      width: 21,
      height: 15,
      seed,
      constraints: {
        minRooms: 5,
        maxRooms: 9,
        minRoomSize: 3,
        maxRoomSize: 7,
      },
    });
    maps.push(toSigilMap(seed, dungeon.toJS()));
  } catch (err) {
    console.warn(`Skipping seed ${seed}: ${err?.message || err}`);
  }
}

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify({ generatedAt: new Date().toISOString(), maps }, null, 2) + '\n');
console.log(`Generated ${maps.length} maps -> ${outFile}`);
