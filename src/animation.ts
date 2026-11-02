import { actionProgress, type Player } from "./model";
export type MotionState = {
  walk: number;
  phase: number;
  lift: number;
  eatLift: number;
  bob: number;
  blink: number;
  leg: number;
  front: number;
};
export const createMotion = (): MotionState => ({
  walk: 0,
  phase: 0,
  lift: 0,
  eatLift: 0,
  bob: 0,
  blink: 1,
  leg: 0,
  front: 0,
});
const damp = (a: number, b: number, rate: number, dt: number) =>
  a + (b - a) * (1 - Math.exp(-rate * dt));
export function advanceMotion(
  state: MotionState,
  p: Player,
  speed: number,
  dt: number,
  seconds: number,
  seed = 0,
  now = Date.now(),
) {
  dt = Math.min(0.05, Math.max(0, dt));
  const consuming =
    (p.action === "drink" ||
      p.action === "eat" ||
      p.action === "water" ||
      p.action === "sit") &&
    actionProgress(p, now) < 1;
  state.walk = damp(
    state.walk,
    p.seat === null && speed > 0.07 && !consuming
      ? Math.min(1, speed / 2.4)
      : 0,
    12,
    dt,
  );
  state.phase =
    (state.phase +
      dt *
        (p.animal === "bear" ? 8 : p.animal === "rabbit" ? 11 : 9) *
        Math.max(0.3, Math.min(1.3, speed / 2.4))) %
    (Math.PI * 2);
  const stride = Math.sin(state.phase) * state.walk;
  state.leg = stride * (p.animal === "rabbit" ? 0.5 : 0.4);
  state.front = -stride * 0.15;
  const lift = Math.sin(actionProgress(p, now) * Math.PI);
  state.lift = damp(state.lift, p.action === "drink" ? lift : 0, 20, dt);
  state.eatLift = damp(state.eatLift, p.action === "eat" ? lift : 0, 20, dt);
  state.bob =
    Math.abs(Math.sin(state.phase)) *
      state.walk *
      (p.animal === "rabbit" ? 0.035 : 0.018) +
    Math.sin(seconds * 1.7 + seed) * 0.006 * (1 - state.walk);
  const blinkTime = (seconds + seed) % (4.5 + (seed % 1));
  state.blink =
    blinkTime < 0.16 ? Math.max(0.06, Math.abs(blinkTime - 0.08) / 0.08) : 1;
  return state;
}
