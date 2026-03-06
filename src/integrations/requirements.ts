/**
 * Integration requirements registry — single source of truth for all
 * credentials, API keys, OAuth tokens, and external logins that OpenClaw uses.
 *
 * Each entry declares:
 *  - id              machine-readable identifier
 *  - name            human-readable name
 *  - description     what the integration unlocks
 *  - category        grouping for display
 *  - requiredEnvVars env vars that MUST be set for the integration to function
 *  - optionalEnvVars env vars that provide additional / alternate auth
 *  - oauthRequired   whether an interactive OAuth flow is needed (no simple env var)
 *  - setupSteps      ordered step-by-step instructions
 *  - links           official links for obtaining credentials
 *  - dependentCommands CLI commands / features that require this integration
 *
 * Usage:
 *  - Server-side: call getMissingEnvVars(requirement.requiredEnvVars) to check
 *  - HTTP: GET /api/setup/status returns configured status for all integrations
 */

export type IntegrationCategory =
  | "ai-provider"
  | "channel"
  | "tool"
  | "voice"
  | "infrastructure";

export interface IntegrationRequirement {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: IntegrationCategory;
  /** At least one of these must be set for the integration to function. */
  readonly requiredEnvVars: readonly string[];
  /** Any-one-of semantics: if multiple vars are listed, the first non-empty one wins. */
  readonly requiredEnvVarsAnyOf?: readonly (readonly string[])[];
  /** Present but not required — augment or enable optional behaviour. */
  readonly optionalEnvVars?: readonly string[];
  /** True when a browser/interactive OAuth flow is also supported (no plain env var). */
  readonly oauthSupported?: boolean;
  /** True when ONLY OAuth works — no env var path exists. */
  readonly oauthOnly?: boolean;
  readonly setupSteps: readonly string[];
  readonly links: readonly string[];
  readonly dependentCommands?: readonly string[];
}

// ---------------------------------------------------------------------------
// Helper: detect missing env vars (server-side only)
// ---------------------------------------------------------------------------

/**
 * Returns the subset of `required` env vars that are not set in the current
 * process environment. An empty return means all vars are present.
 *
 * Server-side only — never call from client code.
 */
export function getMissingEnvVars(required: readonly string[]): string[] {
  return required.filter((v) => !process.env[v]?.trim());
}

/**
 * Returns true when at least one group in `anyOf` is fully satisfied.
 * Used for integrations where multiple sets of env vars are alternatives.
 */
export function isAnyGroupSatisfied(anyOf: readonly (readonly string[])[]): boolean {
  return anyOf.some((group) => getMissingEnvVars(group).length === 0);
}

/**
 * Returns whether a single integration requirement is satisfied given the
 * current process environment.
 *
 * Logic: the integration is configured when EITHER:
 *  - `requiredEnvVars` is empty AND `requiredEnvVarsAnyOf` is not provided, OR
 *  - all vars in `requiredEnvVars` are set, OR
 *  - at least one group in `requiredEnvVarsAnyOf` is fully satisfied.
 *
 * These are alternative paths: if `requiredEnvVarsAnyOf` is provided, any
 * single satisfied group is sufficient even if `requiredEnvVars` is not met.
 */
