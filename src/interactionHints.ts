import type { Interaction } from "./InteractionPanel";
export const HINT_DWELL = 2000,
  HINT_LIFETIME = 3000,
  HINT_REPEAT = 300000,
  HINT_DISMISS = 600000;
const key = (room: number, target: Interaction) =>
  `${room}:${target.kind}:${target.id}`;
const same = (a: Interaction | null, b: Interaction | null) =>
  a?.kind === b?.kind && a?.id === b?.id;
/** Automatic hints never replace an active hint or own any movement input. */
export class InteractionHints {
  private cooldown = new Map<string, number>();
  private candidate: Interaction | null = null;
  private since = 0;
  private active: { room: number; target: Interaction; until: number } | null =
    null;
  private room: number | null = null;
  tick(
    room: number | null,
    nearby: Interaction | null,
    blocked: boolean,
    now: number,
  ): Interaction | null {
    if (room !== this.room) {
      this.active = null;
      this.candidate = null;
      this.room = room;
    }
    if (blocked || room === null) {
      this.active = null;
      this.candidate = null;
      return null;
    }
    if (this.active) {
      if (now < this.active.until) return this.active.target;
      this.active = null;
      this.candidate = null;
    }
    if (!nearby) {
      this.candidate = null;
      return null;
    }
    if ((this.cooldown.get(key(room, nearby)) ?? 0) > now) {
      this.candidate = null;
      return null;
    }
    if (!same(this.candidate, nearby)) {
      this.candidate = { ...nearby };
      this.since = now;
      return null;
    }
    if (now - this.since < HINT_DWELL) return null;
    this.active = { room, target: { ...nearby }, until: now + HINT_LIFETIME };
    this.cooldown.set(key(room, nearby), now + HINT_REPEAT);
    for (const [id, until] of this.cooldown)
      if (until <= now) this.cooldown.delete(id);
    this.candidate = null;
    return this.active.target;
  }
  dismiss(room: number, target: Interaction, now: number) {
    this.cooldown.set(key(room, target), now + HINT_DISMISS);
    this.active = null;
    this.candidate = null;
  }
}
