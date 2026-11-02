import { describe, expect, it } from "vitest";
import {
  BUBBLE_LIFE,
  MAX_BUBBLES,
  SEATS,
  bubblePosition,
  clampPosition,
  mergeBubbles,
  validBubble,
  validPlayer,
  type Bubble,
} from "../src/model";
const now = 1700000000000;
const bubble = (id: string, born = now): Bubble => ({
  id,
  owner: "visitor",
  x: 0,
  z: 0,
  born,
  size: 0.2,
  seed: 2,
  rainbow: false,
});
describe("room bubble lifecycle", () => {
  it("uses deterministic local motion and rises over time", () => {
    const b = bubble("one");
    expect(bubblePosition(b, now + 1000)).toEqual(
      bubblePosition({ ...b }, now + 1000),
    );
    expect(bubblePosition(b, now + 2000).y).toBeGreaterThan(
      bubblePosition(b, now).y,
    );
  });
  it("deduplicates repeated create events", () =>
    expect(
      mergeBubbles([bubble("a")], [bubble("a")], now, new Map()),
    ).toHaveLength(1));
  it("rejects pop-before-create and repeated pop resurrection", () =>
    expect(mergeBubbles([], [bubble("a")], now, new Map([["a", now]]))).toEqual(
      [],
    ));
  it("expires old bubbles and rejects far-future events", () =>
    expect(
      mergeBubbles(
        [],
        [bubble("old", now - BUBBLE_LIFE), bubble("future", now + 5000)],
        now,
        new Map(),
      ),
    ).toEqual([]));
  it("caps and deterministically evicts to fifty per room", () => {
    const batch = Array.from({ length: 80 }, (_, i) =>
      bubble(String(i), now + i),
    );
    const a = mergeBubbles([], batch, now + 100, new Map());
    const b = mergeBubbles([], batch.reverse(), now + 100, new Map());
    expect(a).toHaveLength(MAX_BUBBLES);
    expect(a).toEqual(b);
  });
  it("validates network payloads including finite coordinates and size", () => {
    expect(validBubble(bubble("a"))).toBe(true);
    expect(validBubble({ ...bubble("b"), x: NaN })).toBe(false);
    expect(validBubble({ ...bubble("b"), size: 1000 })).toBe(false);
    expect(validBubble(null)).toBe(false);
  });
});
describe("cafe world", () => {
  it("has twelve usable distinct seats", () => {
    expect(SEATS).toHaveLength(12);
    expect(new Set(SEATS.map((s) => `${s.x}/${s.z}`)).size).toBe(12);
  });
  it("keeps players inside the cafe", () =>
    expect(clampPosition(900, -900)).toEqual({ x: 5.1, z: -4.5 }));
  it("rejects malformed player actions and accepts valid visitors", () => {
    const p = {
      id: "a",
      name: "방문자",
      animal: "cat",
      x: 0,
      z: 0,
      angle: 0,
      seat: null,
      drink: null,
      dessert: null,
    };
    expect(validPlayer(p)).toBe(true);
    expect(validPlayer({ ...p, seat: 12 })).toBe(false);
    expect(validPlayer({ ...p, drink: "bogus" })).toBe(false);
    expect(validPlayer({ ...p, x: Infinity })).toBe(false);
  });
});
