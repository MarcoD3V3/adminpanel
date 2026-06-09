"use client";

import { useCallback, useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { PageContent } from "@/components/layout/PageContent";
import {
  NotificationComposer,
  type NotificationType,
  DISPLAY_OPTIONS,
  TYPE_OPTIONS,
} from "@/components/notifications/NotificationComposer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/utils";
import { rowItem, badgeWarning } from "@/lib/styles";
import { RefreshCw } from "lucide-react";
import type { Notification, NotificationDisplay, NotificationTarget } from "@/types";

const typeColors: Record<string, string> = {
  info: "bg-[var(--color-surface-hover)] text-[var(--color-text-soft)]",
  warning: "bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]",
  success: "bg-[var(--color-accent-soft)] text-[var(--color-accent)]",
  error: "bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]",
  alert: "bg-red-500/20 text-red-300",
  update: "bg-sky-500/20 text-sky-300",
};

const displayLabels = Object.fromEntries(DISPLAY_OPTIONS.map((o) => [o.id, o.label])) as Record<
  NotificationDisplay,
  string
>;

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendFeedback, setSendFeedback] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState<NotificationTarget>("all");
  const [type, setType] = useState<NotificationType>("info");
  const [display, setDisplay] = useState<NotificationDisplay>("toast");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      const data = (await res.json()) as { notifications: Notification[] };
      setNotifications(data.notifications ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) return;
    setSending(true);
    setSendFeedback(null);
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, message, type, display, target }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        setSendFeedback(data.error ?? "No se pudo enviar la notificación.");
        return;
      }
      setTitle("");
      setMessage("");
      setSendFeedback("Enviada — el launcher la recibirá en unos segundos.");
      await refresh();
    } catch {
      setSendFeedback("Error de red al enviar.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Header
        title="Notificaciones"
        description="Avisos compactos al launcher — toast, banner o modal"
      />

      <PageContent>
        <div className="grid gap-6 xl:grid-cols-5">
          <div className="xl:col-span-2">
            <NotificationComposer
              title={title}
              message={message}
              type={type}
              display={display}
              target={target}
              sending={sending}
              onTitleChange={setTitle}
              onMessageChange={setMessage}
              onTypeChange={setType}
              onDisplayChange={setDisplay}
              onTargetChange={setTarget}
              onSend={() => void handleSend()}
            />
            {sendFeedback && (
              <p
                className={`text-sm ${sendFeedback.startsWith("Enviada") ? "text-[var(--color-accent)]" : "text-red-400"}`}
              >
                {sendFeedback}
              </p>
            )}
          </div>

          <Card className="xl:col-span-3">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Historial</CardTitle>
                  <p className="mt-0.5 text-xs text-[var(--color-text-soft)]">
                    {notifications.length} envíos · formato categoría — mensaje
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {notifications.map((notif) => (
                <div key={notif.id} className={rowItem}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-[var(--color-text)]">
                        <span className="text-[var(--color-text-soft)]">{notif.title}</span>
                        <span className="text-[var(--color-muted)]"> — </span>
                        {notif.message}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Badge className={typeColors[notif.type] ?? typeColors.info}>
                          {TYPE_OPTIONS.find((t) => t.id === notif.type)?.label ?? notif.type}
                        </Badge>
                        <Badge>{displayLabels[notif.display ?? "toast"]}</Badge>
                        <span className="text-[11px] text-[var(--color-muted)]">
                          {formatDate(notif.createdAt)} · {notif.target}
                          {notif.sent && ` · ${notif.readCount} entregas`}
                        </span>
                      </div>
                    </div>
                    <Badge
                      className={
                        notif.sent
                          ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)] shrink-0"
                          : badgeWarning
                      }
                    >
                      {notif.sent ? "Enviada" : "Borrador"}
                    </Badge>
                  </div>
                </div>
              ))}
              {!notifications.length && !loading && (
                <p className="py-8 text-center text-sm text-[var(--color-muted)]">
                  Aún no has enviado notificaciones.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </PageContent>
    </>
  );
}