export function isIntegrationConfigured(req: IntegrationRequirement): boolean {
  if (req.oauthOnly) {
    // Cannot check OAuth tokens via env vars alone; assume not configured
    // unless the caller has a way to detect stored OAuth state.
    return false;
  }
  if (req.requiredEnvVarsAnyOf && req.requiredEnvVarsAnyOf.length > 0) {
    // Integration has multiple acceptable env var sets — any one group is enough
    const plainOk = req.requiredEnvVars.length === 0 || getMissingEnvVars(req.requiredEnvVars).length === 0;
    const anyOfOk = isAnyGroupSatisfied(req.requiredEnvVarsAnyOf);
    return plainOk || anyOfOk;
  }
  return getMissingEnvVars(req.requiredEnvVars).length === 0;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const INTEGRATION_REQUIREMENTS: readonly IntegrationRequirement[] = [
  // -------------------------------------------------------------------------
  // AI MODEL PROVIDERS
  // -------------------------------------------------------------------------
  {
    id: "openai",
    name: "OpenAI",
    category: "ai-provider",
    description: "GPT-4o, o1, o3, voice/Realtime API, DALL-E image generation",
    requiredEnvVars: [],
    requiredEnvVarsAnyOf: [
      ["OPENAI_API_KEY"],
      ["OPENAI_API_KEY_1"],
    ],
    /** OPENAI_API_KEYS enables multi-key round-robin; OPENAI_API_KEY_1 is a numbered alias. */
    optionalEnvVars: ["OPENAI_API_KEYS"],
    setupSteps: [
      "Go to https://platform.openai.com/api-keys",
      "Sign in or create an account",
      'Click "Create new secret key"',
      "Copy the key and set OPENAI_API_KEY=sk-... in your .env",
    ],
    links: ["https://platform.openai.com/api-keys"],
    dependentCommands: ["openclaw onboard", "openclaw agent"],
  },
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    category: "ai-provider",
    description: "Claude 3.5/3.7 (Opus, Sonnet, Haiku), extended thinking",
    requiredEnvVars: [],
    requiredEnvVarsAnyOf: [
      ["ANTHROPIC_API_KEY"],
      ["ANTHROPIC_OAUTH_TOKEN"],
    ],
    /** Multi-key rotation aliases; ANTHROPIC_OAUTH_TOKEN satisfies the requirement via anyOf. */
    optionalEnvVars: ["ANTHROPIC_API_KEY_1", "ANTHROPIC_API_KEYS"],
    oauthSupported: true,
    setupSteps: [
      "Go to https://console.anthropic.com/keys",
      "Sign in or create an account",
      'Click "Create Key"',
      "Copy the key and set ANTHROPIC_API_KEY=sk-ant-... in your .env",
      "Alternatively, run: openclaw onboard (to use OAuth for Claude Max subscribers)",
    ],
    links: ["https://console.anthropic.com/keys"],
    dependentCommands: ["openclaw onboard", "openclaw agent"],
  },
  {
    id: "google-gemini",
    name: "Google Gemini",
    category: "ai-provider",
    description: "Gemini 2.0/2.5 (Flash, Pro), multimodal, Google Search grounding",
    requiredEnvVars: [],
    requiredEnvVarsAnyOf: [
      ["GEMINI_API_KEY"],
      ["GOOGLE_API_KEY"],
    ],
    /** Multi-key rotation aliases; GOOGLE_API_KEY satisfies the requirement via anyOf. */
    optionalEnvVars: ["GEMINI_API_KEY_1", "GEMINI_API_KEYS"],
    setupSteps: [
      "Go to https://aistudio.google.com/apikey",
      'Click "Create API key"',
      "Copy the key and set GEMINI_API_KEY=... in your .env",
    ],
    links: ["https://aistudio.google.com/apikey"],
    dependentCommands: ["openclaw onboard", "openclaw agent"],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    category: "ai-provider",
    description: "100+ models through a single key (GPT, Claude, Gemini, Llama, etc.)",
    requiredEnvVars: ["OPENROUTER_API_KEY"],
    setupSteps: [
      "Go to https://openrouter.ai/keys",
      "Sign in or create an account",
      'Click "Create Key"',
      "Copy the key and set OPENROUTER_API_KEY=sk-or-... in your .env",
    ],
    links: ["https://openrouter.ai/keys"],
    dependentCommands: ["openclaw agent"],
  },
  {
    id: "mistral",
    name: "Mistral AI",
    category: "ai-provider",
    description: "Mistral Large, Small, and Nemo models",
    requiredEnvVars: ["MISTRAL_API_KEY"],
    setupSteps: [
      "Go to https://console.mistral.ai/keys",
      "Sign in or create an account",
      'Click "Create new key"',
      "Copy the key and set MISTRAL_API_KEY=... in your .env",
    ],
    links: ["https://console.mistral.ai/keys"],
    dependentCommands: ["openclaw agent"],
  },
  {
    id: "xai",
    name: "xAI (Grok)",
    category: "ai-provider",
    description: "Grok-3 and Grok-2 models",
    requiredEnvVars: ["XAI_API_KEY"],
    setupSteps: [
      "Go to https://x.ai/api",
      "Sign in and request API access",
      "Copy the key and set XAI_API_KEY=... in your .env",
    ],
    links: ["https://x.ai/api"],
    dependentCommands: ["openclaw agent"],
  },
  {
    id: "groq",
    name: "Groq",
    category: "ai-provider",
    description: "Fast inference (Llama, Mistral, Gemma) via Groq LPU",
    requiredEnvVars: ["GROQ_API_KEY"],
    setupSteps: [
      "Go to https://console.groq.com/keys",
      "Sign in or create an account",
      'Click "Create API Key"',
      "Copy the key and set GROQ_API_KEY=gsk_... in your .env",
    ],
    links: ["https://console.groq.com/keys"],
    dependentCommands: ["openclaw agent"],
  },
  {
    id: "together",
    name: "Together AI",
    category: "ai-provider",
    description: "Open-source models (Llama, Qwen, etc.) hosted on Together",
    requiredEnvVars: ["TOGETHER_API_KEY"],
    setupSteps: [
      "Go to https://api.together.xyz/settings/api-keys",
      "Sign in or create an account",
      'Click "Generate API Key"',
      "Copy the key and set TOGETHER_API_KEY=... in your .env",
    ],
    links: ["https://api.together.xyz/settings/api-keys"],
    dependentCommands: ["openclaw agent"],
  },
  {
    id: "huggingface",
    name: "HuggingFace",
    category: "ai-provider",
    description: "HuggingFace Inference API and gated models",
    requiredEnvVars: [],
    requiredEnvVarsAnyOf: [
      ["HUGGINGFACE_HUB_TOKEN"],
      ["HF_TOKEN"],
    ],
    /** HF_TOKEN satisfies the requirement via anyOf; no additional optional vars. */
    setupSteps: [
      "Go to https://huggingface.co/settings/tokens",
      "Sign in or create an account",
      'Click "New token"',
      "Copy the token and set HUGGINGFACE_HUB_TOKEN=hf_... in your .env",
    ],
    links: ["https://huggingface.co/settings/tokens"],
    dependentCommands: ["openclaw agent"],
  },
  {
    id: "moonshot",
    name: "Moonshot (Kimi)",
    category: "ai-provider",
    description: "Kimi long-context Chinese language models",
    requiredEnvVars: [],
    requiredEnvVarsAnyOf: [
      ["MOONSHOT_API_KEY"],
      ["KIMI_API_KEY"],
    ],
    /** KIMICODE_API_KEY is a separate coding-specific model key; KIMI_API_KEY satisfies requirement via anyOf. */
    optionalEnvVars: ["KIMICODE_API_KEY"],
    setupSteps: [
      "Go to https://platform.moonshot.cn/console/api-keys",
      "Sign in or create an account",
      'Click "Create API Key"',
      "Copy the key and set MOONSHOT_API_KEY=... in your .env",
    ],
    links: ["https://platform.moonshot.cn/console/api-keys"],
    dependentCommands: ["openclaw agent"],
  },
  {
    id: "qianfan",
    name: "Qianfan (Baidu ERNIE)",
    category: "ai-provider",
    description: "Baidu ERNIE language models",
    requiredEnvVars: ["QIANFAN_API_KEY"],
    setupSteps: [
      "Go to https://qianfan.cloud.baidu.com/",
      "Sign in and apply for API access",
      "Copy the key and set QIANFAN_API_KEY=... in your .env",
    ],
    links: ["https://qianfan.cloud.baidu.com/"],
    dependentCommands: ["openclaw agent"],
  },
  {
    id: "minimax",
    name: "MiniMax",
    category: "ai-provider",
    description: "MiniMax text and audio models",
    requiredEnvVars: [],
    requiredEnvVarsAnyOf: [
      ["MINIMAX_API_KEY"],
      ["MINIMAX_OAUTH_TOKEN"],
    ],
    optionalEnvVars: ["MINIMAX_OAUTH_TOKEN"],
    oauthSupported: true,
    setupSteps: [
      "Go to https://www.minimax.chat/",
      "Sign in and navigate to API settings",
      "Copy the key and set MINIMAX_API_KEY=... in your .env",
      "Alternatively run: openclaw onboard (for MiniMax OAuth)",
    ],
    links: ["https://www.minimax.chat/"],
    dependentCommands: ["openclaw agent"],
  },
  {
    id: "venice",
    name: "Venice AI",
    category: "ai-provider",
    description: "Privacy-focused model hosting",
    requiredEnvVars: ["VENICE_API_KEY"],
    setupSteps: [
      "Go to https://venice.ai/",
      "Sign in and navigate to API settings",
      "Copy the key and set VENICE_API_KEY=... in your .env",
    ],
    links: ["https://venice.ai/"],
    dependentCommands: ["openclaw agent"],
  },
  {
    id: "zai",
    name: "ZAI",
    category: "ai-provider",
    description: "ZAI aggregate model provider",
    requiredEnvVars: [],
    requiredEnvVarsAnyOf: [
      ["ZAI_API_KEY"],
      ["Z_AI_API_KEY"],
    ],
    /** Z_AI_API_KEY satisfies the requirement via anyOf; no additional optional vars. */
    setupSteps: [
      "Go to https://zai.ai/",
      "Sign in and obtain an API key",
      "Set ZAI_API_KEY=... in your .env",
    ],
    links: ["https://zai.ai/"],
    dependentCommands: ["openclaw agent"],
  },
  {
    id: "kilocode",
    name: "KiloCode",
    category: "ai-provider",
    description: "KiloCode coding-optimised models",
    requiredEnvVars: ["KILOCODE_API_KEY"],
    setupSteps: [
      "Go to https://kilocode.ai/",
      "Sign in and obtain an API key",
      "Set KILOCODE_API_KEY=... in your .env",
    ],
    links: ["https://kilocode.ai/"],
    dependentCommands: ["openclaw agent"],
  },
  {
    id: "volcengine",
    name: "BytePlus / Volcengine",
    category: "ai-provider",
    description: "ByteDance Volcengine AI models",
    requiredEnvVars: [],
    requiredEnvVarsAnyOf: [
      ["VOLCANO_ENGINE_API_KEY"],
      ["BYTEPLUS_API_KEY"],
    ],
    /** BYTEPLUS_API_KEY satisfies the requirement via anyOf. No additional optional vars. */
    setupSteps: [
      "Go to https://www.byteplus.com/",
      "Sign in and obtain an API key",
      "Set VOLCANO_ENGINE_API_KEY=... in your .env",
    ],
    links: ["https://www.byteplus.com/"],
    dependentCommands: ["openclaw agent"],
  },
  {
    id: "litellm",
    name: "LiteLLM",
    category: "ai-provider",
    description: "Any model behind a self-hosted LiteLLM proxy",
    requiredEnvVars: ["LITELLM_API_KEY"],
    setupSteps: [
      "Set up a LiteLLM proxy — see https://docs.litellm.ai/",
      "Obtain an API key from your LiteLLM instance",
      "Set LITELLM_API_KEY=... in your .env",
    ],
    links: ["https://docs.litellm.ai/"],
    dependentCommands: ["openclaw agent"],
  },
  {
    id: "cloudflare-ai-gateway",
    name: "Cloudflare AI Gateway",
    category: "ai-provider",
    description: "Routes AI requests through Cloudflare (caching, logging, rate limiting)",
    requiredEnvVars: ["CLOUDFLARE_AI_GATEWAY_API_KEY"],
    setupSteps: [
      "Go to https://dash.cloudflare.com → Workers AI → AI Gateway",
      "Create an AI Gateway and copy the API key",
      "Set CLOUDFLARE_AI_GATEWAY_API_KEY=... in your .env",
    ],
    links: ["https://dash.cloudflare.com/"],
    dependentCommands: ["openclaw agent"],
  },
  {
    id: "vercel-ai-gateway",
    name: "Vercel AI Gateway",
    category: "ai-provider",
    description: "Multi-model routing via Vercel's AI SDK gateway",
    requiredEnvVars: ["AI_GATEWAY_API_KEY"],
    setupSteps: [
      "Go to https://vercel.com/docs/ai",
      "Enable the AI Gateway and copy the API key",
      "Set AI_GATEWAY_API_KEY=... in your .env",
    ],
    links: ["https://vercel.com/docs/ai"],
    dependentCommands: ["openclaw agent"],
  },
  {
    id: "opencode",
    name: "OpenCode",
    category: "ai-provider",
    description: "OpenCode AI models",
    requiredEnvVars: [],
    requiredEnvVarsAnyOf: [
      ["OPENCODE_API_KEY"],
      ["OPENCODE_ZEN_API_KEY"],
    ],
    /** OPENCODE_ZEN_API_KEY satisfies the requirement via anyOf. No additional optional vars. */
    setupSteps: [
      "Go to https://opencode.ai/",
      "Sign in and obtain an API key",
      "Set OPENCODE_API_KEY=... in your .env",
    ],
    links: ["https://opencode.ai/"],
    dependentCommands: ["openclaw agent"],
  },
  {
    id: "chutes",
    name: "Chutes.ai",
    category: "ai-provider",
    description: "Chutes decentralised AI models (OAuth-based)",
    requiredEnvVars: [],
    requiredEnvVarsAnyOf: [
      ["CHUTES_CLIENT_ID"],
    ],
    /** CHUTES_CLIENT_SECRET augments the OAuth flow; CHUTES_CLIENT_ID satisfies requirement via anyOf. */
    optionalEnvVars: ["CHUTES_CLIENT_SECRET"],
    oauthSupported: true,
    setupSteps: [
      "Go to https://chutes.ai/",
      "Sign in and note your client ID",
      "Run: openclaw onboard (to complete the OAuth flow)",
      "Or set CHUTES_CLIENT_ID=... in your .env",
    ],
    links: ["https://chutes.ai/"],
    dependentCommands: ["openclaw onboard", "openclaw agent"],
  },
  {
    id: "github-copilot",
    name: "GitHub Copilot",
    category: "ai-provider",
    description: "GitHub Copilot models (requires active Copilot subscription)",
    requiredEnvVars: [],
    oauthOnly: true,
    oauthSupported: true,
    setupSteps: [
      "Ensure you have an active GitHub Copilot subscription",
      "Run: openclaw onboard",
      'Select "GitHub Copilot" as your provider',
      "Complete the OAuth browser flow",
    ],
    links: [
      "https://github.com/settings/copilot",
      "https://github.com/features/copilot",
    ],
    dependentCommands: ["openclaw onboard", "openclaw agent"],
  },
  {
    id: "ollama",
    name: "Ollama (local)",
    category: "ai-provider",
    description: "Local LLM models — fully offline, no credentials required",
    requiredEnvVars: [],
    setupSteps: [
      "Install Ollama from https://ollama.ai",
      "Run: ollama pull llama3.3 (or any supported model)",
      "Start Ollama: ollama serve",
      "Configure openclaw: openclaw config set providers.ollama.enabled true",
    ],
    links: ["https://ollama.ai"],
    dependentCommands: ["openclaw agent"],
  },

  // -------------------------------------------------------------------------
  // MESSAGING CHANNELS
  // -------------------------------------------------------------------------
  {
    id: "telegram",
    name: "Telegram",
    category: "channel",
    description: "Telegram bot (DMs, groups, inline queries)",
    requiredEnvVars: ["TELEGRAM_BOT_TOKEN"],
    setupSteps: [
      "Open Telegram and message @BotFather",
      "Send /newbot and follow the prompts",
      "Copy the token and set TELEGRAM_BOT_TOKEN=123456:ABCDEF... in your .env",
      "Or run: openclaw channels login telegram",
    ],
    links: ["https://t.me/BotFather", "https://docs.openclaw.ai/channels/telegram"],
    dependentCommands: ["openclaw channels login telegram"],
  },
  {
    id: "discord",
    name: "Discord",
    category: "channel",
    description: "Discord bot (DMs, guilds, threads, slash commands, voice)",
    requiredEnvVars: ["DISCORD_BOT_TOKEN"],
    setupSteps: [
      "Go to https://discord.com/developers/applications",
      'Click "New Application", then navigate to "Bot"',
      'Click "Reset Token" and copy the token',
      'Enable "Message Content Intent" under Privileged Gateway Intents',
      "Set DISCORD_BOT_TOKEN=... in your .env",
      "Or run: openclaw channels login discord",
    ],
    links: [
      "https://discord.com/developers/applications",
      "https://docs.openclaw.ai/channels/discord",
    ],
    dependentCommands: ["openclaw channels login discord"],
  },
  {
    id: "slack",
    name: "Slack",
    category: "channel",
    description: "Slack bot (DMs, channels, slash commands, Socket Mode streaming)",
    requiredEnvVars: ["SLACK_BOT_TOKEN", "SLACK_APP_TOKEN"],
    setupSteps: [
      "Go to https://api.slack.com/apps and create a new app",
      "Add required scopes: app_mentions:read, channels:history, chat:write, im:history, im:read, im:write, mpim:history",
      "Install the app to your workspace and copy the Bot User OAuth Token",
      "Enable Socket Mode and create an App-Level Token with connections:write scope",
      "Set SLACK_BOT_TOKEN=xoxb-... and SLACK_APP_TOKEN=xapp-... in your .env",
    ],
    links: ["https://api.slack.com/apps", "https://docs.openclaw.ai/channels/slack"],
    dependentCommands: ["openclaw channels login slack"],
  },
  {
    id: "mattermost",
    name: "Mattermost",
    category: "channel",
    description: "Mattermost DMs and channels (self-hosted)",
    requiredEnvVars: ["MATTERMOST_BOT_TOKEN", "MATTERMOST_URL"],
    setupSteps: [
      "In your Mattermost instance, go to System Console → Integrations → Bot Accounts",
      "Create a bot account and copy the access token",
      "Set MATTERMOST_BOT_TOKEN=... and MATTERMOST_URL=https://chat.example.com in your .env",
    ],
    links: ["https://docs.mattermost.com/developer/bot-accounts.html", "https://docs.openclaw.ai/channels/mattermost"],
    dependentCommands: ["openclaw channels login mattermost"],
  },
  {
    id: "line",
    name: "Line",
    category: "channel",
    description: "Line DMs and group chats",
    requiredEnvVars: ["LINE_CHANNEL_ACCESS_TOKEN", "LINE_CHANNEL_SECRET"],
    setupSteps: [
      "Go to https://developers.line.biz/en/",
      "Create a Messaging API channel",
      "Copy the Channel Access Token and Channel Secret",
      "Set LINE_CHANNEL_ACCESS_TOKEN=... and LINE_CHANNEL_SECRET=... in your .env",
    ],
    links: ["https://developers.line.biz/en/", "https://docs.openclaw.ai/channels/line"],
    dependentCommands: ["openclaw channels login line"],
  },
  {
    id: "zalo",
    name: "Zalo",
    category: "channel",
    description: "Zalo Official Account messaging",
    requiredEnvVars: ["ZALO_BOT_TOKEN"],
    setupSteps: [
      "Go to https://developers.zalo.me/",
      "Create an Official Account and obtain a bot token",
      "Set ZALO_BOT_TOKEN=... in your .env",
    ],
    links: ["https://developers.zalo.me/", "https://docs.openclaw.ai/channels/zalo"],
    dependentCommands: ["openclaw channels login zalo"],
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    category: "channel",
    description: "WhatsApp DMs and groups (via WhatsApp Web protocol)",
    requiredEnvVars: [],
    oauthOnly: true,
    oauthSupported: true,
    setupSteps: [
      "Run: openclaw channels login whatsapp",
      "Scan the QR code with your WhatsApp mobile app",
      "The session is stored in ~/.openclaw/sessions/",
    ],
    links: ["https://docs.openclaw.ai/channels/whatsapp"],
    dependentCommands: ["openclaw channels login whatsapp"],
  },
  {
    id: "signal",
    name: "Signal",
    category: "channel",
    description: "Encrypted Signal DMs and groups",
    requiredEnvVars: [],
    oauthOnly: true,
    oauthSupported: true,
    setupSteps: [
      "Run: openclaw channels login signal",
      "Follow the interactive prompts to link your Signal account",
    ],
    links: ["https://docs.openclaw.ai/channels/signal"],
    dependentCommands: ["openclaw channels login signal"],
  },
  {
    id: "matrix",
    name: "Matrix",
    category: "channel",
    description: "Decentralised Matrix chat (Element, FluffyChat, etc.)",
    requiredEnvVars: [],
    setupSteps: [
      "Create a bot account on matrix.org or your own Synapse instance",
      "Obtain an access token (log in via Element → Settings → Help & About → Access Token)",
      "Configure in openclaw.json: channels.matrix.homeserver, userId, accessToken",
    ],
    links: ["https://matrix.org", "https://docs.openclaw.ai/channels/matrix"],
    dependentCommands: ["openclaw channels login matrix"],
  },
  {
    id: "msteams",
    name: "Microsoft Teams",
    category: "channel",
    description: "Enterprise Teams DMs and channels",
    requiredEnvVars: [],
    setupSteps: [
      "Go to https://portal.azure.com → Azure Active Directory → App Registrations",
      "Register a new app and note the Application (client) ID and Directory (tenant) ID",
      "Create a client secret under Certificates & secrets",
      "Create an Azure Bot Service and connect it to the Teams channel",
      "Configure in openclaw.json: channels.msteams.accounts[].appId, appPassword, tenantId",
    ],
    links: ["https://portal.azure.com", "https://docs.openclaw.ai/channels/msteams"],
    dependentCommands: ["openclaw channels login msteams"],
  },
  {
    id: "googlechat",
    name: "Google Chat",
    category: "channel",
    description: "Google Chat DMs and spaces (Google Workspace)",
    requiredEnvVars: [],
    setupSteps: [
      "Go to https://console.cloud.google.com → IAM & Admin → Service Accounts",
      "Create a service account, download the JSON key",
      "Enable the Chat API and configure the bot in Google Workspace",
      "Configure in openclaw.json: channels.googlechat.serviceAccountJson",
    ],
    links: [
      "https://console.cloud.google.com",
      "https://docs.openclaw.ai/channels/googlechat",
    ],
    dependentCommands: ["openclaw channels login googlechat"],
  },
  {
    id: "feishu",
    name: "Feishu / Lark",
    category: "channel",
    description: "ByteDance Feishu/Lark enterprise messaging",
    requiredEnvVars: [],
    setupSteps: [
      "Go to https://open.feishu.cn/app",
      "Create a new app and note the App ID and App Secret",
      "Configure in openclaw.json: channels.feishu.appId, appSecret",
    ],
    links: ["https://open.feishu.cn/app", "https://docs.openclaw.ai/channels/feishu"],
    dependentCommands: ["openclaw channels login feishu"],
  },
  {
    id: "twitch",
    name: "Twitch",
    category: "channel",
    description: "Twitch chat read and write",
    requiredEnvVars: ["OPENCLAW_TWITCH_ACCESS_TOKEN"],
    setupSteps: [
      "Go to https://twitchtokengenerator.com to generate an OAuth token",
      "Or create an app at https://dev.twitch.tv/console and complete the OAuth flow",
      "Set OPENCLAW_TWITCH_ACCESS_TOKEN=oauth:... in your .env",
    ],
    links: [
      "https://twitchtokengenerator.com",
      "https://dev.twitch.tv/console",
      "https://docs.openclaw.ai/channels/twitch",
    ],
    dependentCommands: ["openclaw channels login twitch"],
  },
  {
    id: "irc",
    name: "IRC",
    category: "channel",
    description: "IRC channel and private message support",
    requiredEnvVars: [],
    setupSteps: [
      "Configure in openclaw.json: channels.irc.hostname, port, nick",
      "Optional: set password for NickServ authentication",
      "Most networks (e.g. Libera.Chat) do not require registration",
    ],
    links: ["https://libera.chat", "https://docs.openclaw.ai/channels/irc"],
    dependentCommands: ["openclaw channels login irc"],
  },
  {
    id: "nostr",
    name: "Nostr",
    category: "channel",
    description: "Decentralised Nostr protocol messaging",
    requiredEnvVars: [],
    setupSteps: [
      "Generate a keypair with any Nostr client or: node -e \"require('nostr-tools').generateSecretKey()\"",
      "Configure in openclaw.json: channels.nostr.privateKey, relays",
    ],
    links: ["https://nostr.com", "https://docs.openclaw.ai/channels/nostr"],
    dependentCommands: ["openclaw channels login nostr"],
  },

  // -------------------------------------------------------------------------
  // TOOLS
  // -------------------------------------------------------------------------
  {
    id: "brave-search",
    name: "Brave Search",
    category: "tool",
    description: "web_search tool — real-time web search via Brave API",
    requiredEnvVars: ["BRAVE_API_KEY"],
    setupSteps: [
      "Go to https://brave.com/search/api/",
      "Sign up for a Brave Search API plan (free tier available)",
      "Copy the API key and set BRAVE_API_KEY=... in your .env",
    ],
    links: ["https://brave.com/search/api/"],
    dependentCommands: ["openclaw agent (web_search tool)"],
  },
  {
    id: "perplexity",
    name: "Perplexity",
    category: "tool",
    description: "web_search tool — alternative real-time web search",
    requiredEnvVars: ["PERPLEXITY_API_KEY"],
    setupSteps: [
      "Go to https://www.perplexity.ai/settings/api",
      "Create an account and subscribe to API access",
      "Copy the key and set PERPLEXITY_API_KEY=pplx-... in your .env",
    ],
    links: ["https://www.perplexity.ai/settings/api"],
    dependentCommands: ["openclaw agent (web_search tool)"],
  },
  {
    id: "firecrawl",
    name: "FireCrawl",
    category: "tool",
    description: "fetch_page tool — advanced web scraping with clean Markdown output",
    requiredEnvVars: ["FIRECRAWL_API_KEY"],
    setupSteps: [
      "Go to https://firecrawl.dev",
      "Sign up and obtain an API key",
      "Copy the key and set FIRECRAWL_API_KEY=fc-... in your .env",
    ],
    links: ["https://firecrawl.dev"],
    dependentCommands: ["openclaw agent (fetch_page tool)"],
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs (TTS)",
    category: "tool",
    description: "Voice synthesis — high-quality text-to-speech",
    requiredEnvVars: [],
    requiredEnvVarsAnyOf: [
      ["ELEVENLABS_API_KEY"],
      ["XI_API_KEY"],
    ],
    /** XI_API_KEY is an alias; it satisfies the requirement via anyOf. No additional optional vars. */
    setupSteps: [
      "Go to https://elevenlabs.io → Profile → API Keys",
      "Copy the key and set ELEVENLABS_API_KEY=... in your .env",
    ],
    links: ["https://elevenlabs.io/api"],
    dependentCommands: ["openclaw agent (tts tool)"],
  },
  {
    id: "deepgram",
    name: "Deepgram (STT)",
    category: "tool",
    description: "Speech-to-text — audio transcription and live STT for voice channels",
    requiredEnvVars: ["DEEPGRAM_API_KEY"],
    setupSteps: [
      "Go to https://console.deepgram.com",
      "Sign in and create an API key",
      "Copy the key and set DEEPGRAM_API_KEY=... in your .env",
    ],
    links: ["https://console.deepgram.com"],
    dependentCommands: ["openclaw agent (stt tool)", "voice channels"],
  },

  // -------------------------------------------------------------------------
  // VOICE CALLING (extensions/voice-call)
  // -------------------------------------------------------------------------
  {
    id: "twilio-voice",
    name: "Twilio (voice calls)",
    category: "voice",
    description: "Inbound and outbound voice calls to any phone number",
    requiredEnvVars: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"],
    setupSteps: [
      "Go to https://www.twilio.com/console",
      "Sign up and note your Account SID and Auth Token",
      "Buy a phone number in the Twilio console",
      "Set TWILIO_ACCOUNT_SID=ACxxxxxx... and TWILIO_AUTH_TOKEN=... in your .env",
      "Configure in openclaw.json: plugins.entries.voice-call.config.twilio",
    ],
    links: ["https://www.twilio.com/console"],
    dependentCommands: ["openclaw plugins enable voice-call"],
  },
  {
    id: "telnyx-voice",
    name: "Telnyx (voice calls)",
    category: "voice",
    description: "Voice calls via Telnyx Call Control (alternative to Twilio)",
    requiredEnvVars: ["TELNYX_API_KEY", "TELNYX_CONNECTION_ID"],
    optionalEnvVars: ["TELNYX_PUBLIC_KEY"],
    setupSteps: [
      "Go to https://portal.telnyx.com/#/app/api-keys",
      "Create an API key",
      "Create a Call Control application and note the Connection ID",
      "Set TELNYX_API_KEY=... and TELNYX_CONNECTION_ID=... in your .env",
    ],
    links: ["https://portal.telnyx.com/#/app/api-keys"],
    dependentCommands: ["openclaw plugins enable voice-call"],
  },
  {
    id: "plivo-voice",
    name: "Plivo (voice calls)",
    category: "voice",
    description: "Voice calls via Plivo (alternative to Twilio)",
    requiredEnvVars: ["PLIVO_AUTH_ID", "PLIVO_AUTH_TOKEN"],
    setupSteps: [
      "Go to https://console.plivo.com/dashboard/",
      "Sign in and note your Auth ID and Auth Token",
      "Set PLIVO_AUTH_ID=MAxxxxxx... and PLIVO_AUTH_TOKEN=... in your .env",
    ],
    links: ["https://console.plivo.com/dashboard/"],
    dependentCommands: ["openclaw plugins enable voice-call"],
  },
  {
    id: "ngrok",
    name: "ngrok (webhook tunnel)",
    category: "voice",
    description: "Secure tunnel so telephony providers can reach your local gateway",
    requiredEnvVars: [],
    optionalEnvVars: ["NGROK_AUTHTOKEN", "NGROK_DOMAIN"],
    setupSteps: [
      "Go to https://dashboard.ngrok.com/get-started/your-authtoken",
      "Sign in and copy your auth token",
      "Set NGROK_AUTHTOKEN=... in your .env",
      "Optional: set NGROK_DOMAIN=myapp.ngrok.io for a stable custom domain (paid)",
    ],
    links: ["https://dashboard.ngrok.com/get-started/your-authtoken"],
    dependentCommands: ["openclaw plugins enable voice-call"],
  },

  // -------------------------------------------------------------------------
  // INFRASTRUCTURE
  // -------------------------------------------------------------------------
  {
    id: "gateway-auth",
    name: "Gateway Auth Token",
    category: "infrastructure",
    description: "Bearer-token authentication for the gateway WebSocket/HTTP API",
    requiredEnvVars: [],
    optionalEnvVars: ["OPENCLAW_GATEWAY_TOKEN", "OPENCLAW_GATEWAY_PASSWORD"],
    setupSteps: [
      "Generate a token: openssl rand -hex 32",
      "Set OPENCLAW_GATEWAY_TOKEN=<token> in your .env",
      "All clients must pass this token as a Bearer token",
    ],
    links: ["https://docs.openclaw.ai/gateway/auth"],
    dependentCommands: ["openclaw gateway run"],
  },
] as const;

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/** Find a single requirement by id. */
export function findRequirement(id: string): IntegrationRequirement | undefined {
  return INTEGRATION_REQUIREMENTS.find((r) => r.id === id);
}

/** Return all requirements in a given category. */
export function getByCategory(category: IntegrationCategory): readonly IntegrationRequirement[] {
  return INTEGRATION_REQUIREMENTS.filter((r) => r.category === category);
}

/**
 * Build a setup status object suitable for the GET /api/setup/status response.
 * Does NOT expose secret values — only whether each env var is set.
 */
export function buildSetupStatus(): {
  integrations: Record<
    string,
    {
      name: string;
      category: IntegrationCategory;
      configured: boolean;
      missing: string[];
      oauthOnly: boolean;
    }
  >;
} {
  const integrations: ReturnType<typeof buildSetupStatus>["integrations"] = {};

  for (const req of INTEGRATION_REQUIREMENTS) {
    const missing = getMissingEnvVars(req.requiredEnvVars as string[]);
    const configured = isIntegrationConfigured(req);
    integrations[req.id] = {
      name: req.name,
      category: req.category,
      configured,
      missing,
      oauthOnly: req.oauthOnly === true,
    };
  }

  return { integrations };
}
