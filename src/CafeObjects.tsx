import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { DRINKS, type Drink } from "./model";
import { brewState } from "./brewing";
const sphere = new THREE.SphereGeometry(1, 12, 8);
function Oval({
  p,
  s,
  color,
}: {
  p: [number, number, number];
  s: [number, number, number];
  color: string;
}) {
  return (
    <mesh position={p} scale={s} geometry={sphere}>
      <meshStandardMaterial color={color} roughness={0.65} />
    </mesh>
  );
}
function Block({
  p,
  s,
  color,
  metal = false,
}: {
  p: [number, number, number];
  s: [number, number, number];
  color: string;
  metal?: boolean;
}) {
  return (
    <mesh position={p}>
      <boxGeometry args={s} />
      <meshStandardMaterial
        color={color}
        metalness={metal ? 0.65 : 0}
        roughness={metal ? 0.28 : 0.7}
      />
    </mesh>
  );
}
export function cupDimensions(drink: Drink) {
  return {
    height:
      drink === "espresso"
        ? 0.12
        : ["americano", "vanilla", "choco"].includes(drink)
          ? 0.25
          : 0.2,
    radius:
      drink === "espresso" ? 0.07 : drink === "cappuccino" ? 0.115 : 0.095,
  };
}
export function Cup({
  drink,
  level = 4,
  getLevel,
}: {
  drink: Drink;
  level?: number;
  getLevel?: () => number;
}) {
  const d = DRINKS.find((d) => d.id === drink)!,
    espresso = drink === "espresso";
  const { height: h, radius: r } = cupDimensions(drink);
  const liquid = useRef<THREE.Mesh>(null),
    foam = useRef<THREE.Group>(null);
  useFrame(() => {
    const l = getLevel?.() ?? level,
      y = -h * 0.38 + (Math.max(0, Math.min(4, l)) / 4) * h * 0.74;
    if (liquid.current) {
      liquid.current.visible = l > 0;
      liquid.current.position.y = y;
    }
    if (foam.current) {
      foam.current.visible = l > 0;
      foam.current.position.y = y + 0.009;
    }
  });
  return (
    <group>
      <mesh>
        <cylinderGeometry args={[r, r * 0.8, h, 16, 1, true]} />
        <meshStandardMaterial
          color={d.color}
          side={THREE.DoubleSide}
          roughness={0.35}
        />
      </mesh>
      <mesh position={[0, -h / 2 + 0.009, 0]}>
        <cylinderGeometry args={[r * 0.8, r * 0.8, 0.015, 16]} />
        <meshStandardMaterial color={d.color} />
      </mesh>
      <mesh position={[r + 0.018, 0, 0]} rotation-y={Math.PI / 2}>
        <torusGeometry args={[espresso ? 0.035 : 0.05, 0.012, 5, 12]} />
        <meshStandardMaterial color={d.color} />
      </mesh>
      {level > 0 && (
        <mesh
          ref={liquid}
          name="coffee-liquid"
          position={[0, -h * 0.38 + (Math.min(4, level) / 4) * h * 0.74, 0]}
        >
          <cylinderGeometry args={[r * 0.91, r * 0.91, 0.008, 16]} />
          <meshStandardMaterial
            color={
              drink === "espresso" || drink === "americano"
                ? "#654332"
                : "#c69568"
            }
            roughness={0.4}
          />
        </mesh>
      )}
      {drink === "cappuccino" && level > 0 && (
        <group ref={foam}>
          <Oval p={[0, 0, 0]} s={[0.07, 0.012, 0.07]} color="#fff4dc" />
        </group>
      )}
      <mesh position={[0, -h * 0.18, 0]}>
        <cylinderGeometry args={[r * 0.95, r * 0.89, 0.026, 16, 1, true]} />
        <meshStandardMaterial
          color={
            drink === "vanilla"
              ? "#c39f59"
              : drink === "americano"
                ? "#819d8c"
                : drink === "choco"
                  ? "#a07186"
                  : "#c3b1cf"
          }
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
export function DessertModel({
  kind,
  bites = 3,
  plate = true,
  getBites,
}: {
  kind: number;
  bites?: number;
  plate?: boolean;
  getBites?: () => number;
}) {
  const food = useRef<THREE.Group>(null);
  useFrame(() => {
    if (food.current && getBites)
      food.current.scale.setScalar(Math.max(0.15, getBites() / 3));
  });
  return (
    <group>
      {plate && (
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.23, 0.21, 0.025, 20]} />
          <meshStandardMaterial color="#fff5e5" roughness={0.35} />
        </mesh>
      )}
      <group
        ref={food}
        scale={Math.max(0.15, bites / 3)}
        position={[0, 0.02, 0]}
      >
        {kind === 3 ? (
          <group rotation-y={0.3}>
            {[-2, -1, 0, 1, 2].map((i) => (
              <Oval
                key={i}
                p={[i * 0.055, 0.07, Math.abs(i) * 0.025]}
                s={[0.065, 0.07 - Math.abs(i) * 0.01, 0.07]}
                color={i % 2 ? "#d49a55" : "#e8bb7b"}
              />
            ))}
          </group>
        ) : kind === 4 ? (
          <>
            <mesh position={[0, 0.055, 0]}>
              <cylinderGeometry args={[0.12, 0.12, 0.08, 16]} />
              <meshStandardMaterial color="#c8b4de" />
            </mesh>
            <mesh position={[0, 0.055, 0]}>
              <cylinderGeometry args={[0.124, 0.124, 0.018, 16]} />
              <meshStandardMaterial color="#fff1dd" />
            </mesh>
          </>
        ) : kind === 1 ? (
          <>
            <mesh position={[0, 0.045, 0]}>
              <cylinderGeometry args={[0.13, 0.13, 0.055, 16]} />
              <meshStandardMaterial color="#d4a36d" />
            </mesh>
            {[0, 1, 2, 3, 4].map((i) => (
              <Oval
                key={i}
                p={[Math.sin(i * 2) * 0.075, 0.08, Math.cos(i * 2) * 0.075]}
                s={[0.021, 0.012, 0.021]}
                color="#674b3d"
              />
            ))}
          </>
        ) : kind === 2 ? (
          <>
            <mesh position={[0, 0.06, 0]}>
              <cylinderGeometry args={[0.1, 0.075, 0.12, 12]} />
              <meshStandardMaterial color="#d9b6ce" />
            </mesh>
            <Oval p={[0, 0.15, 0]} s={[0.11, 0.08, 0.11]} color="#fff1e6" />
          </>
        ) : (
          <>
            <mesh position={[0, 0.08, 0]} rotation-y={Math.PI / 4}>
              <cylinderGeometry args={[0.16, 0.16, 0.14, 3]} />
              <meshStandardMaterial
                color={kind === 5 ? "#f2d58b" : "#edd6bb"}
              />
            </mesh>
            <mesh position={[0, 0.155, 0]} rotation-y={Math.PI / 4}>
              <cylinderGeometry args={[0.16, 0.16, 0.02, 3]} />
              <meshStandardMaterial
                color={kind === 5 ? "#e1ba6f" : "#fff0e6"}
              />
            </mesh>
            {kind === 0 && (
              <Oval p={[0, 0.2, 0]} s={[0.045, 0.06, 0.045]} color="#da7c8a" />
            )}
          </>
        )}
      </group>
    </group>
  );
}
export function EspressoStation({
  brewAt,
  drink,
  onClick,
}: {
  brewAt: number;
  drink: Drink;
  onClick: () => void;
}) {
  const stream = useRef<THREE.Mesh>(null),
    cup = useRef<THREE.Group>(null),
    beans = useRef<THREE.Group>(null),
    needle = useRef<THREE.Mesh>(null),
    steam = useRef<THREE.Group>(null),
    base = useRef<THREE.Group>(null);
  useFrame(() => {
    const elapsed = Date.now() - brewAt,
      state = brewState(drink, elapsed);
    if (base.current) {
      base.current.userData.stage = state.active ? state.stage : "idle";
      base.current.userData.fill = state.active ? state.fill : 0;
    }
    if (stream.current) {
      stream.current.visible = state.active && state.stage === "extract";
      stream.current.scale.x = 0.8 + Math.sin(elapsed * 0.04) * 0.2;
    }
    if (cup.current) cup.current.visible = state.active;
    if (beans.current) {
      beans.current.rotation.y =
        state.active && state.stage === "grind" ? elapsed * 0.012 : 0;
    }
    if (needle.current)
      needle.current.rotation.z =
        state.active && ["pump", "extract"].includes(state.stage)
          ? 0.4 + Math.sin(elapsed * 0.025) * 0.12
          : -0.65;
    if (steam.current) {
      steam.current.visible = state.active && state.stage === "steam";
      steam.current.children.forEach((p, i) => {
        const t = (elapsed * 0.0015 + i * 0.3) % 1;
        p.position.set(Math.sin(t * 6 + i) * 0.045, t * 0.4, 0);
        p.scale.setScalar(0.04 + t * 0.035);
      });
    }
  });
  return (
    <group
      ref={base}
      name="espresso-machine"
      position={[2.5, 0, 3.7]}
      onClick={(e) => {
        if (e.delta > 5) return;
        e.stopPropagation();
        onClick();
      }}
    >
      <Block p={[0, 0.43, 0]} s={[1.65, 0.86, 0.92]} color="#cebea6" />
      <Block p={[0, 0.9, 0]} s={[1.75, 0.1, 1]} color="#f4e9d4" />
      <group position={[0, 0.98, 0]}>
        <RoundedBox
          args={[1.28, 0.76, 0.65]}
          radius={0.055}
          position={[0, 0.5, 0]}
        >
          <meshStandardMaterial
            color="#e9dfca"
            metalness={0.2}
            roughness={0.38}
          />
        </RoundedBox>
        <Block
          p={[0, 0.19, 0.2]}
          s={[1.27, 0.12, 0.68]}
          color="#b8bebc"
          metal
        />
        <Block
          p={[0, 0.34, 0.22]}
          s={[1.08, 0.23, 0.32]}
          color="#6f7471"
          metal
        />
        {[-0.36, -0.18, 0, 0.18, 0.36].map((x) => (
          <Block
            key={x}
            p={[x, 0.265, 0.35]}
            s={[0.016, 0.025, 0.24]}
            color="#c5cbc6"
            metal
          />
        ))}
        <mesh position={[-0.3, 1.03, -0.09]}>
          <cylinderGeometry args={[0.23, 0.16, 0.35, 16]} />
          <meshPhysicalMaterial
            color="#d7e3df"
            transparent
            opacity={0.32}
            roughness={0.15}
            depthWrite={false}
          />
        </mesh>
        <group ref={beans} position={[-0.3, 0, -0.09]}>
          {" "}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Oval
              key={i}
              p={[
                Math.sin(i * 2) * 0.11,
                0.93 + (i % 2) * 0.035,
                Math.cos(i * 2) * 0.09,
              ]}
              s={[0.055, 0.035, 0.04]}
              color="#624735"
            />
          ))}
        </group>
        <mesh position={[-0.3, 1.22, -0.09]}>
          <cylinderGeometry args={[0.24, 0.24, 0.045, 16]} />
          <meshStandardMaterial
            color="#b9c2be"
            metalness={0.7}
            roughness={0.25}
          />
        </mesh>
        <mesh position={[0.11, 0.72, 0.34]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.115, 0.115, 0.025, 20]} />
          <meshStandardMaterial color="#faf8ee" />
        </mesh>
        <mesh ref={needle} position={[0.11, 0.72, 0.36]} rotation-z={-0.65}>
          <boxGeometry args={[0.012, 0.14, 0.012]} />
          <meshStandardMaterial color="#777f78" />
        </mesh>
        {[-0.35, -0.18, 0.43].map((x) => (
          <mesh key={x} position={[x, 0.7, 0.35]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.045, 0.045, 0.04, 12]} />
            <meshStandardMaterial
              color="#a5b3ae"
              metalness={0.65}
              roughness={0.25}
            />
          </mesh>
        ))}
        <Block
          p={[-0.12, 0.56, 0.4]}
          s={[0.31, 0.1, 0.2]}
          color="#b5bcb8"
          metal
        />
        <mesh position={[0.03, 0.56, 0.48]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.035, 0.045, 0.37, 10]} />
          <meshStandardMaterial color="#666a64" />
        </mesh>
        <mesh position={[0.47, 0.39, 0.37]} rotation-z={-0.2}>
          <cylinderGeometry args={[0.014, 0.014, 0.37, 8]} />
          <meshStandardMaterial
            color="#b6c2be"
            metalness={0.8}
            roughness={0.25}
          />
        </mesh>
        <group ref={steam} position={[0.47, 0.3, 0.4]}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} geometry={sphere}>
              <meshBasicMaterial
                color="#fff4df"
                transparent
                opacity={0.24}
                depthWrite={false}
              />
            </mesh>
          ))}
        </group>
        <mesh name="coffee-stream" position={[-0.12, 0.4, 0.4]} ref={stream}>
          <cylinderGeometry args={[0.009, 0.011, 0.27, 6]} />
          <meshBasicMaterial color="#8f6242" />
        </mesh>
        <group name="brew-cup" ref={cup} position={[-0.12, 0.32, 0.4]}>
          <Cup
            drink={drink}
            getLevel={() => brewState(drink, Date.now() - brewAt).fill * 4}
          />
        </group>
        <Html
          position={[0, 0.86, 0.35]}
          transform
          center
          distanceFactor={4}
          style={{ pointerEvents: "none" }}
        >
          <div className="espresso-label">PAUSE / ESPRESSO</div>
        </Html>
      </group>
    </group>
  );
}
export function DessertCase({ onClick }: { onClick: () => void }) {
  return (
    <group
      position={[4.25, 0, 3.7]}
      onClick={(e) => {
        if (e.delta > 5) return;
        e.stopPropagation();
        onClick();
      }}
    >
      <Block p={[0, 0.43, 0]} s={[1.55, 0.86, 0.92]} color="#d4bfae" />
      <Block p={[0, 0.9, 0]} s={[1.65, 0.1, 1]} color="#f3dfce" />
      <mesh position={[0, 1.52, 0]}>
        <boxGeometry args={[1.6, 0.025, 0.95]} />
        <meshPhysicalMaterial
          color="#e0eee8"
          transparent
          opacity={0.16}
          roughness={0.1}
          depthWrite={false}
        />
      </mesh>
      <Block p={[0, 1.52, 0.46]} s={[1.6, 0.045, 0.035]} color="#d8c4b0" />
      <Block p={[0, 1.52, -0.46]} s={[1.6, 0.045, 0.035]} color="#d8c4b0" />
      <Block p={[0, 1.16, -0.43]} s={[1.55, 0.58, 0.035]} color="#efe3cb" />
      {[
        [-0.77, 0],
        [0.77, 0],
      ].map(([x, z], i) => (
        <Block key={i} p={[x, 1.2, z]} s={[0.04, 0.58, 0.91]} color="#dbcfb9" />
      ))}
      <mesh position={[0, 1.2, 0.46]}>
        <boxGeometry args={[1.5, 0.55, 0.025]} />
        <meshPhysicalMaterial
          color="#cfe8e7"
          transparent
          opacity={0.18}
          roughness={0.08}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 1.48, -0.35]}>
        <boxGeometry args={[1.49, 0.01, 0.035]} />
        <meshBasicMaterial color="#ffe6a0" />
      </mesh>
      <Block p={[0, 1.18, 0]} s={[1.5, 0.025, 0.8]} color="#eadbc8" />
      {[3, 4, 1, 0, 5].map((kind, i) => (
        <group
          key={kind}
          position={[
            -0.5 + (i % 3) * 0.49,
            i < 3 ? 0.96 : 1.22,
            i < 3 ? 0.17 : 0.0,
          ]}
          scale={0.75}
        >
          <DessertModel kind={kind} />
        </group>
      ))}
      <Html
        position={[0, 0.69, 0.49]}
        transform
        center
        distanceFactor={4}
        style={{ pointerEvents: "none" }}
      >
        <div className="espresso-label">PETITE PATISSERIE</div>
      </Html>
    </group>
  );
}
export function CorkBoard({ onClick }: { onClick: () => void }) {
  return (
    <group
      position={[-5.64, 2.05, 2]}
      rotation-y={Math.PI / 2}
      onClick={(e) => {
        if (e.delta > 5) return;
        e.stopPropagation();
        onClick();
      }}
    >
      <RoundedBox args={[1.9, 1.3, 0.12]} radius={0.04}>
        <meshStandardMaterial color="#b18a62" />
      </RoundedBox>
      <Block p={[0, 0, 0.07]} s={[1.74, 1.13, 0.025]} color="#c8a67d" />
      {[-1, 0, 1].flatMap((x, i) =>
        [-1, 1].map((y, j) => (
          <group
            key={`${x}/${y}`}
            position={[x * 0.5, y * 0.25, 0.1]}
            rotation-z={(i - j) * 0.1}
          >
            <Block
              p={[0, 0, 0]}
              s={[0.4, 0.35, 0.012]}
              color={["#f5d9df", "#dcede4", "#ddd6f4"][(i + j) % 3]}
            />
            <Oval
              p={[0, 0.13, 0.02]}
              s={[0.025, 0.025, 0.018]}
              color="#d78085"
            />
            <Block p={[0, 0, 0.012]} s={[0.26, 0.012, 0.01]} color="#a89881" />
            <Block
              p={[-0.025, -0.06, 0.012]}
              s={[0.21, 0.012, 0.01]}
              color="#a89881"
            />
          </group>
        )),
      )}
      <Html
        position={[0, 0.83, 0]}
        transform
        center
        distanceFactor={4}
        style={{ pointerEvents: "none" }}
      >
        <div className="espresso-label">OUR LITTLE GUESTBOOK</div>
      </Html>
    </group>
  );
}
