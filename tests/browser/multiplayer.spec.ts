import { test, expect } from "@playwright/test";
import * as THREE from "three";
import { mockRealtime } from "./realtime-fixture";
test("two real clients: Presence, movement, bubbles, pop, room isolation, reconnect and leave (mock server)", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 1100, height: 800 },
  });
  const transport = await mockRealtime(context);
  const a = await context.newPage(),
    b = await context.newPage();
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
  await a.keyboard.down("a");
  await a.waitForTimeout(750);
  await a.keyboard.up("a");
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
  const camera = new THREE.PerspectiveCamera(45, 1100 / 800, 0.1, 100);
  camera.position.set(-0.4, 8.3, 11 + 3.4 * 0.16);
  camera.lookAt(0, 0.3, -0.6);
  camera.updateMatrixWorld();
  for (const x of [-0.35, 0, 0.35]) {
    const pos = new THREE.Vector3(x, 1.4, 4.05).project(camera);
    await a.mouse.click((pos.x + 1) * 550, (1 - pos.y) * 400);
    if ((await a.locator("main").getAttribute("data-bubbles")) === "0") break;
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
