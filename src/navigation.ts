import { nearestWalkable, walkable, obstacles, type Point } from "./world";
const STEP = 0.2,
  MINX = -5.4,
  MINZ = -4.8,
  W = 55,
  H = 48;
const point = (i: number): Point => ({
  x: MINX + (i % W) * STEP,
  z: MINZ + Math.floor(i / W) * STEP,
});
const grids = new Map<number, boolean[]>();
/** Exact segment/AABB intersection: narrow corners cannot slip between sampled points. */
export function lineClear(a: Point, b: Point, room: number) {
  if (!walkable(a, room) || !walkable(b, room)) return false;
  for (const box of obstacles(room)) {
    let near = 0,
      far = 1;
    for (const [origin, delta, min, max] of [
      [a.x, b.x - a.x, box.minX - 0.22, box.maxX + 0.22],
      [a.z, b.z - a.z, box.minZ - 0.22, box.maxZ + 0.22],
    ]) {
      if (Math.abs(delta) < 1e-9) {
        if (origin <= min || origin >= max) {
          near = 2;
          break;
        }
      } else {
        const p = (min - origin) / delta,
          q = (max - origin) / delta;
        near = Math.max(near, Math.min(p, q));
        far = Math.min(far, Math.max(p, q));
      }
    }
    if (near < far - 1e-9 && near < 1 && far > 0) return false;
  }
  return true;
}
/** Bounded grid A*, cached topology, called only on a destination change. */
export function findPath(
  start: Point,
  destination: Point,
  room: number,
): Point[] {
  const target = nearestWalkable(destination, room),
    origin = nearestWalkable(start, room);
  if (lineClear(origin, target, room)) return [target];
  if (!grids.has(room))
    grids.set(
      room,
      Array.from({ length: W * H }, (_, i) => walkable(point(i), room)),
    );
  const allowed = grids.get(room)!;
  function nearest(p: Point) {
    let best = -1,
      score = Infinity;
    for (let i = 0; i < allowed.length; i++)
      if (allowed[i]) {
        const q = point(i),
          d = (p.x - q.x) ** 2 + (p.z - q.z) ** 2;
        if (d < score && lineClear(p, q, room)) {
          best = i;
          score = d;
        }
      }
    return best;
  }
  const from = nearest(origin),
    to = nearest(target);
  if (from < 0 || to < 0) return [];
  const open = new Set([from]),
    g = new Map([[from, 0]]),
    parent = new Map<number, number>();
  const heuristic = (i: number) => {
    const p = point(i),
      q = point(to);
    return Math.hypot(p.x - q.x, p.z - q.z);
  };
  let budget = W * H,
    closest = from;
  function route(end: number, goal: Point) {
    const points = [goal];
    let c = end;
    while (c !== from) {
      points.unshift(point(c));
      c = parent.get(c)!;
    }
    points.unshift(point(from));
    const result: Point[] = [];
    let previous = origin;
    while (points.length) {
      let i = points.length - 1;
      while (i > 0 && !lineClear(previous, points[i], room)) i--;
      previous = points[i];
      result.push(previous);
      points.splice(0, i + 1);
    }
    return result;
  }
  while (open.size && budget--) {
    let current = -1,
      best = Infinity;
    for (const i of open) {
      const s = g.get(i)! + heuristic(i);
      if (s < best) {
        best = s;
        current = i;
      }
    }
    if (heuristic(current) < heuristic(closest)) closest = current;
    if (current === to) return route(to, target);
    open.delete(current);
    const cx = current % W,
      cz = Math.floor(current / W);
    for (const [dx, dz] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ]) {
      const x = cx + dx,
        z = cz + dz;
      if (x < 0 || x >= W || z < 0 || z >= H) continue;
      const next = z * W + x;
      if (
        !allowed[next] ||
        (dx && dz && (!allowed[cz * W + x] || !allowed[z * W + cx]))
      )
        continue;
      const score = g.get(current)! + Math.hypot(dx, dz) * STEP;
      if (score < (g.get(next) ?? Infinity)) {
        g.set(next, score);
        parent.set(next, current);
        open.add(next);
      }
    }
  }
  // A disconnected target falls back to the closest point in the reachable component.
  return route(closest, point(closest));
}
