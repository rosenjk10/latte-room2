import { describe, it, expect } from "vitest";
import { findPath, lineClear } from "../src/navigation";
import {
  walkable,
  nearestWalkable,
  seatApproach,
  CHAIR_POSITIONS,
  cameraPosition,
  roomLayout,
  obstacles,
} from "../src/world";
import {
  RoomCoordinator,
  emptyState,
  reduceRequest,
  BLOOM_MS,
  WATER_COOLDOWN,
  validSharedState,
  type SharedMessage,
  type Request,
} from "../src/roomState";
describe("shared floor collision and navigation", () => {
  it("routes around tables and chairs instead of cutting corners", () => {
    const start = { x: 0, z: 3.4 },
      goal = { x: 1, z: -4.4 };
    expect(lineClear(start, goal, 1)).toBe(false);
    const route = findPath(start, goal, 1);
    expect(route.length).toBeGreaterThan(1);
    let previous = start;
    for (const p of route) {
      expect(walkable(p, 1)).toBe(true);
      expect(lineClear(previous, p, 1)).toBe(true);
      previous = p;
    }
    expect(Math.hypot(previous.x - goal.x, previous.z - goal.z)).toBeLessThan(
      0.2,
    );
  });
  it("projects blocked destinations to valid floor, and every chair is approachable in all ten rooms", () => {
    expect(walkable(nearestWalkable({ x: 0, z: 1.2 }, 1), 1)).toBe(true);
    for (let room = 1; room <= 10; room++)
      for (let i = 0; i < CHAIR_POSITIONS.length; i++) {
        const p = seatApproach(i, room);
        expect(walkable(p, room), `room ${room} seat ${i}`).toBe(true);
        expect(
          findPath({ x: 0, z: 3.4 }, p, room).length,
          `room ${room} seat ${i} route`,
        ).toBeGreaterThan(0);
      }
  });
  it("allows camera eye height, but sweeps cannot cross walls or furniture", () => {
    const previous = { x: 0, y: 1, z: 0 };
    const wall = cameraPosition(previous, { x: 0, y: 1, z: -8 }, 1, previous);
    expect(wall.z).toBeGreaterThan(-5);
    const table = cameraPosition(
      { x: 0, y: 0.6, z: 0 },
      { x: 0, y: 0.6, z: 2.5 },
      1,
      { x: 0, y: 0.6, z: 0 },
    );
    expect(table.z).toBeLessThan(0.55);
    expect(
      cameraPosition(previous, { x: 0, y: -10, z: 0 }, 1, previous).y,
    ).toBeGreaterThanOrEqual(0.32);
  });
  it("varies room accent and decor without removing existing walkways", () => {
    expect(roomLayout(1).shelf.x).not.toBe(roomLayout(2).shelf.x);
    expect(roomLayout(1).accent).not.toBe(roomLayout(2).accent);
  });
});
function network() {
  let now = 100000;
  const engines = new Map<string, RoomCoordinator>(),
    queue: { sender: string; value: SharedMessage }[] = [];
  const create = (id: string) => {
    const e = new RoomCoordinator(
      id,
      (value) => queue.push({ sender: id, value: structuredClone(value) }),
      () => {},
      () => now,
    );
    engines.set(id, e);
    e.setConnected(true);
    return e;
  };
  const flush = () => {
    let limit = 5000;
    while (queue.length && limit--) {
      const { sender, value } = queue.shift()!;
      engines.forEach((e, id) => {
        if (id !== sender) e.receive(structuredClone(value));
      });
    }
    expect(limit).toBeGreaterThan(0);
  };
  const roster = () => {
    const ids = [...engines.keys()];
    engines.forEach((e) => e.setMembers(ids));
    flush();
  };
  const close = (id: string) => {
    engines.get(id)?.setConnected(false);
    engines.get(id)?.dispose();
    engines.delete(id);
    roster();
  };
  return {
    engines,
    create,
    flush,
    roster,
    close,
    advance: (ms: number) => {
      now += ms;
      engines.forEach((e) => e.tick());
      flush();
    },
  };
}
describe("transient room authority over Supabase Broadcast protocol", () => {
  it("serializes simultaneous watering and duplicate delivery into one growth step", async () => {
    const n = network(),
      a = n.create("a"),
      b = n.create("b");
    n.roster();
    expect(a.ready && b.ready).toBe(true);
    const first = a.request("water", 0, 0),
      second = b.request("water", 0, 0);
    n.flush();
    const results = await Promise.all([first, second]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(a.state.flowers[0].stage).toBe(1);
    expect(a.state).toEqual(b.state);
    const id = results.find((r) => r.ok)!.id;
    const duplicate: Request = {
      type: "request",
      term: a.term,
      id,
      actor: "a",
      kind: "water",
      resource: 0,
      version: 0,
    };
    a.receive(duplicate);
    n.flush();
    expect(a.state.flowers[0].stage).toBe(1);
    a.dispose();
    b.dispose();
  });
  it("applies cooldown, blooms at stage four, and resets after exactly three minutes", async () => {
    const n = network(),
      a = n.create("a");
    n.roster();
    for (let stage = 0; stage < 4; stage++) {
      const r = await a.request("water", 0, a.state.flowers[0].version);
      expect(r.ok).toBe(true);
      if (stage < 3) n.advance(WATER_COOLDOWN + 1);
    }
    expect(a.state.flowers[0].stage).toBe(4);
    n.advance(BLOOM_MS - 1);
    expect(a.state.flowers[0].stage).toBe(4);
    n.advance(1);
    expect(a.state.flowers[0]).toMatchObject({
      stage: 0,
      cycle: 1,
      bloomAt: 0,
      wateredAt: 0,
    });
    expect((await a.request("water", 0, a.state.flowers[0].version)).ok).toBe(
      true,
    );
    a.dispose();
  });
  it("grants a chair to only one visitor and rejects stale release tokens", async () => {
    const n = network(),
      a = n.create("a"),
      b = n.create("b");
    n.roster();
    const p = a.request("claim", 12),
      q = b.request("claim", 12);
    n.flush();
    expect((await Promise.all([p, q])).filter((r) => r.ok)).toHaveLength(1);
    expect(a.state.seats[12].owner).toBe("a");
    await a.request("release", 12, undefined, a.state.seats[12].token);
    n.flush();
    const next = b.request("claim", 12);
    n.flush();
    expect((await next).ok).toBe(true);
    const bad = await a.request("release", 12, undefined, "old-token");
    n.flush();
    expect(bad.ok).toBe(false);
    expect(a.state.seats[12].owner).toBe("b");
    a.dispose();
    b.dispose();
  });
  it("restores growth for late joins and elects a recovered authority after leader exit", async () => {
    const n = network(),
      a = n.create("a"),
      b = n.create("b");
    n.roster();
    await a.request("water", 2, 0);
    n.flush();
    const c = n.create("c");
    n.roster();
    expect(c.state.flowers[2].stage).toBe(1);
    n.close("a");
    expect(b.ready && c.ready).toBe(true);
    n.advance(WATER_COOLDOWN + 1);
    const r = c.request("water", 2, c.state.flowers[2].version);
    n.flush();
    expect((await r).ok).toBe(true);
    expect(b.state).toEqual(c.state);
    b.setConnected(false);
    expect((await b.request("water", 2, b.state.flowers[2].version)).ok).toBe(
      false,
    );
    b.setConnected(true);
    n.flush();
    expect(b.state).toEqual(c.state);
    b.dispose();
    c.dispose();
  });
  it("fails closed until every present peer participates in recovery, and validates snapshots", () => {
    const n = network(),
      a = n.create("a");
    a.setMembers(["a", "missing"]);
    n.flush();
    expect(a.ready).toBe(false);
    expect(validSharedState(emptyState())).toBe(true);
    expect(validSharedState({ ...emptyState(), flowers: [] })).toBe(false);
    a.dispose();
  });
});

describe("path following rather than only route geometry", () => {
  it("can follow the reading-chair to flower route without cutting an obstacle corner", () => {
    for (const dt of [0.016, 0.033, 0.05]) {
      const start = seatApproach(13, 1),
        pot = roomLayout(1).pots[0],
        d = Math.hypot(start.x - pot.x, start.z - pot.z),
        goal = nearestWalkable(
          {
            x: pot.x + ((start.x - pot.x) / d) * 0.78,
            z: pot.z + ((start.z - pot.z) / d) * 0.78,
          },
          1,
        ),
        route = findPath(start, goal, 1);
      let p = { ...start },
        budget = 2000;
      while (route.length && budget--) {
        const t = route[0],
          dx = t.x - p.x,
          dz = t.z - p.z,
          length = Math.hypot(dx, dz);
        if (length < 0.001) {
          route.shift();
          continue;
        }
        const step = Math.min(dt * 2.4, length),
          next = {
            x: p.x + (dx / length) * step,
            z: p.z + (dz / length) * step,
          };
        expect(
          walkable(next, 1),
          JSON.stringify({ p, next, target: t, route }),
        ).toBe(true);
        p = next;
      }
      expect(route).toHaveLength(0);
    }
  });
});

describe("recovery and overlapping camera colliders", () => {
  it("repairs a follower that missed an update with a periodic room checkpoint", async () => {
    const n = network(),
      a = n.create("a"),
      b = n.create("b");
    n.roster();
    const missed = structuredClone(b.state);
    await a.request("water", 1, 0);
    n.flush();
    b.state = missed;
    n.advance(10001);
    expect(b.state.flowers[1].stage).toBe(1);
    a.dispose();
    b.dispose();
  });
  it("projects a camera out of the entire overlapping furniture union", () => {
    const p = { x: -4.5, y: 0.5, z: 0.65 };
    const safe = cameraPosition(p, p, 1, p);
    for (const b of obstacles(1)) {
      expect(
        safe.x > b.minX - 0.16 &&
          safe.x < b.maxX + 0.16 &&
          safe.z > b.minZ - 0.16 &&
          safe.z < b.maxZ + 0.16 &&
          safe.y < b.height + 0.16,
        `inside ${b.id}: ${JSON.stringify(safe)}`,
      ).toBe(false);
    }
  });
});
