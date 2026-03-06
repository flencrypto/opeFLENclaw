import type { GatewayBrowserClient } from "../gateway.ts";
import type { IntegrationStatusEntry } from "../views/setup.ts";

export type SetupState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  setupLoading: boolean;
  setupIntegrations: IntegrationStatusEntry[] | null;
  setupError: string | null;
};

export async function loadSetupStatus(state: SetupState) {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.setupLoading) {
    return;
  }
  state.setupLoading = true;
  state.setupError = null;
  try {
    const res = await state.client.request<{ integrations: IntegrationStatusEntry[] }>(
      "setup.status",
      {},
    );
    state.setupIntegrations = res?.integrations ?? null;
  } catch (err) {
    state.setupError = String(err);
  } finally {
    state.setupLoading = false;
  }
}
