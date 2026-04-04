import "dotenv/config";
import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertDmConfig, requestAutonomousCrewAction, requestDmTurn } from "./api.js";
import {
  deleteSession,
  getSessionBackendMode,
  listSessions,
  loadSession,
  saveSession,
} from "./sessionStore.js";
import { dynamicVaultRoot, storageMode } from "./storagePaths.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const distRoot = path.join(projectRoot, "dist");
const indexHtmlPath = path.join(distRoot, "index.html");

const PORT = Number(process.env.PORT || process.env.DM_API_PORT || 8787);
const hasBuiltClient = existsSync(indexHtmlPath);
const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY);
const modelName = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const sessionBackendMode = getSessionBackendMode();

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "512kb" }));

app.get("/healthz", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "dungeonmaister",
    frontend: hasBuiltClient ? "built" : "not-built",
    api: "up",
    storageMode,
    sessionBackendMode,
  });
});

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "dungeonmaister",
    frontend: hasBuiltClient ? "built" : "not-built",
    openaiConfigured: hasOpenAiKey,
    model: modelName,
    storageMode,
    sessionBackendMode,
    dynamicVaultRoot,
  });
});

app.get("/api/sessions", async (_req, res) => {
  try {
    const sessions = await listSessions();
    res.json(sessions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.get("/api/session/:slotId", async (req, res) => {
  try {
    const session = await loadSession(req.params.slotId);
    res.json({ session });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.put("/api/session/:slotId", async (req, res) => {
  try {
    const {
      worldState,
      narration,
      turn,
      conversationHistory = [],
      createdFromCharacterCreation = false,
    } = req.body || {};

    if (!worldState || typeof turn !== "number") {
      res.status(400).json({ error: "Missing worldState or turn" });
      return;
    }

    const session = await saveSession(req.params.slotId, {
      worldState,
      narration: narration || "",
      turn,
      conversationHistory,
      createdFromCharacterCreation,
    });

    res.json({ session });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.delete("/api/session/:slotId", async (req, res) => {
  try {
    const result = await deleteSession(req.params.slotId);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.post("/api/turn", async (req, res) => {
  try {
    assertDmConfig();

    const {
      worldState,
      action,
      activeCrew,
      conversationHistory = [],
      currentTurn = 0,
    } = req.body || {};

    if (!worldState || !action || !activeCrew) {
      res.status(400).json({ error: "Missing worldState, action, or activeCrew" });
      return;
    }

    const { narration, stateDelta } = await requestDmTurn({
      worldState,
      action,
      activeCrew,
      conversationHistory,
      currentTurn,
    });

    res.json({ narration, stateDelta });
  } catch (err) {
    console.error(err);
    const status = /OPENAI_API_KEY/.test(err.message || "") ? 503 : 500;
    res.status(status).json({ error: err.message || String(err) });
  }
});

app.post("/api/autonomous-action", async (req, res) => {
  try {
    assertDmConfig();

    const {
      worldState,
      activeCrew,
      conversationHistory = [],
      currentTurn = 0,
    } = req.body || {};

    if (!worldState || !activeCrew) {
      res.status(400).json({ error: "Missing worldState or activeCrew" });
      return;
    }

    const action = await requestAutonomousCrewAction({
      worldState,
      activeCrew,
      conversationHistory,
      currentTurn,
    });

    res.json({ action });
  } catch (err) {
    console.error(err);
    const status = /OPENAI_API_KEY/.test(err.message || "") ? 503 : 500;
    res.status(status).json({ error: err.message || String(err) });
  }
});

if (hasBuiltClient) {
  app.use(express.static(distRoot));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      next();
      return;
    }

    res.sendFile(indexHtmlPath);
  });
}

app.listen(PORT, () => {
  console.log(
    hasBuiltClient
      ? `Artemis Lost listening on http://localhost:${PORT}`
      : `DM API listening on http://localhost:${PORT}`
  );
  if (!hasOpenAiKey) {
    console.warn("OPENAI_API_KEY is not set. Gameplay requests to /api/turn and /api/autonomous-action will return 503.");
  }
  console.log(`Dynamic session storage: ${dynamicVaultRoot} (${storageMode})`);
  console.log(`Session backend: ${sessionBackendMode}`);
});
