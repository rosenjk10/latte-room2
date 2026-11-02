import { brewPlan } from "./brewing";
export type Animal = "cat" | "rabbit" | "bear" | "dog" | "otter";
export type Drink =
  "espresso" | "americano" | "latte" | "cappuccino" | "vanilla" | "choco";
export type Player = {
  id: string;
  name: string;
  animal: Animal;
  x: number;
  z: number;
  angle: number;
  seat: number | null;
  drink: Drink | null;
  dessert: number | null;
  drinkLevel?: number;
  dessertBites?: number;
  drinkPlaced?: boolean;
  dessertPlaced?: boolean;
  action?: "idle" | "brew" | "drink" | "eat";
  actionAt?: number;
  brewDrink?: Drink;
};
export type Bubble = {
  id: string;
  owner: string;
  x: number;
  z: number;
  born: number;
  size: number;
  seed: number;
  rainbow: boolean;
};
export type Burst = {
  id: string;
  x: number;
  y: number;
  z: number;
  born: number;
  rainbow: boolean;
};
export const MAX_BUBBLES = 50;
export const BUBBLE_LIFE = 10500;
export const COOLDOWN = 1800;
export const ANIMALS: {
  id: Animal;
  label: string;
  emoji: string;
  color: string;
}[] = [
  { id: "cat", label: "고양이", emoji: "🐱", color: "#efd2b6" },
  { id: "rabbit", label: "토끼", emoji: "🐰", color: "#fff3ee" },
  { id: "bear", label: "곰", emoji: "🐻", color: "#ba8c73" },
  { id: "dog", label: "강아지", emoji: "🐶", color: "#e9c49c" },
  { id: "otter", label: "수달", emoji: "🦦", color: "#aa8c72" },
];
export const DRINKS: { id: Drink; label: string; color: string }[] = [
  { id: "espresso", label: "에스프레소", color: "#ede2cc" },
  { id: "americano", label: "아메리카노", color: "#dcede4" },
  { id: "latte", label: "라떼", color: "#fff4e6" },
  { id: "cappuccino", label: "카푸치노", color: "#ddd6f4" },
  { id: "vanilla", label: "바닐라라떼", color: "#f6e4ab" },
  { id: "choco", label: "초코라떼", color: "#f5d9df" },
];
export const DESSERTS = [
  "🍰 딸기 케이크",
  "🍪 초코 쿠키",
  "🧁 컵케이크",
  "🥐 크루아상",
  "🟣 마카롱",
  "🍰 치즈케이크",
];
export const ACTION_DURATION = { brew: 5800, drink: 1100, eat: 1000, idle: 0 };
export function actionDuration(p: Player) {
  return p.action === "brew"
    ? brewPlan(p.brewDrink ?? "latte").duration
    : ACTION_DURATION[p.action ?? "idle"];
}
export function actionProgress(p: Player, now = Date.now()) {
  const duration = actionDuration(p);
  return duration
    ? Math.max(0, Math.min(1, (now - (p.actionAt ?? 0)) / duration))
    : 1;
}
export function consume(p: Player, kind: "drink" | "eat"): Partial<Player> {
  if (kind === "drink")
    return { drinkLevel: Math.max(0, (p.drinkLevel ?? 4) - 1) };
  const bites = Math.max(0, (p.dessertBites ?? 3) - 1);
  return {
    dessertBites: bites,
    ...(bites === 0 ? { dessert: null, dessertPlaced: false } : {}),
  };
}
export const CAMERA_LIMITS = {
  minDistance: 10,
  maxDistance: 26,
  minPolarAngle: 0.28,
  maxPolarAngle: 1.02,
};
export function cameraIsSafe(distance: number, polar: number) {
  return (
    distance >= CAMERA_LIMITS.minDistance &&
    distance <= CAMERA_LIMITS.maxDistance &&
    polar >= CAMERA_LIMITS.minPolarAngle &&
    polar <= CAMERA_LIMITS.maxPolarAngle
  );
}
export const TABLES = [
  [-3, -2.8],
  [0, -2.8],
  [3, -2.8],
  [-3, 1.2],
  [0, 1.2],
  [3, 1.2],
];
export const SEATS = TABLES.flatMap(([x, z]) => [
  { x: x - 0.78, z, angle: Math.PI / 2 },
  { x: x + 0.78, z, angle: -Math.PI / 2 },
]);
export function clampPosition(x: number, z: number) {
  return {
    x: Math.max(-5.1, Math.min(5.1, x)),
    z: Math.max(-4.5, Math.min(4.3, z)),
  };
}
export function bubblePosition(b: Bubble, now: number) {
  const t = Math.max(0, (now - b.born) / 1000);
  return {
    x: b.x + Math.sin(t * 1.35 + b.seed) * 0.38,
    z: b.z + Math.cos(t * 0.9 + b.seed) * 0.24,
    y: 1 + t * 0.34,
  };
}
export function mergeBubbles(
  current: Bubble[],
  incoming: Bubble[],
  now: number,
  popped: Map<string, number>,
) {
  const unique = new Map(
    current
      .filter((b) => now - b.born < BUBBLE_LIFE && !popped.has(b.id))
      .map((b) => [b.id, b]),
  );
  incoming.forEach((b) => {
    if (!popped.has(b.id) && now - b.born < BUBBLE_LIFE && b.born <= now + 3000)
      unique.set(b.id, b);
  });
  return [...unique.values()]
    .sort((a, b) => a.born - b.born || a.id.localeCompare(b.id))
    .slice(-MAX_BUBBLES);
}
export function validBubble(v: unknown): v is Bubble {
  if (!v || typeof v !== "object") return false;
  const b = v as Bubble;
  return (
    typeof b.id === "string" &&
    b.id.length < 120 &&
    typeof b.owner === "string" &&
    b.owner.length < 120 &&
    [b.x, b.z, b.born, b.size, b.seed].every(Number.isFinite) &&
    Math.abs(b.x) < 7 &&
    Math.abs(b.z) < 7 &&
    b.size >= 0.12 &&
    b.size <= 1.2 &&
    typeof b.rainbow === "boolean"
  );
}
export function validPlayer(v: unknown): v is Player {
  if (!v || typeof v !== "object") return false;
  const p = v as Player;
  return (
    typeof p.id === "string" &&
    p.id.length < 120 &&
    typeof p.name === "string" &&
    p.name.length <= 16 &&
    ANIMALS.some((a) => a.id === p.animal) &&
    [p.x, p.z, p.angle].every(Number.isFinite) &&
    Math.abs(p.x) < 7 &&
    Math.abs(p.z) < 7 &&
    (p.seat === null ||
      (Number.isInteger(p.seat) && p.seat >= 0 && p.seat < 12)) &&
    (p.drink === null || DRINKS.some((d) => d.id === p.drink)) &&
    (p.drinkLevel === undefined ||
      (Number.isInteger(p.drinkLevel) &&
        p.drinkLevel >= 0 &&
        p.drinkLevel <= 4)) &&
    (p.dessertBites === undefined ||
      (Number.isInteger(p.dessertBites) &&
        p.dessertBites >= 0 &&
        p.dessertBites <= 3)) &&
    (p.drinkPlaced === undefined || typeof p.drinkPlaced === "boolean") &&
    (p.dessertPlaced === undefined || typeof p.dessertPlaced === "boolean") &&
    (p.action === undefined ||
      ["idle", "brew", "drink", "eat"].includes(p.action)) &&
    (p.brewDrink === undefined || DRINKS.some((d) => d.id === p.brewDrink)) &&
    (p.actionAt === undefined ||
      (Number.isFinite(p.actionAt) && p.actionAt >= 0)) &&
    (p.dessert === null ||
      (Number.isInteger(p.dessert) &&
        p.dessert >= 0 &&
        p.dessert < DESSERTS.length))
  );
}
