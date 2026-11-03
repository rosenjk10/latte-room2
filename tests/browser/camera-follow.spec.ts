import { test, expect, type Page } from "@playwright/test";
import { position, clickWorld, screenPoint } from "./world-inspection";
async function data(p: Page) {
  return p.locator("canvas").evaluate((c) => ({
    eye: JSON.parse(c.dataset.camera!),
    view: JSON.parse(c.dataset.view!),
    pos: JSON.parse(c.dataset.player!),
    mode: c.dataset.cameraMode,
  }));
}
async function drag(p: Page, dx: number, dy: number) {
  await p.mouse.move(640, 350);
  await p.mouse.down();
  await p.mouse.move(640 + dx, 350 + dy, { steps: 12 });
  await p.mouse.up();
  await p.waitForTimeout(250);
}
async function aim(p: Page, point: { x: number; y: number; z: number }) {
  const s = await data(p);
  const yaw = Math.atan2(point.x - s.eye[0], point.z - s.eye[2]);
  const pitch = Math.atan2(
    point.y - s.eye[1],
    Math.hypot(point.x - s.eye[0], point.z - s.eye[2]),
  );
  const delta = Math.atan2(
    Math.sin(yaw - s.view[0]),
    Math.cos(yaw - s.view[0]),
  );
  // Multiple safe gestures avoid leaving the canvas when turning around.
  const count =
    Math.ceil(
      Math.max(Math.abs(delta / 0.006), Math.abs((pitch - s.view[1]) / 0.006)) /
        180,
    ) || 1;
  for (let i = 0; i < count; i++)
    await drag(p, -delta / 0.006 / count, (pitch - s.view[1]) / 0.006 / count);
}
test("PC: real eye tracking, relative movement, floor/ceiling, auto walk, cup and low third person", async ({
  page,
}) => {
  test.setTimeout(150000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: "입장하기" }).click();
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-camera-mode",
    "third",
  );
  await page.getByRole("button", { name: "1인칭 / 3인칭 전환" }).click();
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-camera-mode",
    "first",
  );
  await page.waitForTimeout(500);
  const start = await data(page);
  expect(
    await page.evaluate(
      () =>
        window.__LATTE_SCENE__!.getObjectByName(
          "avatar:" +
            document
              .querySelector(".name-tag.you")!
              .getAttribute("data-player-id"),
        )!.visible,
    ),
  ).toBe(false);
  expect(start.eye[1]).toBeCloseTo(0.93, 1);
  expect(
    Math.hypot(start.eye[0] - start.pos[0], start.eye[2] - start.pos[1]),
  ).toBeLessThan(0.3);
  await page.keyboard.down("w");
  await expect
    .poll(async () => (await position(page))[1], { timeout: 8000 })
    .toBeLessThan(start.pos[1] - 0.3);
  await page.keyboard.up("w");
  let moved = await data(page);
  expect(moved.pos[1]).toBeLessThan(start.pos[1] - 0.25);
  expect(
    Math.hypot(moved.eye[0] - moved.pos[0], moved.eye[2] - moved.pos[1]),
  ).toBeLessThan(0.3);
  const before = await position(page);
  await drag(page, 150, 210);
  expect(await position(page)).toEqual(before);
  expect((await data(page)).view[1]).toBeGreaterThan(1.2);
  await expect
    .poll(() =>
      page
        .locator("canvas")
        .evaluate(
          (c) =>
            JSON.parse(c.dataset.cameraTarget!)[1] -
            JSON.parse(c.dataset.camera!)[1],
        ),
    )
    .toBeGreaterThan(0.85);
  await drag(page, 0, -210);
  await drag(page, 0, -210);
  expect((await data(page)).view[1]).toBeLessThan(-1.2);
  await expect
    .poll(() =>
      page
        .locator("canvas")
        .evaluate(
          (c) =>
            JSON.parse(c.dataset.cameraTarget!)[1] -
            JSON.parse(c.dataset.camera!)[1],
        ),
    )
    .toBeLessThan(-0.85);
  expect((await data(page)).eye[1]).toBeGreaterThan(0.32);
  await page.getByRole("button", { name: "카메라 시점 초기화" }).click();
  await page.waitForTimeout(500);
  await aim(page, { x: 0, y: 0.01, z: 2.05 });
  await clickWorld(page, { x: 0, y: 0.01, z: 2.05 });
  await expect
    .poll(async () => Math.abs((await position(page))[1] - 2.05), {
      timeout: 10000,
    })
    .toBeLessThan(0.15);
  moved = await data(page);
  expect(
    Math.hypot(moved.eye[0] - moved.pos[0], moved.eye[2] - moved.pos[1]),
  ).toBeLessThan(0.3);
  await page.getByRole("button", { name: "음료 선택", exact: true }).click();
  await page
    .getByRole("button", { name: "라떼 추출하기", exact: true })
    .click();
  await expect(page.getByRole("button", { name: /마시기 · 4/ })).toBeVisible({
    timeout: 10000,
  });
  expect(
    await page.evaluate(
      () =>
        window.__LATTE_SCENE__!.getObjectByName("first-person-cup")?.visible,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "카메라 시점 초기화" }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "test-results/first-person-cup.png" });
  await page.getByRole("button", { name: /마시기 ·/ }).click();
  await expect(page.locator("main")).toHaveAttribute("data-drink-level", "3");
  await page.getByRole("button", { name: "1인칭 / 3인칭 전환" }).click();
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-camera-mode",
    "third",
  );
  await page.getByRole("button", { name: "카메라 시점 초기화" }).click();
  await page.waitForTimeout(600);
  const third = await data(page);
  expect(third.eye[1]).toBeLessThan(2);
  expect(third.eye[2]).toBeGreaterThan(third.pos[1] + 1);
  await page.keyboard.down("s");
  await expect
    .poll(async () => (await position(page))[1], { timeout: 8000 })
    .toBeGreaterThan(third.pos[1] + 0.3);
  await page.keyboard.up("s");
  await page.waitForTimeout(400);
  const follow = await data(page);
  expect(follow.eye[2]).toBeGreaterThan(third.eye[2] + 0.15);
  expect(follow.pos[1]).toBeGreaterThan(third.pos[1] + 0.2);
  await page.mouse.move(640, 350);
  await page.mouse.wheel(0, -1200);
  await page.waitForTimeout(500);
  expect((await data(page)).view[2]).toBeLessThan(third.view[2]);
  expect(await page.evaluate(() => window.visualViewport!.scale)).toBe(1);
  expect(
    await page.evaluate(() => localStorage.getItem("latte:camera-mode")),
  ).toBe("third");
  await page.reload();
  await page.getByRole("button", { name: "입장하기" }).click();
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-camera-mode",
    "third",
  );
  await page.getByRole("button", { name: "방명록 열기" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(errors).toEqual([]);
});
test("mobile: drag gaze, joystick eye tracking, pinch third-person zoom and tap walking", async ({
  browser,
}) => {
  test.setTimeout(100000);
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "입장하기" }).click();
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-camera-mode",
    "third",
  );
  await page.getByRole("button", { name: "1인칭 / 3인칭 전환" }).click();
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-camera-mode",
    "first",
  );
  await page.waitForTimeout(500);
  const client = await context.newCDPSession(page);
  const start = await data(page);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 200, y: 400, id: 1 }],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: 280, y: 500, id: 1 }],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.waitForTimeout(300);
  expect((await data(page)).view[0]).not.toBe(start.view[0]);
  expect(await position(page)).toEqual(start.pos);
  const joy = await page
    .getByRole("group", { name: "이동 조이스틱" })
    .boundingBox();
  const x = joy!.x + joy!.width / 2,
    y = joy!.y + joy!.height / 2;
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y, id: 1 }],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x, y: y - 35, id: 1 }],
  });
  await page.waitForTimeout(600);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  const moved = await data(page);
  expect(
    Math.hypot(moved.pos[0] - start.pos[0], moved.pos[1] - start.pos[1]),
  ).toBeGreaterThan(0.2);
  expect(
    Math.hypot(moved.eye[0] - moved.pos[0], moved.eye[2] - moved.pos[1]),
  ).toBeLessThan(0.3);
  expect(moved.view[0]).toBeCloseTo(start.view[0] - 0.48, 1);
  await page.getByRole("button", { name: "1인칭 / 3인칭 전환" }).tap();
  await page.waitForTimeout(500);
  const third = await data(page);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: 160, y: 400, id: 1 },
      { x: 240, y: 400, id: 2 },
    ],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { x: 120, y: 400, id: 1 },
      { x: 280, y: 400, id: 2 },
    ],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.waitForTimeout(300);
  expect((await data(page)).view[2]).toBeLessThan(third.view[2]);
  expect(await page.evaluate(() => window.visualViewport!.scale)).toBe(1);
  expect(await position(page)).toEqual(moved.pos);
  await page.getByRole("button", { name: "1인칭 / 3인칭 전환" }).tap();
  await page.getByRole("button", { name: "방 둘러보기" }).tap();
  await page.getByRole("button", { name: /ROOM 02/ }).tap();
  await page.getByRole("button", { name: "카메라 시점 초기화" }).tap();
  await page.waitForTimeout(400);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 200, y: 420, id: 1 }],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: 200, y: 280, id: 1 }],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.waitForTimeout(300);
  const now = await data(page),
    goal = { x: now.pos[0], y: 0.01, z: now.pos[1] - 1.0 };
  const tap = await screenPoint(page, goal);
  await page.touchscreen.tap(tap.x, tap.y);
  await expect
    .poll(
      async () =>
        Math.hypot(
          (await position(page))[0] - goal.x,
          (await position(page))[1] - goal.z,
        ),
      { timeout: 10000 },
    )
    .toBeLessThan(0.15);
  await context.close();
});
