import "dotenv/config";
import express from "express";
import { assertDmConfig, requestDmTurn } from "./api.js";

const PORT = Number(process.env.DM_API_PORT || 8787);

const app = express();
app.use(express.json({ limit: "512kb" }));

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
    const status = /ANTHROPIC_API_KEY/.test(err.message || "") ? 503 : 500;
    res.status(status).json({ error: err.message || String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`DM API listening on http://localhost:${PORT}`);
});
