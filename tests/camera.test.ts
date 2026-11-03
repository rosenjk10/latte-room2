import { describe, it, expect, vi } from "vitest";
import { viewDirection, THIRD_PITCH, loadCameraMode } from "../src/camera";
import { cameraPosition } from "../src/world";
describe("third-person camera only", () => {
  it("normalizes old first-person preferences without offering another mode", () => {
    const storage = new Map([["latte:camera-mode", "first"]]);
    vi.stubGlobal("localStorage", {
      setItem: (k: string, v: string) => storage.set(k, v),
    });
    try {
      expect(loadCameraMode()).toBe("third");
      expect(storage.get("latte:camera-mode")).toBe("third");
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("keeps orbit direction finite and normalized within the low camera bounds", () => {
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2])
      for (const pitch of [
        THIRD_PITCH.min,
        THIRD_PITCH.initial,
        THIRD_PITCH.max,
      ]) {
        const d = viewDirection(yaw, pitch);
        expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(1);
        expect(d.y).toBeGreaterThan(-0.7);
      }
  });
  it("shortens the arm before walls and furniture", () => {
    expect(
      cameraPosition({ x: 0, y: 0.93, z: -4.5 }, { x: 0, y: 1.2, z: -7 }, 1).z,
    ).toBeGreaterThan(-5);
    expect(
      cameraPosition({ x: 0, y: 0.7, z: 3.4 }, { x: 0, y: 0.7, z: 0 }, 1).z,
    ).toBeGreaterThan(1.8);
  });
});
