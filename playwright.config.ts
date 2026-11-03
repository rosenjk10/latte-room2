import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 65000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5173",
    headless: true,
    launchOptions: {
      executablePath:
        process.env.CHROMIUM_PATH ||
        (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
      args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
    },
  },
  projects: [
    {
      name: "local",
      testMatch: [
        "cafe.spec.ts",
        "camera-follow.spec.ts",
        "third-person-follow.spec.ts",
        "reading-hints.spec.ts",
        "third-local.spec.ts",
        "fourth-local.spec.ts",
      ],
    },
    {
      name: "realtime-mock",
      testMatch: [
        "multiplayer.spec.ts",
        "third-multiplayer.spec.ts",
        "fourth-multiplayer.spec.ts",
      ],
    },
  ],
  webServer: [
    {
      command: "npm run dev -- --port 5173 --strictPort",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npm run dev -- --port 5174 --strictPort",
      url: "http://127.0.0.1:5174",
      env: {
        VITE_SUPABASE_URL: "https://latte-e2e.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY:
          "sb_publishable_mock_transport_test_only",
      },
      reuseExistingServer: false,
    },
  ],
});
