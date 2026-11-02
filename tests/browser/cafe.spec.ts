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
  await page.getByRole("button", { name: "카푸치노 추출하기" }).click();
  await expect(page.getByRole("button", { name: /마시기/ })).toBeVisible({
    timeout: 10000,
  });
  await page.getByRole("button", { name: "디저트 선택", exact: true }).click();
  await page.getByRole("button", { name: "랜덤 디저트 받기" }).click();
  await expect(page.getByRole("status")).toContainText("준비됐어요");
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
  const session = await context.newCDPSession(page);
  const playerBefore = await page.locator("canvas").getAttribute("data-player");
  const cameraBefore = await page.locator("canvas").getAttribute("data-camera");
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 150, y: 350, id: 1 }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: 230, y: 390, id: 1 }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.waitForTimeout(400);
  expect(await page.locator("canvas").getAttribute("data-camera")).not.toBe(
    cameraBefore,
  );
  expect(await page.locator("canvas").getAttribute("data-player")).toBe(
    playerBefore,
  );
  const cameraRotated = await page
    .locator("canvas")
    .getAttribute("data-camera");
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: 150, y: 400, id: 1 },
      { x: 230, y: 400, id: 2 },
    ],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { x: 100, y: 400, id: 1 },
      { x: 280, y: 400, id: 2 },
    ],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.waitForTimeout(400);
  expect(await page.locator("canvas").getAttribute("data-camera")).not.toBe(
    cameraRotated,
  );
  expect(await page.locator("canvas").getAttribute("data-player")).toBe(
    playerBefore,
  );
  await page.getByRole("button", { name: "카메라 시점 초기화" }).tap();
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

test("free camera, consumable lifecycle, persisted sound settings and guestbook fallback", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const Original = window.AudioContext;
    let created = 0;
    Object.defineProperty(window, "__audioContexts", { get: () => created });
    window.AudioContext = class extends Original {
      constructor(...args: ConstructorParameters<typeof AudioContext>) {
        super(...args);
        created++;
      }
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "입장하기" }).click();
  await expect(page.locator("canvas")).toHaveAttribute("data-camera", /.+/);
  const initialCamera = await page
      .locator("canvas")
      .getAttribute("data-camera"),
    initialPlayer = await page.locator("canvas").getAttribute("data-player");
  await page.mouse.move(640, 280);
  await page.mouse.down();
  await page.mouse.move(800, 360, { steps: 15 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  expect(await page.locator("canvas").getAttribute("data-camera")).not.toBe(
    initialCamera,
  );
  expect(await page.locator("canvas").getAttribute("data-player")).toBe(
    initialPlayer,
  );
  await expect(page.locator("main")).toHaveAttribute("data-seated", "false");
  await page.mouse.move(640, 300);
  for (let i = 0; i < 12; i++) await page.mouse.wheel(0, -500);
  await page.waitForTimeout(500);
  let position = JSON.parse(
    (await page.locator("canvas").getAttribute("data-camera"))!,
  );
  expect(position[1]).toBeGreaterThan(5.4);
  expect(
    Math.hypot(position[0], position[1] - 0.3, position[2] + 0.6),
  ).toBeGreaterThan(9.98);
  for (let i = 0; i < 14; i++) await page.mouse.wheel(0, 500);
  await page.waitForTimeout(500);
  position = JSON.parse(
    (await page.locator("canvas").getAttribute("data-camera"))!,
  );
  expect(
    Math.hypot(position[0], position[1] - 0.3, position[2] + 0.6),
  ).toBeLessThan(26.02);
  await page.getByRole("button", { name: "카메라 시점 초기화" }).click();
  await page.waitForTimeout(500);
  expect(await page.locator("canvas").getAttribute("data-camera")).toBe(
    initialCamera,
  );
  expect(await page.locator("canvas").getAttribute("data-player")).toBe(
    initialPlayer,
  );
  await page.getByRole("button", { name: "사운드 설정", exact: true }).click();
  await page.getByRole("slider", { name: "배경음악 볼륨" }).fill("24");
  await page.getByRole("slider", { name: "효과음 볼륨" }).fill("71");
  expect(
    await page.evaluate(
      () => (window as unknown as { __audioContexts: number }).__audioContexts,
    ),
  ).toBe(0);
  await page.getByRole("button", { name: "전체 소리 켜기" }).click();
  await expect(
    page.getByRole("button", { name: "사운드 끄기", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await page.getByRole("button", { name: "음료 선택", exact: true }).click();
  await page
    .getByRole("button", { name: "에스프레소", exact: false })
    .first()
    .click();
  await page.getByRole("button", { name: "에스프레소 추출하기" }).click();
  await expect(page.locator("main")).toHaveAttribute("data-action", "brew");
  await expect(page.getByRole("button", { name: /마시기 · 4/ })).toBeVisible({
    timeout: 10000,
  });
  for (let level = 3; level >= 0; level--) {
    await page.getByRole("button", { name: /마시기 ·/ }).click();
    await expect(page.locator("main")).toHaveAttribute("data-action", "drink");
    await expect(page.locator("main")).toHaveAttribute(
      "data-drink-level",
      String(level),
    );
  }
  await page.getByRole("button", { name: "빈 컵 정리", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "빈 컵 정리", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "디저트 선택", exact: true }).click();
  await page.getByRole("button", { name: "마카롱", exact: false }).click();
  const seat = screenPoint(-0.78, 0.55, 1.2);
  await page.mouse.click(seat.x, seat.y);
  await expect(page.locator("main")).toHaveAttribute("data-seated", "true");
  await page
    .getByRole("button", { name: "테이블에 올리기", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "접시 들기", exact: true }),
  ).toBeVisible();
  for (let bites = 2; bites >= 0; bites--) {
    await page.getByRole("button", { name: /먹기 ·/ }).click();
    await expect(page.locator("main")).toHaveAttribute("data-action", "eat");
    await expect(page.locator("main")).toHaveAttribute(
      "data-dessert-bites",
      String(bites),
    );
  }
  await expect(page.getByRole("button", { name: /먹기 ·/ })).toHaveCount(0);
  await page.getByRole("button", { name: "방명록 열기" }).click();
  await expect(
    page.getByText("로컬 체험에서는 저장할 수 없어요.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "메모 남기기", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await page.reload();
  expect(
    await page.evaluate(
      () => (window as unknown as { __audioContexts: number }).__audioContexts,
    ),
  ).toBe(0);
  await page.getByRole("button", { name: "사운드 설정", exact: true }).click();
  await expect(page.getByRole("slider", { name: "배경음악 볼륨" })).toHaveValue(
    "24",
  );
  await expect(page.getByRole("slider", { name: "효과음 볼륨" })).toHaveValue(
    "71",
  );
  expect(errors).toEqual([]);
});
