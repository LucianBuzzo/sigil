import React, { useEffect, useMemo, useRef, useState } from "react";
import {
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

const cardKindColors: Record<string, string> = {
  attack: "#ef4444",
  skill: "#22c55e",
  spell: "#3b82f6",
};

const cardArtUrl = (id: string, ext: "png" | "svg") =>
  new URL(`./card-art/${id}.${ext}`, window.location.href).toString();

type FloatingText = {
  id: number;
  value: string;
  x: number;
  y: number;
};

const xpThreshold = (level: number) => {
  const table = [0, 10, 25, 45, 70, 100];
  return table[level] ?? 999999;
};

export function App() {
  const [state, setState] = useState(() => createNewGame(1));
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [drawnCardIds, setDrawnCardIds] = useState<Set<string>>(new Set());
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const prevHandRef = useRef<string[]>([]);
  const combatLogRef = useRef<HTMLDivElement | null>(null);
  const prevEnemyHpRef = useRef<number>(state.enemy.hp);
  const prevHeroHpRef = useRef<number>(state.hero.hp);
  const floatIdRef = useRef<number>(1);

  const handInstanceIds = useMemo(() => state.hand.map((c, i) => `${c.id}-${i}`), [state.hand]);

  useEffect(() => {
    const prev = new Set(prevHandRef.current);
    const fresh = handInstanceIds.filter((id) => !prev.has(id));
    if (fresh.length) {
      setDrawnCardIds(new Set(fresh));
      const t = setTimeout(() => setDrawnCardIds(new Set()), 380);
      prevHandRef.current = [...handInstanceIds];
      return () => clearTimeout(t);
    }
    prevHandRef.current = [...handInstanceIds];
  }, [handInstanceIds]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1 || n > 7) return;
      const card = state.hand[n - 1];
      if (!card) return;
      onCardClick(card.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.hand, selectedCardId, state.ap.current, state.phase]);

  useEffect(() => {
    const el = combatLogRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [state.log.length]);

  useEffect(() => {
    const prevHp = prevEnemyHpRef.current;
    const currHp = state.enemy.hp;
    prevEnemyHpRef.current = currHp;

    if (currHp < prevHp) {
      const dmg = prevHp - currHp;
      const id = floatIdRef.current++;
      setFloatingTexts((prev) => [...prev, { id, value: String(dmg), x: state.enemy.x, y: state.enemy.y }]);
      const t = setTimeout(() => {
        setFloatingTexts((prev) => prev.filter((f) => f.id !== id));
      }, 950);
      return () => clearTimeout(t);
    }
  }, [state.enemy.hp, state.enemy.x, state.enemy.y]);

  useEffect(() => {
    const prevHp = prevHeroHpRef.current;
    const currHp = state.hero.hp;
    prevHeroHpRef.current = currHp;

    if (currHp < prevHp) {
      const dmg = prevHp - currHp;
      const id = floatIdRef.current++;
      setFloatingTexts((prev) => [...prev, { id, value: String(dmg), x: state.hero.x, y: state.hero.y }]);
      const t = setTimeout(() => {
        setFloatingTexts((prev) => prev.filter((f) => f.id !== id));
      }, 950);
      return () => clearTimeout(t);
    }
  }, [state.hero.hp, state.hero.x, state.hero.y]);

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

  const xpStart = xpThreshold(state.progression.level - 1);
  const xpEnd = xpThreshold(state.progression.level);
  const xpSpan = Math.max(1, xpEnd - xpStart);
  const xpProgressPct = Math.max(0, Math.min(100, ((state.progression.xp - xpStart) / xpSpan) * 100));
  const shouldPulseEndTurn = state.phase === "hero" && state.ap.current <= 0;

  return (
    <div data-testid="app-root" style={{ padding: 16 }}>
      <style>{`
        .card-enter { animation: card-in 800ms cubic-bezier(0.22, 1, 0.36, 1); }
        .hand-row {
          overflow-x: auto;
          overflow-y: hidden;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .hand-row::-webkit-scrollbar {
          width: 0;
          height: 0;
          display: none;
        }
        .floating-dmg {
          position: absolute;
          color: #fca5a5;
          font-weight: 900;
          text-shadow: 0 2px 8px rgba(0,0,0,0.55);
          pointer-events: none;
          transform: translate(-50%, -50%);
          animation: float-dmg 900ms ease-out forwards;
          z-index: 20;
        }
        @keyframes card-in {
          from { opacity: 0; transform: translateX(100vw) scale(0.98); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes float-dmg {
          0% { opacity: 0; transform: translate(-50%, -40%) scale(0.8); }
          15% { opacity: 1; transform: translate(-50%, -55%) scale(1.1); }
          100% { opacity: 0; transform: translate(-50%, -140%) scale(1); }
        }
        .end-turn-pulse {
          animation: end-turn-pulse 1100ms ease-in-out infinite;
          box-shadow: 0 0 0 rgba(251, 191, 36, 0.6);
        }
        @keyframes end-turn-pulse {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.65); }
          60% { transform: scale(1.03); box-shadow: 0 0 0 12px rgba(251, 191, 36, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(251, 191, 36, 0); }
        }
      `}</style>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(640px, 1fr) 360px",
          gap: 16,
          alignItems: "start",
        }}
      >
        <div data-testid="main-view" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <section data-testid="board-panel">
            <h2>Sigil — Bastion Prototype</h2>
            <p style={{ marginTop: -8, opacity: 0.8 }}>Map Source: {state.map.meta.source}</p>

            {state.phase === "reward" && (
              <div data-testid="reward-panel" style={{ marginBottom: 10, border: "1px solid #22c55e", background: "#08201a", borderRadius: 8, padding: 10 }}>
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
              <div data-testid="gameover-panel" style={{ marginBottom: 10, border: "1px solid #ef4444", background: "#2a0b0b", borderRadius: 8, padding: 10 }}>
                <strong>Game Over</strong>
                <p style={{ margin: "6px 0" }}>
                  Floors: {state.runSummary?.floorsCleared} | Kills: {state.runSummary?.kills} | Lvl: {state.runSummary?.level} | Rank: {state.runSummary?.rank}
                </p>
                <button data-testid="new-run" onClick={() => setState(createNewGame(Math.floor(Math.random() * 1000)))}>
                  Start New Run
                </button>
              </div>
            )}

            <div data-testid="battle-grid" style={{ display: "inline-block", border: "1px solid #374151", background: "#0b1220", padding: 4 }}>
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
                          background: kind === "wall" ? "#374151" : kind === "door" ? "#7c3aed" : "#111827",
                          display: "grid",
                          placeItems: "center",
                          position: "relative",
                          overflow: "visible",
                          fontSize: 16,
                        }}
                      >
                        {isHero ? "🧙" : isEnemy ? "💀" : isChest ? "🧰" : ""}
                        {floatingTexts
                          .filter((f) => f.x === x && f.y === y)
                          .map((f) => (
                            <span key={f.id} className="floating-dmg">
                              {f.value}
                            </span>
                          ))}
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
              <button
                data-testid="end-turn"
                className={shouldPulseEndTurn ? "end-turn-pulse" : ""}
                style={shouldPulseEndTurn ? { animation: "end-turn-pulse 1100ms ease-in-out infinite" } : undefined}
                onClick={() => setState((s) => endTurn(s))}
              >
                End Turn
              </button>
              <button data-testid="new-seed" onClick={() => setState(createNewGame(Math.floor(Math.random() * 1000)))}>New Seed</button>
            </div>
          </section>

          <section
            data-testid="hand-bottom-row"
            style={{
              border: "1px solid #1f2937",
              borderRadius: 10,
              background: "linear-gradient(180deg, #0b1220 0%, #070b14 100%)",
              padding: 10,
            }}
          >
            <h4 style={{ margin: "0 0 8px" }}>Hand (press 1–7)</h4>
            <div data-testid="hand" style={{ display: "flex", gap: 10, overflowX: "auto", paddingTop: 8, paddingBottom: 30 }}>
              {state.hand.map((c, i) => {
                const instanceId = `${c.id}-${i}`;
                const isSelected = selectedCardId === c.id;
                const accent = cardKindColors[c.kind] ?? "#6b7280";
                return (
                  <button
                    key={instanceId}
                    className={drawnCardIds.has(instanceId) ? "card-enter" : ""}
                    data-testid={`card-${c.id}-${i}`}
                    onClick={() => onCardClick(c.id)}
                    style={{
                      minWidth: 180,
                      maxWidth: 180,
                      textAlign: "left",
                      borderRadius: 12,
                      border: `2px solid ${isSelected ? "#f59e0b" : "#374151"}`,
                      background: "#111827",
                      color: "#e5e7eb",
                      padding: 0,
                      opacity: 1,
                      position: "relative",
                      zIndex: isSelected ? 2 : 1,
                      transform: isSelected ? "translateY(-4px) scale(1.01)" : "none",
                      transition: "transform 120ms ease, opacity 120ms ease",
                      boxShadow: isSelected ? "0 10px 20px rgba(245,158,11,0.25)" : "0 8px 16px rgba(0,0,0,0.2)",
                    }}
                  >
                    <div style={{ height: 22, background: accent, borderTopLeftRadius: 10, borderTopRightRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 8px", fontSize: 10, fontWeight: 800 }}>
                      <span>{c.kind.toUpperCase()}</span>
                      <span>#{i + 1}</span>
                    </div>

                    <div style={{ padding: 8 }}>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>{c.name}</div>
                      <div
                        style={{
                          marginTop: 6,
                          height: 110,
                          borderRadius: 8,
                          border: "1px solid #374151",
                          background: "radial-gradient(circle at 30% 30%, #1f2937 0%, #0b1220 70%)",
                          overflow: "hidden",
                          position: "relative",
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        <img
                          src={cardArtUrl(c.id, "png")}
                          alt={`${c.name} art`}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          onError={(e) => {
                            const el = e.currentTarget as HTMLImageElement;
                            if (!el.dataset.fallbackTried) {
                              el.dataset.fallbackTried = "1";
                              el.src = cardArtUrl(c.id, "svg");
                              return;
                            }
                            el.style.display = "none";
                          }}
                        />
                      </div>

                      <div style={{ marginTop: 6, fontSize: 12 }}>Damage: {c.value}</div>
                      <div style={{ fontSize: 12 }}>Range: {c.range}</div>
                      <div style={{ marginTop: 4, fontSize: 11, opacity: 0.85 }}>
                        {c.applyStatus ? `On hit: ${c.applyStatus.kind}` : c.selfStatus ? `Self: ${c.selfStatus.kind}` : "No status"}
                      </div>
                    </div>
                  </button>
                );
              })}
              {state.hand.length === 0 && <small>No cards in hand</small>}
            </div>
          </section>
        </div>

        <div data-testid="right-sidebar" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <aside
            data-testid="combat-panel"
            style={{
              background: "#0b1220",
              border: "1px solid #1f2937",
              borderRadius: 8,
              padding: 12,
              position: "relative",
              zIndex: 0,
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
            <p data-testid="floor-objective">Objective: defeat {state.floorKillTarget} enemies ({state.floorKills}/{state.floorKillTarget}) or find chest 🧰</p>
            {selectedCardId && (
              <p data-testid="target-preview">Target preview: {enemyInRange ? "enemy in range" : "enemy out of range"}</p>
            )}

            <h4>Progression</h4>
            <div style={{ marginBottom: 10 }}>
              <div data-testid="level" style={{ textAlign: "center", fontWeight: 700, marginBottom: 6 }}>
                Level {state.progression.level}
              </div>
              <div
                data-testid="xp"
                style={{
                  height: 12,
                  borderRadius: 999,
                  overflow: "hidden",
                  background: "#111827",
                  border: "1px solid #374151",
                }}
                aria-label={`XP ${state.progression.xp - xpStart}/${xpSpan}`}
                title={`XP ${state.progression.xp - xpStart}/${xpSpan} (total ${state.progression.xp})`}
              >
                <div
                  style={{
                    width: `${xpProgressPct}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, #22c55e 0%, #84cc16 100%)",
                    transition: "width 180ms ease",
                  }}
                />
              </div>
            </div>
            <p data-testid="rank">Rank: {state.progression.rank}</p>
            <p data-testid="kills">Kills: {state.progression.kills}</p>
            <p data-testid="mutation">Mutation: {state.progression.rankMutation ?? "none"}</p>

            {state.progression.rankChoicePending && (
              <div data-testid="rank-up-choice" style={{ margin: "8px 0 12px", padding: 8, borderRadius: 6, border: "1px solid #7c3aed", background: "#1f1133" }}>
                <strong>Rank-Up Available</strong>
                <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                  <button data-testid="rank-choice-battlemage" onClick={() => setState((s) => chooseRankMutation(s, "battlemage"))}>Battlemage (+1 draw each turn)</button>
                  <button data-testid="rank-choice-spellblade" onClick={() => setState((s) => chooseRankMutation(s, "spellblade"))}>Spellblade (+1 AP each turn)</button>
                </div>
              </div>
            )}
          </aside>

          <aside
            data-testid="combat-log-panel"
            style={{
              background: "#0b1220",
              border: "1px solid #1f2937",
              borderRadius: 8,
              padding: 12,
              position: "relative",
              zIndex: 0,
            }}
          >
            <h4 style={{ margin: "0 0 8px" }}>Log</h4>
            <div
              ref={combatLogRef}
              data-testid="combat-log"
              style={{
                maxHeight: 260,
                overflowY: "auto",
                fontSize: 12,
                background: "#030712",
                padding: 8,
                borderRadius: 6,
              }}
            >
              {state.log.slice(-30).map((line, i) => (
                <div key={i}>• {line}</div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
