export type StatusKind = "bleed" | "guard" | "slow";

export type Card = {
  id: string;
  name: string;
  kind: "attack" | "skill" | "spell";
  value: number;
  range: number;
  applyStatus?: { kind: StatusKind; duration: number };
  selfStatus?: { kind: StatusKind; duration: number };
};

export type Item = {
  id: string;
  name: string;
  slot: "mainhand" | "offhand" | "armor";
  cards: string[];
};

export const cards: Card[] = [
  { id: "slash", name: "Slash", kind: "attack", value: 4, range: 1 },
  {
    id: "shield-bash",
    name: "Shield Bash",
    kind: "skill",
    value: 2,
    range: 1,
    applyStatus: { kind: "slow", duration: 1 },
  },
  {
    id: "arc-bolt",
    name: "Arc Bolt",
    kind: "spell",
    value: 3,
    range: 3,
    applyStatus: { kind: "bleed", duration: 2 },
  },
  { id: "lunge", name: "Lunge", kind: "skill", value: 3, range: 2 },
  {
    id: "parry",
    name: "Parry",
    kind: "skill",
    value: 0,
    range: 0,
    selfStatus: { kind: "guard", duration: 1 },
  },
];

export const items: Item[] = [
  { id: "rust-sword", name: "Rust Sword", slot: "mainhand", cards: ["slash", "lunge"] },
  { id: "oak-shield", name: "Oak Shield", slot: "offhand", cards: ["shield-bash", "parry"] },
  { id: "apprentice-robe", name: "Apprentice Robe", slot: "armor", cards: ["arc-bolt"] },
];
