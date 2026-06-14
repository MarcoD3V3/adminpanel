import { NextResponse } from "next/server";
import type { NotificationDisplay, NotificationStyle } from "@craftlauncher/shared";
import { createNotification, listNotifications } from "@/lib/launcher-notifications/service";
import type { NotificationTarget } from "@/lib/launcher-notifications/store";
import { requireAdminSession } from "@/lib/launcher-auth/require-admin";

export async function GET() {
  const denied = await requireAdminSession();
  if (denied) return denied;

  const notifications = await listNotifications();
  return NextResponse.json({
    notifications: notifications.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.style,
      display: n.display,
      target: n.target,
      createdAt: n.createdAt,
      sent: true,
      readCount: n.deliveredTo.length,
    })),
  });
}

export async function POST(request: Request) {
  const denied = await requireAdminSession();
  if (denied) return denied;

  const body = (await request.json()) as {
    title?: string;
    message?: string;
    type?: NotificationStyle;
    display?: NotificationDisplay;
    target?: NotificationTarget;
    targetDevices?: string[];
  };

  if (!body.title?.trim() || !body.message?.trim()) {
    return NextResponse.json({ success: false, error: "Título y mensaje requeridos" }, { status: 400 });
  }

  const created = await createNotification({
    title: body.title,
    message: body.message,
    style: body.type ?? "info",
    display: body.display ?? "toast",
    target: body.target ?? "all",
    targetDevices: body.targetDevices,
  });

  if (!created) {
    return NextResponse.json(
      { success: false, error: "Las notificaciones están desactivadas en Configuración" },
      { status: 403 }
    );
  }

  return NextResponse.json({
    success: true,
    notification: {
      id: created.id,
      title: created.title,
      message: created.message,
      type: created.style,
      display: created.display,
      target: created.target,
      createdAt: created.createdAt,
      sent: true,
      readCount: 0,
    },
  });
}
