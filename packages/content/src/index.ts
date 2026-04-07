export type StatusKind = "bleed" | "guard" | "slow";

export type ClassId = "warden" | "vanguard" | "stalker";

export type Card = {
  id: string;
  name: string;
  kind: "attack" | "skill" | "spell";
  value: number;
  range: number;
  allowedClasses?: ClassId[];
  applyStatus?: { kind: StatusKind; duration: number };
  selfStatus?: { kind: StatusKind; duration: number };
};

export type Item = {
  id: string;
  name: string;
  slot: "mainhand" | "offhand" | "armor";
  allowedClasses?: ClassId[];
  cards: string[];
};

export type ClassLoadout = {
  id: ClassId;
  name: string;
  baseCards: string[];
  items: string[];
};

export const cards: Card[] = [
  { id: "slash", name: "Slash", kind: "attack", value: 4, range: 1, allowedClasses: ["warden", "stalker"] },
  { id: "cleave", name: "Cleave", kind: "attack", value: 5, range: 1, allowedClasses: ["vanguard"] },
  {
    id: "shield-bash",
    name: "Shield Bash",
    kind: "skill",
    value: 2,
    range: 1,
    allowedClasses: ["warden", "vanguard", "stalker"],
    applyStatus: { kind: "slow", duration: 1 },
  },
  {
    id: "arc-bolt",
    name: "Arc Bolt",
    kind: "spell",
    value: 3,
    range: 3,
    allowedClasses: ["warden", "vanguard"],
    applyStatus: { kind: "bleed", duration: 2 },
  },
  {
    id: "venom-dart",
    name: "Venom Dart",
    kind: "spell",
    value: 2,
    range: 3,
    allowedClasses: ["stalker"],
    applyStatus: { kind: "bleed", duration: 3 },
  },
  { id: "lunge", name: "Lunge", kind: "skill", value: 3, range: 2, allowedClasses: ["warden", "vanguard", "stalker"] },
  {
    id: "parry",
    name: "Parry",
    kind: "skill",
    value: 0,
    range: 0,
    allowedClasses: ["warden", "stalker"],
    selfStatus: { kind: "guard", duration: 1 },
  },
  {
    id: "bulwark",
    name: "Bulwark",
    kind: "skill",
    value: 0,
    range: 0,
    allowedClasses: ["vanguard"],
    selfStatus: { kind: "guard", duration: 2 },
  },
  { id: "basic-strike", name: "Basic Strike", kind: "attack", value: 2, range: 1 },
  { id: "basic-bolt", name: "Basic Bolt", kind: "spell", value: 2, range: 2 },
  { id: "basic-guard", name: "Basic Guard", kind: "skill", value: 0, range: 0, selfStatus: { kind: "guard", duration: 1 } },
  { id: "basic-jab", name: "Basic Jab", kind: "attack", value: 2, range: 1 },
  { id: "basic-stance", name: "Basic Stance", kind: "skill", value: 0, range: 0 },
];

export const items: Item[] = [
  { id: "rust-sword", name: "Rust Sword", slot: "mainhand", allowedClasses: ["warden", "stalker"], cards: ["slash", "lunge"] },
  { id: "oak-shield", name: "Oak Shield", slot: "offhand", allowedClasses: ["warden", "stalker"], cards: ["shield-bash", "parry"] },
  { id: "apprentice-robe", name: "Apprentice Robe", slot: "armor", allowedClasses: ["warden", "vanguard"], cards: ["arc-bolt"] },

  { id: "iron-greatsword", name: "Iron Greatsword", slot: "mainhand", allowedClasses: ["vanguard"], cards: ["cleave", "lunge"] },
  { id: "tower-shield", name: "Tower Shield", slot: "offhand", allowedClasses: ["vanguard"], cards: ["shield-bash", "bulwark"] },
  { id: "venom-cloak", name: "Venom Cloak", slot: "armor", allowedClasses: ["stalker"], cards: ["venom-dart"] },
];

export const classes: ClassLoadout[] = [
  { id: "warden", name: "Warden", baseCards: ["slash", "shield-bash", "arc-bolt"], items: ["rust-sword", "oak-shield", "apprentice-robe"] },
  { id: "vanguard", name: "Vanguard", baseCards: ["cleave", "shield-bash", "bulwark"], items: ["iron-greatsword", "tower-shield", "apprentice-robe"] },
  { id: "stalker", name: "Stalker", baseCards: ["slash", "venom-dart", "parry"], items: ["rust-sword", "oak-shield", "venom-cloak"] },
];
