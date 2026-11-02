import { describe, it, expect } from "vitest";
import {
  consume,
  actionProgress,
  CAMERA_LIMITS,
  cameraIsSafe,
  validPlayer,
  type Player,
} from "../src/model";
import { cameraPosition } from "../src/world";
import { validateMemo } from "../src/guestbook";
const p: Player = {
  id: "a",
  name: "손님",
  animal: "cat",
  x: 0,
  z: 0,
  angle: 0,
  seat: null,
  drink: "espresso",
  drinkLevel: 4,
  dessert: 4,
  dessertBites: 3,
};
describe("consumable state and backwards-compatible multiplayer", () => {
  it("takes four sips to empty a cup without discarding it", () => {
    let next = { ...p };
    for (let i = 0; i < 6; i++) next = { ...next, ...consume(next, "drink") };
    expect(next.drinkLevel).toBe(0);
    expect(next.drink).toBe("espresso");
  });
  it("cleans up dessert and plate after three bites", () => {
    let next = { ...p, dessertPlaced: true };
    for (let i = 0; i < 3; i++) next = { ...next, ...consume(next, "eat") };
    expect(next.dessert).toBeNull();
    expect(next.dessertPlaced).toBe(false);
  });
  it("uses action timestamps for synchronized animation", () => {
    expect(
      actionProgress({ ...p, action: "drink", actionAt: 1000 }, 1550),
    ).toBe(0.5);
    expect(actionProgress({ ...p, action: "drink", actionAt: 1000 }, 999)).toBe(
      0,
    );
  });
  it("accepts old peers and rejects invalid new action payloads", () => {
    expect(validPlayer(p)).toBe(true);
    expect(validPlayer({ ...p, action: "hack" })).toBe(false);
    expect(validPlayer({ ...p, drinkLevel: 200 })).toBe(false);
    expect(validPlayer({ ...p, dessertPlaced: "yes" })).toBe(false);
    expect(validPlayer({ ...p, actionAt: NaN })).toBe(false);
  });
});
describe("camera safety envelope", () => {
  it("supports low views while camera collision stays above the floor", () => {
    const safe = cameraPosition(
      { x: 0, y: 0.95, z: 3.4 },
      { x: 0, y: -3, z: 4.4 },
      1,
    );
    expect(safe.y).toBeGreaterThanOrEqual(0.32);
    expect(CAMERA_LIMITS.minDistance).toBeLessThan(1);
    expect(cameraIsSafe(0.8, 1.5)).toBe(true);
  });
});
describe("guestbook client validation", () => {
  it("checks unicode length, spam and forbidden words, leaving text escaping to React", () => {
    expect(validateMemo("손님", "따뜻한 오후")).toBeNull();
    expect(validateMemo("손님", "가".repeat(101))).toBeTruthy();
    expect(validateMemo("손님", "www.example.com")).toBeTruthy();
    expect(validateMemo("손님", "!!!!!!")).toBeTruthy();
    expect(validateMemo("손님", "<b>쉬어가요</b>")).toBeNull();
  });
});
