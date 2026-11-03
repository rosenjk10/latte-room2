export type CameraMode = "third";
export const CAMERA_KEY = "latte:camera-mode";
export const THIRD_DISTANCE = { min: 0.8, max: 8, initial: 3.3 };
// A first-person preference from older releases must never hide the avatar on entry.
// Third-person is the only supported camera.
export function loadCameraMode(): CameraMode {
  try {
    localStorage.setItem(CAMERA_KEY, "third");
  } catch {
    /* Storage is optional. */
  }
  return "third";
}
export const THIRD_PITCH = { min: -0.75, max: 0.45, initial: -0.13 };
export function viewDirection(yaw: number, pitch: number) {
  return {
    x: Math.sin(yaw) * Math.cos(pitch),
    y: Math.sin(pitch),
    z: Math.cos(yaw) * Math.cos(pitch),
  };
}
