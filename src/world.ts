export type Point = { x: number; z: number };
export type Obstacle = {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
};
export const TABLE_POSITIONS = [
  [-3, -2.8],
  [0, -2.8],
  [3, -2.8],
  [-3, 1.2],
  [0, 1.2],
  [3, 1.2],
];
export const CHAIR_POSITIONS = TABLE_POSITIONS.flatMap(([x, z]) => [
  { x: x - 0.78, z, angle: Math.PI / 2 },
  { x: x + 0.78, z, angle: -Math.PI / 2 },
]).concat([
  { x: -4.45, z: 0.05, angle: Math.PI / 2 },
  { x: 4.45, z: 0.1, angle: -Math.PI / 2 },
]);
export const BOOKS = [
  { title: "느린 오후", color: "#dcede4" },
  { title: "작은 쉼표", color: "#f5d9df" },
  { title: "구름의 자리", color: "#ddd6f4" },
  { title: "다정한 온도", color: "#f2dfb8" },
  { title: "나만의 속도", color: "#cddde5" },
  { title: "오늘의 정원", color: "#e7c9b3" },
];
// Original micro-writing created for this project; no quotations from published books.
export const THOUGHTS = [
  "오늘의 속도는 오늘의 내가 정해도 좋아요.",
  "조용히 쉬어가는 마음에도 작은 잎이 자라요.",
  "잘하려는 마음을 잠깐 내려두면 창밖이 보여요.",
  "작은 숨 한 번에도 나를 돌보는 시간이 담겨요.",
  "아직 피지 않은 하루에도 따뜻한 빛은 머물러요.",
  "서두르지 않는 걸음에도 당신만의 풍경이 있어요.",
  "다정한 한 모금을 나에게 먼저 건네 보세요.",
  "여기서는 잠시, 해야 할 일보다 나를 먼저 생각해요.",
];
export function roomLayout(room: number) {
  const flip = room % 2 === 0;
  return {
    accent: ["#dcede4", "#fff4e6", "#f5d9df", "#ddd6f4"][(room - 1) % 4],
    shelf: { x: flip ? 4.9 : -4.9, z: -1.35 },
    pots: [
      { x: -4.8, z: -4.35 },
      { x: 4.8, z: -4.35 },
      { x: flip ? 4.8 : -4.8, z: -2.75 },
      { x: -4.95, z: 3.85 },
      { x: 4.95, z: 2.65 },
      { x: 0, z: -4.45 },
    ],
  };
}
const box = (
  id: string,
  x: number,
  z: number,
  w: number,
  d: number,
  height: number,
): Obstacle => ({
  id,
  minX: x - w / 2,
  maxX: x + w / 2,
  minZ: z - d / 2,
  maxZ: z + d / 2,
  height,
});
const obstacleCache = new Map<string, Obstacle[]>();
export function obstacles(room: number, chairs = true): Obstacle[] {
  const key = `${room}/${chairs}`;
  const cached = obstacleCache.get(key);
  if (cached) return cached;
  const l = roomLayout(room);
  const result = [
    ...TABLE_POSITIONS.map(([x, z], i) => box(`table:${i}`, x, z, 1.3, 1.3, 1)),
    ...(chairs
      ? CHAIR_POSITIONS.map((p, i) =>
          box(
            `chair:${i}`,
            p.x,
            p.z,
            i < 12 ? 0.53 : 0.8,
            i < 12 ? 0.5 : 0.85,
            i < 12 ? 1 : 1.2,
          ),
        )
      : []),
    box("machine", 2.5, 3.7, 1.75, 1, 2.3),
    box("showcase", 4.25, 3.7, 1.65, 1, 1.65),
    box("bookshelf", l.shelf.x, l.shelf.z, 0.5, 1.5, 2.35),
    ...l.pots.map((p, i) => box(`pot:${i}`, p.x, p.z, 0.5, 0.5, 1.6)),
    box("side-table", -4.5, 1.05, 0.65, 0.65, 0.7),
  ];
  obstacleCache.set(key, result);
  return result;
}
export const WALK_BOUNDS = { minX: -5.35, maxX: 5.35, minZ: -4.75, maxZ: 4.55 };
export function walkable(p: Point, room: number, radius = 0.22) {
  return (
    p.x >= WALK_BOUNDS.minX &&
    p.x <= WALK_BOUNDS.maxX &&
    p.z >= WALK_BOUNDS.minZ &&
    p.z <= WALK_BOUNDS.maxZ &&
    !obstacles(room).some(
      (b) =>
        p.x > b.minX - radius &&
        p.x < b.maxX + radius &&
        p.z > b.minZ - radius &&
        p.z < b.maxZ + radius,
    )
  );
}
export function nearestWalkable(p: Point, room: number): Point {
  const base = {
    x: Math.max(-5.3, Math.min(5.3, p.x)),
    z: Math.max(-4.7, Math.min(4.5, p.z)),
  };
  if (walkable(base, room)) return base;
  for (let r = 0.1; r < 12; r += 0.1) {
    for (let i = 0; i < 32; i++) {
      const t = (i * Math.PI) / 16,
        q = { x: base.x + Math.cos(t) * r, z: base.z + Math.sin(t) * r };
      if (walkable(q, room)) return q;
    }
  }
  return { x: 0, z: 3.4 };
}
export function seatApproach(index: number, room: number) {
  const s = CHAIR_POSITIONS[index];
  return nearestWalkable(
    index >= 12
      ? { x: s.x + (s.x > 0 ? -0.55 : 0.55), z: s.z - 0.8 }
      : { x: s.x + (s.angle > 0 ? -0.65 : 0.65), z: s.z },
    room,
  );
}
/** Sweep a camera sphere from the previous eye and project outside the complete furniture union. */
export function cameraPosition(
  target: { x: number; y: number; z: number },
  desired: { x: number; y: number; z: number },
  room: number,
  previous?: { x: number; y: number; z: number },
) {
  const origin = previous ?? target;
  const eye = { ...desired, y: Math.max(0.32, desired.y) };
  const dx = eye.x - origin.x,
    dy = eye.y - origin.y,
    dz = eye.z - origin.z;
  let hit = 1;
  const colliders = [
    ...obstacles(room),
    box("back-wall", 0, -5.2, 12, 0.2, 4.2),
    box("left-wall", -5.8, 0, 0.2, 10.5, 4.2),
  ];
  for (const b of colliders) {
    let near = 0,
      far = 1;
    const axes: [
      [number, number, number, number],
      [number, number, number, number],
      [number, number, number, number],
    ] = [
      [origin.x, dx, b.minX - 0.16, b.maxX + 0.16],
      [origin.y, dy, -0.1, b.height + 0.16],
      [origin.z, dz, b.minZ - 0.16, b.maxZ + 0.16],
    ];
    for (const [origin, delta, min, max] of axes) {
      if (Math.abs(delta) < 1e-7) {
        if (origin < min || origin > max) {
          near = 2;
          break;
        }
      } else {
        const a = (min - origin) / delta,
          c = (max - origin) / delta;
        near = Math.max(near, Math.min(a, c));
        far = Math.min(far, Math.max(a, c));
      }
    }
    if (near <= far && near > 0.000001 && near < hit)
      hit = Math.max(0, near - 0.001);
  }
  const result = {
    x: origin.x + dx * hit,
    y: Math.max(0.32, origin.y + dy * hit),
    z: origin.z + dz * hit,
  };
  const inside = (p: { x: number; y: number; z: number }, b: Obstacle) =>
    p.x > b.minX - 0.16 &&
    p.x < b.maxX + 0.16 &&
    p.z > b.minZ - 0.16 &&
    p.z < b.maxZ + 0.16 &&
    p.y < b.height + 0.16;
  if (colliders.some((b) => inside(result, b))) {
    const candidates = colliders
      .flatMap((b) => [
        { x: b.minX - 0.17, y: result.y, z: result.z },
        { x: b.maxX + 0.17, y: result.y, z: result.z },
        { x: result.x, y: result.y, z: b.minZ - 0.17 },
        { x: result.x, y: result.y, z: b.maxZ + 0.17 },
        { x: result.x, y: b.height + 0.17, z: result.z },
      ])
      .filter((p) => p.y >= 0.32 && !colliders.some((b) => inside(p, b)))
      .sort(
        (a, b) =>
          Math.hypot(a.x - result.x, a.y - result.y, a.z - result.z) -
          Math.hypot(b.x - result.x, b.y - result.y, b.z - result.z),
      );
    Object.assign(
      result,
      candidates[0] ?? {
        x: result.x,
        y: Math.max(...colliders.map((b) => b.height)) + 0.17,
        z: result.z,
      },
    );
  }
  return { x: result.x, y: Math.max(0.32, result.y), z: result.z };
}
