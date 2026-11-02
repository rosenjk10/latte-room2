import { useRef, useLayoutEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Mesh } from "three";
import type { Player } from "./model";
import { actionProgress } from "./model";
import { Cup, DessertModel } from "./CafeObjects";
import { OpenBook, WateringCan } from "./HealingObjects";
/** Local-only view model; remote visitors still see the original attached paw props. */
export default function FirstPersonHands({
  player,
  visible,
}: {
  player: React.RefObject<Player>;
  visible: boolean;
}) {
  const root = useRef<Group>(null),
    cup = useRef<Group>(null);
  // First-person hands are a foreground view model: nearby counters must not
  // erase the cup. Materials belong to this local instance, never remote props.
  useLayoutEffect(() => {
    root.current?.traverse((node) => {
      if (node instanceof Mesh) {
        node.renderOrder = 1000;
        for (const material of Array.isArray(node.material)
          ? node.material
          : [node.material]) {
          material.depthTest = false;
          material.depthWrite = false;
        }
      }
    });
  });
  const p = player.current;
  const drinking = p.action === "drink";
  const reading = !!p.reading;
  useFrame(({ camera }) => {
    if (!root.current) return;
    root.current.position.copy(camera.position);
    root.current.quaternion.copy(camera.quaternion);
    if (cup.current) {
      const lift = drinking
        ? Math.sin(actionProgress(player.current) * Math.PI)
        : 0;
      cup.current.position.set(
        0.2 - 0.1 * lift,
        -0.19 + 0.17 * lift,
        -0.48 + 0.08 * lift,
      );
      cup.current.rotation.x = lift * 0.65;
    }
  });
  return (
    <group ref={root} visible={visible} name="first-person-hands">
      {p.drink &&
        (!p.drinkPlaced || drinking) &&
        !reading &&
        p.action !== "water" && (
          <group ref={cup} name="first-person-cup">
            <mesh position={[0, -0.06, 0.03]} scale={[0.075, 0.065, 0.09]}>
              <sphereGeometry args={[1, 12, 8]} />
              <meshStandardMaterial color="#d9b599" />
            </mesh>
            <Cup
              drink={p.drink}
              level={p.drinkLevel ?? 4}
              getLevel={() =>
                Math.max(
                  0,
                  (player.current.drinkLevel ?? 4) -
                    (player.current.action === "drink"
                      ? actionProgress(player.current)
                      : 0),
                )
              }
            />
          </group>
        )}
      {reading && (
        <group position={[0, -0.25, -0.5]} scale={0.8}>
          <OpenBook book={p.book ?? 0} />
        </group>
      )}
      {p.action === "water" && (
        <group position={[0.22, -0.27, -0.55]} scale={0.7}>
          <WateringCan />
        </group>
      )}
      {p.dessert !== null &&
        (!p.dessertPlaced || p.action === "eat") &&
        !reading && (
          <group position={[-0.22, -0.3, -0.5]} scale={0.8}>
            <DessertModel kind={p.dessert} bites={p.dessertBites ?? 3} />
          </group>
        )}
    </group>
  );
}
