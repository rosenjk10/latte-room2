import type { Page } from "@playwright/test";
export async function avatarPose(page: Page, id: string) {
  return page.evaluate((id) => {
    const scene = window.__LATTE_SCENE__!;
    scene.updateMatrixWorld(true);
    const root = scene.getObjectByName(`avatar:${id}`)!,
      paw = scene.getObjectByName(`paw-right:${id}`)!,
      cup = scene.getObjectByName(`cup:${id}`);
    const world = (n: typeof root) =>
      n.getWorldPosition(n.position.clone()).toArray();
    return {
      position: world(root),
      yaw: root.rotation.y,
      walk: root.userData.walkWeight as number,
      legLeft: scene.getObjectByName(`leg-left:${id}`)!.rotation.x,
      legRight: scene.getObjectByName(`leg-right:${id}`)!.rotation.x,
      paw: world(paw),
      cup: cup ? world(cup) : null,
      cupParent: cup?.parent?.name,
      cupLocal: cup?.position.toArray(),
      pawLocalCup: cup
        ? paw.worldToLocal(cup.getWorldPosition(cup.position.clone())).toArray()
        : null,
      tip: cup?.rotation.x ?? 0,
    };
  }, id);
}
