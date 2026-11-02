import type { Page } from "@playwright/test";
import * as THREE from "three";
export async function screenPoint(
  page: Page,
  p: { x: number; y: number; z: number },
) {
  const data = await page
    .locator("canvas")
    .first()
    .evaluate((canvas) => {
      const c = canvas as HTMLCanvasElement,
        r = c.getBoundingClientRect();
      return {
        eye: JSON.parse(c.dataset.camera!),
        target: JSON.parse(c.dataset.cameraTarget || "[0,.3,-.6]"),
        w: r.width,
        h: r.height,
        x: r.x,
        y: r.y,
      };
    });
  const camera = new THREE.PerspectiveCamera(45, data.w / data.h, 0.1, 100);
  camera.position.fromArray(data.eye);
  camera.lookAt(new THREE.Vector3(...data.target));
  camera.updateMatrixWorld();
  const q = new THREE.Vector3(p.x, p.y, p.z).project(camera);
  return {
    x: data.x + ((q.x + 1) * data.w) / 2,
    y: data.y + ((1 - q.y) * data.h) / 2,
  };
}
export async function clickWorld(
  page: Page,
  p: { x: number; y: number; z: number },
) {
  const q = await screenPoint(page, p);
  await page.mouse.click(q.x, q.y);
}
export async function clickObject(
  page: Page,
  name: string,
  offset = [0, 0, 0],
) {
  const p = await page.evaluate(
    ({ name, offset }) => {
      const s = window.__LATTE_SCENE__!,
        n = s.getObjectByName(name)!;
      s.updateMatrixWorld(true);
      const p = n.localToWorld(
        n.position.clone().set(offset[0], offset[1], offset[2]),
      );
      return { x: p.x, y: p.y, z: p.z };
    },
    { name, offset },
  );
  await inspectionView(page, p);
  await clickWorld(page, p);
}
export async function position(page: Page) {
  return JSON.parse(
    (await page.locator("canvas").getAttribute("data-player"))!,
  ) as [number, number];
}
/** Use the real third-person controls to get a wide picking angle for legacy prop tests. */
export async function inspectionView(
  page: Page,
  point?: { x: number; z: number },
) {
  const canvas = page.locator("canvas");
  if ((await canvas.getAttribute("data-camera-mode")) === "first")
    await page.getByRole("button", { name: "1인칭 / 3인칭 전환" }).click();
  const view = JSON.parse((await canvas.getAttribute("data-view"))!);
  const player = JSON.parse((await canvas.getAttribute("data-player"))!);
  const yaw = point
    ? Math.atan2(point.x - player[0], point.z - player[1])
    : Math.PI;
  const delta = Math.atan2(Math.sin(yaw - view[0]), Math.cos(yaw - view[0]));
  const r = await canvas.boundingBox();
  const n =
    Math.ceil(
      Math.max(Math.abs(delta / 0.006), Math.abs((-0.65 - view[1]) / 0.006)) /
        90,
    ) || 1;
  for (let i = 0; i < n; i++) {
    const x = r!.width * 0.5,
      y = r!.height * 0.48;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(
      x - delta / 0.006 / n,
      y + (-0.65 - view[1]) / 0.006 / n,
      { steps: 1 },
    );
    await page.mouse.up();
  }
  await page.mouse.move(r!.width * 0.5, r!.height * 0.48);
  if (r!.width > 600) await page.mouse.wheel(0, 2200);
  await page.waitForTimeout(450);
}
