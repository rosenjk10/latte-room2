export const BLOOM_MS = 180000,
  WATER_COOLDOWN = 3500,
  SEAT_LEASE = 20000;
export type Flower = {
  stage: number;
  version: number;
  cycle: number;
  seed: number;
  wateredAt: number;
  bloomAt: number;
  actor: string;
};
export type Claim = { owner: string; token: string; until: number };
export type Result = {
  id: string;
  actor: string;
  ok: boolean;
  reason: string;
  at: number;
};
export type SharedState = {
  revision: number;
  flowers: Flower[];
  seats: Record<number, Claim>;
  recent: Result[];
};
export type Request = {
  type: "request";
  term: string;
  id: string;
  actor: string;
  kind: "water" | "claim" | "release" | "renew";
  resource: number;
  version?: number;
  token?: string;
};
export type SharedMessage =
  | Request
  | { type: "offer"; term: string; from: string; state: SharedState }
  | { type: "collect"; term: string; from: string }
  | { type: "commit"; term: string; from: string; state: SharedState };
export type RoomBridge = {
  event: (v: unknown) => void;
  roster: (ids: string[]) => void;
  connected: (v: boolean) => void;
  bind: (fn: ((v: SharedMessage) => void) | null) => void;
};
export const emptyState = (): SharedState => ({
  revision: 0,
  flowers: Array.from({ length: 6 }, (_, i) => ({
    stage: 0,
    version: 0,
    cycle: 0,
    seed: Math.floor(Math.random() * 1000000),
    wateredAt: 0,
    bloomAt: 0,
    actor: "",
  })),
  seats: {},
  recent: [],
});
export function membershipTerm(ids: string[]) {
  let hash = 2166136261;
  for (const c of ids.join("|"))
    hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  return `${ids[0]}:${hash >>> 0}`;
}
export function validSharedState(v: unknown): v is SharedState {
  if (!v || typeof v !== "object") return false;
  const s = v as SharedState;
  return (
    Number.isSafeInteger(s.revision) &&
    s.revision >= 0 &&
    Array.isArray(s.flowers) &&
    s.flowers.length === 6 &&
    s.flowers.every(
      (f) =>
        f &&
        Number.isInteger(f.stage) &&
        f.stage >= 0 &&
        f.stage <= 4 &&
        [f.version, f.cycle, f.seed, f.wateredAt, f.bloomAt].every(
          (n) => Number.isSafeInteger(n) && n >= 0,
        ) &&
        typeof f.actor === "string" &&
        f.actor.length < 120,
    ) &&
    !!s.seats &&
    typeof s.seats === "object" &&
    Object.keys(s.seats).length <= 14 &&
    Object.entries(s.seats).every(
      ([i, c]) =>
        Number.isInteger(+i) &&
        +i >= 0 &&
        +i < 14 &&
        c &&
        typeof c.owner === "string" &&
        c.owner.length < 120 &&
        typeof c.token === "string" &&
        c.token.length < 120 &&
        Number.isFinite(c.until),
    ) &&
    Array.isArray(s.recent) &&
    s.recent.length <= 64 &&
    s.recent.every(
      (r) =>
        r &&
        typeof r.id === "string" &&
        r.id.length < 120 &&
        typeof r.actor === "string" &&
        r.actor.length < 120 &&
        typeof r.ok === "boolean" &&
        typeof r.reason === "string" &&
        r.reason.length <= 100 &&
        Number.isFinite(r.at),
    )
  );
}
export function reduceRequest(
  state: SharedState,
  r: Request,
  members: string[],
  now: number,
): SharedState {
  if (state.recent.some((x) => x.id === r.id)) return state;
  const s = structuredClone(state);
  s.recent = s.recent.filter((x) => now - x.at < 60000);
  let reason = "",
    ok = false;
  if (!members.includes(r.actor))
    reason = "이 방에 연결된 후 다시 시도해주세요.";
  else if (r.kind === "water") {
    const f = s.flowers[r.resource];
    if (!f) reason = "화분을 찾지 못했어요.";
    else if (f.stage === 4) reason = "피어난 꽃을 잠시 함께 감상해요.";
    else if (f.version !== r.version)
      reason = "다른 손님이 먼저 물을 주었어요.";
    else if (f.wateredAt && now - f.wateredAt < WATER_COOLDOWN)
      reason = "물이 스며들 시간을 조금만 기다려요.";
    else {
      f.stage++;
      f.version++;
      f.wateredAt = now;
      f.actor = r.actor;
      if (f.stage === 4) f.bloomAt = now;
      ok = true;
    }
  } else if (r.kind === "claim") {
    const c = s.seats[r.resource];
    if (r.resource < 0 || r.resource >= 14)
      reason = "이 의자는 이용할 수 없어요.";
    else if (c && c.until > now && c.owner !== r.actor)
      reason = "다른 손님이 먼저 앉았어요.";
    else {
      Object.entries(s.seats).forEach(([i, c]) => {
        if (c.owner === r.actor) delete s.seats[+i];
      });
      s.seats[r.resource] = {
        owner: r.actor,
        token: r.id,
        until: now + SEAT_LEASE,
      };
      ok = true;
    }
  } else {
    const c = s.seats[r.resource];
    if (c?.owner === r.actor && c.token === r.token) {
      if (r.kind === "release") delete s.seats[r.resource];
      else c.until = now + SEAT_LEASE;
      ok = true;
    } else reason = "의자 상태가 바뀌었어요.";
  }
  s.recent.push({ id: r.id, actor: r.actor, ok, reason, at: now });
  s.recent = s.recent.slice(-64);
  s.revision++;
  return s;
}
/** One elected writer per Presence membership. Recovery collects every connected peer before writes resume. */
export class RoomCoordinator {
  state = emptyState();
  ready = false;
  connected = false;
  members: string[] = [];
  term = "";
  private offers = new Map<string, SharedState>();
  private disposed = false;
  private checkpointAt = 0;
  private pending = new Map<
    string,
    { resolve: (r: Result) => void; timer: ReturnType<typeof setTimeout> }
  >();
  constructor(
    readonly id: string,
    private send: (v: SharedMessage) => void,
    private changed: () => void,
    private now = () => Date.now(),
  ) {}
  private publish() {
    this.changed();
    for (const r of this.state.recent) {
      const p = this.pending.get(r.id);
      if (p) {
        clearTimeout(p.timer);
        p.resolve(r);
        this.pending.delete(r.id);
      }
    }
  }
  setConnected(value: boolean) {
    this.connected = value;
    if (!value) {
      this.ready = false;
      this.failPending();
      this.changed();
    } else this.recover();
  }
  setMembers(ids: string[]) {
    const members = [...new Set(ids)].sort();
    if (members.join("|") === this.members.join("|")) return;
    this.members = members;
    this.term = membershipTerm(members);
    this.recover();
  }
  private recover() {
    this.ready = false;
    this.offers.clear();
    this.changed();
    if (!this.connected || !this.members.includes(this.id)) return;
    this.offers.set(this.id, structuredClone(this.state));
    if (this.members[0] === this.id) {
      this.send({ type: "collect", term: this.term, from: this.id });
      this.finishRecovery();
    } else
      this.send({
        type: "offer",
        term: this.term,
        from: this.id,
        state: this.state,
      });
  }
  private finishRecovery() {
    if (
      !this.connected ||
      this.members[0] !== this.id ||
      !this.members.every((id) => this.offers.has(id))
    )
      return;
    const candidates = [...this.offers.values()].sort(
      (a, b) =>
        b.revision - a.revision ||
        JSON.stringify(b).localeCompare(JSON.stringify(a)),
    );
    this.state = structuredClone(candidates[0]);
    this.prune();
    this.ready = true;
    this.checkpointAt = this.now();
    this.send({
      type: "commit",
      term: this.term,
      from: this.id,
      state: this.state,
    });
    this.publish();
  }
  receive(value: unknown) {
    if (
      this.disposed ||
      !this.connected ||
      !this.members.includes(this.id) ||
      !value ||
      typeof value !== "object"
    )
      return;
    const m = value as SharedMessage;
    if (m.term !== this.term) return;
    if (m.type === "collect" && m.from === this.members[0]) {
      this.ready = false;
      this.changed();
      this.send({
        type: "offer",
        term: this.term,
        from: this.id,
        state: this.state,
      });
    } else if (
      m.type === "offer" &&
      this.members[0] === this.id &&
      this.members.includes(m.from) &&
      validSharedState(m.state)
    ) {
      if (this.ready) {
        this.send({
          type: "commit",
          term: this.term,
          from: this.id,
          state: this.state,
        });
      } else {
        this.offers.set(m.from, structuredClone(m.state));
        this.finishRecovery();
      }
    } else if (
      m.type === "commit" &&
      m.from === this.members[0] &&
      validSharedState(m.state)
    ) {
      if (!this.ready || m.state.revision >= this.state.revision) {
        this.state = structuredClone(m.state);
        this.ready = true;
        this.publish();
      }
    } else if (
      m.type === "request" &&
      this.members[0] === this.id &&
      this.ready &&
      typeof m.id === "string" &&
      m.id.length < 120 &&
      typeof m.actor === "string" &&
      Number.isInteger(m.resource) &&
      ["water", "claim", "release", "renew"].includes(m.kind)
    ) {
      const next = reduceRequest(this.state, m, this.members, this.now());
      this.state = next;
      this.checkpointAt = this.now();
      this.send({
        type: "commit",
        term: this.term,
        from: this.id,
        state: next,
      });
      this.publish();
    }
  }
  request(
    kind: Request["kind"],
    resource: number,
    version?: number,
    token?: string,
  ): Promise<Result> {
    const id = crypto.randomUUID();
    if (!this.ready || !this.connected)
      return Promise.resolve({
        id,
        actor: this.id,
        ok: false,
        reason: "공간을 맞추고 있어요. 연결 후 다시 시도해주세요.",
        at: this.now(),
      });
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve({
          id,
          actor: this.id,
          ok: false,
          reason: "응답이 늦어지고 있어요. 다시 시도해주세요.",
          at: this.now(),
        });
      }, 6000);
      this.pending.set(id, { resolve, timer });
      const r: Request = {
        type: "request",
        term: this.term,
        id,
        actor: this.id,
        kind,
        resource,
        version,
        token,
      };
      if (this.members[0] === this.id) this.receive(r);
      else this.send(r);
    });
  }
  private prune() {
    const now = this.now();
    let dirty = false;
    Object.entries(this.state.seats).forEach(([i, c]) => {
      if (!this.members.includes(c.owner) || c.until <= now) {
        delete this.state.seats[+i];
        dirty = true;
      }
    });
    this.state.flowers.forEach((f) => {
      if (f.stage === 4 && now - f.bloomAt >= BLOOM_MS) {
        f.stage = 0;
        f.version++;
        f.cycle++;
        f.seed = Math.floor(Math.random() * 1000000);
        f.wateredAt = 0;
        f.bloomAt = 0;
        f.actor = "";
        dirty = true;
      }
    });
    if (dirty) this.state.revision++;
    return dirty;
  }
  tick() {
    if (!this.ready || !this.connected || this.members[0] !== this.id) return;
    const changed = this.prune();
    if (changed || this.now() - this.checkpointAt >= 10000) {
      this.checkpointAt = this.now();
      this.send({
        type: "commit",
        term: this.term,
        from: this.id,
        state: this.state,
      });
      this.publish();
    }
  }
  private failPending() {
    for (const [id, p] of this.pending) {
      clearTimeout(p.timer);
      p.resolve({
        id,
        actor: this.id,
        ok: false,
        reason: "연결이 끊겨 조작을 멈췄어요.",
        at: this.now(),
      });
    }
    this.pending.clear();
  }
  dispose() {
    this.disposed = true;
    this.failPending();
  }
}
