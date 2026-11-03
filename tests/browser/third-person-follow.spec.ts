import { test, expect, type Page } from "@playwright/test";
import { position, screenPoint, clickWorld } from "./world-inspection";
async function snapshot(page: Page) {
  return page.locator("canvas").evaluate((c) => ({
    position: JSON.parse(c.dataset.player!),
    camera: JSON.parse(c.dataset.camera!),
    view: JSON.parse(c.dataset.view!),
    mode: c.dataset.cameraMode,
  }));
}
async function visibleAvatar(page: Page) {
  expect(
    await page.evaluate(() => {
      const id = document
        .querySelector(".name-tag.you")!
        .getAttribute("data-player-id");
      return window.__LATTE_SCENE__!.getObjectByName(`avatar:${id}`)!.visible;
    }),
  ).toBe(true);
  const s = await snapshot(page),
    r = await page.locator("canvas").boundingBox();
  const p = await screenPoint(page, {
    x: s.position[0],
    y: 0.85,
    z: s.position[1],
  });
  expect(Math.abs(p.x - r!.width / 2)).toBeLessThan(65);
  expect(p.y).toBeGreaterThan(r!.height * 0.35);
  expect(p.y).toBeLessThan(r!.height * 0.65);
}
test("default third-person PC: legacy preference migration, continuous tracking, scrolling, auto walk and orbit", async ({
  page,
}) => {
  test.setTimeout(100000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() =>
    localStorage.setItem("latte:camera-mode", "first"),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "입장하기" }).click();
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-camera-mode",
    "third",
  );
  await expect(
    page.getByRole("button", { name: "1인칭 / 3인칭 전환" }),
  ).toHaveCount(0);
  await page.waitForTimeout(400);
  const initial = await snapshot(page);
  expect(initial.camera[1]).toBeLessThan(2);
  await visibleAvatar(page);
  const background = await screenPoint(page, { x: 0, y: 1, z: -4.8 });
  const frames: Awaited<ReturnType<typeof snapshot>>[] = [];
  await page.keyboard.down("d");
  await expect
    .poll(
      async () => {
        const s = await snapshot(page);
        frames.push(s);
        return s.position[0];
      },
      { intervals: [100], timeout: 8000 },
    )
    .toBeGreaterThan(initial.position[0] + 0.5);
  await page.keyboard.up("d");
  for (const s of frames) {
    expect(s.camera[0] - initial.camera[0]).toBeCloseTo(
      s.position[0] - initial.position[0],
      2,
    );
    expect(s.view[0]).toBeCloseTo(initial.view[0], 5);
  }
  await visibleAvatar(page);
  const scrolled = await screenPoint(page, { x: 0, y: 1, z: -4.8 });
  expect(Math.abs(scrolled.x - background.x)).toBeGreaterThan(15);
  await page.waitForTimeout(300);
  const stopped = await snapshot(page);
  await page.waitForTimeout(300);
  expect((await snapshot(page)).camera[0]).toBeCloseTo(stopped.camera[0], 3);
  const goal = { x: stopped.position[0], y: 0.01, z: 2.4 };
  await clickWorld(page, goal);
  await expect
    .poll(
      async () =>
        Math.hypot(
          (await position(page))[0] - goal.x,
          (await position(page))[1] - goal.z,
        ),
      { timeout: 12000 },
    )
    .toBeLessThan(0.15);
  const arrived = await snapshot(page);
  expect(arrived.camera[2] - stopped.camera[2]).toBeCloseTo(
    arrived.position[1] - stopped.position[1],
    1,
  );
  await visibleAvatar(page);
  const before = await position(page);
  await page.mouse.move(640, 350);
  await page.mouse.down();
  await page.mouse.move(760, 200, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  expect(await position(page)).toEqual(before);
  expect((await snapshot(page)).view[1]).toBeGreaterThanOrEqual(-0.75);
  expect((await snapshot(page)).camera[1]).toBeGreaterThanOrEqual(0.32);
  await page.getByRole("button", { name: "카메라 시점 초기화" }).click();
  await page.waitForTimeout(450);
  await visibleAvatar(page);
  await page.reload();
  await page.getByRole("button", { name: "입장하기" }).click();
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-camera-mode",
    "third",
  );
});
test("default third-person mobile: visible avatar, joystick follow, drag separation, pinch and floor tap", async ({
  browser,
}) => {
  test.setTimeout(100000);
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await page.goto("/");
    await page.getByRole("button", { name: "입장하기" }).tap();
    await expect(page.locator("canvas")).toHaveAttribute(
      "data-camera-mode",
      "third",
    );
    await page.waitForTimeout(400);
    await visibleAvatar(page);
    const initial = await snapshot(page),
      cdp = await context.newCDPSession(page),
      r = await page
        .getByRole("group", { name: "이동 조이스틱" })
        .boundingBox();
    const x = r!.x + r!.width / 2,
      y = r!.y + r!.height / 2;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y, id: 1 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + 30, y, id: 1 }],
    });
    await expect
      .poll(async () => (await position(page))[0], { timeout: 8000 })
      .toBeGreaterThan(initial.position[0] + 0.4);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    const moved = await snapshot(page);
    expect(moved.camera[0] - initial.camera[0]).toBeCloseTo(
      moved.position[0] - initial.position[0],
      2,
    );
    await visibleAvatar(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: 180, y: 400, id: 1 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: 250, y: 430, id: 1 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await page.waitForTimeout(250);
    expect(await position(page)).toEqual(moved.position);
    expect((await snapshot(page)).view[0]).not.toBe(moved.view[0]);
    const old = await snapshot(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: 150, y: 400, id: 1 },
        { x: 230, y: 400, id: 2 },
      ],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: 120, y: 400, id: 1 },
        { x: 260, y: 400, id: 2 },
      ],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await page.waitForTimeout(200);
    expect((await snapshot(page)).view[2]).toBeLessThan(old.view[2]);
    expect(await page.evaluate(() => visualViewport!.scale)).toBe(1);
    // A fresh room gives a clear aisle for a real floor tap after gestures.
    await page.getByRole("button", { name: "방 둘러보기" }).tap();
    await page.getByRole("button", { name: /ROOM 02/ }).tap();
    await page.waitForTimeout(450);
    const goal = { x: 0, y: 0.01, z: 2.4 },
      target = await screenPoint(page, goal);
    await page.touchscreen.tap(target.x, target.y);
    await expect
      .poll(async () => Math.abs((await position(page))[1] - goal.z), {
        timeout: 12000,
      })
      .toBeLessThan(0.15);
    await visibleAvatar(page);
    await page.screenshot({ path: "test-results/third-person-mobile.png" });
  } finally {
    await context.close();
  }
});
