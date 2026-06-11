import type { HubLayout } from "@/types/hub-builder";
import {
  isHubLayoutShape,
  parseStoredLayoutFile,
  signHubLayout,
  serializeSignedDocument,
  verifyReasonMessage,
} from "@/lib/hub-layout-signing";
import { jsonSecure } from "@/lib/launcher-auth/http";
import { requireAdminSession } from "@/lib/launcher-auth/require-admin";

export async function POST(request: Request) {
  const denied = await requireAdminSession();
  if (denied) return denied;

  try {
    const body = (await request.json()) as { raw?: string; layout?: HubLayout };
    const result = body.raw
      ? parseStoredLayoutFile(body.raw)
      : body.layout && isHubLayoutShape(body.layout)
        ? parseStoredLayoutFile(JSON.stringify(body.layout))
        : { ok: false as const, reason: "invalid" as const };

    if (!result.ok) {
      return jsonSecure(
        {
          valid: false,
          reason: result.reason,
          error: verifyReasonMessage(result.reason),
        },
        { status: 403 }
      );
    }

    return jsonSecure({
      valid: true,
      layout: result.layout,
      signedAt: result.signedAt,
    });
  } catch {
    return jsonSecure(
      { valid: false, reason: "parse_error", error: verifyReasonMessage("parse_error") },
      { status: 400 }
    );
  }
}

/** Firma un layout para exportar (solo admin). */
export async function PUT(request: Request) {
  const denied = await requireAdminSession();
  if (denied) return denied;

  try {
    const body = (await request.json()) as { layout?: HubLayout };
    if (!body.layout || !isHubLayoutShape(body.layout)) {
      return jsonSecure({ error: "Layout inválido" }, { status: 400 });
    }
    const signed = signHubLayout(body.layout);
    if (!signed) {
      return jsonSecure(
        { error: "No se pudo firmar. Configura LAUNCHER_ADMIN_SECRET en el servidor." },
        { status: 503 }
      );
    }
    return jsonSecure({
      document: signed,
      signedJson: serializeSignedDocument(signed),
    });
  } catch {
    return jsonSecure({ error: "Error al firmar" }, { status: 500 });
  }
}
