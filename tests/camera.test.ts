import { describe, it, expect } from "vitest";
import { relativeMovement, viewDirection, PITCH_LIMIT } from "../src/camera";
import { cameraPosition } from "../src/world";
describe("character camera", () => {
  it("maps forward, backward and strafing to the viewing direction", () => {
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const forward = relativeMovement(0, -1, yaw),
        d = viewDirection(yaw, 0);
      expect(forward.x).toBeCloseTo(d.x);
      expect(forward.z).toBeCloseTo(d.z);
      const back = relativeMovement(0, 1, yaw),
        right = relativeMovement(1, 0, yaw);
      expect(back.x).toBeCloseTo(-d.x);
      expect(back.z).toBeCloseTo(-d.z);
      expect(right.x * d.x + right.z * d.z).toBeCloseTo(0);
    }
  });
  it("can look at floor/ceiling without flipping", () => {
    expect(viewDirection(1, PITCH_LIMIT).y).toBeGreaterThan(0.97);
    expect(viewDirection(1, -PITCH_LIMIT).y).toBeLessThan(-0.97);
  });
  it("shortens the shoulder camera arm before the back wall and furniture", () => {
    const anchor = { x: 0, y: 0.93, z: -4.5 };
    const wall = cameraPosition(anchor, { x: 0, y: 1.2, z: -7 }, 1);
    expect(wall.z).toBeGreaterThan(-5);
    const table = cameraPosition(
      { x: 0, y: 0.7, z: 3.4 },
      { x: 0, y: 0.7, z: 0 },
      1,
    );
    expect(table.z).toBeGreaterThan(1.8);
  });
});
