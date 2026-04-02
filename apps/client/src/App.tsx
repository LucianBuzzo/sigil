import React, { useMemo, useState } from "react";
import {
  canPlayCard,
  chooseRankMutation,
  chooseReward,
  createNewGame,
  endTurn,
  getCardRangeTiles,
  moveHero,
  playCard,
  type RewardChoice,
} from "@sigil/core";

const tileSize = 36;

export function App() {
  const [state, setState] = useState(() => createNewGame(1));
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const grid = useMemo(() => {
    const byKey = new Map(state.map.tiles.map((t) => [`${t.x},${t.y}`, t.kind]));
    return Array.from({ length: state.map.height }, (_, y) =>
      Array.from({ length: state.map.width }, (_, x) => byKey.get(`${x},${y}`) ?? "wall")
    );
  }, [state.map]);

  const inRangeTiles = useMemo(() => {
    if (!selectedCardId) return new Set<string>();
    return new Set(getCardRangeTiles(state, selectedCardId).map((t) => `${t.x},${t.y}`));
  }, [selectedCardId, state]);

  const enemyInRange = useMemo(() => {
    if (!selectedCardId) return false;
    return inRangeTiles.has(`${state.enemy.x},${state.enemy.y}`);
  }, [selectedCardId, inRangeTiles, state.enemy.x, state.enemy.y]);

  const onCardClick = (cardId: string) => {
    if (selectedCardId !== cardId) {
      setSelectedCardId(cardId);
      return;
    }
    setState((s) => playCard(s, cardId));
    setSelectedCardId(null);
  };

  const rewardButtons: Array<{ key: RewardChoice; label: string }> = [
    { key: "vigor", label: "Vigor (+HP/+heal)" },
    { key: "focus", label: "Focus (+AP)" },
    { key: "armament", label: "Armament (+Arc Bolt card)" },
  ];

  return (
    <div
      data-testid="app-root"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(640px, 1fr) 360px",
        gap: 16,
        padding: 16,
        alignItems: "start",
      }}
    >
      <section data-testid="board-panel">
        <h2>Sigil — Bastion Prototype</h2>
        <p style={{ marginTop: -8, opacity: 0.8 }}>Map Source: {state.map.meta.source}</p>

        {state.phase === "reward" && (
          <div
            data-testid="reward-panel"
            style={{
              marginBottom: 10,
              border: "1px solid #22c55e",
              background: "#08201a",
              borderRadius: 8,
              padding: 10,
            }}
          >
            <strong>Floor Clear — Choose Reward</strong>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {rewardButtons.map((r) => (
                <button key={r.key} data-testid={`reward-${r.key}`} onClick={() => setState((s) => chooseReward(s, r.key))}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {state.phase === "gameover" && (
          <div
            data-testid="gameover-panel"
            style={{
              marginBottom: 10,
              border: "1px solid #ef4444",
              background: "#2a0b0b",
              borderRadius: 8,
              padding: 10,
            }}
          >
            <strong>Game Over</strong>
            <p style={{ margin: "6px 0" }}>
              Floors: {state.runSummary?.floorsCleared} | Kills: {state.runSummary?.kills} | Lvl:
              {" "}
              {state.runSummary?.level} | Rank: {state.runSummary?.rank}
            </p>
            <button data-testid="new-run" onClick={() => setState(createNewGame(Math.floor(Math.random() * 1000)))}>
              Start New Run
            </button>
          </div>
        )}

        <div
          data-testid="battle-grid"
          style={{
            display: "inline-block",
            border: "1px solid #374151",
            background: "#0b1220",
            padding: 4,
          }}
        >
          {grid.map((row, y) => (
            <div key={y} style={{ display: "flex" }}>
              {row.map((kind, x) => {
                const isHero = state.hero.x === x && state.hero.y === y;
                const isEnemy = state.enemy.x === x && state.enemy.y === y && state.enemy.hp > 0;
                const isChest = state.chest.x === x && state.chest.y === y;
                const inRange = inRangeTiles.has(`${x},${y}`);
                return (
                  <div
                    key={`${x}-${y}`}
                    data-testid={`tile-${x}-${y}`}
                    aria-label={`tile-${x}-${y}-${kind}`}
                    style={{
                      width: tileSize,
                      height: tileSize,
                      boxSizing: "border-box",
                      border: inRange ? "1px solid #22c55e" : "1px solid #1f2937",
                      background:
                        kind === "wall" ? "#374151" : kind === "door" ? "#7c3aed" : "#111827",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 16,
                    }}
                  >
                    {isHero ? "🧙" : isEnemy ? "💀" : isChest ? "🧰" : ""}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div data-testid="movement-controls" style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button data-testid="move-up" onClick={() => setState((s) => moveHero(s, 0, -1))}>↑</button>
          <button data-testid="move-left" onClick={() => setState((s) => moveHero(s, -1, 0))}>←</button>
          <button data-testid="move-right" onClick={() => setState((s) => moveHero(s, 1, 0))}>→</button>
          <button data-testid="move-down" onClick={() => setState((s) => moveHero(s, 0, 1))}>↓</button>
          <button data-testid="end-turn" onClick={() => setState((s) => endTurn(s))}>End Turn</button>
          <button data-testid="new-seed" onClick={() => setState(createNewGame(Math.floor(Math.random() * 1000)))}>
            New Seed
          </button>
        </div>
      </section>

      <aside
        data-testid="combat-panel"
        style={{
          background: "#0b1220",
          border: "1px solid #1f2937",
          borderRadius: 8,
          padding: 12,
        }}
      >
        <h3>Combat</h3>
        <p data-testid="turn">Turn: {state.turn}</p>
        <p data-testid="floor">Floor: {state.floor}</p>
        <p data-testid="phase">Phase: {state.phase}</p>
        <p data-testid="ap">AP: {state.ap.current}/{state.ap.max}</p>
        <p data-testid="hero-hp">Hero HP: {state.hero.hp}/{state.hero.maxHp}</p>
        <p data-testid="enemy-hp">Enemy HP: {state.enemy.hp}/{state.enemy.maxHp}</p>
        <p data-testid="enemy-name">Enemy: {state.enemy.name}</p>
        <p data-testid="floor-objective">
          Objective: defeat {state.floorKillTarget} enemies ({state.floorKills}/{state.floorKillTarget}) or find chest 🧰
        </p>
        {selectedCardId && (
          <p data-testid="target-preview">Target preview: {enemyInRange ? "enemy in range" : "enemy out of range"}</p>
        )}

        <h4>Progression</h4>
        <p data-testid="xp">XP: {state.progression.xp}</p>
        <p data-testid="level">Level: {state.progression.level}</p>
        <p data-testid="rank">Rank: {state.progression.rank}</p>
        <p data-testid="kills">Kills: {state.progression.kills}</p>
        <p data-testid="mutation">Mutation: {state.progression.rankMutation ?? "none"}</p>

        {state.progression.rankChoicePending && (
          <div data-testid="rank-up-choice" style={{ margin: "8px 0 12px", padding: 8, borderRadius: 6, border: "1px solid #7c3aed", background: "#1f1133" }}>
            <strong>Rank-Up Available</strong>
            <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
              <button data-testid="rank-choice-battlemage" onClick={() => setState((s) => chooseRankMutation(s, "battlemage"))}>
                Battlemage (+1 draw each turn)
              </button>
              <button data-testid="rank-choice-spellblade" onClick={() => setState((s) => chooseRankMutation(s, "spellblade"))}>
                Spellblade (+1 AP each turn)
              </button>
            </div>
          </div>
        )}

        <h4>Hand</h4>
        <div data-testid="hand" style={{ display: "grid", gap: 8 }}>
          {state.hand.map((c, i) => {
            const isSelected = selectedCardId === c.id;
            const playable = canPlayCard(state, c.id);
            return (
              <button
                key={`${c.id}-${i}`}
                data-testid={`card-${c.id}-${i}`}
                onClick={() => onCardClick(c.id)}
                style={{ opacity: playable ? 1 : 0.6, outline: isSelected ? "2px solid #22c55e" : "none" }}
              >
                {c.name} [{c.kind}] dmg:{c.value} r:{c.range}
              </button>
            );
          })}
          {state.hand.length === 0 && <small>No cards in hand</small>}
        </div>

        <h4 style={{ marginTop: 12 }}>Log</h4>
        <div data-testid="combat-log" style={{ maxHeight: 240, overflow: "auto", fontSize: 12, background: "#030712", padding: 8, borderRadius: 6 }}>
          {state.log.slice(-18).map((line, i) => (
            <div key={i}>• {line}</div>
          ))}
        </div>
      </aside>
    </div>
  );
}
