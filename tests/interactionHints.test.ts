import { describe, it, expect } from "vitest";
import {
  InteractionHints,
  HINT_DWELL,
  HINT_LIFETIME,
  HINT_REPEAT,
  HINT_DISMISS,
} from "../src/interactionHints";
const book = { kind: "book" as const, id: 0 },
  pot = { kind: "pot" as const, id: 1 };
const start = 1000000;
describe("quiet automatic interaction hints", () => {
  it("requires continuous two-second dwell and resets when leaving", () => {
    const p = new InteractionHints();
    expect(p.tick(1, book, false, start)).toBeNull();
    expect(p.tick(1, book, false, start + 1999)).toBeNull();
    p.tick(1, null, false, start + 2000);
    p.tick(1, book, false, start + 2100);
    expect(p.tick(1, book, false, start + 4099)).toBeNull();
    expect(p.tick(1, book, false, start + 4100)).toEqual(book);
  });
  it("expires at three seconds and prevents repeating the same object for five minutes", () => {
    const p = new InteractionHints();
    p.tick(1, book, false, start);
    const shown = start + HINT_DWELL;
    expect(p.tick(1, book, false, shown)).toEqual(book);
    expect(p.tick(1, book, false, shown + HINT_LIFETIME - 1)).toEqual(book);
    expect(p.tick(1, book, false, shown + HINT_LIFETIME)).toBeNull();
    expect(p.tick(1, book, false, shown + HINT_REPEAT - 1)).toBeNull();
    p.tick(1, book, false, shown + HINT_REPEAT);
    expect(p.tick(1, book, false, shown + HINT_REPEAT + HINT_DWELL)).toEqual(
      book,
    );
  });
  it("does not replace an active hint with another nearby object", () => {
    const p = new InteractionHints();
    p.tick(1, book, false, start);
    p.tick(1, book, false, start + 2000);
    expect(p.tick(1, pot, false, start + 3000)).toEqual(book);
    expect(p.tick(1, pot, false, start + 4999)).toEqual(book);
    expect(p.tick(1, pot, false, start + 5000)).toBeNull();
    expect(p.tick(1, pot, false, start + 7000)).toEqual(pot);
  });
  it("suppresses automatic hints for ten minutes after closing, including manual menus", () => {
    const p = new InteractionHints();
    p.dismiss(1, book, start);
    expect(p.tick(1, book, false, start + HINT_DISMISS - 1)).toBeNull();
    p.tick(1, book, false, start + HINT_DISMISS);
    expect(p.tick(1, book, false, start + HINT_DISMISS + 2000)).toEqual(book);
  });
  it("yields to explicit menus and starts a fresh dwell afterward", () => {
    const p = new InteractionHints();
    p.tick(1, book, false, start);
    expect(p.tick(1, book, true, start + 2000)).toBeNull();
    expect(p.tick(1, book, false, start + 4000)).toBeNull();
    expect(p.tick(1, book, false, start + 6000)).toEqual(book);
  });
  it("isolates rooms and kinds and keeps dismissed objects suppressed on room return", () => {
    const p = new InteractionHints();
    p.dismiss(1, book, start);
    p.tick(2, book, false, start);
    expect(p.tick(2, book, false, start + 2000)).toEqual(book);
    expect(p.tick(1, book, false, start + 3000)).toBeNull();
    expect(p.tick(1, book, false, start + 6000)).toBeNull();
    p.tick(1, { kind: "chair", id: 0 }, false, start + 7000);
    expect(p.tick(1, { kind: "chair", id: 0 }, false, start + 9000)).toEqual({
      kind: "chair",
      id: 0,
    });
  });
});
