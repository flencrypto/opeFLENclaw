import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";
import { buildExternalLinkRel, EXTERNAL_LINK_TARGET } from "../external-link.ts";

export type IntegrationStatusEntry = {
  id: string;
  name: string;
  category: string;
  configured: boolean;
  missing: string[];
  requiresOAuth: boolean;
};

export type SetupProps = {
  loading: boolean;
  error: string | null;
  integrations: IntegrationStatusEntry[] | null;
  onRefresh: () => void;
};

const CATEGORY_LABELS: Record<string, string> = {
  gateway: "Gateway",
  "model-provider": "AI Model Providers",
  channel: "Messaging Channels",
  tool: "Tools",
  voice: "Voice / Media",
  oauth: "OAuth",
};

// The insertion order of CATEGORY_LABELS defines the display order.
const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS);

function categoryLabel(cat: string): string {
  return CATEGORY_LABELS[cat] ?? cat;
}

/** Returns true if an integration is considered ready (configured or OAuth-gated). */
function isIntegrationReady(entry: IntegrationStatusEntry): boolean {
  return entry.configured || entry.requiresOAuth;
}

function groupByCategory(entries: IntegrationStatusEntry[]): Map<string, IntegrationStatusEntry[]> {
  const grouped = new Map<string, IntegrationStatusEntry[]>();
  for (const cat of CATEGORY_ORDER) {
    grouped.set(cat, []);
  }
  for (const entry of entries) {
    const cat = entry.category ?? "other";
    if (!grouped.has(cat)) {
      grouped.set(cat, []);
    }
    grouped.get(cat)!.push(entry);
  }
  // Remove empty groups
  for (const [cat, items] of grouped) {
    if (items.length === 0) {
      grouped.delete(cat);
    }
  }
  return grouped;
}

function renderStatusChip(configured: boolean, requiresOAuth: boolean) {
  if (configured || requiresOAuth) {
    return html`<span class="chip chip-ok">${configured ? t("setup.status.configured") : t("setup.status.oauth")}</span>`;
  }
  return html`<span class="chip chip-danger">${t("setup.status.missing")}</span>`;
}

function renderIntegrationRow(entry: IntegrationStatusEntry) {
  const ready = isIntegrationReady(entry);
  return html`
    <div class="setup-integration-row ${ready ? "setup-row--ok" : "setup-row--missing"}">
      <div class="setup-row-header">
        <span class="setup-row-name">${entry.name}</span>
        ${renderStatusChip(entry.configured, entry.requiresOAuth)}
      </div>
      ${
        !entry.configured && entry.missing.length > 0
          ? html`
              <div class="setup-row-missing">
                <span class="muted">${t("setup.missing.label")}</span>
                <div class="chip-row" style="margin-top: 4px;">
                  ${entry.missing.map((v) => html`<code class="chip">${v}</code>`)}
                </div>
              </div>
            `
          : nothing
      }
      ${
        !entry.configured && entry.requiresOAuth && entry.missing.length === 0
          ? html`<div class="setup-row-oauth muted">${t("setup.oauth.hint")}</div>`
          : nothing
      }
    </div>
  `;
}

export function renderSetup(props: SetupProps) {
  const missingCount = (props.integrations ?? []).filter((i) => !isIntegrationReady(i)).length;
  const configuredCount = (props.integrations ?? []).filter(isIntegrationReady).length;

  return html`
    <div>
      <div class="card" style="margin-bottom: 18px;">
        <div class="row" style="justify-content: space-between; align-items: flex-start;">
          <div>
            <div class="card-title">${t("setup.title")}</div>
            <div class="card-sub">${t("setup.subtitle")}</div>
          </div>
          <button
            class="btn btn--sm"
            @click=${props.onRefresh}
            ?disabled=${props.loading}
          >
            ${props.loading ? t("common.loading") : t("common.refresh")}
          </button>
        </div>

        ${
          props.integrations
            ? html`
                <div class="stat-grid" style="margin-top: 16px;">
                  <div class="stat">
                    <div class="stat-label">${t("setup.stats.configured")}</div>
                    <div class="stat-value ok">${configuredCount}</div>
                  </div>
                  <div class="stat">
                    <div class="stat-label">${t("setup.stats.missing")}</div>
                    <div class="stat-value ${missingCount > 0 ? "danger" : "ok"}">${missingCount}</div>
                  </div>
                </div>
              `
            : nothing
        }

        ${
          missingCount > 0
            ? html`
                <div class="callout info" style="margin-top: 14px;">
                  ${t("setup.hint.envFile")}
                  <div style="margin-top: 6px;">
                    <a
                      class="session-link"
                      href="https://docs.openclaw.ai/gateway/auth"
                      target=${EXTERNAL_LINK_TARGET}
                      rel=${buildExternalLinkRel()}
                    >${t("setup.hint.docs")}</a>
                    &nbsp;·&nbsp;
                    <a
                      class="session-link"
                      href="https://github.com/openclaw/openclaw/blob/main/REQUIRED_KEYS_AND_LOGINS.txt"
                      target=${EXTERNAL_LINK_TARGET}
                      rel=${buildExternalLinkRel()}
                    >${t("setup.hint.keyRef")}</a>
                  </div>
                </div>
              `
            : nothing
        }

        ${
          props.error
            ? html`<div class="callout danger" style="margin-top: 14px;">${props.error}</div>`
            : nothing
        }
      </div>

      ${
        props.loading && !props.integrations
          ? html`<div class="muted" style="padding: 12px 0;">${t("common.loading")}</div>`
          : nothing
      }

      ${
        props.integrations
          ? Array.from(groupByCategory(props.integrations)).map(
              ([cat, entries]) => html`
                <div class="card" style="margin-bottom: 14px;">
                  <div class="card-title" style="margin-bottom: 12px;">${categoryLabel(cat)}</div>
                  <div class="setup-integration-list">
                    ${entries.map(renderIntegrationRow)}
                  </div>
                </div>
              `,
            )
          : nothing
      }
    </div>
  `;
}
