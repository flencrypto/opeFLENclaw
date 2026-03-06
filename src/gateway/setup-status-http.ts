import type { IncomingMessage, ServerResponse } from "node:http";
import { buildSetupStatus } from "../integrations/requirements.js";
import { sendJson, sendMethodNotAllowed } from "./http-common.js";

const SETUP_STATUS_PATH = "/api/setup/status";

/**
 * Handles GET /api/setup/status.
 *
 * Returns which integrations are configured (env vars present) without
 * exposing any secret values. This endpoint is intentionally unauthenticated
 * so that operators can check configuration status without a gateway token.
 *
 * Response shape:
 * ```json
 * {
 *   "ok": true,
 *   "integrations": {
 *     "openai": { "name": "OpenAI", "category": "ai-provider", "configured": true, "missing": [], "oauthOnly": false },
 *     "telegram": { "name": "Telegram", "category": "channel", "configured": false, "missing": ["TELEGRAM_BOT_TOKEN"], "oauthOnly": false }
 *   }
 * }
 * ```
 *
 * Returns false if the path does not match (caller should try next handler).
 */
export function handleSetupStatusRequest(
  req: IncomingMessage,
  res: ServerResponse,
): boolean {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname !== SETUP_STATUS_PATH) {
    return false;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    sendMethodNotAllowed(res, "GET");
    return true;
  }

  const status = buildSetupStatus();
  sendJson(res, 200, { ok: true, ...status });
  return true;
}
