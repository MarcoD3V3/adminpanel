import type { Integration, IntegrationConfig } from "@/types/features";
import type { IntegrationEventPayload } from "./events";

const SEVERITY_COLORS: Record<string, number> = {
  critical: 0xed4245,
  warning: 0xfaa61a,
  info: 0x496f4f,
};

const SEVERITY_EMOJI: Record<string, string> = {
  critical: "🔴",
  warning: "🟠",
  info: "🟢",
};

export function buildDiscordPayload(integration: Integration, payload: IntegrationEventPayload) {
  const color = SEVERITY_COLORS[payload.severity ?? "info"] ?? 0x496f4f;
  const emoji = SEVERITY_EMOJI[payload.severity ?? "info"] ?? "📣";

  return {
    username: integration.config?.discordUsername ?? "CraftLauncher",
    avatar_url: integration.config?.discordAvatarUrl,
    embeds: [
      {
        title: `${emoji} ${payload.event}`,
        description: payload.title,
        color,
        fields: [
          { name: "Mensaje", value: payload.message.slice(0, 1024) },
          ...(payload.data
            ? Object.entries(payload.data)
                .slice(0, 6)
                .map(([k, v]) => ({
                  name: k,
                  value: String(v).slice(0, 256),
                  inline: true,
                }))
            : []),
        ],
        footer: { text: "CraftLauncher Admin" },
        timestamp: payload.timestamp ?? new Date().toISOString(),
      },
    ],
  };
}

export function buildSlackPayload(payload: IntegrationEventPayload) {
  const emoji = SEVERITY_EMOJI[payload.severity ?? "info"] ?? ":bell:";
  const lines = [
    `${emoji} *${payload.event}*`,
    `*${payload.title}*`,
    payload.message,
  ];
  if (payload.data) {
    for (const [k, v] of Object.entries(payload.data).slice(0, 8)) {
      lines.push(`• *${k}:* ${String(v)}`);
    }
  }
  return { text: lines.join("\n") };
}

export function buildTelegramPayload(integration: Integration, payload: IntegrationEventPayload) {
  const chatId = integration.config?.telegramChatId;
  const emoji = SEVERITY_EMOJI[payload.severity ?? "info"] ?? "📣";
  const text = [
    `${emoji} <b>${payload.event}</b>`,
    `<b>${payload.title}</b>`,
    payload.message,
    payload.data
      ? "\n" +
        Object.entries(payload.data)
          .slice(0, 6)
          .map(([k, v]) => `• <b>${k}:</b> ${String(v)}`)
          .join("\n")
      : "",
    `\n<i>CraftLauncher · ${new Date(payload.timestamp ?? Date.now()).toLocaleString("es")}</i>`,
  ].join("\n");

  return { chat_id: chatId, text, parse_mode: "HTML" as const };
}

export function buildCustomPayload(payload: IntegrationEventPayload) {
  return {
    source: "craftlauncher",
    version: 1,
    event: payload.event,
    title: payload.title,
    message: payload.message,
    severity: payload.severity ?? "info",
    timestamp: payload.timestamp ?? new Date().toISOString(),
    data: payload.data ?? {},
  };
}

export function buildProviderBody(integration: Integration, payload: IntegrationEventPayload): {
  body: unknown;
  valid: boolean;
  error?: string;
} {
  switch (integration.type) {
    case "discord":
      return { body: buildDiscordPayload(integration, payload), valid: true };
    case "slack":
      return { body: buildSlackPayload(payload), valid: true };
    case "telegram": {
      if (!integration.config?.telegramChatId?.trim()) {
        return { body: null, valid: false, error: "Falta telegramChatId en la configuración" };
      }
      return { body: buildTelegramPayload(integration, payload), valid: true };
    }
    case "custom":
      return { body: buildCustomPayload(payload), valid: true };
    default:
      return { body: null, valid: false, error: "Tipo de integración desconocido" };
  }
}

export function extraHeaders(config?: IntegrationConfig): HeadersInit {
  const headers: Record<string, string> = {};
  if (config?.secretHeaderName && config?.secretHeaderValue) {
    headers[config.secretHeaderName] = config.secretHeaderValue;
  }
  return headers;
}

export function previewDiscordEmbed(payload: IntegrationEventPayload): string[] {
  const emoji = SEVERITY_EMOJI[payload.severity ?? "info"] ?? "🔴";
  return [
    `${emoji} ${payload.event}`,
    payload.title,
    payload.message,
    ...(payload.data
      ? Object.entries(payload.data).slice(0, 4).map(([k, v]) => `${k}: ${String(v)}`)
      : []),
    `CraftLauncher Admin · ${new Date(payload.timestamp ?? Date.now()).toLocaleString("es")}`,
  ];
}
