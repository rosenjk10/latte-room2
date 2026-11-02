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
import {
  ANIMALS,
  DRINKS,
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
}: {
  onGuestbook: () => void;
  brewAt: number;
  brewDrink: import("./model").Drink;
  onSeat: (i: number) => void;
  onMachine: (kind: "drink" | "dessert") => void;
}) {
  return (
    <group>
      <Box position={[0, -0.17, 0]} size={[12, 0.3, 11]} color="#e6d4be" />
      {Array.from({ length: 16 }, (_, i) => (
        <Box
          key={i}
          position={[-5.65 + i * 0.75, -0.008, 0]}
          size={[0.018, 0.008, 11]}
          color="#cdb89f"
        />
      ))}
      <Box position={[0, 2, -5.2]} size={[12, 4.4, 0.2]} color="#dcede4" />
      <Box position={[-5.8, 2, 0]} size={[0.2, 4.4, 10.5]} color="#fff4e6" />
      {[-3.5, 0, 3.5].map((x) => (
        <group key={x} position={[x, 2.35, -5.06]}>
          <Box position={[0, 0, 0]} size={[2.4, 2.2, 0.1]} color="#fff4e6" />
          <Box
            position={[0, 0, 0.065]}
            size={[2.15, 1.96, 0.05]}
            color="#bdd9dc"
          />
          <Box position={[0, 0, 0.11]} size={[0.07, 2, 0.05]} color="#fff4e6" />
          <Box
            position={[0, 0, 0.12]}
            size={[2.2, 0.07, 0.05]}
            color="#fff4e6"
          />
          <Ball
            position={[0.65, 0.5, 0.11]}
            scale={[0.3, 0.3, 0.05]}
            color="#ffe8b3"
          />
        </group>
      ))}
      <group position={[-5.66, 2, 0]} rotation-y={Math.PI / 2}>
        <Html transform center distanceFactor={6}>
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
            <meshStandardMaterial color="#ddd6f4" />
          </mesh>
          <Ball
            position={[0, 1.16, 0]}
            scale={[0.12, 0.12, 0.12]}
            color="#e5b5c0"
          />
        </group>
      ))}
      {SEATS.map((s, i) => (
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
            color={i % 3 === 0 ? "#f5d9df" : "#dcede4"}
          />
          <Box
            position={[0, 0.75, -0.22]}
            size={[0.53, 0.5, 0.09]}
            color={i % 3 === 0 ? "#f5d9df" : "#dcede4"}
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
      {[
        [-4.8, -4.3],
        [4.8, -4.3],
        [4.9, 3.8],
        [-5, 3.7],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.25, 0.19, 0.55, 12]} />
            <meshStandardMaterial color="#d7a28c" />
          </mesh>
          <Box position={[0, 0.75, 0]} size={[0.06, 1, 0.06]} color="#789172" />
          {[0, 1, 2, 3, 4].map((j) => (
            <Ball
              key={j}
              position={[
                Math.sin(j * 2) * 0.2,
                0.8 + j * 0.14,
                Math.cos(j * 2) * 0.15,
              ]}
              scale={[0.25, 0.18, 0.16]}
              color={j % 2 ? "#789a7c" : "#9bb99a"}
            />
          ))}
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
function Animal({
  player,
  local = false,
}: {
  player: Player;
  local?: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const cupHand = useRef<THREE.Group>(null),
    dessertHand = useRef<THREE.Group>(null);
  const current = useRef(new THREE.Vector3(player.x, 0, player.z));
  const previous = useRef(current.current.clone());
  const color = ANIMALS.find((a) => a.id === player.animal)!.color;
  useFrame((_, dt) => {
    if (!group.current) return;
    current.current.lerp(
      new THREE.Vector3(player.x, player.seat === null ? 0 : 0.39, player.z),
      local ? 1 : 1 - Math.exp(-dt * 12),
    );
    const moving = previous.current.distanceTo(current.current) > 0.003;
    group.current.position.copy(current.current);
    group.current.position.y += moving
      ? Math.sin(performance.now() * 0.012) * 0.035
      : 0;
    let delta = player.angle - group.current.rotation.y;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    group.current.rotation.y += delta * (1 - Math.exp(-dt * 15));
    previous.current.copy(current.current);
    const progress = actionProgress(player),
      lift = Math.sin(progress * Math.PI);
    if (cupHand.current) {
      cupHand.current.position.set(
        0.36 - lift * (player.action === "drink" ? 0.25 : 0),
        0.58 + lift * (player.action === "drink" ? 0.3 : 0),
        0.2 + lift * (player.action === "drink" ? 0.12 : 0),
      );
      cupHand.current.rotation.z = player.action === "drink" ? lift * 0.7 : 0;
    }
    if (dessertHand.current) {
      dessertHand.current.position.set(
        -0.35 + lift * (player.action === "eat" ? 0.22 : 0),
        0.57 + lift * (player.action === "eat" ? 0.26 : 0),
        0.2 + lift * (player.action === "eat" ? 0.12 : 0),
      );
    }
  });
  return (
    <group ref={group} position={[player.x, 0, player.z]}>
      <Ball position={[0, 0.45, 0]} scale={[0.29, 0.36, 0.23]} color={color} />
      <Ball position={[0, 0.88, 0]} scale={[0.36, 0.32, 0.3]} color={color} />
      {[-1, 1].map((side) => (
        <group key={side}>
          {player.animal === "rabbit" ? (
            <Ball
              position={[side * 0.18, 1.27, 0]}
              scale={[0.095, 0.32, 0.09]}
              color={color}
            />
          ) : player.animal === "cat" ? (
            <mesh position={[side * 0.24, 1.15, 0]} rotation-z={-side * 0.18}>
              <coneGeometry args={[0.14, 0.28, 3]} />
              <meshStandardMaterial color={color} />
            </mesh>
          ) : (
            <Ball
              position={[side * 0.3, player.animal === "dog" ? 0.86 : 1.12, 0]}
              scale={[0.12, player.animal === "dog" ? 0.22 : 0.13, 0.1]}
              color={player.animal === "dog" ? "#a97d61" : color}
            />
          )}
          <Ball
            position={[side * 0.115, 0.93, 0.274]}
            scale={[0.032, 0.04, 0.02]}
            color="#50443f"
          />
          <Ball
            position={[side * 0.24, 0.82, 0.24]}
            scale={[0.065, 0.035, 0.02]}
            color="#eeadb7"
          />
          <Ball
            position={[side * 0.16, 0.12, 0.07]}
            scale={[0.12, 0.1, 0.16]}
            color={color}
          />
          <Ball
            position={[side * 0.3, 0.48, 0.08]}
            scale={[0.1, 0.17, 0.1]}
            color={color}
          />
        </group>
      ))}
      <Ball
        position={[0, 0.83, 0.3]}
        scale={[0.037, 0.025, 0.026]}
        color="#9f786e"
      />
      {player.drink &&
        (!player.drinkPlaced ||
          (player.action === "drink" && actionProgress(player) < 1)) && (
          <group ref={cupHand} position={[0.36, 0.58, 0.2]}>
            <Cup
              drink={player.drink}
              getLevel={() =>
                Math.max(
                  0,
                  (player.drinkLevel ?? 4) -
                    (player.action === "drink" ? actionProgress(player) : 0),
                )
              }
              level={Math.max(
                0,
                (player.drinkLevel ?? 4) -
                  (player.action === "drink" && actionProgress(player) < 1
                    ? actionProgress(player)
                    : 0),
              )}
            />
          </group>
        )}
      {player.dessert !== null &&
        (!player.dessertPlaced ||
          (player.action === "eat" && actionProgress(player) < 1)) && (
          <group ref={dessertHand} position={[-0.35, 0.57, 0.2]} scale={0.65}>
            <DessertModel
              kind={player.dessert}
              getBites={() =>
                Math.max(
                  0.1,
                  (player.dessertBites ?? 3) -
                    (player.action === "eat" ? actionProgress(player) : 0),
                )
              }
              bites={Math.max(
                0.1,
                (player.dessertBites ?? 3) -
                  (player.action === "eat" && actionProgress(player) < 1
                    ? actionProgress(player)
                    : 0),
              )}
            />
          </group>
        )}
      <Html
        position={[0, 1.75, 0]}
        center
        distanceFactor={9}
        style={{ pointerEvents: "none" }}
      >
        <div
          data-x={player.x.toFixed(3)}
          data-z={player.z.toFixed(3)}
          data-action={player.action ?? "idle"}
          data-drink-level={player.drinkLevel ?? 4}
          data-dessert-bites={player.dessertBites ?? 3}
          className={`name-tag ${local ? "you" : ""}`}
        >
          {player.name}
          {local ? " · 나" : ""}
        </div>
      </Html>
    </group>
  );
}
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
            color={["#fff4c0", "#f5d9df", "#ddd6f4", "#dcede4"][i % 4]}
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
}) {
  const handlers = useRef({ onSeat, onMachine, onGuestbook });
  handlers.current = { onSeat, onMachine, onGuestbook };
  const interaction = useMemo(
    () => ({
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
  useFrame((_, dt) => {
    const p = player.current,
      c = controls.current;
    if (entered && p.seat === null && !c.cameraBusy && !blocked) {
      let x =
        c.x +
        (c.keys.has("d") || c.keys.has("arrowright") ? 1 : 0) -
        (c.keys.has("a") || c.keys.has("arrowleft") ? 1 : 0);
      let z =
        c.z +
        (c.keys.has("s") || c.keys.has("arrowdown") ? 1 : 0) -
        (c.keys.has("w") || c.keys.has("arrowup") ? 1 : 0);
      const length = Math.hypot(x, z);
      if (length > 0) {
        x /= Math.max(1, length);
        z /= Math.max(1, length);
        const next = clampPosition(
          p.x + x * Math.min(dt, 0.05) * 2.4,
          p.z + z * Math.min(dt, 0.05) * 2.4,
        );
        const blocked =
          TABLES.some(
            ([tx, tz]) => Math.hypot(next.x - tx, next.z - tz) < 0.87,
          ) ||
          (next.z > 3.1 && next.x > 1.7);
        if (!blocked) {
          p.x = next.x;
          p.z = next.z;
          audio.play("step");
        }
        p.angle = Math.atan2(x, z);
      }
    }
    gl.domElement.dataset.player = JSON.stringify([
      +p.x.toFixed(3),
      +p.z.toFixed(3),
    ]);
    tick();
  });
  return (
    <>
      <color attach="background" args={["#f5efe6"]} />
      <fog attach="fog" args={["#f5efe6", 18, 32]} />
      <ambientLight intensity={0.9} />
      <hemisphereLight args={["#fff4e6", "#dcede4", 0.8]} />
      <directionalLight position={[3, 8, 2]} intensity={2.5} color="#ffedcf" />
      <CameraRig entered={entered} reset={cameraReset} controls={controls} />
      <Cafe
        onSeat={interaction.seat}
        onMachine={interaction.machine}
        onGuestbook={interaction.guestbook}
        brewAt={Math.max(
          0,
          ...[player.current, ...others]
            .filter((p) => p.action === "brew")
            .map((p) => p.actionAt ?? 0),
        )}
        brewDrink={brewDrink}
      />
      {[player.current, ...others]
        .filter((p) => p.seat !== null)
        .map((p) => {
          const table = TABLES[Math.floor(p.seat! / 2)],
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
      {others.map((p) => (
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
