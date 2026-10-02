import { test, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createMissionSession } from "../../src/game/worldState.js";

let service, directory, url;
const action = "Hold position and maintain the command relay.";

test.beforeAll(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "artemis-solo-failure-e2e-"));
  service = spawn(process.execPath, ["tests/e2e/multiplayer-fixture.mjs"], {
    env: { ...process.env, ARTEMIS_FIXTURE_DIRECTORY: directory, ARTEMIS_FIXTURE_PORT: "0", DATA_DIR: directory, DATABASE_URL: "", OPENAI_API_KEY: "", ANTHROPIC_API_KEY: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  url = await new Promise((resolve, reject) => {
    let output = "", diagnostics = "";
    const timer = setTimeout(() => { service.kill(); reject(new Error("Solo fixture startup timed out")); }, 15000);
    service.stderr.on("data", (chunk) => { diagnostics += chunk.toString(); });
    service.once("exit", (code) => { clearTimeout(timer); reject(new Error(`Solo fixture exited ${code}: ${diagnostics}`)); });
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

async function loadSaved(page, playerId) {
  const response = await page.request.get(`${url}/api/session/slot-1`, { headers: { "x-player-id": playerId } });
  expect(response.status()).toBe(200);
  return (await response.json()).session;
}
async function openMission(page, bot = false) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(url);
  await expect(page.getByRole("button", { name: "Play co-op", exact: true })).toBeVisible();
  const playerId = await page.evaluate(() => localStorage.getItem("artemis-lost-player-id"));
  const fixture = createMissionSession();
  fixture.narration = "Fixture mission control awaits your next command.";
  if (bot) fixture.worldState.crew[0].character.controller = "bot";
  const saved = await page.request.put(`${url}/api/session/slot-1`, { headers: { "x-player-id": playerId }, data: fixture });
  expect(saved.status()).toBe(200);
  const before = await loadSaved(page, playerId);
  await page.reload();
  await page.getByRole("button", { name: "Load", exact: true }).click();
  await expect(page.locator(".narration-panel__body")).toHaveText(fixture.narration);
  return { playerId, before };
}

for (const failure of ["http", "network"]) {
  test(`solo narration ${failure} failure preserves the save and retry commits one turn`, async ({ page }, testInfo) => {
    const requests = [], errors = [];
    let saves = 0;
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => { if (request.method() === "PUT" && request.url().endsWith("/api/session/slot-1")) saves += 1; });
    await page.route("**/api/turn", async (route) => {
      requests.push(route.request().postDataJSON());
      if (requests.length === 1) {
        if (failure === "network") return route.abort("failed");
        return route.fulfill({ status: 503, json: { error: "Fixture provider timed out", code: "PROVIDER_TIMEOUT", retryable: true } });
      }
      return route.fulfill({ json: { narration: "Fixture command accepted once.", stateDelta: {} } });
    });
    const { playerId, before } = await openMission(page);
    const input = page.locator(".al-input");
    await input.fill(action);
    await page.getByRole("button", { name: "TRANSMIT", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Your mission and action are unchanged");
    expect((await page.getByRole("alert").boundingBox()).width).toBeGreaterThan(300);
    expect((await page.getByRole("button", { name: "Retry action", exact: true }).boundingBox()).height).toBeGreaterThanOrEqual(44);
    await expect(input).toHaveValue(action);
    await expect(input).toBeEnabled();
    expect(await loadSaved(page, playerId)).toEqual(before);
    expect(saves).toBe(0);
    await page.screenshot({ path: testInfo.outputPath(`${failure}-failure-preserved.png`), fullPage: true });
    await page.getByRole("button", { name: "Retry action", exact: true }).click();
    await expect(page.locator(".narration-panel__body")).toHaveText("Fixture command accepted once.");
    await expect(input).toHaveValue("");
    const after = await loadSaved(page, playerId);
    expect(after.turn).toBe(1);
    expect(after.worldState.mission.met).toBe("T+14:23:07");
    expect(after.conversationHistory.filter((entry) => entry.content === action)).toHaveLength(1);
    expect(requests).toHaveLength(2);
    expect(requests[1]).toEqual(requests[0]);
    expect(saves).toBe(1);
    expect(errors).toEqual([]);
  });

  test(`autonomous ${failure} planning failure clears drafting and recovers explicitly`, async ({ page }) => {
    let plans = 0, turns = 0;
    await page.route("**/api/autonomous-action", async (route) => {
      plans += 1;
      if (plans === 1) {
        if (failure === "network") return route.abort("failed");
        return route.fulfill({ status: 503, json: { error: "Fixture planner timed out", retryable: true } });
      }
      return route.fulfill({ json: { action } });
    });
    await page.route("**/api/turn", async (route) => { turns += 1; return route.fulfill({ json: { narration: "Fixture autonomous action accepted.", stateDelta: {} } }); });
    const { playerId, before } = await openMission(page, true);
    await expect(page.getByRole("alert")).toContainText("AI crew could not prepare an action");
    await expect(page.getByRole("button", { name: "DRAFTING TURN", exact: true })).toHaveCount(0);
    expect(await loadSaved(page, playerId)).toEqual(before);
    expect(turns).toBe(0);
    await page.getByRole("button", { name: "Retry AI planning", exact: true }).click();
    await page.getByRole("button", { name: "CONTINUE AUTONOMOUS TURN", exact: true }).click();
    await expect(page.locator(".narration-panel__body")).toHaveText("Fixture autonomous action accepted.");
    await expect.poll(async () => (await loadSaved(page, playerId)).turn).toBe(1);
    expect(plans).toBe(2);
    expect(turns).toBe(1);
  });
}
