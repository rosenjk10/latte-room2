import { inspectionView } from "./world-inspection";
import { test, expect } from "@playwright/test";
import * as THREE from "three";
import { mockRealtime } from "./realtime-fixture";
import { bubblePosition, type Bubble } from "../../src/model";
test("two real clients: Presence, movement, bubbles, pop, room isolation, reconnect and leave (mock server)", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 1100, height: 800 },
  });
  await context.addInitScript(() =>
    localStorage.setItem("latte:camera-mode", "third"),
  );
  const transport = await mockRealtime(context);
  const a = await context.newPage(),
    b = await context.newPage();
  test.setTimeout(120000);
  const errors: string[] = [];
  [a, b].forEach((p) => p.on("pageerror", (e) => errors.push(e.message)));
  await a.goto("http://127.0.0.1:5174");
  await a.getByRole("textbox", { name: "닉네임" }).fill("민트");
  await a.getByRole("button", { name: "입장하기" }).click();
  await expect(a.locator(".connection")).toContainText("실시간 연결됨");
  await b.goto("http://127.0.0.1:5174");
  await b.getByRole("textbox", { name: "닉네임" }).fill("바닐라");
  await b.getByRole("button", { name: "입장하기" }).click();
  await expect(a.locator(".connection")).toContainText("2명");
  await expect(b.locator(".connection")).toContainText("2명");
  await expect(
    a.locator(".name-tag").filter({ hasText: "바닐라" }),
  ).toBeVisible();
  const before = await b
    .locator(".name-tag")
    .filter({ hasText: "민트" })
    .boundingBox();
  await a.bringToFront();
  await a.waitForTimeout(300);
  const playerBefore = await a.locator("canvas").getAttribute("data-player");
  await a.keyboard.down("a");
  await a.waitForTimeout(750);
  await a.keyboard.up("a");
  await expect
    .poll(() => a.locator("canvas").getAttribute("data-player"))
    .not.toBe(playerBefore);
  await b.bringToFront();
  await b.waitForTimeout(600);
  const after = await b
    .locator(".name-tag")
    .filter({ hasText: "민트" })
    .boundingBox();
  expect(Math.abs(after!.x - before!.x)).toBeGreaterThan(10);
  const motion = transport.metrics.filter((m) => m.event === "player");
  const bySocket = new Map<unknown, number[]>();
  motion.forEach((m) =>
    bySocket.set(m.socket, [...(bySocket.get(m.socket) || []), m.at]),
  );
  // Includes hello snapshots: the same 5Hz gate applies to every position broadcast.
  for (const times of bySocket.values()) {
    expect(times.length).toBeLessThan(25);
    for (let i = 1; i < times.length; i++)
      expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(170);
  }
  // Giant bubble from B remains easy to raycast, pop on A must disappear on B.
  const button = b.getByRole("button", { name: "비눗방울 만들기" }),
    rect = await button.boundingBox();
  await b.mouse.move(rect!.x + rect!.width / 2, rect!.y + rect!.height / 2);
  await b.mouse.down();
  await expect(b.getByRole("status")).toContainText("커다란 여유");
  await b.mouse.up();
  await expect(a.locator("main")).toHaveAttribute("data-bubbles", "1");
  await expect(b.locator("main")).toHaveAttribute("data-bubbles", "1");
  // Activate A so its WebGL meshes have advanced to the shared bubble's current pose.
  await a.bringToFront();
  await a.waitForTimeout(300);
  const bubble = (
    transport.metrics.findLast((m) => m.event === "bubbles")!
      .payload as Bubble[]
  )[0];
  await inspectionView(a, bubblePosition(bubble, Date.now()));
  const camera = new THREE.PerspectiveCamera(45, 1100 / 800, 0.1, 100);
  const cameraPosition = JSON.parse(
    (await a.locator("canvas").getAttribute("data-camera"))!,
  ) as [number, number, number];
  camera.position.fromArray(cameraPosition);
  camera.lookAt(
    new THREE.Vector3(
      ...JSON.parse(
        (await a.locator("canvas").getAttribute("data-camera-target"))!,
      ),
    ),
  );
  camera.updateMatrixWorld();
  for (let attempt = 0; attempt < 4; attempt++) {
    const p = bubblePosition(bubble, Date.now()),
      pos = new THREE.Vector3(p.x, p.y, p.z).project(camera);
    await a.mouse.click((pos.x + 1) * 550, (1 - pos.y) * 400);
    if ((await a.locator("main").getAttribute("data-bubbles")) === "0") break;
    await a.waitForTimeout(100);
  }
  await expect(a.locator("main")).toHaveAttribute("data-bubbles", "0");
  await expect(b.locator("main")).toHaveAttribute("data-bubbles", "0");
  await b.getByRole("button", { name: "방 둘러보기" }).click();
  await b.getByRole("button", { name: /ROOM 02/ }).click();
  await expect(a.locator(".connection")).toContainText("1명");
  await expect(a.locator(".name-tag")).toHaveCount(1);
  await b.waitForTimeout(1900);
  await b.getByRole("button", { name: "비눗방울 만들기" }).click();
  await expect
    .poll(async () =>
      Number(await b.locator("main").getAttribute("data-bubbles")),
    )
    .toBeGreaterThanOrEqual(5);
  await expect(a.locator("main")).toHaveAttribute("data-bubbles", "0");
  const previousSockets = transport.sockets.length;
  transport.disconnect();
  await expect
    .poll(() => transport.sockets.length, { timeout: 20000 })
    .toBeGreaterThan(previousSockets);
  await expect(b.locator(".connection")).toContainText("실시간 연결됨", {
    timeout: 20000,
  });
  await b.getByRole("button", { name: "나가기", exact: true }).click();
  await a.getByRole("button", { name: "방 둘러보기" }).click();
  await expect(a.getByRole("button", { name: /ROOM 02/ })).toContainText("0명");
  expect(errors).toEqual([]);
  await context.close();
});

