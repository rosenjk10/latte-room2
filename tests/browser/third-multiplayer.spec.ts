import { test, expect, chromium } from "@playwright/test";
import { existsSync } from "node:fs";
import { mockRealtime } from "./realtime-fixture";
import { avatarPose } from "./avatar-inspection";
test("third update: independent browsers display remote gait, attached cups, sipping and renamed duplicate nicknames", async ({
  browser,
}) => {
  test.setTimeout(120000);
  // Each browser has an active foreground page so remote animation is genuinely rendered.
  const second = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROMIUM_PATH ||
      (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  try {
    const ca = await browser.newContext(),
      cb = await second.newContext();
    const server = await mockRealtime(ca);
    await server.attach(cb);
    const a = await ca.newPage(),
      b = await cb.newPage();
    const errors: string[] = [];
    [a, b].forEach((p) => p.on("pageerror", (e) => errors.push(e.message)));
    for (const p of [a, b]) {
      await p.goto("http://127.0.0.1:5174");
      await p
        .getByRole("textbox", { name: "닉네임", exact: true })
        .fill("같은 이름");
      await p.getByRole("button", { name: "입장하기" }).click();
    }
    await expect(a.locator(".connection")).toContainText("2명");
    await expect(b.locator(".name-tag")).toHaveCount(2);
    const idA = (await a
        .locator(".name-tag.you")
        .getAttribute("data-player-id"))!,
      idB = (await b.locator(".name-tag.you").getAttribute("data-player-id"))!;
    expect(idA).not.toBe(idB);
    await a.getByRole("button", { name: "음료 선택", exact: true }).click();
    await a.getByRole("button", { name: "아메리카노", exact: true }).click();
    await a.getByRole("button", { name: "아메리카노 추출하기" }).click();
    await expect(a.getByRole("button", { name: /마시기 · 4/ })).toBeVisible({
      timeout: 10000,
    });
    await expect
      .poll(async () => (await avatarPose(b, idA)).cupParent)
      .toBe(`paw-right:${idA}`);
    const held = await avatarPose(b, idA);
    await a.keyboard.down("a");
    await expect
      .poll(async () => (await avatarPose(b, idA)).walk, { intervals: [100] })
      .toBeGreaterThan(0.4);
    const moving = await avatarPose(b, idA);
    await b.waitForTimeout(180);
    const next = await avatarPose(b, idA);
    await a.keyboard.up("a");
    expect(Math.abs(next.legLeft - moving.legLeft)).toBeGreaterThan(0.015);
    expect(next.legLeft * next.legRight).toBeLessThan(0);
    expect(next.position[0]).toBeLessThan(held.position[0] - 0.2);
    next.pawLocalCup!.forEach((v, i) =>
      expect(v).toBeCloseTo(next.cupLocal![i], 5),
    );
    await a.keyboard.down("w");
    await a.waitForTimeout(350);
    await a.keyboard.up("w");
    await expect
      .poll(async () => Math.abs((await avatarPose(b, idA)).yaw - held.yaw))
      .toBeGreaterThan(1);
    await expect
      .poll(async () => (await avatarPose(b, idA)).walk)
      .toBeLessThan(0.05);
    await a.getByRole("button", { name: /마시기 ·/ }).click();
    await expect
      .poll(async () => (await avatarPose(b, idA)).tip, { intervals: [70] })
      .toBeLessThan(-0.1);
    await expect(b.locator(`[data-player-id="${idA}"]`)).toHaveAttribute(
      "data-drink-level",
      "3",
    );
    await a.getByRole("button", { name: "닉네임 변경", exact: true }).click();
    const renamed = await a.evaluate(() => localStorage.getItem("latte:name"));
    expect(renamed).not.toBe("같은 이름");
    await expect(b.locator(`[data-player-id="${idA}"]`)).toContainText(
      renamed!,
    );
    await expect(b.locator(".name-tag")).toHaveCount(2);
    expect((await avatarPose(b, idA)).cupParent).toBe(`paw-right:${idA}`);
    expect(errors).toEqual([]);
    await ca.close();
    await cb.close();
  } finally {
    await second.close();
  }
});
