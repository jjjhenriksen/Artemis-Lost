const DEFAULT_TIMEOUT_MS = 30000;
export function getProviderTimeoutMs(value = process.env.LLM_TIMEOUT_MS) {
  if (value === undefined || value === "") return DEFAULT_TIMEOUT_MS;
  const timeout = typeof value === "number" ? value
    : typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN;
  if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 120000) {
    throw Object.assign(new Error("LLM_TIMEOUT_MS must be an integer between 1 and 120000 milliseconds."), {
      status: 503, code: "INVALID_PROVIDER_TIMEOUT",
    });
  }
  return timeout;
}
