import { test, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createMissionSession } from "../../src/game/worldState.js";

let service, directory, url;
const narration = "Fixture mission control: the crew holds position while the incident report arrives. ".repeat(30);

test.beforeAll(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "artemis-motion-e2e-"));
  service = spawn(process.execPath, ["tests/e2e/multiplayer-fixture.mjs"], {
    env: { ...process.env, ARTEMIS_FIXTURE_DIRECTORY: directory, ARTEMIS_FIXTURE_PORT: "0", DATA_DIR: directory, DATABASE_URL: "", OPENAI_API_KEY: "", ANTHROPIC_API_KEY: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  url = await new Promise((resolve, reject) => {
    let output = "", diagnostics = "";
    const timer = setTimeout(() => { service.kill(); reject(new Error("Motion fixture startup timed out")); }, 15000);
    service.stderr.on("data", (chunk) => { diagnostics += chunk.toString(); });
    service.once("exit", (code) => { clearTimeout(timer); reject(new Error(`Motion fixture exited ${code}: ${diagnostics}`)); });
    service.stdout.on("data", (chunk) => {
      output += chunk.toString();
      for (const line of output.split("\n")) {
        try {
          const data = JSON.parse(line);
          if (data.fixtureUrl) { clearTimeout(timer); resolve(data.fixtureUrl); }
        } catch { /* Await the complete readiness line. */ }
      }
    });
  });
});

test.afterAll(async () => {
  if (service && service.exitCode === null) await new Promise((resolve) => { service.once("exit", resolve); service.kill("SIGTERM"); });
  if (directory) await rm(directory, { recursive: true, force: true });
});

async function openSeededMission(page) {
  // Seed a fictional solo save; no turn endpoint or model provider is called.
  await page.goto(url);
  await expect(page.getByRole("button", { name: "Play co-op", exact: true })).toBeVisible();
  const playerId = await page.evaluate(() => localStorage.getItem("artemis-lost-player-id"));
  const saved = await page.request.put(`${url}/api/session/slot-1`, {
    headers: { "x-player-id": playerId },
    data: { ...createMissionSession(), narration },
  });
  expect(saved.status()).toBe(200);
  await page.reload();
  await page.getByRole("button", { name: "Load", exact: true }).click();
  return page.locator(".narration-panel__body");
}

test("initial reduced motion reveals the complete game narration without a cursor", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const report = await openSeededMission(page);
  await expect(report).toHaveText(narration);
  await expect(page.locator(".narration-panel__cursor")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("initial-reduced-motion.png"), fullPage: true });
});

test("changing the real browser preference stops ongoing narration immediately", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const report = await openSeededMission(page);
  await expect(page.locator(".narration-panel__cursor")).toHaveCount(1);
  expect((await report.textContent()).length).toBeLessThan(narration.length);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(report).toHaveText(narration);
  await expect(page.locator(".narration-panel__cursor")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("motion-change-completed.png"), fullPage: true });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(report).toHaveText(narration);
  await expect(page.locator(".narration-panel__cursor")).toHaveCount(0);
});
