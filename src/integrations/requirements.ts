/**
 * Centralized integration requirements registry.
 *
 * Each entry describes what env vars, credentials, or external setup a feature
 * needs before it can operate.  This is the single source of truth used by:
 *   - `openclaw doctor` health checks
 *   - CLI guards that explain what is missing before attempting a call
 *   - REQUIRED_KEYS_AND_LOGINS.txt (generated from this file)
 *
 * Server-only: never import this module from browser / client bundles.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IntegrationCategory =
  | "model-provider"
  | "channel"
  | "tool"
  | "voice"
  | "gateway"
  | "oauth";

export type EnvVarSpec = {
  /** Environment variable name. */
  name: string;
  /** Human-readable description. */
  description: string;
  /** true = at least one of the `alternatives` group must be set. */
  optional?: boolean;
  /** Alternative env var names that satisfy the same requirement. */
  alternatives?: string[];
};

export type IntegrationRequirement = {
  /** Stable machine-readable identifier. */
  id: string;
  /** Display name. */
  name: string;
  /** What the integration unlocks. */
  description: string;
  /** Broad category. */
  category: IntegrationCategory;
  /** Required env vars – ALL must be present unless marked optional. */
  requiredEnvVars: EnvVarSpec[];
  /**
   * Optional env vars that expand capabilities but are not strictly required.
   * Not listed in missing-var checks.
   */
  optionalEnvVars?: EnvVarSpec[];
  /**
   * Whether a browser-based OAuth / login flow is needed instead of (or in
   * addition to) raw env vars.
   */
  requiresOAuth?: boolean;
  /** Step-by-step "where to get it" instructions (human-readable). */
  setupSteps: string[];
  /** Official documentation / dashboard links. */
  links: string[];
  /**
   * CLI commands / config paths that depend on this integration being
   * configured.
   */
  dependentRoutes?: string[];
  /** Notes on server-only handling (never expose to client). */
  serverOnlyNotes?: string;
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const INTEGRATION_REQUIREMENTS: IntegrationRequirement[] = [
  // -------------------------------------------------------------------------
  // Gateway auth
  // -------------------------------------------------------------------------
  {
    id: "gateway-auth",
    name: "Gateway Authentication",
    description: "Secures the OpenClaw gateway HTTP server when it is exposed beyond localhost.",
    category: "gateway",
    requiredEnvVars: [
      {
        name: "OPENCLAW_GATEWAY_TOKEN",
        description:
          "Long random token that clients must present to authenticate with the gateway. " +
          "Generate with: openssl rand -hex 32",
        optional: true, // only required for non-loopback bindings
      },
    ],
    setupSteps: [
      "Generate a random token: openssl rand -hex 32",
      "Set OPENCLAW_GATEWAY_TOKEN=<token> in ~/.openclaw/.env or your shell profile.",
      "Alternatively set gateway.auth.token in openclaw.json.",
    ],
    links: ["https://docs.openclaw.ai/gateway/auth"],
    dependentRoutes: ["openclaw gateway run", "openclaw channels status --probe"],
    serverOnlyNotes: "Token is read server-side only; never exposed to channel clients.",
  },

  // -------------------------------------------------------------------------
  // Model providers — at least ONE must be configured
  // -------------------------------------------------------------------------
  {
    id: "openai",
    name: "OpenAI",
    description: "Access GPT-4o, o3, and other OpenAI models.",
    category: "model-provider",
    requiredEnvVars: [
      {
        name: "OPENAI_API_KEY",
        description: "OpenAI secret API key (starts with sk-).",
      },
    ],
    setupSteps: [
      "Sign in at https://platform.openai.com/",
      "Go to API Keys → Create new secret key.",
      "Set OPENAI_API_KEY=sk-... in ~/.openclaw/.env or your shell profile.",
    ],
    links: ["https://platform.openai.com/api-keys"],
    dependentRoutes: ["openclaw agent --model openai/...", "TTS with OpenAI voice"],
    serverOnlyNotes: "Key is loaded server-side; never forwarded to channel messages.",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Access Claude 3.x / Claude 4 models.",
    category: "model-provider",
    requiredEnvVars: [
      {
        name: "ANTHROPIC_API_KEY",
        description: "Anthropic API key (starts with sk-ant-).",
        alternatives: ["ANTHROPIC_OAUTH_TOKEN"],
      },
    ],
    optionalEnvVars: [
      {
        name: "ANTHROPIC_OAUTH_TOKEN",
        description: "OAuth token from Claude.ai browser login (alternative to API key).",
      },
      {
        name: "CLAUDE_AI_SESSION_KEY",
        description: "Session key extracted from Claude.ai web session.",
      },
    ],
    requiresOAuth: true, // Claude.ai web login is an alternative path
    setupSteps: [
      "Option A (API key): sign in at https://console.anthropic.com/",
      "  → Settings → API Keys → Create Key.",
      "  Set ANTHROPIC_API_KEY=sk-ant-... in ~/.openclaw/.env.",
      "Option B (OAuth / Claude.ai): run `openclaw models add anthropic` and follow the prompts.",
    ],
    links: [
      "https://console.anthropic.com/settings/keys",
      "https://docs.openclaw.ai/models/anthropic",
    ],
    dependentRoutes: ["openclaw agent --model anthropic/..."],
    serverOnlyNotes: "API key and OAuth tokens remain server-side.",
  },
  {
    id: "google-gemini",
    name: "Google Gemini",
    description: "Access Gemini 1.5 / 2.x models from Google AI Studio or Vertex AI.",
    category: "model-provider",
    requiredEnvVars: [
      {
        name: "GEMINI_API_KEY",
        description: "Google AI Studio API key.",
        alternatives: ["GOOGLE_API_KEY"],
      },
    ],
    optionalEnvVars: [
      {
        name: "GOOGLE_API_KEY",
        description: "Alternative name accepted by some Google SDKs.",
      },
    ],
    requiresOAuth: true, // Google Gemini CLI auth is an alternative
    setupSteps: [
      "Option A (API key): visit https://aistudio.google.com/app/apikey",
      "  → Create API key → copy the key.",
      "  Set GEMINI_API_KEY=... in ~/.openclaw/.env.",
      "Option B (OAuth): run `openclaw models add google-gemini-cli-auth` and follow the prompts.",
    ],
    links: ["https://aistudio.google.com/app/apikey", "https://docs.openclaw.ai/models/gemini"],
    dependentRoutes: ["openclaw agent --model google/..."],
    serverOnlyNotes: "Key is loaded server-side only.",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "Unified API gateway for 200+ models (GPT, Claude, Gemini, Llama, …).",
    category: "model-provider",
    requiredEnvVars: [
      {
        name: "OPENROUTER_API_KEY",
        description: "OpenRouter API key (starts with sk-or-).",
      },
    ],
    setupSteps: [
      "Sign in at https://openrouter.ai/",
      "Go to Keys → Create key.",
      "Set OPENROUTER_API_KEY=sk-or-... in ~/.openclaw/.env.",
    ],
    links: ["https://openrouter.ai/keys"],
    dependentRoutes: ["openclaw agent --model openrouter/..."],
    serverOnlyNotes: "Key is server-only.",
  },
  {
    id: "xai",
    name: "xAI (Grok)",
    description: "Access Grok models from xAI.",
    category: "model-provider",
    requiredEnvVars: [
      {
        name: "XAI_API_KEY",
        description: "xAI API key.",
      },
    ],
    setupSteps: [
      "Visit https://console.x.ai/ and create an API key.",
      "Set XAI_API_KEY=... in ~/.openclaw/.env.",
    ],
    links: ["https://console.x.ai/"],
    dependentRoutes: ["openclaw agent --model xai/..."],
    serverOnlyNotes: "Key is server-only.",
  },
  {
    id: "github-copilot",
    name: "GitHub Copilot",
    description: "Use GitHub Copilot models (GPT-4o, Claude, etc.) via your Copilot subscription.",
    category: "model-provider",
    requiredEnvVars: [
      {
        name: "COPILOT_GITHUB_TOKEN",
        description: "GitHub personal access token with Copilot scope.",
        alternatives: ["GH_TOKEN", "GITHUB_TOKEN"],
      },
    ],
    requiresOAuth: true,
    setupSteps: [
      "Option A (OAuth): run `openclaw models add copilot-proxy` and sign in via browser.",
      "Option B (PAT): create a GitHub token at https://github.com/settings/tokens",
      "  → include the `copilot` scope.",
      "  Set COPILOT_GITHUB_TOKEN=ghp_... in ~/.openclaw/.env.",
    ],
    links: ["https://github.com/settings/tokens", "https://docs.openclaw.ai/models/github-copilot"],
    dependentRoutes: ["openclaw agent --model copilot/..."],
    serverOnlyNotes: "Token is server-only; OAuth tokens stored in auth-profiles.",
  },
  {
    id: "aws-bedrock",
    name: "AWS Bedrock",
    description: "Access Claude, Llama, Titan, and other models via Amazon Bedrock.",
    category: "model-provider",
    requiredEnvVars: [
      {
        name: "AWS_ACCESS_KEY_ID",
        description: "AWS access key ID.",
      },
      {
        name: "AWS_SECRET_ACCESS_KEY",
        description: "AWS secret access key.",
      },
    ],
    optionalEnvVars: [
      {
        name: "AWS_BEARER_TOKEN_BEDROCK",
        description: "Bearer token for Bedrock (alternative to key pair).",
      },
      {
        name: "AWS_PROFILE",
        description: "AWS named profile from ~/.aws/credentials.",
      },
      {
        name: "AWS_REGION",
        description: "AWS region for Bedrock (e.g. us-east-1).",
      },
    ],
    setupSteps: [
      "Create an AWS IAM user or role with AmazonBedrockFullAccess.",
      "Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in ~/.openclaw/.env,",
      "  or configure a named profile in ~/.aws/credentials and set AWS_PROFILE.",
      "Enable model access in the Bedrock console for your region.",
    ],
    links: [
      "https://console.aws.amazon.com/bedrock/",
      "https://docs.aws.amazon.com/bedrock/latest/userguide/security-iam.html",
    ],
    dependentRoutes: ["openclaw agent --model bedrock/..."],
    serverOnlyNotes: "AWS credentials are loaded server-side via the AWS SDK.",
  },
  {
    id: "mistral",
    name: "Mistral AI",
    description: "Access Mistral 7B, Mixtral, and Mistral Large models.",
    category: "model-provider",
    requiredEnvVars: [
      {
        name: "MISTRAL_API_KEY",
        description: "Mistral API key.",
      },
    ],
    setupSteps: [
      "Sign in at https://console.mistral.ai/",
      "Go to API Keys → Create new key.",
      "Set MISTRAL_API_KEY=... in ~/.openclaw/.env.",
    ],
    links: ["https://console.mistral.ai/api-keys/"],
    dependentRoutes: ["openclaw agent --model mistral/..."],
    serverOnlyNotes: "Key is server-only.",
  },
  {
    id: "together-ai",
    name: "Together AI",
    description: "Access open-source models (Llama, Mistral, Qwen, etc.) via Together AI.",
    category: "model-provider",
    requiredEnvVars: [
      {
        name: "TOGETHER_API_KEY",
        description: "Together AI API key.",
      },
    ],
    setupSteps: [
      "Sign in at https://api.together.xyz/",
      "Go to Settings → API Keys → Create.",
      "Set TOGETHER_API_KEY=... in ~/.openclaw/.env.",
    ],
    links: ["https://api.together.xyz/settings/api-keys"],
    dependentRoutes: ["openclaw agent --model together/..."],
    serverOnlyNotes: "Key is server-only.",
  },
  {
    id: "huggingface",
    name: "Hugging Face Inference",
    description: "Access thousands of open-source models via Hugging Face Inference API.",
    category: "model-provider",
    requiredEnvVars: [
      {
        name: "HUGGINGFACE_HUB_TOKEN",
        description: "Hugging Face access token.",
        alternatives: ["HF_TOKEN"],
      },
    ],
    setupSteps: [
      "Sign in at https://huggingface.co/",
      "Go to Settings → Access Tokens → New token.",
      "Set HUGGINGFACE_HUB_TOKEN=hf_... in ~/.openclaw/.env.",
    ],
    links: ["https://huggingface.co/settings/tokens"],
    dependentRoutes: ["openclaw agent --model huggingface/..."],
    serverOnlyNotes: "Token is server-only.",
  },

  // -------------------------------------------------------------------------
  // Messaging channels
  // -------------------------------------------------------------------------
  {
    id: "telegram",
    name: "Telegram",
    description: "Receive and reply to messages via a Telegram bot.",
    category: "channel",
    requiredEnvVars: [
      {
        name: "TELEGRAM_BOT_TOKEN",
        description: "Bot token from @BotFather (format: 123456:ABCDEF…).",
      },
    ],
    setupSteps: [
      "Open Telegram and message @BotFather.",
      "Send /newbot, follow prompts, copy the token shown.",
      "Set TELEGRAM_BOT_TOKEN=<token> in ~/.openclaw/.env,",
      "  or run `openclaw channels add telegram` and paste the token.",
    ],
    links: [
      "https://core.telegram.org/bots#how-do-i-create-a-bot",
      "https://docs.openclaw.ai/channels/telegram",
    ],
    dependentRoutes: ["openclaw channels add telegram", "openclaw channels status --probe"],
    serverOnlyNotes: "Token is stored in config/env, never forwarded to users.",
  },
  {
    id: "discord",
    name: "Discord",
    description: "Receive and reply to messages via a Discord bot.",
    category: "channel",
    requiredEnvVars: [
      {
        name: "DISCORD_BOT_TOKEN",
        description: "Discord bot token from the Discord Developer Portal.",
      },
    ],
    setupSteps: [
      "Visit https://discord.com/developers/applications → New Application.",
      "Go to Bot → Add Bot → Reset Token, copy the token.",
      "Enable Message Content Intent under Privileged Gateway Intents.",
      "Invite the bot to your server via OAuth2 → URL Generator.",
      "Set DISCORD_BOT_TOKEN=... in ~/.openclaw/.env,",
      "  or run `openclaw channels add discord`.",
    ],
    links: [
      "https://discord.com/developers/applications",
      "https://docs.openclaw.ai/channels/discord",
    ],
    dependentRoutes: ["openclaw channels add discord", "openclaw channels status --probe"],
    serverOnlyNotes: "Token is server-only.",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Receive and reply to messages in Slack workspaces via a Slack app.",
    category: "channel",
    requiredEnvVars: [
      {
        name: "SLACK_BOT_TOKEN",
        description: "Slack bot OAuth token (xoxb-…).",
      },
      {
        name: "SLACK_APP_TOKEN",
        description: "Slack app-level token for Socket Mode (xapp-…).",
      },
    ],
    setupSteps: [
      "Visit https://api.slack.com/apps → Create New App → From scratch.",
      "Under OAuth & Permissions add bot scopes: app_mentions:read, chat:write, …",
      "Install the app to your workspace, copy the Bot User OAuth Token (xoxb-…).",
      "Under App-Level Tokens → Generate Token with connections:write scope (xapp-…).",
      "Set SLACK_BOT_TOKEN and SLACK_APP_TOKEN in ~/.openclaw/.env,",
      "  or run `openclaw channels add slack`.",
    ],
    links: ["https://api.slack.com/apps", "https://docs.openclaw.ai/channels/slack"],
    dependentRoutes: ["openclaw channels add slack", "openclaw channels status --probe"],
    serverOnlyNotes: "Both tokens are server-only.",
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    description: "Connect a WhatsApp number using WhatsApp Web (QR code login).",
    category: "channel",
    requiredEnvVars: [],
    requiresOAuth: true, // QR code login via WhatsApp Web
    setupSteps: [
      "Run `openclaw channels add whatsapp` and scan the QR code with your phone.",
      "Recommend using a dedicated phone / eSIM for the bot number.",
      "Session is stored in ~/.openclaw/sessions/whatsapp/.",
    ],
    links: ["https://docs.openclaw.ai/channels/whatsapp"],
    dependentRoutes: ["openclaw channels add whatsapp"],
    serverOnlyNotes: "Session credentials are stored in state dir, never in config.",
  },
  {
    id: "signal",
    name: "Signal",
    description: "Send and receive Signal messages via signal-cli or a local HTTP API.",
    category: "channel",
    requiredEnvVars: [],
    setupSteps: [
      "Option A (signal-cli): install signal-cli, register a number, then run",
      "  `openclaw channels add signal --signal-number +15550001234 --cli-path /path/to/signal-cli`",
      "Option B (HTTP API): run the signal-cli REST API container, then",
      "  `openclaw channels add signal --http-url http://localhost:8080`",
    ],
    links: ["https://github.com/AsamK/signal-cli", "https://docs.openclaw.ai/channels/signal"],
    dependentRoutes: ["openclaw channels add signal"],
    serverOnlyNotes: "No raw API keys; credentials managed by signal-cli.",
  },
  {
    id: "msteams",
    name: "Microsoft Teams",
    description: "Integrate with Microsoft Teams via the Bot Framework.",
    category: "channel",
    requiredEnvVars: [
      {
        name: "MSTEAMS_APP_ID",
        description: "Azure AD app / Bot Framework app ID.",
      },
      {
        name: "MSTEAMS_APP_PASSWORD",
        description: "Azure AD app client secret.",
      },
      {
        name: "MSTEAMS_TENANT_ID",
        description: "Azure AD tenant ID.",
      },
    ],
    setupSteps: [
      "Register a new Azure Bot at https://portal.azure.com → Azure Bot.",
      "Copy the App ID and create a client secret (App Registration → Certificates & secrets).",
      "Set MSTEAMS_APP_ID, MSTEAMS_APP_PASSWORD, MSTEAMS_TENANT_ID in ~/.openclaw/.env,",
      "  or run `openclaw channels add msteams`.",
    ],
    links: [
      "https://portal.azure.com/",
      "https://learn.microsoft.com/en-us/azure/bot-service/",
      "https://docs.openclaw.ai/channels/msteams",
    ],
    dependentRoutes: ["openclaw channels add msteams"],
    serverOnlyNotes: "App password is server-only; never forwarded to Teams messages.",
  },
  {
    id: "matrix",
    name: "Matrix",
    description: "Connect to any Matrix homeserver (Element, Beeper, etc.).",
    category: "channel",
    requiredEnvVars: [
      {
        name: "MATRIX_HOMESERVER",
        description: "Full URL of your Matrix homeserver (e.g. https://matrix.org).",
      },
      {
        name: "MATRIX_USER_ID",
        description: "Your Matrix user ID (e.g. @botname:matrix.org).",
      },
      {
        name: "MATRIX_ACCESS_TOKEN",
        description: "Matrix access token.",
        alternatives: ["MATRIX_PASSWORD"],
      },
    ],
    optionalEnvVars: [
      {
        name: "MATRIX_PASSWORD",
        description: "Matrix account password (alternative to access token).",
      },
    ],
    setupSteps: [
      "Create a Matrix account (e.g. at https://app.element.io or your own server).",
      "Obtain an access token: Settings → Help & About → Access Token in Element.",
      "Set MATRIX_HOMESERVER, MATRIX_USER_ID, MATRIX_ACCESS_TOKEN in ~/.openclaw/.env,",
      "  or run `openclaw channels add matrix`.",
    ],
    links: ["https://matrix.org/", "https://docs.openclaw.ai/channels/matrix"],
    dependentRoutes: ["openclaw channels add matrix"],
    serverOnlyNotes: "Token/password are server-only.",
  },
  {
    id: "line",
    name: "LINE",
    description: "Send and receive messages via a LINE Official Account bot.",
    category: "channel",
    requiredEnvVars: [
      {
        name: "LINE_CHANNEL_ACCESS_TOKEN",
        description: "LINE channel access token from Messaging API settings.",
      },
    ],
    optionalEnvVars: [
      {
        name: "LINE_CHANNEL_SECRET",
        description: "LINE channel secret (used for webhook signature verification).",
      },
    ],
    setupSteps: [
      "Create a LINE Official Account at https://developers.line.biz/",
      "Go to Messaging API tab → Issue channel access token.",
      "Set LINE_CHANNEL_ACCESS_TOKEN in ~/.openclaw/.env,",
      "  or run `openclaw channels add line`.",
    ],
    links: [
      "https://developers.line.biz/en/docs/messaging-api/",
      "https://docs.openclaw.ai/channels/line",
    ],
    dependentRoutes: ["openclaw channels add line"],
    serverOnlyNotes: "Token is server-only.",
  },
  {
    id: "google-chat",
    name: "Google Chat",
    description: "Send and receive messages in Google Chat spaces via a service account.",
    category: "channel",
    requiredEnvVars: [
      {
        name: "GOOGLE_CHAT_SERVICE_ACCOUNT",
        description: "Inline JSON of a Google service account key (as a single-line string).",
        alternatives: ["GOOGLE_CHAT_SERVICE_ACCOUNT_FILE"],
      },
    ],
    optionalEnvVars: [
      {
        name: "GOOGLE_CHAT_SERVICE_ACCOUNT_FILE",
        description: "Path to a Google service account JSON key file.",
      },
    ],
    setupSteps: [
      "Create a Google Cloud project and enable the Google Chat API.",
      "Create a service account with the Chat API Bot role.",
      "Download the JSON key file, then either:",
      "  a) Set GOOGLE_CHAT_SERVICE_ACCOUNT to the file contents (as JSON string), or",
      "  b) Set GOOGLE_CHAT_SERVICE_ACCOUNT_FILE=/path/to/key.json in ~/.openclaw/.env.",
      "Register the bot in the Google Chat API configuration.",
    ],
    links: [
      "https://console.cloud.google.com/",
      "https://developers.google.com/chat/api/guides/auth/service-accounts",
      "https://docs.openclaw.ai/channels/googlechat",
    ],
    dependentRoutes: ["openclaw channels add googlechat"],
    serverOnlyNotes: "Service account key is server-only; never forwarded.",
  },
  {
    id: "mattermost",
    name: "Mattermost",
    description: "Connect to a self-hosted or cloud Mattermost instance.",
    category: "channel",
    requiredEnvVars: [
      {
        name: "MATTERMOST_BOT_TOKEN",
        description: "Mattermost bot account token.",
      },
      {
        name: "MATTERMOST_URL",
        description: "Base URL of your Mattermost instance (e.g. https://chat.example.com).",
      },
    ],
    setupSteps: [
      "In Mattermost: System Console → Integrations → Bot Accounts → Enable → Create Bot.",
      "Copy the bot access token.",
      "Set MATTERMOST_BOT_TOKEN and MATTERMOST_URL in ~/.openclaw/.env.",
    ],
    links: [
      "https://developers.mattermost.com/integrate/reference/bot-accounts/",
      "https://docs.openclaw.ai/channels/mattermost",
    ],
    dependentRoutes: ["openclaw channels add mattermost"],
    serverOnlyNotes: "Token is server-only.",
  },
  {
    id: "twitch",
    name: "Twitch",
    description: "Read and respond to Twitch chat.",
    category: "channel",
    requiredEnvVars: [
      {
        name: "OPENCLAW_TWITCH_ACCESS_TOKEN",
        description: "Twitch OAuth access token (format: oauth:…).",
      },
    ],
    setupSteps: [
      "Register a Twitch application at https://dev.twitch.tv/console/apps.",
      "Obtain an OAuth token using the Authorization Code flow or a tool like twitch-cli.",
      "Set OPENCLAW_TWITCH_ACCESS_TOKEN=oauth:... in ~/.openclaw/.env.",
    ],
    links: [
      "https://dev.twitch.tv/docs/authentication/",
      "https://docs.openclaw.ai/channels/twitch",
    ],
    dependentRoutes: ["openclaw channels add twitch"],
    serverOnlyNotes: "Token is server-only.",
  },
  {
    id: "feishu",
    name: "Feishu / Lark",
    description: "Send and receive messages via Feishu (Lark) enterprise messaging.",
    category: "channel",
    requiredEnvVars: [
      {
        name: "FEISHU_APP_ID",
        description: "Feishu application App ID.",
      },
      {
        name: "FEISHU_APP_SECRET",
        description: "Feishu application App Secret.",
      },
    ],
    setupSteps: [
      "Log in to https://open.feishu.cn/ → Create Application.",
      "Copy App ID and App Secret from the Credentials & Basic Info page.",
      "Set FEISHU_APP_ID and FEISHU_APP_SECRET in ~/.openclaw/.env.",
    ],
    links: ["https://open.feishu.cn/document/", "https://docs.openclaw.ai/channels/feishu"],
    dependentRoutes: ["openclaw channels add feishu"],
    serverOnlyNotes: "Credentials are server-only.",
  },
  {
    id: "zalo",
    name: "Zalo",
    description: "Connect to Zalo Official Account for Vietnamese users.",
    category: "channel",
    requiredEnvVars: [
      {
        name: "ZALO_BOT_TOKEN",
        description: "Zalo Official Account access token.",
      },
    ],
    setupSteps: [
      "Register an Official Account at https://developers.zalo.me/",
      "Create an app and obtain an access token.",
      "Set ZALO_BOT_TOKEN=... in ~/.openclaw/.env.",
    ],
    links: ["https://developers.zalo.me/", "https://docs.openclaw.ai/channels/zalo"],
    dependentRoutes: ["openclaw channels add zalo"],
    serverOnlyNotes: "Token is server-only.",
  },
  {
    id: "irc",
    name: "IRC",
    description: "Connect to any IRC network.",
    category: "channel",
    requiredEnvVars: [
      {
        name: "IRC_HOST",
        description: "IRC server hostname (e.g. irc.libera.chat).",
      },
      {
        name: "IRC_NICK",
        description: "IRC nickname to use.",
      },
    ],
    optionalEnvVars: [
      { name: "IRC_PORT", description: "IRC server port (default: 6697 for TLS, 6667 plain)." },
      { name: "IRC_USERNAME", description: "IRC username / ident." },
      { name: "IRC_REALNAME", description: "IRC real name displayed in WHOIS." },
      { name: "IRC_PASSWORD", description: "IRC server password." },
      { name: "IRC_NICKSERV_PASSWORD", description: "NickServ identification password." },
      {
        name: "IRC_NICKSERV_REGISTER_EMAIL",
        description: "Email for NickServ registration.",
      },
      { name: "IRC_CHANNELS", description: "Comma-separated list of channels to join on startup." },
      { name: "IRC_TLS", description: "Set to '1' or 'true' to enable TLS." },
    ],
    setupSteps: [
      "Register a nick on your IRC network (e.g. /msg NickServ REGISTER …).",
      "Set IRC_HOST and IRC_NICK in ~/.openclaw/.env.",
      "Optionally set IRC_PASSWORD or IRC_NICKSERV_PASSWORD for authenticated nicks.",
    ],
    links: ["https://docs.openclaw.ai/channels/irc"],
    dependentRoutes: ["openclaw channels add irc"],
    serverOnlyNotes: "Passwords are server-only.",
  },
  {
    id: "synology-chat",
    name: "Synology Chat",
    description: "Connect to a Synology Chat instance.",
    category: "channel",
    requiredEnvVars: [
      {
        name: "SYNOLOGY_CHAT_TOKEN",
        description: "Synology Chat incoming bot token.",
      },
      {
        name: "SYNOLOGY_CHAT_INCOMING_URL",
        description: "Synology Chat incoming webhook URL.",
      },
      {
        name: "SYNOLOGY_NAS_HOST",
        description: "Hostname/IP of your Synology NAS.",
      },
    ],
    optionalEnvVars: [
      {
        name: "SYNOLOGY_ALLOWED_USER_IDS",
        description: "Comma-separated user IDs allowed to interact.",
      },
    ],
    setupSteps: [
      "In Synology Chat: Integration → Incoming Webhooks → Create.",
      "Copy the token and webhook URL.",
      "Set SYNOLOGY_CHAT_TOKEN, SYNOLOGY_CHAT_INCOMING_URL, SYNOLOGY_NAS_HOST in ~/.openclaw/.env.",
    ],
    links: [
      "https://kb.synology.com/en-us/DSM/help/Chat/chat_integration",
      "https://docs.openclaw.ai/channels/synology-chat",
    ],
    dependentRoutes: ["openclaw channels add synology-chat"],
    serverOnlyNotes: "Token and URL are server-only.",
  },
  {
    id: "nextcloud-talk",
    name: "Nextcloud Talk",
    description: "Connect to a Nextcloud Talk instance.",
    category: "channel",
    requiredEnvVars: [
      {
        name: "NEXTCLOUD_TALK_BOT_SECRET",
        description: "Nextcloud Talk bot secret.",
      },
    ],
    setupSteps: [
      "In your Nextcloud instance: Admin → Talk → Bots → Register bot.",
      "Copy the bot secret.",
      "Set NEXTCLOUD_TALK_BOT_SECRET=... in ~/.openclaw/.env.",
    ],
    links: [
      "https://nextcloud-talk.readthedocs.io/en/latest/bots/",
      "https://docs.openclaw.ai/channels/nextcloud-talk",
    ],
    dependentRoutes: ["openclaw channels add nextcloud-talk"],
    serverOnlyNotes: "Secret is server-only.",
  },

  // -------------------------------------------------------------------------
  // Tools
  // -------------------------------------------------------------------------
  {
    id: "brave-search",
    name: "Brave Search",
    description: "Web search using the Brave Search API.",
    category: "tool",
    requiredEnvVars: [
      {
        name: "BRAVE_API_KEY",
        description: "Brave Search API key.",
      },
    ],
    setupSteps: [
      "Sign up at https://api.search.brave.com/",
      "Create a subscription plan (free tier available).",
      "Copy your API key.",
      "Set BRAVE_API_KEY=... in ~/.openclaw/.env,",
      "  or set tools.web.search.brave.apiKey in openclaw.json.",
    ],
    links: ["https://api.search.brave.com/"],
    dependentRoutes: [
      "web_search tool (provider: brave)",
      "openclaw config set tools.web.search.provider brave",
    ],
    serverOnlyNotes: "Key is server-only.",
  },
  {
    id: "perplexity-search",
    name: "Perplexity Search",
    description: "AI-powered web search via Perplexity.",
    category: "tool",
    requiredEnvVars: [
      {
        name: "PERPLEXITY_API_KEY",
        description: "Perplexity API key (starts with pplx-).",
        alternatives: ["OPENROUTER_API_KEY"],
      },
    ],
    setupSteps: [
      "Sign in at https://www.perplexity.ai/settings/api",
      "Generate an API key.",
      "Set PERPLEXITY_API_KEY=pplx-... in ~/.openclaw/.env.",
      "  (Alternatively, use OPENROUTER_API_KEY with the perplexity/* models.)",
    ],
    links: ["https://www.perplexity.ai/settings/api"],
    dependentRoutes: ["web_search tool (provider: perplexity)"],
    serverOnlyNotes: "Key is server-only.",
  },
  {
    id: "firecrawl",
    name: "Firecrawl",
    description: "Structured web scraping and crawling for agent tools.",
    category: "tool",
    requiredEnvVars: [
      {
        name: "FIRECRAWL_API_KEY",
        description: "Firecrawl API key.",
      },
    ],
    setupSteps: [
      "Sign up at https://www.firecrawl.dev/",
      "Go to Dashboard → API Keys → Create.",
      "Set FIRECRAWL_API_KEY=... in ~/.openclaw/.env,",
      "  or set tools.web.fetch.firecrawl.apiKey in openclaw.json.",
    ],
    links: ["https://www.firecrawl.dev/"],
    dependentRoutes: ["web_fetch tool (mode: firecrawl)"],
    serverOnlyNotes: "Key is server-only.",
  },

  // -------------------------------------------------------------------------
  // Voice / media
  // -------------------------------------------------------------------------
  {
    id: "elevenlabs-tts",
    name: "ElevenLabs TTS",
    description: "High-quality text-to-speech using ElevenLabs.",
    category: "voice",
    requiredEnvVars: [
      {
        name: "ELEVENLABS_API_KEY",
        description: "ElevenLabs API key.",
        alternatives: ["XI_API_KEY"],
      },
    ],
    optionalEnvVars: [
      {
        name: "XI_API_KEY",
        description: "Legacy alias for ELEVENLABS_API_KEY.",
      },
    ],
    setupSteps: [
      "Sign up at https://elevenlabs.io/",
      "Go to Profile → API Keys → Create.",
      "Set ELEVENLABS_API_KEY=... in ~/.openclaw/.env,",
      "  or configure tts.elevenlabs.apiKey in openclaw.json.",
    ],
    links: ["https://elevenlabs.io/", "https://docs.openclaw.ai/voice"],
    dependentRoutes: ["tts (provider: elevenlabs)"],
    serverOnlyNotes: "Key is server-only.",
  },
  {
    id: "deepgram-stt",
    name: "Deepgram STT",
    description: "Speech-to-text transcription using Deepgram.",
    category: "voice",
    requiredEnvVars: [
      {
        name: "DEEPGRAM_API_KEY",
        description: "Deepgram API key.",
      },
    ],
    setupSteps: [
      "Sign up at https://deepgram.com/",
      "Go to API Keys → Create a new API key.",
      "Set DEEPGRAM_API_KEY=... in ~/.openclaw/.env.",
    ],
    links: ["https://deepgram.com/", "https://docs.openclaw.ai/voice"],
    dependentRoutes: ["voice-call extension (stt provider: deepgram)"],
    serverOnlyNotes: "Key is server-only.",
  },
  {
    id: "voice-call-twilio",
    name: "Twilio Voice Calls",
    description: "Inbound/outbound PSTN phone calls via Twilio.",
    category: "voice",
    requiredEnvVars: [
      {
        name: "TWILIO_ACCOUNT_SID",
        description: "Twilio Account SID.",
      },
      {
        name: "TWILIO_AUTH_TOKEN",
        description: "Twilio Auth Token.",
      },
    ],
    optionalEnvVars: [
      { name: "NGROK_AUTHTOKEN", description: "ngrok auth token for local webhook tunneling." },
      { name: "NGROK_DOMAIN", description: "Custom ngrok domain." },
    ],
    setupSteps: [
      "Create a Twilio account at https://www.twilio.com/",
      "From the Console Dashboard copy Account SID and Auth Token.",
      "Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in ~/.openclaw/.env.",
      "Optionally set NGROK_AUTHTOKEN for local development tunneling.",
    ],
    links: ["https://www.twilio.com/console", "https://docs.openclaw.ai/voice"],
    dependentRoutes: ["voice-call extension (provider: twilio)"],
    serverOnlyNotes: "Auth token is server-only.",
  },
  {
    id: "voice-call-telnyx",
    name: "Telnyx Voice Calls",
    description: "Inbound/outbound PSTN phone calls via Telnyx.",
    category: "voice",
    requiredEnvVars: [
      {
        name: "TELNYX_API_KEY",
        description: "Telnyx V2 API key.",
      },
      {
        name: "TELNYX_CONNECTION_ID",
        description: "Telnyx Call Control Application connection ID.",
      },
    ],
    optionalEnvVars: [
      {
        name: "TELNYX_PUBLIC_KEY",
        description: "Telnyx webhook signature verification public key.",
      },
    ],
    setupSteps: [
      "Create a Telnyx account at https://telnyx.com/",
      "Go to API Keys → Create a new V2 key.",
      "Create a Call Control Application and copy the Connection ID.",
      "Set TELNYX_API_KEY and TELNYX_CONNECTION_ID in ~/.openclaw/.env.",
    ],
    links: ["https://portal.telnyx.com/#/app/api-keys", "https://docs.openclaw.ai/voice"],
    dependentRoutes: ["voice-call extension (provider: telnyx)"],
    serverOnlyNotes: "API key is server-only.",
  },
  {
    id: "voice-call-plivo",
    name: "Plivo Voice Calls",
    description: "Inbound/outbound PSTN phone calls via Plivo.",
    category: "voice",
    requiredEnvVars: [
      {
        name: "PLIVO_AUTH_ID",
        description: "Plivo Auth ID.",
      },
      {
        name: "PLIVO_AUTH_TOKEN",
        description: "Plivo Auth Token.",
      },
    ],
    setupSteps: [
      "Create a Plivo account at https://www.plivo.com/",
      "From the Dashboard copy Auth ID and Auth Token.",
      "Set PLIVO_AUTH_ID and PLIVO_AUTH_TOKEN in ~/.openclaw/.env.",
    ],
    links: ["https://console.plivo.com/dashboard/", "https://docs.openclaw.ai/voice"],
    dependentRoutes: ["voice-call extension (provider: plivo)"],
    serverOnlyNotes: "Auth token is server-only.",
  },
];

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

/**
 * Returns env var names from the registry that are currently unset (or empty).
 *
 * Only checks the *required* vars for the given integration (not optional).
 * A var is satisfied if at least one var in its `alternatives` list is also set.
 */
export function getMissingEnvVars(integrationId: string): string[] {
  const entry = INTEGRATION_REQUIREMENTS.find((r) => r.id === integrationId);
  if (!entry) {
    return [];
  }
  const missing: string[] = [];
  for (const spec of entry.requiredEnvVars) {
    if (spec.optional) {
      continue;
    }
    const candidates = [spec.name, ...(spec.alternatives ?? [])];
    const satisfied = candidates.some((v) => {
      const val = process.env[v];
      return typeof val === "string" && val.trim().length > 0;
    });
    if (!satisfied) {
      missing.push(spec.name);
    }
  }
  return missing;
}

/**
 * Returns a summary of all integrations and whether each one is configured.
 * Safe to expose as a server-only status endpoint (no secret values returned).
 */
export function getIntegrationStatus(): Array<{
  id: string;
  name: string;
  category: IntegrationCategory;
  configured: boolean;
  missing: string[];
  requiresOAuth: boolean;
}> {
  return INTEGRATION_REQUIREMENTS.map((entry) => {
    const missing = getMissingEnvVars(entry.id);
    // An OAuth-only integration (no required env vars) is considered configured
    // if it requires OAuth and has no mandatory env vars.
    const configured = missing.length === 0;
    return {
      id: entry.id,
      name: entry.name,
      category: entry.category,
      configured,
      missing,
      requiresOAuth: entry.requiresOAuth ?? false,
    };
  });
}
