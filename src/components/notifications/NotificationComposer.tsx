"use client";

import { Bell, Layers, Megaphone, Send, ShieldAlert, Sparkles, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { FilterPills } from "@/components/ui/FilterPills";
import { cn } from "@/lib/utils";
import type { NotificationDisplay, NotificationTarget } from "@/types";

export type NotificationType = "info" | "warning" | "success" | "error" | "alert" | "update";

const TYPE_OPTIONS: { id: NotificationType; label: string; hint: string; icon: typeof Bell }[] = [
  { id: "info", label: "Info", hint: "Neutro, avisos generales", icon: Bell },
  { id: "warning", label: "Aviso", hint: "Atención sin bloquear", icon: TriangleAlert },
  { id: "success", label: "Éxito", hint: "Confirmaciones positivas", icon: Sparkles },
  { id: "error", label: "Error", hint: "Algo falló", icon: ShieldAlert },
  { id: "alert", label: "Alerta", hint: "Crítico o urgente", icon: Megaphone },
  { id: "update", label: "Update", hint: "Actualizaciones del launcher", icon: Layers },
];

const DISPLAY_OPTIONS: { id: NotificationDisplay; label: string; hint: string }[] = [
  { id: "toast", label: "Alerta flotante", hint: "Aparece arriba a la derecha y se cierra sola (~7 s)" },
  { id: "banner", label: "Banner", hint: "Franja superior persistente" },
  { id: "alert", label: "Modal", hint: "Centrado, obliga a confirmar" },
];

const TARGET_OPTIONS: { id: NotificationTarget; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "online", label: "Online" },
  { id: "premium", label: "Premium" },
  { id: "specific", label: "Específicos" },
];

const previewAccent: Record<NotificationType, string> = {
  info: "border-white/10",
  warning: "border-l-amber-500/70",
  success: "border-l-emerald-500/70",
  error: "border-l-red-500/70",
  alert: "border-l-red-400/80",
  update: "border-l-sky-500/70",
};

function previewLine(title: string, message: string): string {
  const t = title.trim();
  const m = message.trim();
  if (t && m) return `${t} — ${m}`;
  return t || m || "Categoría — mensaje de ejemplo";
}

interface NotificationComposerProps {
  title: string;
  message: string;
  type: NotificationType;
  display: NotificationDisplay;
  target: NotificationTarget;
  sending: boolean;
  onTitleChange: (v: string) => void;
  onMessageChange: (v: string) => void;
  onTypeChange: (v: NotificationType) => void;
  onDisplayChange: (v: NotificationDisplay) => void;
  onTargetChange: (v: NotificationTarget) => void;
  onSend: () => void;
}

export function NotificationComposer({
  title,
  message,
  type,
  display,
  target,
  sending,
  onTitleChange,
  onMessageChange,
  onTypeChange,
  onDisplayChange,
  onTargetChange,
  onSend,
}: NotificationComposerProps) {
  const typeMeta = TYPE_OPTIONS.find((o) => o.id === type)!;
  const displayMeta = DISPLAY_OPTIONS.find((o) => o.id === display)!;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enviar notificación</CardTitle>
        <CardDescription>
          Formato compacto <span className="text-[var(--color-text-soft)]">Categoría — mensaje</span>, igual que en el
          launcher.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Categoría"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Noticias, Mantenimiento, Evento…"
            hint="Aparece antes del guión"
          />
          <Input
            label="Mensaje"
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            placeholder="ventana no configurada, doble XP activo…"
            hint="Texto principal de la notificación"
          />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-[var(--color-text-soft)]">Estilo</p>
          <FilterPills options={TYPE_OPTIONS.map((o) => ({ id: o.id, label: o.label }))} active={type} onChange={(id) => onTypeChange(id as NotificationType)} />
          <p className="text-[11px] text-[var(--color-muted)]">{typeMeta.hint}</p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-[var(--color-text-soft)]">Presentación</p>
          <FilterPills
            options={DISPLAY_OPTIONS.map((o) => ({ id: o.id, label: o.label }))}
            active={display}
            onChange={(id) => onDisplayChange(id as NotificationDisplay)}
          />
          <p className="text-[11px] text-[var(--color-muted)]">{displayMeta.hint}</p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-[var(--color-text-soft)]">Destinatarios</p>
          <FilterPills
            options={TARGET_OPTIONS}
            active={target}
            onChange={(id) => onTargetChange(id as NotificationTarget)}
          />
        </div>

        <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[#0c0e11] p-5">
          <p className="mb-3 text-[10px] font-medium uppercase tracking-widest text-[var(--color-muted)]">
            Vista previa — {display}
          </p>

          {display === "toast" && (
            <div className="flex justify-end py-6">
              <div
                className={cn(
                  "flex w-full max-w-sm items-start gap-2 rounded-[10px] border bg-[rgba(18,21,26,0.96)] px-3 py-2.5 text-[11px] text-[#e8e9eb] shadow-lg",
                  previewAccent[type],
                  type !== "info" && "border-l-[3px]"
                )}
              >
                <typeMeta.icon className="mt-0.5 h-4 w-4 shrink-0 opacity-80" strokeWidth={1.5} />
                <span className="min-w-0 flex-1 leading-snug">{previewLine(title, message)}</span>
                <span className="text-[var(--color-muted)]">×</span>
              </div>
            </div>
          )}

          {display === "banner" && (
            <div
              className={cn(
                "flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-[11px]",
                type === "warning" && "bg-amber-950/80 text-amber-100",
                type === "success" && "bg-emerald-950/80 text-emerald-100",
                type === "error" && "bg-red-950/80 text-red-100",
                type === "alert" && "bg-red-900/90 text-red-50",
                type === "update" && "bg-sky-950/80 text-sky-100",
                type === "info" && "bg-zinc-900/90 text-zinc-200"
              )}
            >
              <span className="truncate">
                <strong>{title.trim() || "Categoría"}</strong> — {message.trim() || "mensaje"}
              </span>
              <span className="opacity-60">×</span>
            </div>
          )}

          {display === "alert" && (
            <div className="mx-auto max-w-xs rounded-xl border border-white/10 bg-[#12151a] p-5 text-center">
              <typeMeta.icon className="mx-auto mb-2 h-6 w-6 text-[var(--color-accent)]" strokeWidth={1.5} />
              <p className="text-sm font-medium">{title.trim() || "Categoría"}</p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">{message.trim() || "Mensaje de la alerta"}</p>
              <div className="mt-4 inline-block rounded-lg bg-[var(--color-accent)] px-4 py-1.5 text-xs font-medium text-[#0c0e11]">
                Entendido
              </div>
            </div>
          )}
        </div>

        <Button
          className="w-full"
          onClick={onSend}
          disabled={sending || !title.trim() || !message.trim()}
        >
          <Send className="h-3.5 w-3.5" strokeWidth={1.5} />
          {sending ? "Enviando…" : "Enviar a launchers"}
        </Button>
        <p className="text-center text-[11px] text-[var(--color-muted)]">
          Entrega en ~5 s · Alerta flotante se cierra sola a los 7 s
        </p>
      </CardContent>
    </Card>
  );
}

export { TYPE_OPTIONS, DISPLAY_OPTIONS };
