import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/launcher-auth/require-admin";
import { auditAdminRequest } from "@/lib/security/guard";
import {
  addIntegration,
  getDeliveriesLog,
  getIntegrationsDashboard,
} from "@/lib/integrations/service";
import { INTEGRATION_EVENTS } from "@/lib/integrations/events";

export async function GET(request: Request) {
  const denied = await requireAdminSession(request);
  if (denied) return denied;

  await auditAdminRequest(request);
  const url = new URL(request.url);

  if (url.searchParams.get("scope") === "deliveries") {
    const integrationId = url.searchParams.get("integrationId") ?? undefined;
    const limit = Number(url.searchParams.get("limit") ?? "100");
    return NextResponse.json({ deliveries: getDeliveriesLog(limit, integrationId) });
  }

  if (url.searchParams.get("scope") === "events") {
    return NextResponse.json({ events: INTEGRATION_EVENTS });
  }

  return NextResponse.json(getIntegrationsDashboard());
}

export async function POST(request: Request) {
  const denied = await requireAdminSession(request);
  if (denied) return denied;

  const body = (await request.json()) as {
    name?: string;
    type?: "discord" | "telegram" | "slack" | "custom";
    url?: string;
    events?: string[];
    description?: string;
    config?: {
      telegramChatId?: string;
      discordUsername?: string;
      discordAvatarUrl?: string;
      secretHeaderName?: string;
      secretHeaderValue?: string;
      retryOnFail?: boolean;
    };
  };

  await auditAdminRequest(request, body);

  try {
    const integration = await addIntegration({
      name: body.name ?? "",
      type: body.type ?? "discord",
      url: body.url ?? "",
      events: body.events ?? [],
      description: body.description,
      config: body.config,
    });
    return NextResponse.json({ success: true, integration });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo crear la integración";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
