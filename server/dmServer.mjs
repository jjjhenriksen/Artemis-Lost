import "dotenv/config";
import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertDmConfig, requestAutonomousCrewAction, requestDmTurn } from "./api.js";
import { getLlmConfig, isLlmConfigured } from "./llmConfig.js";
import {
  deleteSession,
  getSessionBackendMode,
  listSessions,
  loadSession,
  saveSession,
} from "./sessionStore.js";
import { assertKnownSlot, assertValidSession } from "./sessionValidation.js";
import { dynamicVaultRoot, storageMode } from "./storagePaths.js";
import { createMultiplayerRepository } from "./multiplayerRepository.js";
import { createMultiplayerRouter } from "./multiplayerRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const distRoot = path.join(projectRoot, "dist");
const indexHtmlPath = path.join(distRoot, "index.html");

const PORT = Number(process.env.PORT || process.env.DM_API_PORT || 8787);
const hasBuiltClient = existsSync(indexHtmlPath);
const llmConfig = getLlmConfig();
const hasLlmKey = isLlmConfigured();
const sessionBackendMode = getSessionBackendMode();

function getOwnerIdFromRequest(req) {
  const headerValue = req.get("x-player-id");
  return headerValue || "local-player";
}

export function createApp(deps = {}) {
  const {
    assertConfig = assertDmConfig,
    requestTurn = requestDmTurn,
    requestAutoAction = requestAutonomousCrewAction,
    listSessionsImpl = listSessions,
    loadSessionImpl = loadSession,
    saveSessionImpl = saveSession,
    deleteSessionImpl = deleteSession,
    multiplayerRepository = createMultiplayerRepository(),
    multiplayerRequestTurn = (input) => requestDmTurn({ ...input, sharedRoom: true }),
    multiplayerLimits,
    multiplayerNow,
  } = deps;

  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "512kb" }));
  app.use("/api/multiplayer", (error, _req, res, _next) => {
    const tooLarge = error.type === "entity.too.large";
    res.set("Cache-Control", "no-store").status(tooLarge ? 413 : 400).json({
      error: tooLarge ? "The room request is too large." : "Send a valid JSON object.",
      code: tooLarge ? "REQUEST_TOO_LARGE" : "INVALID_JSON",
    });
  });
  app.use("/api/multiplayer", createMultiplayerRouter({
    repository: multiplayerRepository, requestTurn: multiplayerRequestTurn,
    limits: multiplayerLimits, now: multiplayerNow,
  }));

  app.get("/healthz", (_req, res) => {
    res.status(200).json({
      ok: true,
      service: "artemis-lost",
      frontend: hasBuiltClient ? "built" : "not-built",
      api: "up",
      storageMode,
      sessionBackendMode,
    });
  });

  app.get("/api/health", (_req, res) => {
    res.status(200).json({
      ok: true,
      service: "artemis-lost",
      frontend: hasBuiltClient ? "built" : "not-built",
      llmConfigured: hasLlmKey,
      llmProvider: llmConfig.provider,
      model: llmConfig.model,
      storageMode,
      sessionBackendMode,
      dynamicVaultRoot,
    });
  });

  app.get("/api/sessions", async (req, res) => {
    try {
      const sessions = await listSessionsImpl(getOwnerIdFromRequest(req));
      res.json(sessions);
    } catch (err) {
      if (err.status !== 400) console.error(err);
      res.status(err.status || 500).json({ error: err.message || String(err), code: err.code });
    }
  });

  app.get("/api/session/:slotId", async (req, res) => {
    try {
      assertKnownSlot(req.params.slotId);
      const session = await loadSessionImpl(req.params.slotId, getOwnerIdFromRequest(req));
      res.json({ session });
    } catch (err) {
      if (err.status !== 400) console.error(err);
      res.status(err.status || 500).json({ error: err.message || String(err), code: err.code });
    }
  });

  app.put("/api/session/:slotId", async (req, res) => {
    try {
      assertKnownSlot(req.params.slotId);
      assertValidSession(req.body);
      const {
        worldState, narration = "", turn,
        conversationHistory = [], createdFromCharacterCreation = false,
      } = req.body;
      const session = await saveSessionImpl(req.params.slotId, {
        worldState, narration, turn, conversationHistory, createdFromCharacterCreation,
      }, getOwnerIdFromRequest(req));

      res.json({ session });
    } catch (err) {
      if (err.status !== 400) console.error(err);
      res.status(err.status || 500).json({ error: err.message || String(err), code: err.code });
    }
  });

  app.delete("/api/session/:slotId", async (req, res) => {
    try {
      assertKnownSlot(req.params.slotId);
      const result = await deleteSessionImpl(req.params.slotId, getOwnerIdFromRequest(req));
      res.json(result);
    } catch (err) {
      if (err.status !== 400) console.error(err);
      res.status(err.status || 500).json({ error: err.message || String(err), code: err.code });
    }
  });

  app.post("/api/turn", async (req, res) => {
    try {
      assertConfig();

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

      const { narration, stateDelta } = await requestTurn({
        worldState,
        action,
        activeCrew,
        conversationHistory,
        currentTurn,
        ownerId: getOwnerIdFromRequest(req),
      });

      res.json({ narration, stateDelta });
    } catch (err) {
      console.error(err);
      const status = /API_KEY is not set/.test(err.message || "") ? 503 : 500;
      res.status(status).json({ error: err.message || String(err) });
    }
  });

  app.post("/api/autonomous-action", async (req, res) => {
    try {
      assertConfig();

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

      const action = await requestAutoAction({
        worldState,
        activeCrew,
        conversationHistory,
        currentTurn,
        ownerId: getOwnerIdFromRequest(req),
      });

      res.json({ action });
    } catch (err) {
      console.error(err);
      const status = /API_KEY is not set/.test(err.message || "") ? 503 : 500;
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

  return app;
}

const app = createApp();

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  app.listen(PORT, () => {
    console.log(
      hasBuiltClient
        ? `Artemis Lost listening on http://localhost:${PORT}`
        : `DM API listening on http://localhost:${PORT}`
    );
    if (!hasLlmKey) {
      console.warn(
        "No LLM API key is set. Add OPENAI_API_KEY or ANTHROPIC_API_KEY to .env. Gameplay requests to /api/turn and /api/autonomous-action will return 503."
      );
    } else {
      console.log(`LLM provider: ${llmConfig.provider} (${llmConfig.model})`);
    }
    console.log(`Dynamic session storage: ${dynamicVaultRoot} (${storageMode})`);
    console.log(`Session backend: ${sessionBackendMode}`);
  });
}