test("guestbook save, safe text, realtime refresh across rooms, server error, and remote drink/eat actions (mock server)", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 1100, height: 800 },
  });
  await context.addInitScript(() =>
    localStorage.setItem("latte:camera-mode", "third"),
  );
  await mockRealtime(context);
  const a = await context.newPage(),
    b = await context.newPage();
  test.setTimeout(120000);
  const errors: string[] = [];
  [a, b].forEach((p) => p.on("pageerror", (e) => errors.push(e.message)));
  await a.goto("http://127.0.0.1:5174");
  await a.getByRole("textbox", { name: "닉네임" }).fill("모카");
  await a.getByRole("button", { name: "입장하기" }).click();
  await b.goto("http://127.0.0.1:5174");
  await b.getByRole("textbox", { name: "닉네임" }).fill("우유");
  await b.getByRole("button", { name: "입장하기" }).click();
  await expect(a.locator(".connection")).toContainText("2명");
  await a.bringToFront();
  await a.getByRole("button", { name: "음료 선택", exact: true }).click();
  await a.getByRole("button", { name: "라떼", exact: true }).click();
  await a.getByRole("button", { name: "라떼 추출하기", exact: true }).click();
  await expect(a.getByRole("button", { name: /마시기 · 4/ })).toBeVisible({
    timeout: 10000,
  });
  await expect(
    b.locator(".name-tag").filter({ hasText: "모카" }),
  ).toHaveAttribute("data-drink-level", "4");
  await a.getByRole("button", { name: /마시기 ·/ }).click();
  await expect(
    b.locator(".name-tag").filter({ hasText: "모카" }),
  ).toHaveAttribute("data-action", "drink");
  await expect(
    b.locator(".name-tag").filter({ hasText: "모카" }),
  ).toHaveAttribute("data-drink-level", "3");
  await a.getByRole("button", { name: "디저트 선택", exact: true }).click();
  await a.getByRole("button", { name: "크루아상", exact: false }).click();
  await a.getByRole("button", { name: /먹기 ·/ }).click();
  await expect(
    b.locator(".name-tag").filter({ hasText: "모카" }),
  ).toHaveAttribute("data-action", "eat");
  await expect(
    b.locator(".name-tag").filter({ hasText: "모카" }),
  ).toHaveAttribute("data-dessert-bites", "2");
  await b.getByRole("button", { name: "방 둘러보기" }).click();
  await b.getByRole("button", { name: /ROOM 02/ }).click();
  await b.getByRole("button", { name: "방명록 열기" }).click();
  await expect(b.locator(".empty-memos")).toBeVisible();
  await a.getByRole("button", { name: "방명록 열기" }).click();
  await a
    .getByRole("textbox", { name: "방명록 메시지" })
    .fill("<img src=x onerror=alert(1)> 쉬어가요");
  await a.getByRole("button", { name: "메모 남기기", exact: true }).click();
  await expect(a.locator(".memo-list li")).toHaveCount(1);
  await expect(b.locator(".memo-list li")).toHaveCount(1);
  await expect(b.locator(".memo-list li")).toContainText(
    "<img src=x onerror=alert(1)>",
  );
  await expect(b.locator(".memo-list img")).toHaveCount(0);
  await a.getByRole("textbox", { name: "방명록 메시지" }).fill("한 번 더");
  await a.getByRole("button", { name: "메모 남기기", exact: true }).click();
  await expect(a.getByRole("alert")).toContainText("1분");
  await a.getByRole("button", { name: "닫기", exact: true }).click();
  await a.getByRole("button", { name: "방명록 열기" }).click();
  await expect(a.locator(".memo-list li")).toHaveCount(1);
  expect(errors).toEqual([]);
  await context.close();
});
