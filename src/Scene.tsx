import { HealingInterior } from "./HealingObjects";
import { roomLayout, walkable, BOOKS, seatApproach, type Point } from "./world";
import { findPath } from "./navigation";
import type { SharedState } from "./roomState";
import { memo, useRef, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Html } from "@react-three/drei";
import * as THREE from "three";
import CameraRig from "./CameraRig";
import {
  Cup,
  DessertModel,
  EspressoStation,
  DessertCase,
  CorkBoard,
} from "./CafeObjects";
import { audio } from "./audio";
import Animal from "./Avatar";
import SceneInspection from "./SceneInspection";
import {
  TABLES,
  SEATS,
  bubblePosition,
  BUBBLE_LIFE,
  clampPosition,
  actionProgress,
  type Player,
  type Bubble,
  type Burst,
} from "./model";
const sphere = new THREE.SphereGeometry(1, 16, 12);
const bubbleRim = new THREE.TorusGeometry(0.94, 0.018, 5, 40);
const rimColors: number[] = [];
for (let i = 0; i < bubbleRim.attributes.position.count; i++) {
  const p = bubbleRim.attributes.position;
  const color = new THREE.Color().setHSL(
    (Math.atan2(p.getY(i), p.getX(i)) / Math.PI / 2 + 1) % 1,
    0.65,
    0.78,
  );
  rimColors.push(color.r, color.g, color.b);
}
bubbleRim.setAttribute("color", new THREE.Float32BufferAttribute(rimColors, 3));
function Ball({
  position,
  scale,
  color,
}: {
  position: [number, number, number];
  scale: [number, number, number];
  color: string;
}) {
  return (
    <mesh geometry={sphere} position={position} scale={scale}>
      <meshStandardMaterial color={color} roughness={0.75} />
    </mesh>
  );
}
function Box({
  position,
  size,
  color,
  rotation = 0,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  rotation?: number;
}) {
  return (
    <mesh position={position} rotation-y={rotation}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.8} />
    </mesh>
  );
}
const Cafe = memo(function Cafe({
  onSeat,
  onMachine,
  onGuestbook,
  brewAt,
  brewDrink,
  accent,
}: {
  accent: string;
  onGuestbook: () => void;
  brewAt: number;
  brewDrink: import("./model").Drink;
  onSeat: (i: number) => void;
  onMachine: (kind: "drink" | "dessert") => void;
}) {
  return (
    <group onClick={(e) => e.stopPropagation()}>
      <Box position={[0, -0.17, 0]} size={[12, 0.3, 11]} color="#e6d4be" />
      {Array.from({ length: 16 }, (_, i) => (
        <Box
          key={i}
          position={[-5.65 + i * 0.75, -0.008, 0]}
          size={[0.018, 0.008, 11]}
          color="#cdb89f"
        />
      ))}
      <Box position={[0, 2, -5.2]} size={[12, 4.4, 0.2]} color={accent} />
      <Box position={[-5.8, 2, 0]} size={[0.2, 4.4, 10.5]} color="#fff0d5" />
      {[-3.5, 0, 3.5].map((x) => (
        <group key={x} position={[x, 2.35, -5.06]}>
          <Box position={[0, 0, 0]} size={[2.4, 2.2, 0.1]} color="#fff0d5" />
          <Box
            position={[0, 0, 0.065]}
            size={[2.15, 1.96, 0.05]}
            color="#bdd9dc"
          />
          <Box position={[0, 0, 0.11]} size={[0.07, 2, 0.05]} color="#fff0d5" />
          <Box
            position={[0, 0, 0.12]}
            size={[2.2, 0.07, 0.05]}
            color="#fff0d5"
          />
          <Ball
            position={[0.65, 0.5, 0.11]}
            scale={[0.3, 0.3, 0.05]}
            color="#ffe8b3"
          />
        </group>
      ))}
      <group position={[-5.66, 2, 0]} rotation-y={Math.PI / 2}>
        <Html
          transform
          center
          distanceFactor={6}
          style={{ pointerEvents: "none" }}
          zIndexRange={[0, 0]}
        >
          <div className="wall-sign">
            LATTE
            <br />
            <span>ROOM</span>
            <small>stay a little longer.</small>
          </div>
        </Html>
      </group>
      {TABLES.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.88, 0]}>
            <cylinderGeometry args={[0.65, 0.65, 0.09, 24]} />
            <meshStandardMaterial color="#f7e9d6" />
          </mesh>
          <Box
            position={[0, 0.43, 0]}
            size={[0.13, 0.85, 0.13]}
            color="#b78e75"
          />
          <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.36, 0.36, 0.06, 12]} />
            <meshStandardMaterial color="#b78e75" />
          </mesh>
          <mesh position={[0, 1.01, 0]}>
            <cylinderGeometry args={[0.07, 0.06, 0.2, 12]} />
            <meshStandardMaterial color="#cdbff0" />
          </mesh>
          <Ball
            position={[0, 1.16, 0]}
            scale={[0.12, 0.12, 0.12]}
            color="#e5b5c0"
          />
        </group>
      ))}
      {SEATS.slice(0, 12).map((s, i) => (
        <group
          key={i}
          position={[s.x, 0, s.z]}
          rotation-y={s.angle}
          onClick={(e) => {
            if (e.delta > 5) return;
            e.stopPropagation();
            onSeat(i);
          }}
        >
          <Box
            position={[0, 0.47, 0]}
            size={[0.53, 0.12, 0.5]}
            color={i % 3 === 0 ? "#f0c1d0" : "#c8e7d6"}
          />
          <Box
            position={[0, 0.75, -0.22]}
            size={[0.53, 0.5, 0.09]}
            color={i % 3 === 0 ? "#f0c1d0" : "#c8e7d6"}
          />
          {[-0.19, 0.19].flatMap((x) =>
            [-0.17, 0.17].map((z) => (
              <Box
                key={`${x}-${z}`}
                position={[x, 0.22, z]}
                size={[0.05, 0.44, 0.05]}
                color="#b78e75"
              />
            )),
          )}
        </group>
      ))}
      <EspressoStation
        brewAt={brewAt}
        drink={brewDrink}
        onClick={() => onMachine("drink")}
      />
      <DessertCase onClick={() => onMachine("dessert")} />
      <CorkBoard onClick={onGuestbook} />
      {[-3, 0, 3].map((x) => (
        <group key={x} position={[x, 3.7, -1]}>
          <mesh>
            <coneGeometry args={[0.4, 0.3, 20, 1, true]} />
            <meshStandardMaterial color="#d4aa78" side={THREE.DoubleSide} />
          </mesh>
          <Ball
            position={[0, -0.12, 0]}
            scale={[0.13, 0.1, 0.13]}
            color="#fff0c9"
          />
        </group>
      ))}
    </group>
  );
});
function BubbleMesh({
  bubble,
  onPop,
}: {
  bubble: Bubble;
  onPop: (id: string) => void;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!ref.current) return;
    const now = Date.now(),
      p = bubblePosition(bubble, now);
    ref.current.position.set(p.x, p.y, p.z);
    const life = now - bubble.born;
    const s =
      bubble.size * Math.min(1, Math.max(0, (BUBBLE_LIFE - life) / 700));
    ref.current.scale.setScalar(s);
    ref.current.rotation.y = now * 0.0004;
  });
  return (
    <mesh
      ref={ref}
      geometry={sphere}
      onClick={(e) => {
        if (e.delta > 5) return;
        e.stopPropagation();
        onPop(bubble.id);
      }}
    >
      <meshPhysicalMaterial
        color={bubble.rainbow ? "#f4b5f6" : "#d7f0f5"}
        transparent
        opacity={bubble.rainbow ? 0.4 : 0.23}
        roughness={0.08}
        metalness={0.1}
        iridescence={1}
        iridescenceIOR={1.4}
        iridescenceThicknessRange={[100, 500]}
        clearcoat={1}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
      <mesh geometry={bubbleRim} rotation-x={-0.55}>
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={bubble.rainbow ? 0.95 : 0.7}
          depthWrite={false}
        />
      </mesh>
      <mesh
        position={[-0.3, 0.43, 0.64]}
        scale={[0.13, 0.22, 0.035]}
        geometry={sphere}
      >
        <meshBasicMaterial color="white" transparent opacity={0.8} />
      </mesh>
    </mesh>
  );
}
function Sparkles({ burst }: { burst: Burst }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    const t = (performance.now() - burst.born) / 650;
    ref.current.visible = t < 1;
    ref.current.children.forEach((c, i) => {
      const a = (i * Math.PI) / 4;
      c.position.set(
        Math.cos(a) * t * 0.55,
        Math.sin(a) * t * 0.55 - t * t * 0.2,
        Math.sin(a * 2) * t * 0.25,
      );
      c.scale.setScalar(Math.max(0, 1 - t) * 0.045);
    });
  });
  return (
    <group ref={ref} position={[burst.x, burst.y, burst.z]}>
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} geometry={sphere}>
          <meshBasicMaterial
            color={["#fff4c0", "#f0c1d0", "#cdbff0", "#c8e7d6"][i % 4]}
          />
        </mesh>
      ))}
    </group>
  );
}
export type Controls = {
  x: number;
  z: number;
  keys: Set<string>;
  cameraBusy?: boolean;
  draggedUntil?: number;
  path?: Point[];
  destination?: Point | null;
  arrive?: (() => void) | null;
  cancelAuto?: () => void;
};
function World({
  player,
  controls,
  others,
  bubbles,
  bursts,
  onPop,
  onSeat,
  onMachine,
  tick,
  entered,
  cameraReset,
  onGuestbook,
  brewDrink,
  blocked,
  room,
  shared,
  sharedReady,
  onBook,
  onPot,
  onFloor,
  onNearby,
}: {
  player: React.RefObject<Player>;
  controls: React.RefObject<Controls>;
  others: Player[];
  bubbles: Bubble[];
  bursts: Burst[];
  onPop: (id: string) => void;
  onSeat: (i: number) => void;
  onMachine: (k: "drink" | "dessert") => void;
  tick: () => void;
  entered: boolean;
  cameraReset: number;
  onGuestbook: () => void;
  brewDrink: import("./model").Drink;
  blocked: boolean;
  room: number;
  shared: SharedState;
  sharedReady: boolean;
  onBook: (i: number) => void;
  onPot: (i: number) => void;
  onFloor: (p: Point) => void;
  onNearby: (p: { kind: "book" | "pot" | "chair"; id: number } | null) => void;
}) {
  const handlers = useRef({
    onSeat,
    onMachine,
    onGuestbook,
    onBook,
    onPot,
    onFloor,
    onNearby,
  });
  handlers.current = {
    onSeat,
    onMachine,
    onGuestbook,
    onBook,
    onPot,
    onFloor,
    onNearby,
  };
  const interaction = useMemo(
    () => ({
      book: (i: number) => {
        if (performance.now() > (controls.current.draggedUntil ?? 0))
          handlers.current.onBook(i);
      },
      pot: (i: number) => {
        if (performance.now() > (controls.current.draggedUntil ?? 0))
          handlers.current.onPot(i);
      },
      seat: (i: number) => {
        if (performance.now() > (controls.current.draggedUntil ?? 0))
          handlers.current.onSeat(i);
      },
      machine: (k: "drink" | "dessert") => {
        if (performance.now() > (controls.current.draggedUntil ?? 0))
          handlers.current.onMachine(k);
      },
      guestbook: () => {
        if (performance.now() > (controls.current.draggedUntil ?? 0))
          handlers.current.onGuestbook();
      },
    }),
    [controls],
  );
  const { gl } = useThree();
  const marker = useRef<THREE.Mesh>(null),
    nearbyTimer = useRef(0);
  const visibleOthers = others.map((p) =>
    p.clientVersion === 4 &&
    sharedReady &&
    p.seat !== null &&
    shared.seats[p.seat]?.owner !== p.id
      ? {
          ...p,
          ...seatApproach(p.seat, room),
          seat: null,
          reading: false,
          book: null,
          drinkPlaced: false,
          dessertPlaced: false,
        }
      : p,
  );
  const activeBrewer = [player.current, ...visibleOthers]
    .filter((p) => p.action === "brew")
    .sort((a, b) => (b.actionAt ?? 0) - (a.actionAt ?? 0))[0];
  useFrame((_, dt) => {
    const p = player.current,
      c = controls.current;
    if (
      entered &&
      p.seat === null &&
      !blocked &&
      !(
        (p.action === "drink" ||
          p.action === "eat" ||
          p.action === "water" ||
          p.action === "sit") &&
        actionProgress(p) < 1
      )
    ) {
      let x =
        c.x +
        (c.keys.has("d") || c.keys.has("arrowright") ? 1 : 0) -
        (c.keys.has("a") || c.keys.has("arrowleft") ? 1 : 0);
      let z =
        c.z +
        (c.keys.has("s") || c.keys.has("arrowdown") ? 1 : 0) -
        (c.keys.has("w") || c.keys.has("arrowup") ? 1 : 0);
      let length = Math.hypot(x, z);
      if (length > 0.02 && c.destination) {
        c.path = [];
        c.destination = null;
        c.arrive = null;
        c.cancelAuto?.();
      }
      if (length < 0.02 && c.path?.length && !c.cameraBusy) {
        const target = c.path[0],
          dx = target.x - p.x,
          dz = target.z - p.z,
          d = Math.hypot(dx, dz);
        if (d < 0.001) {
          c.path.shift();
          if (!c.path.length) {
            const arrived = c.arrive;
            c.arrive = null;
            c.destination = null;
            arrived?.();
          }
        } else {
          x = dx / d;
          z = dz / d;
          length = 1;
        }
      }
      if (length > 0.02) {
        x /= Math.max(1, length);
        z /= Math.max(1, length);
        const step = Math.min(
            Math.min(dt, 0.05) * 2.4,
            c.path?.length
              ? Math.hypot(c.path[0].x - p.x, c.path[0].z - p.z)
              : Infinity,
          ),
          next = { x: p.x + x * step, z: p.z + z * step };
        if (walkable(next, room)) {
          p.x = next.x;
          p.z = next.z;
          audio.play("step");
        } else if (!c.destination) {
          if (walkable({ x: next.x, z: p.z }, room)) p.x = next.x;
          if (walkable({ x: p.x, z: next.z }, room)) p.z = next.z;
        }
        p.angle = Math.atan2(x, z);
      }
    }
    if (marker.current) {
      marker.current.visible = !!c.destination;
      if (c.destination) {
        marker.current.position.set(c.destination.x, 0.015, c.destination.z);
        marker.current.scale.setScalar(
          1 + Math.sin(performance.now() * 0.004) * 0.08,
        );
      }
    }
    if (performance.now() - nearbyTimer.current > 400) {
      nearbyTimer.current = performance.now();
      const layout = roomLayout(room);
      const candidates = [
        { kind: "book" as const, id: room % BOOKS.length, ...layout.shelf },
        ...layout.pots.map((v, id) => ({ kind: "pot" as const, id, ...v })),
        ...SEATS.map((v, id) => ({ kind: "chair" as const, id, ...v })),
      ].sort(
        (a, b) =>
          Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z),
      );
      const v = candidates[0];
      handlers.current.onNearby(
        v && Math.hypot(v.x - p.x, v.z - p.z) < 1.35
          ? { kind: v.kind, id: v.id }
          : null,
      );
    }
    gl.domElement.dataset.destination = c.destination
      ? JSON.stringify(c.destination)
      : "";
    gl.domElement.dataset.player = JSON.stringify([
      +p.x.toFixed(3),
      +p.z.toFixed(3),
    ]);
    tick();
  }, -2);
  return (
    <>
      <color attach="background" args={["#f5efe6"]} />
      <fog attach="fog" args={["#f5efe6", 18, 32]} />
      <ambientLight intensity={0.9} />
      <hemisphereLight args={["#fff0d5", "#c8e7d6", 0.8]} />
      <directionalLight position={[3, 8, 2]} intensity={2.5} color="#ffedcf" />
      <SceneInspection />
      <CameraRig
        entered={entered}
        reset={cameraReset}
        controls={controls}
        room={room}
        player={player}
      />
      <mesh
        name="walk-floor"
        rotation-x={-Math.PI / 2}
        position={[0, 0.009, 0]}
        onClick={(e) => {
          if (
            !entered ||
            blocked ||
            e.delta > 5 ||
            performance.now() < (controls.current.draggedUntil ?? 0)
          )
            return;
          e.stopPropagation();
          handlers.current.onFloor({ x: e.point.x, z: e.point.z });
        }}
      >
        <planeGeometry args={[12, 11]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh ref={marker} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.1, 0.17, 24]} />
        <meshBasicMaterial
          color="#9fc5ae"
          transparent
          opacity={0.7}
          depthWrite={false}
        />
      </mesh>
      <HealingInterior
        room={room}
        state={shared}
        onBook={interaction.book}
        onPot={interaction.pot}
        onSeat={interaction.seat}
      />
      <Cafe
        accent={roomLayout(room).accent}
        onSeat={interaction.seat}
        onMachine={interaction.machine}
        onGuestbook={interaction.guestbook}
        brewAt={activeBrewer?.actionAt ?? 0}
        brewDrink={activeBrewer?.brewDrink ?? brewDrink}
      />
      {[player.current, ...visibleOthers]
        .filter((p) => p.seat !== null)
        .map((p) => {
          const table = TABLES[Math.floor(p.seat! / 2)] ?? [p.x, p.z],
            eating = p.action === "eat" && actionProgress(p) < 1,
            drinking = p.action === "drink" && actionProgress(p) < 1;
          return (
            <group
              key={p.id}
              position={[
                table[0] + (p.seat! % 2 ? 0.25 : -0.25),
                0.95,
                table[1] + 0.2,
              ]}
            >
              {p.dessert !== null && p.dessertPlaced && !eating && (
                <DessertModel kind={p.dessert} bites={p.dessertBites ?? 3} />
              )}
              {p.drink && p.drinkPlaced && !drinking && (
                <group position={[0, 0.12, -0.35]}>
                  <Cup drink={p.drink} level={p.drinkLevel ?? 4} />
                </group>
              )}
            </group>
          );
        })}
      <Animal player={player.current} local />
      {visibleOthers.map((p) => (
        <Animal key={p.id} player={p} />
      ))}
      {bubbles.map((b) => (
        <BubbleMesh
          key={b.id}
          bubble={b}
          onPop={(id) => {
            if (performance.now() > (controls.current.draggedUntil ?? 0))
              onPop(id);
          }}
        />
      ))}
      {bursts.map((b) => (
        <Sparkles key={b.id} burst={b} />
      ))}
      <ContactShadows
        position={[0, 0.001, 0]}
        opacity={0.23}
        scale={20}
        blur={2.5}
        far={4}
        resolution={256}
        frames={1}
      />
    </>
  );
}
export default function Scene(props: Parameters<typeof World>[0]) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [7.8, 6.8, 10.5], fov: 45 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <World {...props} />
    </Canvas>
  );
}
