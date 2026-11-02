import { describe, it, expect } from "vitest";
import {
  initialNickname,
  randomNickname,
  type NameStorage,
} from "../src/nickname";
import { brewPlan, brewState } from "../src/brewing";
import { createMotion, advanceMotion } from "../src/animation";
import {
  ANIMALS,
  actionDuration,
  validPlayer,
  type Player,
} from "../src/model";
const player: Player = {
  id: "visitor",
  name: "졸린 수달",
  animal: "otter",
  x: 0,
  z: 0,
  angle: 0,
  seat: null,
  drink: null,
  dessert: null,
};
describe("random names are display text, never identity", () => {
  it("produces diverse Korean names within sixteen characters and rerolls even if RNG repeats", () => {
    const names = new Set(
      Array.from({ length: 320 }, (_, i) => randomNickname("", () => i / 320)),
    );
    expect(names.size).toBe(320);
    for (const name of names) expect(name.length).toBeLessThanOrEqual(16);
    const first = randomNickname("", () => 0);
    expect(randomNickname(first, () => 0)).not.toBe(first);
  });
  it("persists the first name across reloads and preserves existing custom names", () => {
    const values = new Map<string, string>();
    const storage: NameStorage = {
      getItem: (k) => values.get(k) ?? null,
      setItem: (k, v) => {
        values.set(k, v);
      },
    };
    const name = initialNickname(storage);
    expect(initialNickname(storage)).toBe(name);
    storage.setItem("latte:name", "기존 이름");
    expect(initialNickname(storage)).toBe("기존 이름");
  });
  it("works when storage is blocked", () => {
    expect(() =>
      initialNickname({
        getItem: () => {
          throw Error("blocked");
        },
        setItem: () => {
          throw Error("blocked");
        },
      }),
    ).not.toThrow();
  });
  it("allows two visitors with equal names and distinct IDs", () => {
    expect(validPlayer(player)).toBe(true);
    expect(validPlayer({ ...player, id: "other" })).toBe(true);
    expect(ANIMALS.map((a) => a.id)).toEqual(
      expect.arrayContaining(["cat", "rabbit", "bear", "dog", "otter"]),
    );
  });
});
describe("shared brewing clock", () => {
  it("uses ordered finite phases and adds steaming only to milk drinks", () => {
    expect(brewPlan("americano").steps.map((s) => s.stage)).toEqual([
      "grind",
      "pump",
      "extract",
      "ready",
    ]);
    expect(brewPlan("latte").steps.map((s) => s.stage)).toEqual([
      "grind",
      "pump",
      "extract",
      "steam",
      "ready",
    ]);
    expect(brewPlan("cappuccino").duration).toBe(5800);
    expect(
      actionDuration({ ...player, action: "brew", brewDrink: "espresso" }),
    ).toBe(4500);
  });
  it("fills only during extraction and stops the stream before steaming", () => {
    expect(brewState("latte", 1800).fill).toBe(0);
    expect(brewState("latte", 3000).fill).toBeCloseTo(0.5);
    expect(brewState("latte", 4100)).toMatchObject({
      stage: "steam",
      fill: 1,
      active: true,
    });
    expect(brewState("latte", 5800).active).toBe(false);
  });
});
describe("frame-independent procedural motion", () => {
  it("alternates front/hind limbs, then eases back to idle", () => {
    const state = createMotion();
    for (let i = 0; i < 60; i++)
      advanceMotion(state, player, 2.4, 1 / 60, i / 60, 0, 0);
    expect(state.walk).toBeGreaterThan(0.9);
    expect(state.leg * state.front).toBeLessThan(0);
    for (let i = 0; i < 120; i++)
      advanceMotion(state, player, 0, 1 / 60, 1 + i / 60, 0, 0);
    expect(state.walk).toBeLessThan(0.001);
    expect(Math.abs(state.leg)).toBeLessThan(0.001);
  });
  it("gives drinking priority over walking and returns the cup after a sip", () => {
    const state = createMotion();
    for (let i = 0; i < 60; i++)
      advanceMotion(state, player, 2.4, 1 / 60, i / 60);
    const sipping = { ...player, action: "drink" as const, actionAt: 1000 };
    for (let i = 0; i < 40; i++)
      advanceMotion(state, sipping, 2.4, 1 / 60, i / 60, 0, 1400);
    expect(state.walk).toBeLessThan(0.001);
    expect(state.lift).toBeGreaterThan(0.7);
    for (let i = 0; i < 60; i++)
      advanceMotion(state, player, 0, 1 / 60, i / 60);
    expect(state.lift).toBeLessThan(0.001);
  });
  it("breathes and blinks without moving across the cafe", () => {
    const state = createMotion();
    advanceMotion(state, player, 0, 1 / 60, 0.08, 0, 0);
    expect(state.blink).toBeLessThan(0.1);
    expect(Math.abs(state.bob)).toBeGreaterThan(0);
    advanceMotion(state, player, 0, 1 / 60, 0.3, 0, 0);
    expect(state.blink).toBe(1);
  });
});
