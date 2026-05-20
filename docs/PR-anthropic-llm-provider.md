# Pull request: Anthropic Claude as optional LLM provider

Use this when opening the PR (copy title + body into GitHub).

## Title

Add Anthropic Claude support as optional LLM provider

## Body

## Summary

- Add optional Anthropic Claude support alongside the existing OpenAI Responses API path.
- Introduce `LLM_PROVIDER`, `ANTHROPIC_API_KEY`, and `ANTHROPIC_MODEL` environment variables; OpenAI remains the default.
- Centralize provider selection in `server/llmConfig.js` and share HTTP logic in `server/api.js`.
- Expose `llmConfigured`, `llmProvider`, and `model` on `/api/health` (remove misleading `openaiConfigured`).
- Update README, `.env.example`, `render.yaml`, and architecture docs.

## Motivation

Players and deployers may prefer Claude over OpenAI. Anthropic does not support OpenAI’s Responses API, so Claude uses the native Messages API while preserving the same prompt contract and `STATE_DELTA` parsing.

## Test plan

- [ ] `cp .env.example .env` and configure `LLM_PROVIDER=anthropic` with a valid `ANTHROPIC_API_KEY`
- [ ] `npm run dev` — open http://localhost:5173 and complete at least one DM turn
- [ ] `GET /api/health` returns `llmConfigured: true`, `llmProvider: "anthropic"`, and the configured model
- [ ] Default OpenAI configuration still works when `LLM_PROVIDER=openai` (or unset) and `OPENAI_API_KEY` is set
- [ ] `npm test` on Node **≥ 20.19.0** (see README; `llmConfig` unit tests included)

## Notes

- No API keys are committed; `.env` stays gitignored.
- `package-lock.json` unrelated churn should not be included in this PR.
