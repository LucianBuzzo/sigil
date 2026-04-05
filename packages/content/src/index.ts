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

export type ClassLoadout = {
  id: string;
  name: string;
  items: string[];
};

export const cards: Card[] = [
  { id: "slash", name: "Slash", kind: "attack", value: 4, range: 1 },
  { id: "cleave", name: "Cleave", kind: "attack", value: 5, range: 1 },
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
  {
    id: "venom-dart",
    name: "Venom Dart",
    kind: "spell",
    value: 2,
    range: 3,
    applyStatus: { kind: "bleed", duration: 3 },
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
  {
    id: "bulwark",
    name: "Bulwark",
    kind: "skill",
    value: 0,
    range: 0,
    selfStatus: { kind: "guard", duration: 2 },
  },
];

export const items: Item[] = [
  { id: "rust-sword", name: "Rust Sword", slot: "mainhand", cards: ["slash", "lunge"] },
  { id: "oak-shield", name: "Oak Shield", slot: "offhand", cards: ["shield-bash", "parry"] },
  { id: "apprentice-robe", name: "Apprentice Robe", slot: "armor", cards: ["arc-bolt"] },

  { id: "iron-greatsword", name: "Iron Greatsword", slot: "mainhand", cards: ["cleave", "lunge"] },
  { id: "tower-shield", name: "Tower Shield", slot: "offhand", cards: ["shield-bash", "bulwark"] },
  { id: "venom-cloak", name: "Venom Cloak", slot: "armor", cards: ["venom-dart"] },
];

export const classes: ClassLoadout[] = [
  { id: "warden", name: "Warden", items: ["rust-sword", "oak-shield", "apprentice-robe"] },
  { id: "vanguard", name: "Vanguard", items: ["iron-greatsword", "tower-shield", "apprentice-robe"] },
  { id: "stalker", name: "Stalker", items: ["rust-sword", "oak-shield", "venom-cloak"] },
];
