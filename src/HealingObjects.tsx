import { Cup } from "./CafeObjects";
import { memo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import { BOOKS, CHAIR_POSITIONS, roomLayout } from "./world";
import { BLOOM_MS, type Flower, type SharedState } from "./roomState";
const ball = new THREE.SphereGeometry(1, 10, 7),
  petal = new THREE.SphereGeometry(1, 8, 6);
function Box({
  p,
  s,
  color,
}: {
  p: [number, number, number];
  s: [number, number, number];
  color: string;
}) {
  return (
    <mesh position={p}>
      <boxGeometry args={s} />
      <meshStandardMaterial color={color} roughness={0.8} />
    </mesh>
  );
}
export function OpenBook({
  book,
  turn = true,
}: {
  book: number;
  turn?: boolean;
}) {
  const pages = useRef<THREE.Group>(null),
    covers = useRef<THREE.Group>(null);
  useFrame(({ clock }, dt) => {
    if (covers.current)
      covers.current.scale.x = THREE.MathUtils.damp(
        covers.current.scale.x,
        1,
        8,
        dt,
      );
    if (pages.current)
      pages.current.rotation.z = turn
        ? Math.sin(clock.elapsedTime * 0.8) * 0.18
        : 0;
  });
  return (
    <group name="open-book" ref={covers} scale={[0.15, 1, 1]}>
      <Box
        p={[-0.105, 0, 0]}
        s={[0.21, 0.02, 0.27]}
        color={BOOKS[book]?.color ?? "#dcede4"}
      />
      <Box
        p={[0.105, 0, 0]}
        s={[0.21, 0.02, 0.27]}
        color={BOOKS[book]?.color ?? "#dcede4"}
      />
      <Box p={[-0.1, 0.015, 0]} s={[0.185, 0.018, 0.245]} color="#fff7e5" />
      <Box p={[0.1, 0.015, 0]} s={[0.185, 0.018, 0.245]} color="#fff7e5" />
      <group ref={pages}>
        <Box p={[0.1, 0.03, 0]} s={[0.185, 0.006, 0.24]} color="#fff9ed" />
      </group>
      {[-1, 1].flatMap((side) =>
        [0, 1, 2].map((i) => (
          <Box
            key={`${side}/${i}`}
            p={[side * 0.1, 0.027, -0.06 + i * 0.05]}
            s={[0.12, 0.002, 0.005]}
            color="#c8bca6"
          />
        )),
      )}
    </group>
  );
}
export function WateringCan() {
  return (
    <group name="watering-can" rotation-x={0.75}>
      <mesh>
        <cylinderGeometry args={[0.095, 0.08, 0.16, 12]} />
        <meshStandardMaterial color="#adc8ba" />
      </mesh>
      <mesh position={[0, 0.01, -0.1]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.075, 0.018, 5, 12]} />
        <meshStandardMaterial color="#adc8ba" />
      </mesh>
      <mesh position={[0, 0.025, 0.14]} rotation-x={0.9}>
        <cylinderGeometry args={[0.025, 0.018, 0.22, 8]} />
        <meshStandardMaterial color="#adc8ba" />
      </mesh>
    </group>
  );
}
export function flowerFade(f: Flower, now: number) {
  return f.stage === 4
    ? Math.max(0, Math.min(1, (BLOOM_MS - (now - f.bloomAt)) / 5000))
    : 1;
}
function GrowingPot({
  flower,
  index,
  onClick,
}: {
  flower: Flower;
  index: number;
  onClick: () => void;
}) {
  const growth = useRef<THREE.Group>(null),
    water = useRef<THREE.Group>(null),
    sparkles = useRef<THREE.Group>(null);
  const color = ["#e9b6cc", "#c6b5ec", "#f6d79c", "#c8dca8"][flower.seed % 4];
  useFrame(({ clock }) => {
    const now = Date.now();
    if (growth.current) growth.current.scale.setScalar(flowerFade(flower, now));
    if (water.current) {
      const age = now - flower.wateredAt;
      water.current.visible = age >= 0 && age < 1800;
      water.current.children.forEach((n, i) => {
        const t = (clock.elapsedTime * 1.6 + i * 0.21) % 1;
        n.position.set(
          Math.sin(i * 2) * 0.08,
          0.7 - t * 0.55,
          Math.cos(i * 2) * 0.07,
        );
      });
    }
    if (sparkles.current) {
      sparkles.current.visible =
        (flower.wateredAt > 0 && now - flower.wateredAt < 1800) ||
        (flower.stage === 4 &&
          (now - flower.bloomAt < 2200 || clock.elapsedTime % 5 < 0.8));
      sparkles.current.rotation.y = clock.elapsedTime;
      sparkles.current.children.forEach((n, i) => {
        n.position.y = 0.7 + Math.sin(clock.elapsedTime * 3 + i) * 0.15;
      });
    }
  });
  return (
    <group
      name={`garden-pot:${index}`}
      userData={{
        stage: flower.stage,
        version: flower.version,
        cycle: flower.cycle,
      }}
      onClick={(e) => {
        if (e.delta > 5) return;
        e.stopPropagation();
        onClick();
      }}
    >
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.23, 0.17, 0.36, 12]} />
        <meshStandardMaterial
          color={["#dcb7a5", "#ddd6f4", "#cadcce"][index % 3]}
        />
      </mesh>
      <mesh position={[0, 0.365, 0]}>
        <cylinderGeometry args={[0.207, 0.207, 0.018, 12]} />
        <meshStandardMaterial color="#8f775e" />
      </mesh>
      <group ref={growth}>
        {flower.stage === 0 ? (
          <mesh
            position={[0, 0.39, 0]}
            scale={[0.045, 0.025, 0.03]}
            geometry={ball}
          >
            <meshStandardMaterial color="#c8aa75" />
          </mesh>
        ) : (
          <>
            <mesh position={[0, 0.38 + (flower.stage >= 2 ? 0.2 : 0.08), 0]}>
              <cylinderGeometry
                args={[0.018, 0.022, flower.stage >= 2 ? 0.4 : 0.16, 7]}
              />
              <meshStandardMaterial color="#819f75" />
            </mesh>
            {[-1, 1].map((side) => (
              <mesh
                key={side}
                position={[side * 0.08, 0.5, 0]}
                rotation-z={side * 0.5}
                scale={[0.12, 0.045, 0.06]}
                geometry={petal}
              >
                <meshStandardMaterial color="#9dbb8b" />
              </mesh>
            ))}
            {flower.stage === 3 && (
              <mesh
                position={[0, 0.83, 0]}
                scale={[0.08, 0.12, 0.08]}
                geometry={ball}
              >
                <meshStandardMaterial color={color} />
              </mesh>
            )}
            {flower.stage === 4 && (
              <group position={[0, 0.85, 0]} rotation-x={-0.35}>
                {Array.from(
                  { length: flower.seed % 3 === 0 ? 5 : 7 },
                  (_, i) => (
                    <mesh
                      key={i}
                      geometry={petal}
                      position={[
                        Math.cos(
                          (i * Math.PI * 2) / (flower.seed % 3 === 0 ? 5 : 7),
                        ) * 0.11,
                        0.025,
                        Math.sin(
                          (i * Math.PI * 2) / (flower.seed % 3 === 0 ? 5 : 7),
                        ) * 0.11,
                      ]}
                      scale={[0.105, 0.04, 0.09]}
                    >
                      <meshStandardMaterial color={color} />
                    </mesh>
                  ),
                )}
                <mesh geometry={ball} scale={[0.065, 0.04, 0.065]}>
                  <meshStandardMaterial color="#f3db9d" />
                </mesh>
              </group>
            )}
          </>
        )}
      </group>
      <group ref={water}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} geometry={ball} scale={[0.025, 0.04, 0.025]}>
            <meshBasicMaterial color="#bcdfe0" transparent opacity={0.7} />
          </mesh>
        ))}
      </group>
      <group ref={sparkles}>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh
            key={i}
            position={[Math.sin(i * 2) * 0.32, 0.8, Math.cos(i * 2) * 0.32]}
            scale={0.025}
          >
            <octahedronGeometry />
            <meshBasicMaterial color="#fff0b6" />
          </mesh>
        ))}
      </group>
    </group>
  );
}
export const HealingInterior = memo(function HealingInterior({
  room,
  state,
  onBook,
  onPot,
  onSeat,
}: {
  room: number;
  state: SharedState;
  onBook: (i: number) => void;
  onPot: (i: number) => void;
  onSeat: (i: number) => void;
}) {
  const l = roomLayout(room);
  return (
    <group onClick={(e) => e.stopPropagation()}>
      <group
        position={[l.shelf.x, 0, l.shelf.z]}
        rotation-y={l.shelf.x > 0 ? -Math.PI / 2 : Math.PI / 2}
        name="bookshelf"
      >
        {[-0.74, 0.74].map((x) => (
          <Box
            key={x}
            p={[x, 1.18, 0]}
            s={[0.06, 2.35, 0.47]}
            color="#bfa084"
          />
        ))}
        {[0.08, 0.65, 1.2, 1.77, 2.34].map((y) => (
          <Box key={y} p={[0, y, 0]} s={[1.55, 0.06, 0.47]} color="#c9ad8c" />
        ))}
        {BOOKS.map((b, i) => (
          <group
            key={b.title}
            name={`shelf-book:${i}`}
            position={[-0.58 + i * 0.23, 1.44, 0.06]}
            rotation-z={i % 2 ? -0.05 : 0.03}
            onClick={(e) => {
              if (e.delta > 5) return;
              e.stopPropagation();
              onBook(i);
            }}
          >
            <Box p={[0, 0, 0]} s={[0.17, 0.4, 0.28]} color={b.color} />
            <Box p={[0, 0.1, 0.145]} s={[0.1, 0.015, 0.005]} color="#a19176" />
            <Html
              position={[0, -0.02, 0.15]}
              transform
              center
              distanceFactor={5}
              style={{ pointerEvents: "none" }}
            >
              <div className="book-spine">{b.title}</div>
            </Html>
          </group>
        ))}
        {[0, 1, 2, 3].map((i) => (
          <group key={i} position={[-0.5 + i * 0.32, 0.88, 0]}>
            <Box
              p={[0, 0, 0]}
              s={[0.22, 0.07, 0.34]}
              color={BOOKS[(i + room) % 6].color}
            />
          </group>
        ))}
        <group position={[0.2, 1.81, 0]} rotation-y={0.25}>
          <OpenBook book={room % 6} turn={false} />
        </group>
      </group>
      {[12, 13].map((i) => {
        const p = CHAIR_POSITIONS[i];
        return (
          <group
            key={i}
            name={`reading-chair:${i}`}
            position={[p.x, 0, p.z]}
            rotation-y={p.angle}
            onClick={(e) => {
              if (e.delta > 5) return;
              e.stopPropagation();
              onSeat(i);
            }}
          >
            <Box p={[0, 0.43, 0]} s={[0.8, 0.25, 0.8]} color={l.accent} />
            <Box p={[0, 0.83, -0.33]} s={[0.8, 0.72, 0.16]} color={l.accent} />
            {[-1, 1].map((s) => (
              <Box
                key={s}
                p={[s * 0.37, 0.64, 0]}
                s={[0.13, 0.32, 0.7]}
                color={l.accent}
              />
            ))}
            <Box p={[0, 0.8, -0.2]} s={[0.5, 0.4, 0.15]} color="#fff4e6" />
            {[-1, 1].flatMap((x) =>
              [-1, 1].map((z) => (
                <Box
                  key={`${x}/${z}`}
                  p={[x * 0.28, 0.16, z * 0.28]}
                  s={[0.07, 0.3, 0.07]}
                  color="#b29377"
                />
              )),
            )}
          </group>
        );
      })}
      <mesh position={[-4.1, 0.004, 0.3]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[1.25, 24]} />
        <meshStandardMaterial color={l.accent} roughness={1} />
      </mesh>
      <group position={[-4.5, 0, 1.05]}>
        <Box p={[0, 0.58, 0]} s={[0.65, 0.06, 0.65]} color="#d7bfa2" />
        <Box p={[0, 0.28, 0]} s={[0.1, 0.56, 0.1]} color="#b39478" />
        <group position={[0, 0.64, 0]} rotation-y={0.3}>
          <OpenBook book={(room + 1) % 6} turn={false} />
        </group>
      </group>
      <group position={[-5.2, 0, 0.6]}>
        <mesh position={[0, 0.05, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.08, 12]} />
          <meshStandardMaterial color="#b6a385" />
        </mesh>
        <Box p={[0, 1, 0]} s={[0.035, 2, 0.035]} color="#b6a385" />
        <mesh position={[0, 2, 0]}>
          <coneGeometry args={[0.31, 0.38, 16, 1, true]} />
          <meshStandardMaterial color="#f6e6bf" side={THREE.DoubleSide} />
        </mesh>
      </group>
      {l.pots.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]}>
          <GrowingPot
            flower={state.flowers[i]}
            index={i}
            onClick={() => onPot(i)}
          />
        </group>
      ))}
      <group position={[-1.7, 3.3, -5.03]} rotation-x={Math.PI / 2}>
        <mesh>
          <cylinderGeometry args={[0.27, 0.27, 0.04, 20]} />
          <meshStandardMaterial color="#c9b195" />
        </mesh>
        <mesh position={[0, 0.03, 0]}>
          <cylinderGeometry args={[0.23, 0.23, 0.01, 20]} />
          <meshStandardMaterial color="#fff7e8" />
        </mesh>
        <Box p={[0.045, 0.045, 0]} s={[0.11, 0.012, 0.02]} color="#837969" />
        <Box p={[0, 0.045, 0.06]} s={[0.02, 0.012, 0.14]} color="#837969" />
      </group>
      {[-4.7, 4.7].map((x, i) => (
        <group key={x} position={[x, 2.4, -5.04]}>
          <Box p={[0, 0, 0]} s={[0.65, 0.85, 0.07]} color="#b79b7b" />
          <Box
            p={[0, 0, 0.05]}
            s={[0.54, 0.74, 0.02]}
            color={i ? "#ddd6f4" : "#f5d9df"}
          />
          <mesh
            position={[0, 0.04, 0.08]}
            geometry={ball}
            scale={[0.18, 0.23, 0.02]}
          >
            <meshStandardMaterial color="#fff1d6" />
          </mesh>
        </group>
      ))}
      <group position={[2.55, 2.65, 4.05]}>
        <Box p={[0, 0, 0]} s={[1.5, 0.06, 0.3]} color="#c4a689" />
        {[0, 1, 2].map((i) => (
          <group key={i} position={[-0.5 + i * 0.5, 0.12, 0]}>
            <mesh>
              <cylinderGeometry args={[0.09, 0.09, 0.23, 10]} />
              <meshPhysicalMaterial
                color="#dce4db"
                transparent
                opacity={0.4}
                roughness={0.2}
              />
            </mesh>
            <mesh>
              <cylinderGeometry args={[0.075, 0.075, 0.17, 10]} />
              <meshStandardMaterial color="#82674e" />
            </mesh>
          </group>
        ))}
      </group>
      <group position={[0, 1.12, -4.94]}>
        <Box p={[0, 0, 0]} s={[1.9, 0.05, 0.3]} color="#d8c2a6" />
        {[-0.65, -0.25, 0.15].map((x, i) => (
          <group key={x} position={[x, 0.14, 0]}>
            <Cup
              drink={
                ["latte", "americano", "cappuccino"][
                  i
                ] as import("./model").Drink
              }
              level={0}
            />
          </group>
        ))}
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[0.65, 0.035 + i * 0.018, 0]}>
            <cylinderGeometry args={[0.14, 0.14, 0.015, 12]} />
            <meshStandardMaterial color="#fff1d7" />
          </mesh>
        ))}
      </group>
      <group position={[-3.5, 1.3, -4.98]}>
        <Box p={[0, 0, 0]} s={[2.2, 0.06, 0.32]} color="#d8c2a6" />
        {[-0.7, 0, 0.7].map((x) => (
          <mesh
            key={x}
            position={[x, 0.12, 0]}
            scale={[0.08, 0.12, 0.08]}
            geometry={ball}
          >
            <meshStandardMaterial color={l.accent} />
          </mesh>
        ))}
      </group>
    </group>
  );
});
