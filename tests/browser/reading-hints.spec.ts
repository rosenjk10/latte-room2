import { test, expect } from "@playwright/test";
import { inspectionView, screenPoint } from "./world-inspection";
test("mobile: always-available reading, shelf touch, book choice, quote and real paw book animation", async ({
  browser,
}) => {
  test.setTimeout(150000);
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => {
      (window as any).__pageSounds = 0;
      const Original = window.AudioContext;
      window.AudioContext = class extends Original {
        createBuffer(channels: number, length: number, rate: number) {
          if (Math.abs(length / rate - 0.22) < 0.001)
            (window as any).__pageSounds++;
          return super.createBuffer(channels, length, rate);
        }
      };
    });
    await page.goto("/");
    await page.getByRole("button", { name: "입장하기" }).tap();
    await page.getByRole("button", { name: "방 둘러보기" }).tap();
    await page.getByRole("button", { name: /ROOM 02/ }).tap();
    await page.getByRole("button", { name: "사운드 켜기", exact: true }).tap();
    await page.getByRole("button", { name: "음료 선택", exact: true }).tap();
    await page
      .getByRole("button", { name: "라떼 추출하기", exact: true })
      .tap();
    await expect(page.getByRole("button", { name: /마시기 · 4/ })).toBeVisible({
      timeout: 10000,
    });
    // Reading remains available even when no proximity hint is being shown.
    const read = page.getByRole("button", { name: "책 읽기", exact: true });
    await expect(read).toBeVisible();
    const box = await read.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.y).toBeGreaterThan(844 / 2);
    await read.tap();
    await expect(page.getByRole("dialog", { name: "짧은 독서" })).toBeVisible();
    await expect(page.locator("blockquote")).not.toBeEmpty();
    await page.getByRole("button", { name: "이 문장과 쉬어가기" }).tap();
    await page.getByRole("button", { name: "독서 의자로 이동" }).tap();
    await expect(page.locator("main")).toHaveAttribute("data-reading", "true", {
      timeout: 25000,
    });
    await page.getByRole("button", { name: "일어나기", exact: false }).tap();
    await expect(page.locator("main")).toHaveAttribute("data-reading", "false");
    // Now approach is complete: touch the real shelf-wide hit target, not a mocked handler.
    const point = await page.evaluate(() => {
      const shelf = window.__LATTE_SCENE__!.getObjectByName("bookshelf")!;
      shelf.updateWorldMatrix(true, true);
      const p = shelf.localToWorld(shelf.position.clone().set(0, 1.1, 0.25));
      return { x: p.x, y: p.y, z: p.z };
    });
    await inspectionView(page, point);
    const screen = await screenPoint(page, point);
    await page.touchscreen.tap(screen.x, screen.y);
    await expect(page.getByRole("dialog", { name: "짧은 독서" })).toBeVisible();
    await page.getByRole("button", { name: "오늘의 정원 선택" }).tap();
    await expect(
      page.getByRole("button", { name: "오늘의 정원 선택" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("blockquote")).not.toBeEmpty();
    await page.getByRole("button", { name: "이 문장과 쉬어가기" }).tap();
    await page.getByRole("button", { name: "독서 의자로 이동" }).tap();
    await expect(page.locator("main")).toHaveAttribute("data-reading", "true", {
      timeout: 25000,
    });
    const id = (await page
      .locator(".name-tag.you")
      .getAttribute("data-player-id"))!;
    expect(
      await page.evaluate((id) => {
        const book = window.__LATTE_SCENE__!.getObjectByName(
          `reading-book:${id}`,
        )!;
        return {
          parent: book.parent!.name,
          open: !!book.getObjectByName("open-book"),
        };
      }, id),
    ).toEqual({ parent: `paw-right:${id}`, open: true });
    const turns = await page.evaluate(async (id) => {
      const book = window
        .__LATTE_SCENE__!.getObjectByName(`reading-book:${id}`)!
        .getObjectByName("open-book")!;
      const pageGroup = book.children[4];
      const start = pageGroup.rotation.z;
      await new Promise((resolve) => setTimeout(resolve, 550));
      return Math.abs(pageGroup.rotation.z - start);
    }, id);
    expect(turns).toBeGreaterThan(0.005);
    expect(
      await page.evaluate(
        (id) => !!window.__LATTE_SCENE__!.getObjectByName(`cup:${id}`),
        id,
      ),
    ).toBe(false);
    await expect(page.locator("main")).toHaveAttribute("data-action", "idle");
    const pageSounds = await page.evaluate(() => (window as any).__pageSounds);
    await expect
      .poll(() => page.evaluate(() => (window as any).__pageSounds), {
        timeout: 10000,
      })
      .toBeGreaterThan(pageSounds);

    await expect(
      page.getByRole("complementary", { name: "가까운 상호작용" }),
    ).toHaveCount(0);
    const actions = await page.locator(".consumable-actions").boundingBox();
    expect(actions!.y).toBeGreaterThan(844 * 0.7);
    const toast = (await page.locator(".toast").count())
      ? await page.locator(".toast").boundingBox()
      : null;
    if (toast) expect(toast.y + toast.height).toBeLessThan(844 * 0.25);
    await page.screenshot({ path: "test-results/mobile-reading-action.png" });
    await page.getByRole("button", { name: "책 덮기", exact: true }).tap();
    await expect(page.locator("main")).toHaveAttribute("data-reading", "false");
    await page.getByRole("button", { name: "일어나기", exact: false }).tap();
    await expect(page.locator("main")).toHaveAttribute("data-seated", "false");
    expect(
      await page.evaluate(
        (id) => !!window.__LATTE_SCENE__!.getObjectByName(`cup:${id}`),
        id,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    await page.screenshot({ path: "test-results/mobile-reading.png" });
  } finally {
    await context.close();
  }
});

test("automatic hint: dwell, expiry, no repeated popup and immediate explicit interaction", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto("/");
  await page.getByRole("button", { name: "입장하기" }).click();
  await expect(
    page.getByRole("complementary", { name: "가까운 상호작용" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "책 읽기", exact: true }).click();
  await page.getByRole("button", { name: "이 문장과 쉬어가기" }).click();
  await page.getByRole("button", { name: "독서 의자로 이동" }).click();
  await expect(page.locator("main")).toHaveAttribute("data-reading", "true", {
    timeout: 25000,
  });
  const seat = await page.evaluate(() => {
    const id = document
      .querySelector(".name-tag.you")!
      .getAttribute("data-player-id");
    const s = window.__LATTE_SCENE__!.getObjectByName(`avatar:${id}`)!;
    return s.position.x > 0 ? 13 : 12;
  });
  await page.getByRole("button", { name: "일어나기", exact: false }).click();
  const hint = page.getByRole("complementary", { name: "가까운 상호작용" });
  await page.waitForTimeout(800);
  await expect(hint).toHaveCount(0);
  await expect(hint).toBeVisible({ timeout: 4000 });
  await expect(hint).toHaveCount(0, { timeout: 4500 });
  await page.waitForTimeout(2500);
  await expect(hint).toHaveCount(0);
  const point = await page.evaluate((id) => {
    const n = window.__LATTE_SCENE__!.getObjectByName(`reading-chair:${id}`)!;
    n.updateWorldMatrix(true, true);
    const p = n.localToWorld(n.position.clone().set(0, 0.8, 0));
    return { x: p.x, y: p.y, z: p.z };
  }, seat);
  await inspectionView(page, point);
  const q = await screenPoint(page, point);
  await page.mouse.click(q.x, q.y);
  await expect(hint).toBeVisible();
  await page.getByRole("button", { name: "상호작용 닫기" }).click();
  await page.waitForTimeout(2500);
  await expect(hint).toHaveCount(0);
});
