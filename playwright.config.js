import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.js",
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { outputFolder: "output/playwright/report", open: "never" }]],
  outputDir: "output/playwright/results",
  use: { channel: process.env.PLAYWRIGHT_CHANNEL || undefined, trace: "retain-on-failure", screenshot: "only-on-failure", reducedMotion: "reduce" },
});
