import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

let service, directory, url;
async function startService(port = 0) {
  service = spawn(process.execPath, ["tests/e2e/multiplayer-fixture.mjs"], {
    env: { ...process.env, ARTEMIS_FIXTURE_DIRECTORY: directory, ARTEMIS_FIXTURE_PORT: String(port), DATABASE_URL: "", OPENAI_API_KEY: "", ANTHROPIC_API_KEY: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  url = await new Promise((resolve, reject) => {
    let output = "", diagnostics = "";
    const timer = setTimeout(() => { service.kill(); reject(new Error("Fixture startup timed out")); }, 15000);
    service.stderr.on("data", (chunk) => { diagnostics += chunk.toString(); });
    service.once("exit", (code) => { clearTimeout(timer); reject(new Error(`Fixture exited ${code}: ${diagnostics}`)); });
    service.stdout.on("data", (chunk) => {
      output += chunk.toString();
      for (const line of output.split("\n")) {
        try { const data = JSON.parse(line); if (data.fixtureUrl) { clearTimeout(timer); resolve(data.fixtureUrl); } } catch { /* Await complete JSON readiness line. */ }
      }
    });
  });
}
async function stopService() {
  if (!service || service.exitCode !== null) return;
  await new Promise((resolve) => { service.once("exit", resolve); service.kill("SIGTERM"); });
}
async function openCoop(page) {
  await page.goto(url);
  await page.getByRole("button", { name: "Play co-op", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Shared mission control" })).toBeVisible();
}
async function credentials(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("artemis-coop-v1")));
}
async function roomState(page, key) {
  const response = await page.request.get(`${url}/api/multiplayer/rooms/${key.roomId}`, { headers: { Authorization: `Bearer ${key.token}` } });
  expect(response.status()).toBe(200);
  return (await response.json()).room;
}
async function calls() {
  try { return (await readFile(path.join(directory, "provider-calls.ndjson"), "utf8")).trim().split("\n").filter(Boolean).length; }
  catch (error) { if (error.code === "ENOENT") return 0; throw error; }
}

test.beforeAll(async () => { directory = await mkdtemp(path.join(tmpdir(), "artemis-coop-e2e-")); await startService(); });
test.afterAll(async () => { await stopService(); if (directory) await rm(directory, { recursive: true, force: true }); });

test("two real clients share a mission, recover a lost response once, run bots and restore after server restart", async ({ browser }, testInfo) => {
  const hostContext = await browser.newContext({ reducedMotion: "reduce" });
  const guestContext = await browser.newContext({ viewport: { width: 320, height: 800 }, reducedMotion: "reduce" });
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  const browserErrors = [];
  for (const page of [host, guest]) page.on("pageerror", (error) => browserErrors.push(error.message));
  try {
    await openCoop(host);
    await host.getByLabel("Display name").fill("Fixture Commander");
    await host.getByLabel("Crew seat").selectOption("vasquez");
    expect((await new AxeBuilder({ page: host }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
    await host.getByRole("button", { name: "Create private room", exact: true }).click();
    await expect(host.getByRole("heading", { name: "Crew roster" })).toBeVisible();
    const a = await credentials(host);
    await openCoop(guest);
    await guest.getByRole("button", { name: "Join a room", exact: true }).click();
    await guest.getByLabel("Display name").fill("Fixture Engineer");
    await guest.getByLabel("Crew seat").selectOption("okafor");
    await guest.getByLabel("Room ID", { exact: true }).fill(a.roomId);
    await guest.getByLabel("Invite code", { exact: true }).fill(a.inviteCode);
    await guest.getByRole("button", { name: "Join crew", exact: true }).click();
    await expect(guest.getByRole("heading", { name: "Crew roster" })).toBeVisible();
    const b = await credentials(guest);
    const occupied = await guest.request.post(`${url}/api/multiplayer/rooms/${a.roomId}/seat`, { headers: { Authorization: `Bearer ${b.token}` }, data: { seatId: "vasquez" } });
    expect(occupied.status()).toBe(409);
    await expect(host.getByText("Fixture Engineer", { exact: true })).toBeVisible();
    await expect(guest.getByRole("button", { name: "Start shared mission", exact: true })).toHaveCount(0);
    expect((await new AxeBuilder({ page: host }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
    await host.getByRole("button", { name: "Start shared mission", exact: true }).click();
    await expect(guest.getByText(/Current turn: Commander/)).toBeVisible();
    await expect(host.getByText("COMMANDER VIEW", { exact: true })).toBeVisible();
    await expect(guest.getByText("FLIGHT ENGINEER VIEW", { exact: true })).toBeVisible();
    await expect(guest.getByLabel("Your action", { exact: true })).toHaveCount(0);
    expect((await new AxeBuilder({ page: host }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);

    // The server commits normally; the first response alone is deliberately lost.
    let loseResponse = true;
    await host.route("**/api/multiplayer/rooms/*/actions", async (route) => {
      if (!loseResponse) return route.continue();
      loseResponse = false;
      const committed = await route.fetch();
      expect(committed.status()).toBe(200);
      await route.abort("failed");
    });
    const before = await roomState(host, a);
    const outOfTurn = await guest.request.post(`${url}/api/multiplayer/rooms/${a.roomId}/actions`, { headers: { Authorization: `Bearer ${b.token}` }, data: { commandId: "forbidden-guest-command", expectedRevision: before.revision, action: "Act from another player's seat." } });
    expect(outOfTurn.status()).toBe(403);
    expect(await calls()).toBe(0);
    await host.getByLabel("Your action", { exact: true }).fill("Hold position and confirm crew readiness.");
    await host.getByRole("button", { name: "Send action", exact: true }).click();
    await expect(host.getByRole("button", { name: "Retry last command", exact: true })).toBeEnabled();
    const pending = (await credentials(host)).pending;
    await host.getByRole("button", { name: "Retry last command", exact: true }).click();
    await expect(host.getByRole("button", { name: "Retry last command", exact: true })).toHaveCount(0);
    expect(await calls()).toBe(1);
    const after = await roomState(host, a);
    expect(after.revision).toBe(before.revision + 1);
    expect(after.session.worldState.mission.met).not.toBe(before.session.worldState.mission.met);
    expect((await roomState(guest, b)).session).toEqual(after.session);
    await expect(guest.getByLabel("Your action", { exact: true })).toBeVisible();
    await guest.getByLabel("Your action", { exact: true }).fill("Monitor oxygen levels and maintain present configuration.");
    await guest.getByRole("button", { name: "Send action", exact: true }).click();
    await expect.poll(calls).toBe(2);
    await expect(host.getByRole("button", { name: "Advance AI turn", exact: true })).toBeEnabled();
    await host.getByRole("button", { name: "Advance AI turn", exact: true }).click();
    await expect.poll(calls).toBe(3);
    // Existing role follow-through can hand control back to a human after a bot.
    const botResolved = await roomState(host, a);
    const nextActor = botResolved.session.worldState.crew[botResolved.session.turn].id;
    if (nextActor === "vasquez" || nextActor === "okafor") {
      const actor = nextActor === "vasquez" ? host : guest;
      await expect(actor.getByLabel("Your action", { exact: true })).toBeVisible();
      await actor.getByLabel("Your action", { exact: true }).fill("Maintain safe configuration and continue monitoring.");
      await actor.getByRole("button", { name: "Send action", exact: true }).click();
    } else {
      await expect(host.getByRole("button", { name: "Advance AI turn", exact: true })).toBeEnabled();
      await host.getByRole("button", { name: "Advance AI turn", exact: true }).click();
    }
    await expect.poll(calls).toBe(4);
    await guest.getByLabel("Message to crew", { exact: true }).fill("Engineering ready after shared turn.");
    await guest.getByRole("button", { name: "Send message", exact: true }).click();
    await expect(host.getByText("Engineering ready after shared turn.", { exact: true })).toBeVisible();
    const saved = await roomState(host, a);
    expect((await roomState(guest, b)).session).toEqual(saved.session);

    // Poll/rejoin must survive a new server process using the same owned directory.
    const port = new URL(url).port;
    await stopService();
    await expect(guest.getByRole("button", { name: "Reconnect", exact: true })).toBeVisible();
    await startService(port);
    await guest.getByRole("button", { name: "Reconnect", exact: true }).click();
    await expect(guest.getByText("Connected · shared mission saved on server", { exact: true })).toBeVisible();
    await openCoop(host);
    await openCoop(guest);
    await expect(host.getByText("Engineering ready after shared turn.", { exact: true })).toBeVisible();
    await expect(guest.getByText("Engineering ready after shared turn.", { exact: true })).toBeVisible();
    expect((await roomState(host, a)).session).toEqual(saved.session);
    expect((await roomState(guest, b)).session).toEqual(saved.session);
    expect(await calls()).toBe(4);
    const replay = await host.request.post(`${url}/api/multiplayer/rooms/${a.roomId}/actions`, { headers: { Authorization: `Bearer ${a.token}` }, data: pending });
    expect(replay.status()).toBe(200);
    expect(await calls()).toBe(4);

    // A third context's credentials cannot view or advance this party.
    const unrelated = await guest.request.post(`${url}/api/multiplayer/rooms`, { data: { name: "Other party", seatId: "park" } });
    const other = await unrelated.json();
    const denied = await guest.request.get(`${url}/api/multiplayer/rooms/${a.roomId}`, { headers: { Authorization: `Bearer ${other.token}` } });
    expect(denied.status()).toBe(401);
    const deniedAction = await guest.request.post(`${url}/api/multiplayer/rooms/${a.roomId}/actions`, { headers: { Authorization: `Bearer ${other.token}` }, data: { commandId: "cross-room-command", expectedRevision: saved.revision, action: "Cross the room boundary." } });
    expect(deniedAction.status()).toBe(401);
    expect(await calls()).toBe(4);
    const serializedDom = await host.locator("body").innerText();
    expect(serializedDom).not.toContain(a.token);
    expect(serializedDom).not.toContain(b.token);
    expect(new URL(host.url()).search).toBe("");
    expect(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await guest.getByLabel("Message to crew", { exact: true }).focus();
    await guest.keyboard.press("Tab");
    await expect(guest.getByRole("button", { name: "Send message", exact: true })).toBeFocused();
    await host.screenshot({ path: testInfo.outputPath("host-shared-mission.png"), fullPage: true, style: ".coop-room-details p:nth-child(2) code { visibility: hidden; }" });
    await guest.screenshot({ path: testInfo.outputPath("guest-mobile-console.png"), fullPage: true });
    const accessibility = await new AxeBuilder({ page: guest }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(accessibility.violations).toEqual([]);
    expect(browserErrors).toEqual([]);
    const proofPath = testInfo.outputPath("multiplayer-proof.json");
    await writeFile(proofPath, JSON.stringify({ independentBrowserContexts: 2, providerCalls: await calls(), duplicateLostResponseAdvancedOnce: true, persistedReplayAfterRestart: true, sharedRevision: saved.revision, mobileWidth: 320, accessibilityViolations: accessibility.violations.length, browserErrors, productionProviderUsed: false }, null, 2));
    await testInfo.attach("multiplayer-proof", { path: proofPath, contentType: "application/json" });
    await guest.getByRole("button", { name: "Leave room", exact: true }).click();
    await expect(guest.getByRole("heading", { name: "Assemble your crew" })).toBeVisible();
    expect((await host.request.get(`${url}/api/multiplayer/rooms/${a.roomId}`, { headers: { Authorization: `Bearer ${b.token}` } })).status()).toBe(401);
  } finally { await hostContext.close(); await guestContext.close(); }
});

test("blocked browser storage preserves co-op navigation and membership in the current tab", async ({ browser }, testInfo) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  await context.addInitScript(() => {
    for (const method of ["getItem", "setItem", "removeItem"]) {
      Storage.prototype[method] = () => { throw new DOMException("Fixture storage unavailable", "SecurityError"); };
    }
  });
  const page = await context.newPage();
  const failures = [];
  page.on("pageerror", (error) => failures.push(error.message));
  try {
    await openCoop(page);
    await page.getByLabel("Display name").fill("Storage-blocked fixture");
    const response = page.waitForResponse((candidate) => candidate.url().endsWith("/api/multiplayer/rooms") && candidate.request().method() === "POST");
    await page.getByRole("button", { name: "Create private room", exact: true }).click();
    const created = await (await response).json();
    await expect(page.getByRole("heading", { name: "Crew roster" })).toBeVisible();
    await expect(page.getByText(/Browser storage is unavailable/)).toBeVisible();
    await page.getByRole("button", { name: "Back to menu", exact: true }).click();
    await page.getByRole("button", { name: "Play co-op", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Crew roster" })).toBeVisible();
    await expect(page.getByText(created.room.id, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Start shared mission", exact: true }).click();
    await expect(page.getByLabel("Your action", { exact: true })).toBeVisible();
    expect(failures).toEqual([]);
    await testInfo.attach("blocked-storage-proof", { body: JSON.stringify({ inMemoryMembershipRestored: true, navigationWorks: true, pageErrors: failures }), contentType: "application/json" });
  } finally { await context.close(); }
});
