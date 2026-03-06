/**
 * Gateway method: setup.status
 *
 * Returns a summary of which integrations are configured and which are missing
 * required env vars.  This is intentionally "client-safe": it only returns
 * env var *names* (never values) and a boolean `configured` flag per
 * integration.  No secrets are exposed.
 */
import { getIntegrationStatus } from "../../integrations/requirements.js";
import type { GatewayRequestHandlers } from "./types.js";

export const setupHandlers: GatewayRequestHandlers = {
  "setup.status": ({ respond }) => {
    const integrations = getIntegrationStatus();
    respond(true, { integrations }, undefined);
  },
};
