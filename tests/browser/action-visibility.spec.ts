import { test, expect } from "@playwright/test";
import { clickObject } from "./world-inspection";
test("third-person actions stay unobscured by interaction cards and notices", async ({
  page,
}) => {
  test.setTimeout(100000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: "입장하기" }).click();
  await expect(
    page.getByRole("button", { name: "1인칭 / 3인칭 전환" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "음료 선택", exact: true }).click();
  await page
    .getByRole("button", { name: "라떼 추출하기", exact: true })
    .click();
  await expect(page.getByRole("button", { name: /마시기 · 4/ })).toBeVisible({
    timeout: 10000,
  });
  await clickObject(page, "garden-pot:3", [0, 0.18, 0]);
  const card = page.getByRole("complementary", { name: "가까운 상호작용" });
  await expect(card).toBeVisible();
  const r = await card.boundingBox();
  expect(r!.x + r!.width).toBeLessThan(1280 * 0.35);
  await page.getByRole("button", { name: "카메라 시점 초기화" }).click();
  await page.getByRole("button", { name: "물주기", exact: true }).click();
  await expect(page.locator("main")).toHaveAttribute("data-action", "water", {
    timeout: 25000,
  });
  await expect(card).toHaveCount(0);
  const toast = await page.locator(".toast").boundingBox();
  if (toast) expect(toast.y + toast.height).toBeLessThan(800 * 0.25);
  await page.screenshot({ path: "test-results/watering-clear-view.png" });
  await page.getByRole("button", { name: /마시기 · 4/ }).click();
  await expect(page.locator("main")).toHaveAttribute("data-action", "drink");
  await expect(card).toHaveCount(0);
  await expect(page.locator("main")).toHaveAttribute("data-drink-level", "3");
  await page.getByRole("button", { name: "디저트 선택", exact: true }).click();
  await page.getByRole("button", { name: "마카롱", exact: false }).click();
  await page.getByRole("button", { name: /먹기 · 3/ }).click();
  await expect(page.locator("main")).toHaveAttribute("data-action", "eat");
  await expect(card).toHaveCount(0);
  await expect(page.locator("main")).toHaveAttribute("data-dessert-bites", "2");
});
