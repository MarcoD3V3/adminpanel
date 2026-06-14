import { NextResponse } from "next/server";
import {
  acquireOrRefreshHubEditLock,
  readHubEditLock,
  releaseHubEditLock,
} from "@/lib/hub-builder-edit-lock";
import {
  remoteHubLockDelete,
  remoteHubLockGet,
  remoteHubLockPost,
  usesRemoteHubData,
} from "@/lib/hub-data-authority";
import { requireAdminAccess } from "@/lib/launcher-auth/require-admin";

function holderPayload(lock: { holderLabel: string; acquiredAt: string; expiresAt: string }) {
  return {
    label: lock.holderLabel,
    since: lock.acquiredAt,
    expiresAt: lock.expiresAt,
  };
}

async function proxyJson(res: Response | null, fallbackStatus = 502) {
  if (!res) {
    return NextResponse.json({ ok: false, error: "Sin conexión con Railway" }, { status: fallbackStatus });
  }
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

export async function GET(request: Request) {
  const denied = await requireAdminAccess(request);
  if (denied) return denied;

  const editorId = new URL(request.url).searchParams.get("editorId")?.trim() ?? "";

  if (usesRemoteHubData()) {
    return proxyJson(await remoteHubLockGet(editorId));
  }

  const lock = await readHubEditLock();
  if (!lock) {
    return NextResponse.json({ locked: false, isOwner: false });
  }

  return NextResponse.json({
    locked: true,
    isOwner: Boolean(editorId && lock.editorId === editorId),
    holder: holderPayload(lock),
  });
}

export async function POST(request: Request) {
  const denied = await requireAdminAccess(request);
  if (denied) return denied;

  try {
    const body = (await request.json()) as { editorId?: string; holderLabel?: string };
    const editorId = body.editorId?.trim();
    if (!editorId || editorId.length > 128) {
      return NextResponse.json({ ok: false, error: "editorId inválido" }, { status: 400 });
    }

    if (usesRemoteHubData()) {
      return proxyJson(await remoteHubLockPost(body));
    }

    const result = await acquireOrRefreshHubEditLock(
      editorId,
      body.holderLabel?.trim() || "Editor"
    );

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          role: "viewer" as const,
          holder: holderPayload(result.lock),
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      ok: true,
      role: "editor" as const,
      holder: holderPayload(result.lock),
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Error al adquirir lock" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const denied = await requireAdminAccess(request);
  if (denied) return denied;

  try {
    const url = new URL(request.url);
    let editorId = url.searchParams.get("editorId")?.trim() ?? "";
    if (!editorId) {
      try {
        const body = (await request.json()) as { editorId?: string };
        editorId = body.editorId?.trim() ?? "";
      } catch {
        /* cuerpo vacío al cerrar pestaña */
      }
    }
    if (!editorId) {
      return NextResponse.json({ ok: false, error: "editorId requerido" }, { status: 400 });
    }

    if (usesRemoteHubData()) {
      return proxyJson(await remoteHubLockDelete(editorId));
    }

    const released = await releaseHubEditLock(editorId);
    return NextResponse.json({ ok: released });
  } catch {
    return NextResponse.json({ ok: false, error: "Error al liberar lock" }, { status: 500 });
  }
}
