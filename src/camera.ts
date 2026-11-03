export type CameraMode = "first" | "third";
export const CAMERA_KEY = "latte:camera-mode";
export const PITCH_LIMIT = 1.35;
export const THIRD_DISTANCE = { min: 0.8, max: 8, initial: 2.6 };
// A first-person preference from older releases must never hide the avatar on entry.
// First person remains available as an optional, current-session preview only.
export function loadCameraMode(): CameraMode {
  try {
    localStorage.setItem(CAMERA_KEY, "third");
  } catch {
    /* Storage is optional. */
  }
  return "third";
}
export function saveCameraMode(mode: CameraMode) {
  try {
    if (mode === "third") localStorage.setItem(CAMERA_KEY, "third");
    else localStorage.removeItem(CAMERA_KEY);
  } catch {
    /* Private storage may be unavailable. */
  }
}
export const THIRD_PITCH = { min: -0.75, max: 0.45, initial: -0.13 };
export function relativeMovement(x: number, z: number, yaw: number) {
  return {
    x: -Math.cos(yaw) * x - Math.sin(yaw) * z,
    z: Math.sin(yaw) * x - Math.cos(yaw) * z,
  };
}
export function viewDirection(yaw: number, pitch: number) {
  return {
    x: Math.sin(yaw) * Math.cos(pitch),
    y: Math.sin(pitch),
    z: Math.cos(yaw) * Math.cos(pitch),
  };
}
