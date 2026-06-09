"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import {
  HUB_ICON_CATALOG,
  HUB_ICON_CATEGORY_LABELS,
  type HubIconCategory,
  type HubElement,
} from "@craftlauncher/shared";
import { HubElementIcon, resolveHubIconComponent } from "@/components/hub-builder/hub-element-icon-registry";
import { cn } from "@/lib/utils";

type IconPickerProps = {
  value: string;
  onChange: (iconId: string) => void;
  previewElement: HubElement;
};

const CATEGORY_ORDER: HubIconCategory[] = [
  "acciones",
  "navegacion",
  "ventana",
  "comunicacion",
  "juego",
  "ui",
  "medios",
];

export function IconPicker({ value, onChange, previewElement }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<HubIconCategory | "all">("all");

  useEffect(() => {
    setOpen(false);
    setQuery("");
    setCategory("all");
  }, [previewElement.id]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return HUB_ICON_CATALOG.filter((icon) => {
      if (category !== "all" && icon.category !== category) return false;
      if (!q) return true;
      return icon.id.includes(q) || icon.label.toLowerCase().includes(q);
    });
  }, [query, category]);

  const PreviewIcon = resolveHubIconComponent(value);
  const previewDef = HUB_ICON_CATALOG.find((icon) => icon.id === value);

  const closePicker = () => {
    setOpen(false);
    setQuery("");
    setCategory("all");
  };

  const handleSelect = (iconId: string) => {
    onChange(iconId);
    closePicker();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-hover)]/50 px-2 py-2 text-left transition-colors hover:border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] text-[var(--color-text-soft)]">
          <PreviewIcon size={18} strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium text-[var(--color-text-soft)]">Icono</p>
          <p className="truncate font-mono text-[10px] text-[var(--color-muted)]">
            {previewDef?.label ?? value}
          </p>
        </div>
        <span className="shrink-0 rounded-md bg-[var(--color-surface)] px-2 py-1 text-[9px] font-medium text-[var(--color-accent)]">
          Cambiar
        </span>
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-[var(--color-accent-muted)]/35 bg-[var(--color-surface)] p-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium text-[var(--color-text-soft)]">Elegir icono</p>
        <button
          type="button"
          onClick={closePicker}
          className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-soft)]"
          title="Cerrar selector"
          aria-label="Cerrar selector de iconos"
        >
          <X size={14} />
        </button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-muted)]" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar icono…"
          autoFocus
          className="h-8 w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-hover)] pl-7 pr-2 text-[11px] text-[var(--color-text)] outline-none focus:border-[var(--color-accent-muted)]"
        />
      </div>

      <div className="flex min-h-14 flex-wrap content-start gap-1">
        <button
          type="button"
          onClick={() => setCategory("all")}
          className={cn(
            "rounded-md px-2 py-1 text-[9px] transition-colors",
            category === "all"
              ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
              : "bg-[var(--color-surface-hover)] text-[var(--color-muted)] hover:text-[var(--color-text-soft)]"
          )}
        >
          Todos
        </button>
        {CATEGORY_ORDER.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={cn(
              "rounded-md px-2 py-1 text-[9px] transition-colors",
              category === cat
                ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                : "bg-[var(--color-surface-hover)] text-[var(--color-muted)] hover:text-[var(--color-text-soft)]"
            )}
          >
            {HUB_ICON_CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      <div className="h-44 overflow-y-auto rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-hover)]/40 p-1.5">
        <div className="grid grid-cols-6 gap-1">
          {filtered.map((icon) => {
            const selected = icon.id === value;
            const previewEl: HubElement = {
              ...previewElement,
              logic: {
                enabled: previewElement.logic?.enabled ?? false,
                trigger: previewElement.logic?.trigger ?? "click",
                script: previewElement.logic?.script ?? "",
                constants: {
                  ...(previewElement.logic?.constants ?? {}),
                  ICON_NAME: icon.id,
                },
              },
            };
            return (
              <button
                key={icon.id}
                type="button"
                title={icon.label}
                onClick={() => handleSelect(icon.id)}
                className={cn(
                  "flex h-8 items-center justify-center rounded-md border transition-colors",
                  selected
                    ? "border-[var(--color-accent-muted)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                    : "border-transparent text-[var(--color-text-soft)] hover:border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-hover)]"
                )}
              >
                <HubElementIcon element={previewEl} size={15} strokeWidth={2} />
              </button>
            );
          })}
        </div>
        {filtered.length === 0 && (
          <p className="flex h-full min-h-[9.5rem] items-center justify-center px-2 text-center text-[10px] text-[var(--color-muted)]">
            Sin resultados
          </p>
        )}
      </div>
    </div>
  );
}
