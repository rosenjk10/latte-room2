export type CameraMode = "first" | "third";
export const CAMERA_KEY = "latte:camera-mode";
export const PITCH_LIMIT = 1.35;
export const THIRD_DISTANCE = { min: 0.8, max: 8, initial: 2.6 };
export function loadCameraMode(): CameraMode {
  try {
    return localStorage.getItem(CAMERA_KEY) === "third" ? "third" : "first";
  } catch {
    return "first";
  }
}
export function saveCameraMode(mode: CameraMode) {
  try {
    localStorage.setItem(CAMERA_KEY, mode);
  } catch {
    /* Private storage may be unavailable. */
  }
}
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
