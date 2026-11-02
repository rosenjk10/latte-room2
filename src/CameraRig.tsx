import { useEffect, useRef, type ComponentRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { MOUSE, TOUCH, Vector3 } from "three";
import { CAMERA_LIMITS } from "./model";
import type { Controls } from "./Scene";
export default function CameraRig({
  entered,
  reset,
  controls,
}: {
  entered: boolean;
  reset: number;
  controls: React.RefObject<Controls>;
}) {
  const orbit = useRef<ComponentRef<typeof OrbitControls>>(null),
    { camera, gl, size } = useThree();
  const mobile = size.width / size.height < 0.8;
  useEffect(() => {
    if (!entered) return;
    camera.position.set(
      0,
      mobile ? 12.5 : 8.3,
      (mobile ? 17 : 11) + 3.4 * 0.16,
    );
    camera.lookAt(0, 0.3, -0.6);
    orbit.current?.target.set(0, 0.3, -0.6);
    orbit.current?.update();
  }, [entered, reset, mobile, camera]);
  useEffect(() => {
    const points = new Map<number, { x: number; y: number }>();
    let dragged = false;
    const down = (e: PointerEvent) => {
      if (points.size === 0) dragged = false;
      points.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (points.size > 1) dragged = true;
      controls.current.cameraBusy = true;
      controls.current.keys.clear();
      controls.current.x = 0;
      controls.current.z = 0;
    };
    const move = (e: PointerEvent) => {
      const p = points.get(e.pointerId);
      if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 5) dragged = true;
    };
    const up = (e: PointerEvent) => {
      points.delete(e.pointerId);
      if (dragged) controls.current.draggedUntil = performance.now() + 180;
      if (points.size === 0) controls.current.cameraBusy = false;
    };
    const wheel = () => {
      controls.current.keys.clear();
      controls.current.x = 0;
      controls.current.z = 0;
    };
    const clear = () => {
      points.clear();
      controls.current.cameraBusy = false;
    };
    const el = gl.domElement;
    el.addEventListener("pointerdown", down, true);
    el.addEventListener("pointermove", move, true);
    el.addEventListener("pointerup", up, true);
    el.addEventListener("pointercancel", up, true);
    el.addEventListener("wheel", wheel, true);
    window.addEventListener("blur", clear);
    return () => {
      el.removeEventListener("pointerdown", down, true);
      el.removeEventListener("pointermove", move, true);
      el.removeEventListener("pointerup", up, true);
      el.removeEventListener("pointercancel", up, true);
      el.removeEventListener("wheel", wheel, true);
      window.removeEventListener("blur", clear);
      clear();
    };
  }, [gl, controls]);
  useFrame(() => {
    if (!entered) {
      camera.position.lerp(new Vector3(7.8, 6.8, 10.5), 0.04);
      camera.lookAt(0, 0.3, -0.6);
    }
    gl.domElement.dataset.camera = JSON.stringify(
      camera.position.toArray().map((n) => +n.toFixed(3)),
    );
  });
  return (
    <OrbitControls
      key={`${entered}:${reset}:${mobile}`}
      ref={orbit}
      makeDefault
      enabled={entered}
      enablePan={false}
      enableDamping
      dampingFactor={0.12}
      rotateSpeed={0.55}
      zoomSpeed={0.7}
      target={[0, 0.3, -0.6]}
      {...CAMERA_LIMITS}
      mouseButtons={{
        LEFT: MOUSE.ROTATE,
        MIDDLE: MOUSE.DOLLY,
        RIGHT: MOUSE.ROTATE,
      }}
      touches={{ ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_ROTATE }}
    />
  );
}
