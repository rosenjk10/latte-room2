import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import type { Scene } from "three";
declare global {
  interface Window {
    __LATTE_SCENE__?: Scene;
  }
}
/** Development-only access for integration tests of actual mesh attachment and motion. */
export default function SceneInspection() {
  const { scene } = useThree();
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__LATTE_SCENE__ = scene;
    return () => {
      if (window.__LATTE_SCENE__ === scene) delete window.__LATTE_SCENE__;
    };
  }, [scene]);
  return null;
}
