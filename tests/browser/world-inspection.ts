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
  await clickWorld(page, p);
}
export async function position(page: Page) {
  return JSON.parse(
    (await page.locator("canvas").getAttribute("data-player"))!,
  ) as [number, number];
}
