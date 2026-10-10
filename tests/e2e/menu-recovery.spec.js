import { test, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

let service, directory, url;
test.beforeAll(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "artemis-menu-recovery-e2e-"));
  service = spawn(process.execPath, ["tests/e2e/multiplayer-fixture.mjs"], {
    env: { ...process.env, ARTEMIS_FIXTURE_DIRECTORY: directory, ARTEMIS_FIXTURE_PORT: "0", DATA_DIR: directory, DATABASE_URL: "", OPENAI_API_KEY: "", ANTHROPIC_API_KEY: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  url = await new Promise((resolve, reject) => {
    let output = "", diagnostics = "";
    const timer = setTimeout(() => { service.kill(); reject(new Error("Menu fixture startup timed out")); }, 15000);
    service.stderr.on("data", (chunk) => { diagnostics += chunk.toString(); });
    service.once("exit", (code) => { clearTimeout(timer); reject(new Error(`Menu fixture exited ${code}: ${diagnostics}`)); });
    service.stdout.on("data", (chunk) => {
      output += chunk.toString();
      for (const line of output.split("\n")) {
        try { const data = JSON.parse(line); if (data.fixtureUrl) { clearTimeout(timer); resolve(data.fixtureUrl); } }
        catch { /* Await complete readiness line. */ }
      }
    });
  });
});
test.afterAll(async () => {
  if (service && service.exitCode === null) await new Promise((resolve) => { service.once("exit", resolve); service.kill("SIGTERM"); });
  if (directory) await rm(directory, { recursive: true, force: true });
});

for (const failure of ["network", "server"]) {
  for (const width of [1280, 360]) {
    test(`saved-mission ${failure} failure can be retried at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 800 });
      let requests = 0;
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/api/sessions", async (route) => {
        requests += 1;
        if (requests === 1) {
          if (failure === "network") return route.abort("failed");
          return route.fulfill({ status: 503, json: { error: "Fixture storage unavailable" } });
        }
        return route.continue();
      });
      await page.goto(url);
      await expect(page).toHaveTitle(/Artemis Lost/);
      await expect(page.getByRole("heading", { name: "Artemis Lost", exact: true })).toBeVisible();
      await expect(page.getByRole("alert")).toContainText("Saved missions could not be loaded");
      await expect(page.getByText("Booting mission systems...", { exact: true })).toHaveCount(0);
      const retry = page.getByRole("button", { name: "Retry saved missions" });
      await expect(retry).toBeVisible();
      expect((await retry.boundingBox()).height).toBeGreaterThanOrEqual(44);
      await page.screenshot({ path: testInfo.outputPath("menu-retry.png"), fullPage: true });
      await retry.click();
      await expect(page.getByRole("button", { name: "New Mission", exact: true })).toHaveCount(3);
      await expect(page.getByRole("alert")).toHaveCount(0);
      expect(requests).toBe(2);
      expect(errors).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath("menu-recovered.png"), fullPage: true });
    });
  }
}
