import { test, expect } from "@playwright/test";
import {
  clickObject,
  clickWorld,
  position,
  inspectionView,
} from "./world-inspection";
import { walkable } from "../../src/world";
test("fourth update: floor routing, manual cancellation, low camera, original books, sitting/reading, watering and repeatable bloom", async ({
  page,
}) => {
  test.setTimeout(150000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: "입장하기" }).click();
  await expect(page.locator("main")).toHaveAttribute(
    "data-shared-ready",
    "true",
  );
  await page.waitForTimeout(500);
  const id = (await page
    .locator(".name-tag.you")
    .getAttribute("data-player-id"))!;
  await inspectionView(page, { x: 1.5, z: -4.05 });
  await clickWorld(page, { x: 1.5, y: 0.01, z: -4.05 });
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-destination",
    /.+/,
  );
  const trace: [number, number][] = [];
  await expect
    .poll(
      async () => {
        const p = await position(page);
        trace.push(p);
        return Math.hypot(p[0] - 1.5, p[1] + 4.05);
      },
      { timeout: 20000, intervals: [150] },
    )
    .toBeLessThan(0.15);
  expect(trace.length).toBeGreaterThan(2);
  for (const [x, z] of trace) expect(walkable({ x, z }, 1)).toBe(true);
  await inspectionView(page, { x: 1.5, z: -3.0 });
  await clickWorld(page, { x: 1.5, y: 0.01, z: -3.0 });
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-destination",
    /.+/,
  );
  await page.keyboard.down("a");
  await page.waitForTimeout(150);
  await page.keyboard.up("a");
  await expect(page.locator("canvas")).toHaveAttribute("data-destination", "");
  await page.getByRole("button", { name: "1인칭 / 3인칭 전환" }).click();
  await expect
    .poll(
      async () =>
        JSON.parse(
          (await page.locator("canvas").getAttribute("data-camera"))!,
        )[1],
    )
    .toBeLessThan(1.7);
  const before = await position(page);
  await page.mouse.move(640, 320);
  await page.mouse.down();
  await page.mouse.move(760, 350, { steps: 12 });
  await page.mouse.up();
  await page.mouse.wheel(0, -1000);
  await page.waitForTimeout(350);
  expect(await position(page)).toEqual(before);
  expect(
    JSON.parse((await page.locator("canvas").getAttribute("data-camera"))!)[1],
  ).toBeGreaterThanOrEqual(0.32);
  await expect(page.locator("canvas")).toHaveAttribute("data-destination", "");
  await page.getByRole("button", { name: "카메라 시점 초기화" }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "방 둘러보기" }).click();
  await page.getByRole("button", { name: /ROOM 02/ }).click();
  await clickObject(page, "shelf-book:0", [0, 0, 0.15]);
  await expect(page.getByRole("dialog", { name: "짧은 독서" })).toBeVisible();
  await expect(page.locator("blockquote")).not.toBeEmpty();
  await page.getByRole("button", { name: "이 문장과 쉬어가기" }).click();
  await page.getByRole("button", { name: "독서 의자로 이동" }).click();
  await expect(page.locator("main")).toHaveAttribute("data-reading", "true", {
    timeout: 25000,
  });
  expect(
    await page.evaluate(
      (id) => !!window.__LATTE_SCENE__!.getObjectByName(`reading-book:${id}`),
      id,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "책 덮기", exact: true }).click();
  await expect(page.locator("main")).toHaveAttribute("data-reading", "false");
  await page.getByRole("button", { name: "일어나기", exact: false }).click();
  await expect(page.locator("main")).toHaveAttribute("data-seated", "false");
  const potIndex = (await position(page))[0] > 0 ? 4 : 3;
  await clickObject(page, `garden-pot:${potIndex}`, [0, 0.18, 0]);
  await page.getByRole("button", { name: "물주기", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await page.locator("main").getAttribute("data-flowers"))!.split(",")[
          potIndex
        ],
      { timeout: 25000 },
    )
    .toBe("1");
  await expect(page.locator("main")).toHaveAttribute("data-action", "water");
  expect(
    await page.evaluate(
      (id) => !!window.__LATTE_SCENE__!.getObjectByName(`watering-can:${id}`),
      id,
    ),
  ).toBe(true);
  for (let stage = 2; stage <= 4; stage++) {
    await expect(
      page.getByRole("button", { name: "물주기", exact: true }),
    ).toBeEnabled({ timeout: 10000 });
    await page.getByRole("button", { name: "물주기", exact: true }).click();
    await expect
      .poll(
        async () =>
          (await page.locator("main").getAttribute("data-flowers"))!.split(",")[
            potIndex
          ],
        { timeout: 7000 },
      )
      .toBe(String(stage));
  }
  await expect(
    page.getByRole("button", { name: "물주기", exact: true }),
  ).toBeDisabled();
  // Advance only wall-clock time; the real coordinator timer performs expiry and broadcasts the reset.
  await page.clock.setSystemTime(new Date(Date.now() + 181000));
  await expect
    .poll(
      async () =>
        (await page.locator("main").getAttribute("data-flowers"))!.split(",")[
          potIndex
        ],
      { timeout: 5000 },
    )
    .toBe("0");
  await expect(
    page.getByRole("button", { name: "물주기", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "물주기", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await page.locator("main").getAttribute("data-flowers"))!.split(",")[
          potIndex
        ],
    )
    .toBe("1");
  await page.screenshot({ path: "test-results/fourth-garden.png" });
  expect(errors).toEqual([]);
});
