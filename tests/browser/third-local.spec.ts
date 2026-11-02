import { test, expect } from "@playwright/test";
import { avatarPose } from "./avatar-inspection";
test("third update: saved random nickname, sequential real audio, filling cup, paw attachment, walking and sipping", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const events: {
      frequency: number;
      start: number;
      stop: number;
      ended: boolean;
    }[] = [];
    (window as any).__brewAudioEvents = events;
    const Original = window.AudioContext;
    window.AudioContext = class extends Original {
      createOscillator() {
        const node = super.createOscillator();
        let frequency = 0,
          entry: (typeof events)[number] | undefined;
        const set = node.frequency.setValueAtTime.bind(node.frequency),
          start = node.start.bind(node),
          stop = node.stop.bind(node);
        node.frequency.setValueAtTime = (v, t) => {
          if (!frequency) frequency = v;
          return set(v, t);
        };
        node.start = (when = 0) => {
          entry = { frequency, start: when, stop: 0, ended: false };
          events.push(entry);
          start(when);
        };
        node.stop = (when = 0) => {
          if (entry) entry.stop = when;
          stop(when);
        };
        node.addEventListener("ended", () => {
          if (entry) entry.ended = true;
        });
        return node;
      }
    };
  });
  await page.addInitScript(() =>
    localStorage.setItem("latte:camera-mode", "third"),
  );
  await page.goto("/");
  const generated = await page
    .getByRole("textbox", { name: "닉네임", exact: true })
    .inputValue();
  expect(generated.length).toBeGreaterThan(2);
  expect(generated.length).toBeLessThanOrEqual(16);
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "닉네임", exact: true }),
  ).toHaveValue(generated);
  await page.getByRole("button", { name: "닉네임 변경", exact: true }).click();
  const nickname = await page
    .getByRole("textbox", { name: "닉네임", exact: true })
    .inputValue();
  expect(nickname).not.toBe(generated);
  await page.getByRole("button", { name: "수달", exact: true }).click();
  await page.getByRole("button", { name: "입장하기" }).click();
  const id = (await page
    .locator(".name-tag.you")
    .getAttribute("data-player-id"))!;
  await page.getByRole("button", { name: "사운드 켜기", exact: true }).click();
  await page.getByRole("button", { name: "음료 선택", exact: true }).click();
  await page.getByRole("button", { name: "라떼", exact: true }).click();
  await page
    .getByRole("button", { name: "라떼 추출하기", exact: true })
    .click();
  await expect(page.locator('[data-brew-stage="grind"]')).toBeVisible();
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            window.__LATTE_SCENE__!.getObjectByName("espresso-machine")!
              .userData.fill as number,
        ),
      { timeout: 7000, intervals: [100] },
    )
    .toBeGreaterThan(0.05);
  const filling = await page.evaluate(() => {
    const s = window.__LATTE_SCENE__!,
      c = s.getObjectByName("brew-cup")!,
      l = c.getObjectByName("coffee-liquid")!;
    return {
      fill: s.getObjectByName("espresso-machine")!.userData.fill as number,
      y: l.position.y,
      stream: s.getObjectByName("coffee-stream")!.visible,
    };
  });
  expect(filling.stream).toBe(true);
  expect(filling.fill).toBeLessThan(1);
  await page.waitForTimeout(250);
  const later = await page.evaluate(
    () =>
      window
        .__LATTE_SCENE__!.getObjectByName("brew-cup")!
        .getObjectByName("coffee-liquid")!.position.y,
  );
  expect(later).toBeGreaterThan(filling.y);
  await expect(page.getByRole("button", { name: /마시기 · 4/ })).toBeVisible({
    timeout: 10000,
  });
  const score = await page.evaluate(
    () =>
      (window as any).__brewAudioEvents as {
        frequency: number;
        start: number;
        stop: number;
        ended: boolean;
      }[],
  );
  const phase = (f: number) => score.find((e) => e.frequency === f)!;
  expect(phase(65).start - phase(240).start).toBeCloseTo(1.2, 2);
  expect(phase(1050).start - phase(240).start).toBeCloseTo(1.98, 2);
  expect(phase(2100).start - phase(240).start).toBeCloseTo(4.1, 2);
  expect(phase(880).start - phase(240).start).toBeCloseTo(5.4, 2);
  expect(
    [240, 65, 1050, 2100, 880].every(
      (f) => phase(f).stop > phase(f).start && phase(f).ended,
    ),
  ).toBe(true);
  const held = await avatarPose(page, id);
  expect(held.cupParent).toBe(`paw-right:${id}`);
  held.pawLocalCup!.forEach((v, i) =>
    expect(v).toBeCloseTo(held.cupLocal![i], 5),
  );
  await page.keyboard.down("a");
  await page.waitForTimeout(650);
  await page.keyboard.up("a");
  const walking = await avatarPose(page, id);
  expect(walking.walk).toBeGreaterThan(0.2);
  expect(walking.position[0]).toBeLessThan(held.position[0] - 0.5);
  expect(Math.abs(walking.yaw - held.yaw)).toBeGreaterThan(0.5);
  walking.pawLocalCup!.forEach((v, i) =>
    expect(v).toBeCloseTo(held.cupLocal![i], 5),
  );
  await page.waitForTimeout(800);
  const rest = await avatarPose(page, id);
  await page.getByRole("button", { name: /마시기 ·/ }).click();
  await expect
    .poll(async () => (await avatarPose(page, id)).tip, { intervals: [80] })
    .toBeLessThan(-0.15);
  await expect
    .poll(async () => (await avatarPose(page, id)).paw[1], { intervals: [40] })
    .toBeGreaterThan(rest.paw[1] + 0.06);
  const sip = await avatarPose(page, id);
  expect(sip.cupParent).toBe(`paw-right:${id}`);
  await page.keyboard.down("w");
  const before = await page.locator("canvas").getAttribute("data-player");
  await page.waitForTimeout(100);
  await page.keyboard.up("w");
  expect(await page.locator("canvas").getAttribute("data-player")).toBe(before);
  await expect(page.locator("main")).toHaveAttribute("data-drink-level", "3");
  await expect
    .poll(async () => Math.abs((await avatarPose(page, id)).tip))
    .toBeLessThan(0.03);
  await page.getByRole("button", { name: "방명록 열기" }).click();
  await expect(
    page.getByRole("textbox", { name: "방명록 닉네임" }),
  ).toHaveValue(nickname);
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  // Room changes cancel a score, including audio sources scheduled for later phases.
  await page.getByRole("button", { name: "음료 선택", exact: true }).click();
  await page
    .getByRole("button", { name: "라떼 추출하기", exact: true })
    .click();
  await page.getByRole("button", { name: "방 둘러보기" }).click();
  await page.getByRole("button", { name: /ROOM 02/ }).click();
  const cancelled = await page.evaluate(() =>
    (window as any).__brewAudioEvents
      .filter((e: any) => [240, 65, 1050, 2100, 880].includes(e.frequency))
      .slice(-15),
  );
  expect(cancelled.some((e: any) => e.stop < e.start)).toBe(true);
  await expect(page.locator("main")).toHaveAttribute("data-action", "idle");
  expect(errors).toEqual([]);
});
