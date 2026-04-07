import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  chooseRankMutation,
  chooseReward,
  createNewGame,
  createStarterDeckConfig,
  endTurn,
  getCardRangeTiles,
  moveHero,
  playCard,
  selectActiveAlly,
  selectEnemyTarget,
  type RewardChoice,
} from "@sigil/core";
import { cards, classes, items } from "@sigil/content";

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

const initialSeedFromUrl = () => {
  const v = Number(new URLSearchParams(window.location.search).get("seed") ?? "1");
  return Number.isFinite(v) ? Math.max(1, Math.floor(v)) : 1;
};

type PlayerClassId = "warden" | "vanguard" | "stalker";

export function App() {
  const [selectedClassId, setSelectedClassId] = useState<PlayerClassId>("warden");
  const [seedInput, setSeedInput] = useState<number>(() => initialSeedFromUrl());
  const [deckConfig, setDeckConfig] = useState(() => createStarterDeckConfig("warden"));
  const [state, setState] = useState(() => createNewGame(initialSeedFromUrl(), "warden", createStarterDeckConfig("warden").activeDeckCardCounts));
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [drawnCardIds, setDrawnCardIds] = useState<Set<string>>(new Set());
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const prevHandRef = useRef<string[]>([]);
  const combatLogRef = useRef<HTMLDivElement | null>(null);
  const prevEnemyHpRef = useRef<Map<string, number>>(new Map(state.enemies.map((e) => [e.id, e.hp])));
  const prevPartyHpRef = useRef<Map<string, number>>(new Map(state.party.map((a) => [a.id, a.hp])));
  const floatIdRef = useRef<number>(1);

  const activeAlly = useMemo(() => state.party.find((a) => a.id === state.activeAllyId) ?? null, [state.party, state.activeAllyId]);

  const handInstanceIds = useMemo(
    () => (activeAlly ? activeAlly.hand.map((c, i) => `${c.id}-${i}`) : []),
    [activeAlly]
  );

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
      if (!Number.isInteger(n) || n < 1 || n > 7 || !activeAlly) return;
      const card = activeAlly.hand[n - 1];
      if (!card) return;
      onCardClick(card.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeAlly, selectedCardId, state.phase]);

  useEffect(() => {
    const el = combatLogRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [state.log.length]);

  useEffect(() => {
    const prev = prevEnemyHpRef.current;
    const current = new Map(state.enemies.map((e) => [e.id, e.hp]));

    state.enemies.forEach((enemy) => {
      const prevHp = prev.get(enemy.id);
      if (typeof prevHp === "number" && enemy.hp < prevHp) {
        const id = floatIdRef.current++;
        setFloatingTexts((p) => [...p, { id, value: String(prevHp - enemy.hp), x: enemy.x, y: enemy.y }]);
        const t = setTimeout(() => setFloatingTexts((p) => p.filter((f) => f.id !== id)), 950);
        return () => clearTimeout(t);
      }
    });

    prevEnemyHpRef.current = current;
  }, [state.enemies]);

  useEffect(() => {
    const prev = prevPartyHpRef.current;
    const current = new Map(state.party.map((a) => [a.id, a.hp]));

    state.party.forEach((ally) => {
      const prevHp = prev.get(ally.id);
      if (typeof prevHp === "number" && ally.hp < prevHp) {
        const id = floatIdRef.current++;
        setFloatingTexts((p) => [...p, { id, value: String(prevHp - ally.hp), x: ally.x, y: ally.y }]);
        const t = setTimeout(() => setFloatingTexts((p) => p.filter((f) => f.id !== id)), 950);
        return () => clearTimeout(t);
      }
    });

    prevPartyHpRef.current = current;
  }, [state.party]);

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

  const selectedEnemy = state.enemies.find((e) => e.id === state.selectedEnemyId) ?? state.enemies[0] ?? null;

  const enemyInRange = useMemo(() => {
    if (!selectedCardId || !selectedEnemy) return false;
    return inRangeTiles.has(`${selectedEnemy.x},${selectedEnemy.y}`);
  }, [selectedCardId, inRangeTiles, selectedEnemy]);

  useEffect(() => {
    setDeckConfig(createStarterDeckConfig(selectedClassId));
  }, [selectedClassId]);

  const activeDeckSize = useMemo(
    () => Object.values(deckConfig.activeDeckCardCounts).reduce((a, b) => a + b, 0),
    [deckConfig.activeDeckCardCounts]
  );

  const cardSourceById = useMemo(() => {
    const selected = classes.find((c) => c.id === selectedClassId);
    const classBase = new Set(selected?.baseCards ?? []);
    const classItems = new Set(selected?.items ?? []);
    const itemCardMap = new Map<string, string>();
    items.forEach((item) => item.cards.forEach((cardId) => itemCardMap.set(cardId, item.id)));

    const out = new Map<string, string>();
    cards.forEach((card) => {
      if (classBase.has(card.id)) {
        out.set(card.id, "class");
        return;
      }
      const itemId = itemCardMap.get(card.id);
      if (itemId && classItems.has(itemId)) {
        out.set(card.id, "gear");
        return;
      }
      if (card.id.startsWith("basic-")) {
        out.set(card.id, "neutral");
        return;
      }
      out.set(card.id, "unlocked");
    });
    return out;
  }, [selectedClassId]);

  const ownedCardRows = useMemo(
    () => Object.entries(deckConfig.ownedCardCounts)
      .map(([id, owned]) => ({
        id,
        owned,
        active: deckConfig.activeDeckCardCounts[id] ?? 0,
        name: cards.find((c) => c.id === id)?.name ?? id,
        source: cardSourceById.get(id) ?? "unknown",
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [deckConfig, cardSourceById]
  );

  const deckWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (activeDeckSize < deckConfig.deckRules.minSize) {
      warnings.push(`Deck below minimum size (${activeDeckSize}/${deckConfig.deckRules.minSize}).`);
    }

    const overCap = Object.entries(deckConfig.activeDeckCardCounts).filter(([, count]) => count > deckConfig.deckRules.maxCopies);
    if (overCap.length) {
      warnings.push(`Some cards exceed copy cap (${deckConfig.deckRules.maxCopies}).`);
    }

    if (!deckConfig.classLockOverrides.allowOffClassCards) {
      const offClass = Object.entries(deckConfig.activeDeckCardCounts).some(([id, count]) => {
        if (count <= 0) return false;
        const card = cards.find((c) => c.id === id);
        return !!(card?.allowedClasses && !card.allowedClasses.includes(selectedClassId));
      });
      if (offClass) warnings.push("Deck contains off-class cards while class lock is strict.");
    }

    return warnings;
  }, [activeDeckSize, deckConfig, selectedClassId]);

  const setActiveCardCopies = (cardId: string, nextCount: number) => {
    setDeckConfig((cfg) => {
      const owned = cfg.ownedCardCounts[cardId] ?? 0;
      const clamped = Math.max(0, Math.min(nextCount, owned, cfg.deckRules.maxCopies));
      const next = { ...cfg.activeDeckCardCounts, [cardId]: clamped };
      if (clamped === 0) delete next[cardId];
      return { ...cfg, activeDeckCardCounts: next };
    });
  };

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
  const shouldPulseEndTurn = state.phase === "hero" && (activeAlly?.ap.current ?? 0) <= 0;

  return (
    <div data-testid="app-root" style={{ padding: 16 }}>
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
                <button data-testid="new-run" onClick={() => setState(createNewGame(seedInput, selectedClassId, deckConfig.activeDeckCardCounts))}>
                  Start New Run
                </button>
              </div>
            )}

            <div data-testid="battle-grid" style={{ display: "inline-block", border: "1px solid #374151", background: "#0b1220", padding: 4 }}>
              {grid.map((row, y) => (
                <div key={y} style={{ display: "flex" }}>
                  {row.map((kind, x) => {
                    const ally = state.party.find((a) => a.hp > 0 && a.x === x && a.y === y);
                    const enemy = state.enemies.find((e) => e.hp > 0 && e.x === x && e.y === y);
                    const isChest = state.chest.x === x && state.chest.y === y;
                    const inRange = inRangeTiles.has(`${x},${y}`);
                    return (
                      <button
                        key={`${x}-${y}`}
                        data-testid={`tile-${x}-${y}`}
                        aria-label={`tile-${x}-${y}-${kind}`}
                        onClick={() => enemy && setState((s) => selectEnemyTarget(s, enemy.id))}
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
                          cursor: enemy ? "pointer" : "default",
                          padding: 0,
                        }}
                      >
                        {ally ? (ally.id === state.activeAllyId ? "🧙" : "🧝") : enemy ? "💀" : isChest ? "🧰" : ""}
                        {enemy && enemy.id === state.selectedEnemyId && (
                          <span data-testid={`enemy-selected-${enemy.id}`} style={{ position: "absolute", top: -8, right: -6, fontSize: 11 }}>🎯</span>
                        )}
                        {floatingTexts
                          .filter((f) => f.x === x && f.y === y)
                          .map((f) => (
                            <span key={f.id} style={{ position: "absolute", color: "#fca5a5", fontWeight: 900 }}>{f.value}</span>
                          ))}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <div data-testid="movement-controls" style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button data-testid="move-up" onClick={() => setState((s) => moveHero(s, 0, -1))}>↑</button>
              <button data-testid="move-left" onClick={() => setState((s) => moveHero(s, -1, 0))}>←</button>
              <button data-testid="move-right" onClick={() => setState((s) => moveHero(s, 1, 0))}>→</button>
              <button data-testid="move-down" onClick={() => setState((s) => moveHero(s, 0, 1))}>↓</button>
              <button data-testid="end-turn" onClick={() => setState((s) => endTurn(s))} className={shouldPulseEndTurn ? "end-turn-pulse" : ""}>
                End Turn
              </button>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.9 }}>Class</span>
                <select data-testid="class-select" value={selectedClassId} onChange={(e) => setSelectedClassId(e.currentTarget.value as PlayerClassId)}>
                  <option value="warden">Warden</option>
                  <option value="vanguard">Vanguard</option>
                  <option value="stalker">Stalker</option>
                </select>
              </label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.9 }}>Seed</span>
                <input data-testid="seed-input" type="number" min={1} value={seedInput} onChange={(e) => setSeedInput(Math.max(1, Number(e.currentTarget.value) || 1))} style={{ width: 90 }} />
              </label>
              <button data-testid="new-seed" onClick={() => {
                const s = Math.max(1, Math.floor(Math.random() * 100000));
                setSeedInput(s);
                setState(createNewGame(s, selectedClassId, deckConfig.activeDeckCardCounts));
              }}>New Seed</button>
              <button data-testid="start-run" onClick={() => setState(createNewGame(seedInput, selectedClassId, deckConfig.activeDeckCardCounts))} disabled={activeDeckSize < deckConfig.deckRules.minSize}>Start Run</button>
            </div>
          </section>

          <section data-testid="deck-builder" style={{ border: "1px solid #1f2937", borderRadius: 8, padding: 10, background: "#0b1220" }}>
            <h4 style={{ margin: "0 0 8px" }}>Deck Builder</h4>
            <p style={{ margin: "0 0 8px", fontSize: 12, opacity: 0.9 }}>
              Active deck: {activeDeckSize}/{deckConfig.deckRules.minSize} minimum (max {deckConfig.deckRules.maxCopies} copies per card)
            </p>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <button
                data-testid="deck-reset-starter"
                onClick={() => {
                  const starter = createStarterDeckConfig(selectedClassId);
                  setDeckConfig(starter);
                }}
              >
                Reset to Starter Deck
              </button>
            </div>
            {deckWarnings.length > 0 && (
              <div data-testid="deck-warnings" style={{ border: "1px solid #f59e0b", background: "#2a1f06", borderRadius: 6, padding: 8, marginBottom: 8 }}>
                {deckWarnings.map((w, i) => <div key={i}>⚠️ {w}</div>)}
              </div>
            )}
            <div style={{ display: "grid", gap: 6, maxHeight: 220, overflowY: "auto" }}>
              {ownedCardRows.map((row) => (
                <div key={row.id} data-testid={`deck-card-${row.id}`} style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto auto", gap: 8, alignItems: "center" }}>
                  <span>{row.name}</span>
                  <small style={{ opacity: 0.8 }}>{row.source}</small>
                  <small>owned {row.owned}</small>
                  <button data-testid={`deck-minus-${row.id}`} onClick={() => setActiveCardCopies(row.id, row.active - 1)}>-</button>
                  <div style={{ minWidth: 70, textAlign: "right" }}>
                    <strong>{row.active}</strong>
                    <button data-testid={`deck-plus-${row.id}`} style={{ marginLeft: 8 }} onClick={() => setActiveCardCopies(row.id, row.active + 1)}>+</button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section data-testid="ally-controls" style={{ border: "1px solid #1f2937", borderRadius: 8, padding: 10, background: "#0b1220" }}>
            <h4 style={{ margin: "0 0 8px" }}>Party</h4>
            <div style={{ display: "grid", gap: 8 }}>
              {state.party.map((ally, i) => (
                <button
                  key={ally.id}
                  data-testid={`ally-select-${ally.id}`}
                  onClick={() => setState((s) => selectActiveAlly(s, ally.id))}
                  style={{
                    textAlign: "left",
                    border: ally.id === state.activeAllyId ? "2px solid #f59e0b" : "1px solid #374151",
                    borderRadius: 6,
                    background: ally.hp > 0 ? "#111827" : "#330f0f",
                    color: "#e5e7eb",
                    padding: 8,
                  }}
                >
                  <strong>{ally.name}</strong> #{i + 1} — HP {ally.hp}/{ally.maxHp} | AP {ally.ap.current}/{ally.ap.max} | Deck {ally.deck.length} | Hand {ally.hand.length} | Discard {ally.discard.length}
                </button>
              ))}
            </div>
          </section>

          <section data-testid="hand-bottom-row" style={{ border: "1px solid #1f2937", borderRadius: 10, background: "linear-gradient(180deg, #0b1220 0%, #070b14 100%)", padding: 10 }}>
            <h4 style={{ margin: "0 0 8px" }}>Active Hand (press 1–7)</h4>
            <div data-testid="hand" style={{ display: "flex", gap: 10, overflowX: "auto", paddingTop: 8, paddingBottom: 30 }}>
              {(activeAlly?.hand ?? []).map((c, i) => {
                const instanceId = `${c.id}-${i}`;
                const isSelected = selectedCardId === c.id;
                const accent = cardKindColors[c.kind] ?? "#6b7280";
                return (
                  <button
                    key={instanceId}
                    className={drawnCardIds.has(instanceId) ? "card-enter" : ""}
                    data-testid={`card-${c.id}-${i}`}
                    onClick={() => onCardClick(c.id)}
                    style={{ minWidth: 180, maxWidth: 180, textAlign: "left", borderRadius: 12, border: `2px solid ${isSelected ? "#f59e0b" : "#374151"}`, background: "#111827", color: "#e5e7eb", padding: 0 }}
                  >
                    <div style={{ height: 22, background: accent, borderTopLeftRadius: 10, borderTopRightRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 8px", fontSize: 10, fontWeight: 800 }}>
                      <span>{c.kind.toUpperCase()}</span><span>#{i + 1}</span>
                    </div>
                    <div style={{ padding: 8 }}>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>{c.name}</div>
                      <div style={{ marginTop: 6, height: 110, borderRadius: 8, border: "1px solid #374151", overflow: "hidden" }}>
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
                    </div>
                  </button>
                );
              })}
              {(activeAlly?.hand.length ?? 0) === 0 && <small>No cards in hand</small>}
            </div>
          </section>
        </div>

        <div data-testid="right-sidebar" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <aside data-testid="combat-panel" style={{ background: "#0b1220", border: "1px solid #1f2937", borderRadius: 8, padding: 12 }}>
            <h3>Combat</h3>
            <p data-testid="turn">Turn: {state.turn}</p>
            <p data-testid="floor">Floor: {state.floor}</p>
            <p data-testid="phase">Phase: {state.phase}</p>
            <p data-testid="ap">AP: {activeAlly?.ap.current ?? 0}/{activeAlly?.ap.max ?? 0}</p>
            <p data-testid="active-ally">Active Ally: {activeAlly?.name ?? "none"}</p>
            <p data-testid="party-status">Party alive: {state.party.filter((a) => a.hp > 0).length}/{state.party.length}</p>
            <div data-testid="party-readout">
              {state.party.map((ally) => (
                <p key={ally.id} data-testid={`ally-hp-${ally.id}`}>{ally.name} HP: {ally.hp}/{ally.maxHp}</p>
              ))}
            </div>
            <p data-testid="enemy-count">Enemies: {state.enemies.length}</p>
            <div data-testid="enemy-list">
              {state.enemies.map((enemy) => (
                <button key={enemy.id} data-testid={`enemy-select-${enemy.id}`} onClick={() => setState((s) => selectEnemyTarget(s, enemy.id))} style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 4 }}>
                  {enemy.id === state.selectedEnemyId ? "🎯 " : ""}{enemy.name} ({enemy.hp}/{enemy.maxHp})
                </button>
              ))}
            </div>
            {selectedEnemy && <p data-testid="enemy-hp">Enemy HP: {selectedEnemy.hp}/{selectedEnemy.maxHp}</p>}
            <p data-testid="floor-objective">Objective: defeat {state.floorKillTarget} enemies ({state.floorKills}/{state.floorKillTarget}) or find chest 🧰</p>
            {selectedCardId && <p data-testid="target-preview">Target preview: {enemyInRange ? "enemy in range" : "enemy out of range"}</p>}

            <h4>Progression</h4>
            <div style={{ marginBottom: 10 }}>
              <div data-testid="level" style={{ textAlign: "center", fontWeight: 700, marginBottom: 6 }}>Level {state.progression.level}</div>
              <div data-testid="xp" style={{ height: 12, borderRadius: 999, overflow: "hidden", background: "#111827", border: "1px solid #374151" }}>
                <div style={{ width: `${xpProgressPct}%`, height: "100%", background: "linear-gradient(90deg, #22c55e 0%, #84cc16 100%)" }} />
              </div>
            </div>
            <p data-testid="rank">Rank: {state.progression.rank}</p>
            <p data-testid="kills">Kills: {state.progression.kills}</p>
            <p data-testid="mutation">Mutation: {state.progression.rankMutation ?? "none"}</p>
            <p data-testid="deck-active-size">Deck size: {Object.values(state.activeDeckCardCounts).reduce((a, b) => a + b, 0)} (min {state.deckRules.minSize})</p>
            <p data-testid="deck-owned-size">Owned cards: {Object.values(state.ownedCardCounts).reduce((a, b) => a + b, 0)}</p>
            <p data-testid="deck-lock-state">Class lock: {state.classLockOverrides.allowOffClassCards || state.classLockOverrides.allowOffClassGear ? "override enabled" : "strict"}</p>

            {state.progression.rankChoicePending && (
              <div data-testid="rank-up-choice" style={{ margin: "8px 0 12px", padding: 8, borderRadius: 6, border: "1px solid #7c3aed", background: "#1f1133" }}>
                <strong>Rank-Up Available</strong>
                <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                  <button data-testid="rank-choice-battlemage" onClick={() => setState((s) => chooseRankMutation(s, "battlemage"))}>Battlemage (+1 draw each turn)</button>
                  <button data-testid="rank-choice-spellblade" onClick={() => setState((s) => chooseRankMutation(s, "spellblade"))}>Spellblade (+1 AP each turn)</button>
                  <button data-testid="rank-choice-reaper" onClick={() => setState((s) => chooseRankMutation(s, "reaper"))}>Reaper (+1 attack damage)</button>
                </div>
              </div>
            )}
          </aside>

          <aside data-testid="combat-log-panel" style={{ background: "#0b1220", border: "1px solid #1f2937", borderRadius: 8, padding: 12 }}>
            <h4 style={{ margin: "0 0 8px" }}>Log</h4>
            <div ref={combatLogRef} data-testid="combat-log" style={{ maxHeight: 260, overflowY: "auto", fontSize: 12, background: "#030712", padding: 8, borderRadius: 6 }}>
              {state.log.slice(-30).map((line, i) => <div key={i}>• {line}</div>)}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
