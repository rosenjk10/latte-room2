import { test, expect } from "@playwright/test";
import * as THREE from "three";
const screenPoint = (
  x: number,
  y: number,
  z: number,
  width = 1280,
  height = 800,
) => {
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 8.3, 11 + 3.4 * 0.16);
  camera.lookAt(0, 0.3, -0.6);
  camera.updateMatrixWorld();
  const v = new THREE.Vector3(x, y, z).project(camera);
  return { x: ((v.x + 1) * width) / 2, y: ((1 - v.y) * height) / 2 };
};
test("desktop: enter, move, sit, drinks, room change and bubble interactions", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "아무것도 하지 않아도 괜찮은 곳." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "토끼", exact: true }).click();
  await page.getByRole("textbox", { name: "닉네임" }).fill("테스트 토끼");
  await page.getByRole("button", { name: "입장하기" }).click();
  await expect(page.locator("main")).toHaveAttribute("data-room", "1");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByText("로컬 체험 · 연결 설정 필요")).toBeVisible();
  await expect(page.getByText("테스트 토끼 · 나")).toBeVisible();
  await page.waitForTimeout(2500);
  const before = await page.getByText("테스트 토끼 · 나").boundingBox();
  await page.keyboard.down("a");
  await page.waitForTimeout(500);
  await page.keyboard.up("a");
  const after = await page.getByText("테스트 토끼 · 나").boundingBox();
  expect(Math.abs(after!.x - before!.x)).toBeGreaterThan(10);
  // Back to spawn for deterministic projected seat and bubble picking.
  await page.getByRole("button", { name: "방 둘러보기" }).click();
  await expect(page.locator(".room-grid button")).toHaveCount(10);
  await page.getByRole("button", { name: /ROOM 02/ }).click();
  await expect(page.locator("main")).toHaveAttribute("data-room", "2");
  await page.getByRole("button", { name: "음료 선택", exact: true }).click();
  await page.getByRole("button", { name: "카푸치노", exact: false }).click();
  await expect(page.getByRole("status")).toContainText("카푸치노");
  await page.getByRole("button", { name: "디저트 선택", exact: true }).click();
  await page.getByRole("button", { name: "랜덤 디저트 받기" }).click();
  await expect(page.getByRole("status")).toContainText("당첨");
  const bubble = page.getByRole("button", { name: "비눗방울 만들기" });
  await bubble.click();
  await expect
    .poll(async () =>
      Number(await page.locator("main").getAttribute("data-bubbles")),
    )
    .toBeGreaterThanOrEqual(5);
  const count = Number(await page.locator("main").getAttribute("data-bubbles"));
  await page.waitForTimeout(2000);
  const bb = await bubble.boundingBox();
  await page.mouse.move(bb!.x + bb!.width / 2, bb!.y + bb!.height / 2);
  await page.mouse.down();
  await expect(page.getByRole("status")).toContainText("커다란 여유");
  await page.mouse.up();
  await expect(page.getByRole("status")).toContainText("커다란 여유");
  await expect(page.locator("main")).toHaveAttribute(
    "data-bubbles",
    String(count + 1),
  );
  await page.screenshot({ path: "test-results/desktop-cafe.png" });
  // Pick the large bubble along its deterministic drift envelope.
  let popped = false;
  const initial = count + 1;
  for (const dx of [-0.35, 0, 0.35]) {
    for (const dz of [0, 0.3]) {
      const point = screenPoint(dx, 1.4, 4.05 + dz);
      await page.mouse.click(point.x, point.y);
      if (
        Number(await page.locator("main").getAttribute("data-bubbles")) <
        initial
      ) {
        popped = true;
        break;
      }
    }
    if (popped) break;
  }
  expect(popped).toBe(true);
  const seat = screenPoint(-0.78, 0.55, 1.2);
  await page.mouse.click(seat.x, seat.y);
  await expect(page.locator("main")).toHaveAttribute("data-seated", "true");
  await page.getByRole("button", { name: "일어나기" }).click();
  await expect(page.locator("main")).toHaveAttribute("data-seated", "false");
  await page.waitForTimeout(11000);
  await expect(page.locator("main")).toHaveAttribute("data-bubbles", "0");
  await page.getByRole("button", { name: "나가기", exact: true }).click();
  await expect(page.getByRole("button", { name: "입장하기" })).toBeVisible();
  expect(errors).toEqual([]);
});
test("mobile: fullscreen layout, joystick, long press, mute and room isolation", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "입장하기" }).tap();
  await page.waitForTimeout(2000);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const joystick = page.getByRole("group", { name: "이동 조이스틱" }),
    b = await joystick.boundingBox();
  const before = await page.locator(".name-tag.you").boundingBox();
  await page.mouse.move(b!.x + b!.width / 2, b!.y + b!.height / 2);
  await page.mouse.down();
  await page.mouse.move(b!.x + b!.width - 5, b!.y + b!.height / 2);
  await page.waitForTimeout(600);
  await page.mouse.up();
  const after = await page.locator(".name-tag.you").boundingBox();
  expect(Math.abs(after!.x - before!.x)).toBeGreaterThan(5);
  await page.getByRole("button", { name: "사운드 켜기" }).tap();
  await expect(page.getByRole("button", { name: "사운드 끄기" })).toBeVisible();
  await page.getByRole("button", { name: "사운드 끄기" }).tap();
  await page.getByRole("button", { name: "비눗방울 만들기" }).tap();
  await expect
    .poll(async () =>
      Number(await page.locator("main").getAttribute("data-bubbles")),
    )
    .toBeGreaterThanOrEqual(5);
  await page.getByRole("button", { name: "방 둘러보기" }).tap();
  await page.getByRole("button", { name: /ROOM 10/ }).tap();
  await expect(page.locator("main")).toHaveAttribute("data-room", "10");
  await expect(page.locator("main")).toHaveAttribute("data-bubbles", "0");
  await page.screenshot({ path: "test-results/mobile-cafe.png" });
  expect(errors).toEqual([]);
  await context.close();
});
