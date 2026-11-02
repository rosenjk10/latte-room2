import { test, expect, chromium } from "@playwright/test";
import { existsSync } from "node:fs";
import { mockRealtime } from "./realtime-fixture";
import { clickObject } from "./world-inspection";
test("fourth update: shared watering, duplicate events, exclusive reading chair and leader reconnect recovery", async ({
  browser,
}) => {
  test.setTimeout(240000);
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
    for (const p of [a, b]) {
      await p.goto("http://127.0.0.1:5174");
      await p.getByRole("button", { name: "입장하기" }).click();
    }
    await expect(a.locator("main")).toHaveAttribute(
      "data-shared-ready",
      "true",
    );
    await expect(b.locator("main")).toHaveAttribute(
      "data-shared-ready",
      "true",
    );
    // Record the actual rendered transient motion from before either client starts.
    // Walking the second client can outlast the first client's 1.8s watering action.
    for (const p of [a, b])
      await p.evaluate(() => {
        const seen = new Set<string>();
        (window as any).__seenWatering = seen;
        // Observe scene attachment synchronously. A first shader compilation can
        // block timer polling for longer than this transient animation lasts.
        const watch = (node: import("three").Object3D) => {
          if (node.name.startsWith("watering-can:")) seen.add(node.name);
          node.addEventListener("childadded", (event) => watch(event.child));
          node.children.forEach(watch);
        };
        if (window.__LATTE_SCENE__) watch(window.__LATTE_SCENE__);
      });
    for (const p of [a, b]) {
      await clickObject(p, "shelf-book:0", [0, 0, 0.15]);
      await p.getByRole("button", { name: "이 문장과 쉬어가기" }).click();
      await clickObject(p, "garden-pot:3", [0, 0.18, 0]);
    }
    await Promise.all(
      [a, b].map((p) =>
        p.getByRole("button", { name: "물주기", exact: true }).click(),
      ),
    );
    await expect
      .poll(
        async () =>
          (await a.locator("main").getAttribute("data-flowers"))!.split(",")[3],
        { timeout: 25000 },
      )
      .toBe("1");
    await expect
      .poll(
        async () =>
          (await b.locator("main").getAttribute("data-flowers"))!.split(",")[3],
      )
      .toBe("1");
    const actor = (
      server.metrics.findLast(
        (m) =>
          m.event === "shared-v4" &&
          (m.payload as any).type === "commit" &&
          (m.payload as any).state.flowers[3].stage === 1,
      )!.payload as any
    ).state.flowers[3].actor;
    const aId = await a.locator(".name-tag.you").getAttribute("data-player-id");
    const observer = actor === aId ? b : a;
    await expect
      .poll(
        () =>
          observer.evaluate(
            (id) => (window as any).__seenWatering.has(`watering-can:${id}`),
            actor,
          ),
        { intervals: [60] },
      )
      .toBe(true);
    const water = server.metrics.find(
      (m) =>
        m.event === "shared-v4" &&
        (m.payload as any).type === "request" &&
        (m.payload as any).kind === "water",
    );
    if (water) {
      const packet = water.payload;
      for (const m of server.memberships.filter((m) =>
        m.topic.includes("room:1:"),
      ))
        m.socket.send(
          JSON.stringify([
            m.joinRef,
            null,
            m.topic,
            "broadcast",
            { type: "broadcast", event: "shared-v4", payload: packet },
          ]),
        );
    }
    await a.waitForTimeout(300);
    expect(await a.locator("main").getAttribute("data-flowers")).toBe(
      await b.locator("main").getAttribute("data-flowers"),
    );
    // Select the same physical chair in both browsers; claims occur only after walking there.
    await Promise.all(
      [a, b].map((p) =>
        expect(p.locator("main")).toHaveAttribute("data-action", "idle"),
      ),
    );
    await Promise.all(
      [a, b].map((p) =>
        p.getByRole("button", { name: "독서 의자로 이동" }).click(),
      ),
    );
    await expect
      .poll(
        async () =>
          Number(
            (await a.locator("main").getAttribute("data-seated")) === "true",
          ) +
          Number(
            (await b.locator("main").getAttribute("data-seated")) === "true",
          ),
        { timeout: 25000 },
      )
      .toBe(1);
    const seatedA =
        (await a.locator("main").getAttribute("data-seated")) === "true",
      owner = seatedA ? a : b,
      watcher = seatedA ? b : a,
      readerId = (await owner
        .locator(".name-tag.you")
        .getAttribute("data-player-id"))!;
    await expect
      .poll(() =>
        watcher.evaluate(
          (id) =>
            !!window.__LATTE_SCENE__!.getObjectByName(`reading-book:${id}`),
          readerId,
        ),
      )
      .toBe(true);
    // A new third client receives the current garden, then survives a real websocket reconnect.
    const cc = await browser.newContext();
    await server.attach(cc);
    const c = await cc.newPage();
    await c.goto("http://127.0.0.1:5174");
    await c.getByRole("button", { name: "입장하기" }).click();
    await expect(c.locator("main")).toHaveAttribute(
      "data-shared-ready",
      "true",
    );
    await expect
      .poll(
        async () =>
          (await c.locator("main").getAttribute("data-flowers"))!.split(",")[3],
      )
      .toBe("1");
    const oldSockets = server.sockets.length;
    server.disconnect();
    await expect
      .poll(() => server.sockets.length, { timeout: 20000 })
      .toBeGreaterThan(oldSockets);
    await expect(c.locator("main")).toHaveAttribute(
      "data-shared-ready",
      "true",
      { timeout: 15000 },
    );
    await expect
      .poll(
        async () =>
          (await c.locator("main").getAttribute("data-flowers"))!.split(",")[3],
      )
      .toBe("1");
    await ca.close();
    await expect(b.locator("main")).toHaveAttribute(
      "data-shared-ready",
      "true",
      { timeout: 10000 },
    );
    await expect(c.locator("main")).toHaveAttribute(
      "data-shared-ready",
      "true",
      { timeout: 10000 },
    );
    expect(await b.locator("main").getAttribute("data-flowers")).toBe(
      await c.locator("main").getAttribute("data-flowers"),
    );
    await b.getByRole("button", { name: "방 둘러보기" }).click();
    await b.getByRole("button", { name: /ROOM 02/ }).click();
    await expect(b.locator("main")).toHaveAttribute(
      "data-shared-ready",
      "true",
    );
    await expect(b.locator("main")).toHaveAttribute(
      "data-flowers",
      "0,0,0,0,0,0",
    );
    await expect(c.locator("main")).toHaveAttribute(
      "data-flowers",
      "0,0,0,1,0,0",
    );
    await cb.close();
    await cc.close();
  } finally {
    await second.close();
  }
});
