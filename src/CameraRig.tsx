import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3, Quaternion } from "three";
import { cameraPosition } from "./world";
import type { Player } from "./model";
import type { Controls } from "./Scene";
import {
  PITCH_LIMIT,
  THIRD_DISTANCE,
  THIRD_PITCH,
  viewDirection,
} from "./camera";

/** Character-anchored cameras. View yaw is independent of avatar steering. */
export default function CameraRig({
  entered,
  reset,
  controls,
  room,
  player,
  eye,
}: {
  entered: boolean;
  room: number;
  player: React.RefObject<Player>;
  eye: boolean;
  reset: number;
  controls: React.RefObject<Controls>;
}) {
  const { camera, gl } = useThree();
  const view = useRef({
    yaw: player.current.angle,
    pitch: 0,
    distance: THIRD_DISTANCE.initial as number,
  });
  const transition = useRef(0);
  const previousRotation = useRef(new Quaternion());
  const targetRotation = useRef(new Quaternion());
  const eyeHeading = useRef(player.current.angle);
  const anchor = useRef(new Vector3());
  const previousAnchor = useRef(new Vector3());
  const desired = useRef(new Vector3()),
    direction = useRef(new Vector3()),
    look = useRef(new Vector3());
  const initialized = useRef(false);
  useEffect(() => {
    view.current.yaw = player.current.angle;
    view.current.pitch = eye ? 0 : THIRD_PITCH.initial;
    view.current.distance = THIRD_DISTANCE.initial;
    transition.current = 0.3;
  }, [entered, reset, room]);
  useEffect(() => {
    if (!eye) view.current.pitch = THIRD_PITCH.initial;
    transition.current = 0.3;
  }, [eye]);
  useEffect(() => {
    const el = gl.domElement;
    const points = new Map<
      number,
      { x: number; y: number; startX: number; startY: number }
    >();
    let dragged = false;
    const span = () => {
      const p = [...points.values()];
      return p.length === 2 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0;
    };
    const zoom = (factor: number) => {
      view.current.distance = Math.max(
        THIRD_DISTANCE.min,
        Math.min(THIRD_DISTANCE.max, view.current.distance * factor),
      );
    };
    const down = (e: PointerEvent) => {
      if (
        !entered ||
        (e.pointerType === "mouse" && e.button !== 0 && e.button !== 2)
      )
        return;
      if (!points.size) dragged = false;
      points.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
        startX: e.clientX,
        startY: e.clientY,
      });
      if (points.size > 1) dragged = true;
    };
    const move = (e: PointerEvent) => {
      const p = points.get(e.pointerId);
      if (!p) return;
      const before = span(),
        dx = e.clientX - p.x,
        dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (Math.hypot(p.x - p.startX, p.y - p.startY) > 5) dragged = true;
      if (!dragged) return;
      controls.current.cameraBusy = true;
      controls.current.draggedUntil = performance.now() + 180;
      if (points.size === 1) {
        view.current.yaw -= dx * 0.006;
        view.current.pitch = Math.max(
          eye ? -PITCH_LIMIT : THIRD_PITCH.min,
          Math.min(
            eye ? PITCH_LIMIT : THIRD_PITCH.max,
            view.current.pitch + dy * 0.006,
          ),
        );
      } else if (before > 0) zoom(before / Math.max(1, span()));
    };
    const up = (e: PointerEvent) => {
      if (points.has(e.pointerId) && dragged)
        controls.current.draggedUntil = performance.now() + 180;
      points.delete(e.pointerId);
      if (!points.size) controls.current.cameraBusy = false;
    };
    const wheel = (e: WheelEvent) => {
      if (entered && !eye) {
        e.preventDefault();
        zoom(Math.exp(e.deltaY * 0.001));
      }
    };
    const clear = () => {
      points.clear();
      controls.current.cameraBusy = false;
    };
    const context = (e: Event) => e.preventDefault();
    el.addEventListener("pointerdown", down, true);
    el.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", up, true);
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("contextmenu", context);
    window.addEventListener("blur", clear);
    return () => {
      el.removeEventListener("pointerdown", down, true);
      el.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", up, true);
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("contextmenu", context);
      window.removeEventListener("blur", clear);
      clear();
    };
  }, [entered, eye, gl, controls]);
  // Runs after movement and avatar animation, before rendering: no one-frame tracking lag.
  useFrame((_, dt) => {
    if (!entered) {
      camera.position.set(7.8, 6.8, 10.5);
      camera.lookAt(0, 0.3, -0.6);
      initialized.current = false;
      return;
    }
    const p = player.current,
      v = view.current,
      c = controls.current;
    // Auto-walking turns the first-person gaze smoothly along the route, without
    // feeding strafing/backward avatar rotation back into the viewing direction.
    if (eye && c.destination && !c.cameraBusy) {
      const delta = Math.atan2(
        Math.sin(p.angle - v.yaw),
        Math.cos(p.angle - v.yaw),
      );
      v.yaw += delta * (1 - Math.exp(-dt * 5));
    }
    c.cameraMode = eye ? "first" : "third";
    c.viewYaw = v.yaw;
    eyeHeading.current +=
      Math.atan2(
        Math.sin(p.angle - eyeHeading.current),
        Math.cos(p.angle - eyeHeading.current),
      ) *
      (1 - Math.exp(-dt * 16));
    const facing = eyeHeading.current,
      height = 0.93 + (p.seat === null ? 0 : 0.39);
    anchor.current.set(p.x, height, p.z);
    // Carry the existing camera with the avatar before easing the orbit offset.
    // Tracking translation must not lag behind or accumulate as the player walks.
    if (!eye && initialized.current && transition.current === 0) {
      camera.position.x += anchor.current.x - previousAnchor.current.x;
      camera.position.z += anchor.current.z - previousAnchor.current.z;
    }
    previousAnchor.current.copy(anchor.current);
    const d = viewDirection(v.yaw, v.pitch);
    direction.current.set(d.x, d.y, d.z);
    if (eye) {
      desired.current.set(
        p.x + Math.sin(facing) * 0.28,
        height,
        p.z + Math.cos(facing) * 0.28,
      );
      const safe = cameraPosition(anchor.current, desired.current, room);
      desired.current.set(safe.x, safe.y, safe.z);
    } else {
      // Low shoulder-height orbit, with the avatar just below centre.
      desired.current
        .copy(anchor.current)
        .addScaledVector(direction.current, -v.distance);
      desired.current.y += 0.25;
      const safe = cameraPosition(anchor.current, desired.current, room);
      desired.current.set(safe.x, safe.y, safe.z);
    }
    if (camera.near !== 0.04) {
      camera.near = 0.04;
      camera.updateProjectionMatrix();
    }
    if (!initialized.current || transition.current > 0) {
      const a = initialized.current ? 1 - Math.exp(-dt * 18) : 1;
      camera.position.lerp(desired.current, a);
      transition.current = Math.max(0, transition.current - dt);
    } else if (eye) {
      // Horizontal translation is exact, so walking never leaves the eyes behind.
      camera.position.x = desired.current.x;
      camera.position.z = desired.current.z;
      camera.position.y +=
        (desired.current.y - camera.position.y) * (1 - Math.exp(-dt * 16));
    } else camera.position.lerp(desired.current, 1 - Math.exp(-dt * 14));
    // Resolve the final eased position too; smoothing cannot move through furniture.
    const safe = cameraPosition(anchor.current, camera.position, room);
    camera.position.set(safe.x, safe.y, safe.z);
    look.current.copy(camera.position).add(direction.current);
    if (!eye) look.current.copy(anchor.current);
    previousRotation.current.copy(camera.quaternion);
    camera.lookAt(look.current);
    targetRotation.current.copy(camera.quaternion);
    if (initialized.current)
      camera.quaternion.slerpQuaternions(
        previousRotation.current,
        targetRotation.current,
        1 - Math.exp(-dt * 20),
      );
    camera.getWorldDirection(direction.current);
    look.current.copy(camera.position).add(direction.current);
    initialized.current = true;
    gl.domElement.dataset.cameraTarget = JSON.stringify(look.current.toArray());
    gl.domElement.dataset.camera = JSON.stringify(camera.position.toArray());
    gl.domElement.dataset.cameraMode = eye ? "first" : "third";
    gl.domElement.dataset.view = JSON.stringify([v.yaw, v.pitch, v.distance]);
  }, -0.1);
  return null;
}
