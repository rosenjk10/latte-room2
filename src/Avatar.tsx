import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { OpenBook, WateringCan } from "./HealingObjects";
import { Cup, DessertModel, cupDimensions } from "./CafeObjects";
import { ANIMALS, actionProgress, type Player } from "./model";
import { createMotion, advanceMotion } from "./animation";
const sphere = new THREE.SphereGeometry(1, 14, 10);
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
    <mesh position={position} scale={scale} geometry={sphere}>
      <meshStandardMaterial color={color} roughness={0.75} />
    </mesh>
  );
}
export default function Avatar({
  player,
  local = false,
}: {
  player: Player;
  local?: boolean;
}) {
  const root = useRef<THREE.Group>(null),
    body = useRef<THREE.Group>(null),
    eyes = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null),
    left = useRef<THREE.Group>(null),
    rightPaw = useRef<THREE.Group>(null),
    leftPaw = useRef<THREE.Group>(null),
    rightShape = useRef<THREE.Group>(null),
    leftShape = useRef<THREE.Group>(null),
    rightLeg = useRef<THREE.Group>(null),
    leftLeg = useRef<THREE.Group>(null),
    cupTip = useRef<THREE.Group>(null);
  const state = useRef(createMotion()),
    current = useRef(new THREE.Vector3(player.x, 0, player.z)),
    previous = useRef(new THREE.Vector3(player.x, 0, player.z));
  const math = useRef({
    target: new THREE.Vector3(),
    direction: new THREE.Vector3(),
    down: new THREE.Vector3(0, -1, 0),
    quaternion: new THREE.Quaternion(),
  });
  const reading =
    !!player.reading && player.seat !== null && player.book != null;
  const watering = player.action === "water" && actionProgress(player) < 1;
  const head = useRef<THREE.Group>(null);
  const color = ANIMALS.find((a) => a.id === player.animal)!.color;
  const seed = useRef(
    [...player.id].reduce((sum, c) => sum + c.charCodeAt(0), 0) * 0.173,
  ).current;
  const holdingCup =
    !!player.drink &&
    !reading &&
    !watering &&
    (!player.drinkPlaced ||
      (player.action === "drink" && actionProgress(player) < 1));
  const holdingPlate =
    player.dessert !== null &&
    !reading &&
    !watering &&
    (!player.dessertPlaced ||
      (player.action === "eat" && actionProgress(player) < 1));
  useFrame(({ clock }, delta) => {
    if (!root.current) return;
    const dt = Math.min(delta, 0.05),
      m = math.current;
    m.target.set(player.x, player.seat === null ? 0 : 0.39, player.z);
    const previousY = current.current.y;
    current.current.lerp(
      m.target,
      local && player.action !== "sit" ? 1 : 1 - Math.exp(-dt * 12),
    );
    current.current.y = THREE.MathUtils.damp(
      previousY,
      player.seat === null ? 0 : 0.39,
      10,
      dt,
    );
    const distance = Math.hypot(
      current.current.x - previous.current.x,
      current.current.z - previous.current.z,
    );
    const speed =
      distance > 0.8 ? 0 : Math.min(3, distance / Math.max(dt, 0.001));
    const pose = advanceMotion(
      state.current,
      player,
      speed,
      dt,
      clock.elapsedTime,
      seed,
    );
    root.current.position.copy(current.current);
    const yaw = Math.atan2(
      Math.sin(player.angle - root.current.rotation.y),
      Math.cos(player.angle - root.current.rotation.y),
    );
    root.current.rotation.y += yaw * (1 - Math.exp(-dt * 15));
    previous.current.copy(current.current);
    if (body.current) body.current.position.y = pose.bob;
    if (eyes.current) {
      eyes.current.scale.y = pose.blink;
      eyes.current.position.y =
        0.93 + (reading ? Math.sin(clock.elapsedTime * 0.7) * 0.005 : 0);
    }
    if (rightLeg.current) {
      rightLeg.current.rotation.x = THREE.MathUtils.damp(
        rightLeg.current.rotation.x,
        player.seat !== null ? -0.65 : pose.leg,
        16,
        dt,
      );
      rightLeg.current.position.y =
        0.24 + Math.max(0, Math.sin(pose.phase)) * 0.035 * pose.walk;
    }
    if (leftLeg.current) {
      leftLeg.current.rotation.x = THREE.MathUtils.damp(
        leftLeg.current.rotation.x,
        player.seat !== null ? -0.65 : -pose.leg,
        16,
        dt,
      );
      leftLeg.current.position.y =
        0.24 + Math.max(0, -Math.sin(pose.phase)) * 0.035 * pose.walk;
    }
    function arm(
      bone: THREE.Group | null,
      paw: THREE.Group | null,
      shape: THREE.Group | null,
      side: number,
      held: boolean,
      lift: number,
    ) {
      if (!bone || !paw || !shape) return;
      const tx = held ? side * (0.36 - 0.22 * lift) : side * 0.3;
      const ty = held ? 0.47 + 0.28 * lift : 0.39;
      const tz = held ? 0.2 + 0.1 * lift : 0.04 + pose.front * side;
      m.direction.set(tx - side * 0.28, ty - 0.65, tz);
      const length = THREE.MathUtils.damp(
        -paw.position.y,
        Math.max(0.22, Math.min(0.43, m.direction.length())),
        18,
        dt,
      );
      m.quaternion.setFromUnitVectors(m.down, m.direction.normalize());
      bone.quaternion.slerp(m.quaternion, 1 - Math.exp(-dt * 18));
      shape.scale.y = length / 0.29;
      paw.position.y = -length;
      paw.quaternion.copy(bone.quaternion).invert();
    }
    arm(
      right.current,
      rightPaw.current,
      rightShape.current,
      1,
      holdingCup || reading || watering,
      reading ? 0.7 : watering ? 0.4 : pose.lift,
    );
    arm(
      left.current,
      leftPaw.current,
      leftShape.current,
      -1,
      holdingPlate || reading,
      reading ? 0.7 : pose.eatLift,
    );
    if (head.current)
      head.current.rotation.x = THREE.MathUtils.damp(
        head.current.rotation.x,
        reading ? 0.035 + Math.sin(clock.elapsedTime * 0.7) * 0.018 : 0,
        8,
        dt,
      );
    if (cupTip.current) cupTip.current.rotation.x = -0.75 * pose.lift;
    root.current.userData.walkWeight = pose.walk;
    root.current.userData.blink = pose.blink;
  });
  return (
    <group ref={root} name={`avatar:${player.id}`}>
      <group ref={body} name={`body:${player.id}`}>
        <Ball
          position={[0, 0.45, 0]}
          scale={[0.29, 0.36, 0.23]}
          color={color}
        />
        {player.animal === "otter" && (
          <Ball
            position={[0, 0.46, 0.19]}
            scale={[0.19, 0.25, 0.065]}
            color="#ead9bd"
          />
        )}
        <group ref={head}>
          <Ball
            position={[0, 0.88, 0]}
            scale={[0.36, 0.32, 0.3]}
            color={color}
          />
          {[-1, 1].map((side) => (
            <group key={side}>
              {player.animal === "rabbit" ? (
                <Ball
                  position={[side * 0.18, 1.27, 0]}
                  scale={[0.095, 0.32, 0.09]}
                  color={color}
                />
              ) : player.animal === "cat" ? (
                <mesh
                  position={[side * 0.24, 1.15, 0]}
                  rotation-z={-side * 0.18}
                >
                  <coneGeometry args={[0.14, 0.28, 3]} />
                  <meshStandardMaterial color={color} />
                </mesh>
              ) : (
                <Ball
                  position={[
                    side * 0.3,
                    player.animal === "dog" ? 0.86 : 1.12,
                    0,
                  ]}
                  scale={[0.12, player.animal === "dog" ? 0.22 : 0.13, 0.1]}
                  color={player.animal === "dog" ? "#a97d61" : color}
                />
              )}
              <Ball
                position={[side * 0.24, 0.82, 0.24]}
                scale={[0.065, 0.035, 0.02]}
                color="#eeadb7"
              />
            </group>
          ))}
          {player.animal === "otter" && (
            <Ball
              position={[0, 0.8, 0.27]}
              scale={[0.2, 0.115, 0.07]}
              color="#ead9bd"
            />
          )}
          <group
            ref={eyes}
            position={[0, 0.93, 0.274]}
            name={`eyes:${player.id}`}
          >
            {[-1, 1].map((side) => (
              <Ball
                key={side}
                position={[side * 0.115, 0, 0]}
                scale={[0.032, 0.04, 0.02]}
                color="#50443f"
              />
            ))}
          </group>
          <Ball
            position={[0, 0.83, player.animal === "otter" ? 0.34 : 0.3]}
            scale={[0.037, 0.025, 0.026]}
            color="#8f6a5d"
          />
        </group>
        <group
          ref={leftLeg}
          position={[-0.16, 0.24, 0]}
          name={`leg-left:${player.id}`}
        >
          <Ball
            position={[0, -0.12, 0.06]}
            scale={[0.12, 0.1, 0.16]}
            color={color}
          />
        </group>
        <group
          ref={rightLeg}
          position={[0.16, 0.24, 0]}
          name={`leg-right:${player.id}`}
        >
          <Ball
            position={[0, -0.12, 0.06]}
            scale={[0.12, 0.1, 0.16]}
            color={color}
          />
        </group>
        <group
          ref={right}
          position={[0.28, 0.65, 0]}
          name={`arm-right:${player.id}`}
        >
          <group ref={rightShape}>
            <Ball
              position={[0, -0.12, 0]}
              scale={[0.095, 0.155, 0.095]}
              color={color}
            />
          </group>
          <group
            ref={rightPaw}
            position={[0, -0.29, 0]}
            name={`paw-right:${player.id}`}
          >
            <Ball
              position={[0, 0, 0]}
              scale={[0.08, 0.08, 0.08]}
              color={color}
            />
            {reading && (
              <group
                name={`reading-book:${player.id}`}
                position={[-0.2, 0.05, 0.04]}
                rotation-x={0.18}
              >
                <OpenBook book={player.book!} />
              </group>
            )}
            {watering && (
              <group
                name={`watering-can:${player.id}`}
                position={[-0.03, 0.05, 0.05]}
              >
                <WateringCan />
              </group>
            )}
            {holdingCup && player.drink && (
              <group
                ref={cupTip}
                name={`cup:${player.id}`}
                position={[
                  -(cupDimensions(player.drink).radius + 0.018),
                  0.04,
                  0.06,
                ]}
              >
                <Cup
                  drink={player.drink}
                  level={player.drinkLevel ?? 4}
                  getLevel={() =>
                    Math.max(
                      0,
                      (player.drinkLevel ?? 4) -
                        (player.action === "drink"
                          ? actionProgress(player)
                          : 0),
                    )
                  }
                />
              </group>
            )}
          </group>
        </group>
        <group
          ref={left}
          position={[-0.28, 0.65, 0]}
          name={`arm-left:${player.id}`}
        >
          <group ref={leftShape}>
            <Ball
              position={[0, -0.12, 0]}
              scale={[0.095, 0.155, 0.095]}
              color={color}
            />
          </group>
          <group
            ref={leftPaw}
            position={[0, -0.29, 0]}
            name={`paw-left:${player.id}`}
          >
            <Ball
              position={[0, 0, 0]}
              scale={[0.08, 0.08, 0.08]}
              color={color}
            />
            {holdingPlate && player.dessert !== null && (
              <group
                name={`plate:${player.id}`}
                position={[0.03, 0.06, 0.04]}
                scale={0.65}
              >
                <DessertModel
                  kind={player.dessert}
                  bites={player.dessertBites ?? 3}
                  getBites={() =>
                    Math.max(
                      0.1,
                      (player.dessertBites ?? 3) -
                        (player.action === "eat" ? actionProgress(player) : 0),
                    )
                  }
                />
              </group>
            )}
          </group>
        </group>
      </group>
      <Html
        position={[0, 1.75, 0]}
        center
        distanceFactor={9}
        style={{ pointerEvents: "none" }}
      >
        <div
          data-player-id={player.id}
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
