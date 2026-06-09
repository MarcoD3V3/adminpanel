"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Eye, EyeOff, Lock, LockOpen } from "lucide-react";
import { Input, Select } from "@/components/ui/Input";
import { HubColorPicker } from "@/components/hub-builder/HubColorPicker";
import { HubNumberField } from "@/components/hub-builder/WindowDimensionField";
import { useHubBuilderStore } from "@/lib/hub-builder-store";
import { cn } from "@/lib/utils";
import type { HubElement } from "@/types/hub-builder";
import {
  GAME_MENU_ACTIONS,
  GAME_MENU_W,
  GAME_MENU_H,
  anchorsToHubPosition,
  deriveGameMenuAction,
  gameMenuActionToHubPatch,
  hubElementAnchors,
  isGameMenuButtonElement,
  isGameMenuLabelElement,
  isGameMenuPreviewOnlyElement,
  type Anchor,
  type AnchorX,
  type AnchorY,
  type GameMenuAction,
} from "@/lib/game-ui-export";
import {
  GAME_MENU_STYLE_PRESETS,
  matchGameMenuPreset,
  type GameMenuStyle,
} from "@/lib/game-menu-styles";
import { GAME_MENU_BINDINGS, type GameMenuBinding } from "@/lib/game-menu-bindings";

function PropertySection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="border-b border-[var(--color-border-subtle)]/70 pb-3 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-1.5 text-left"
      >
        <span className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-muted)]">
          {title}
        </span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 text-[var(--color-muted)] transition-transform", open && "rotate-180")}
          strokeWidth={1.5}
        />
      </button>
      {open && <div className="space-y-2 pt-0.5">{children}</div>}
    </section>
  );
}

function ToggleChip({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={cn(
        "flex flex-1 items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-[10px] transition-colors",
        active
          ? "border-[var(--color-accent-muted)] bg-[var(--color-accent)]/15 text-[var(--color-text-soft)]"
          : "border-[var(--color-border-subtle)] text-[var(--color-muted)] hover:bg-[var(--color-surface-hover)]"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

const ANCHOR_X_OPTIONS: { value: AnchorX; label: string }[] = [
  { value: "left", label: "Izquierda" },
  { value: "center", label: "Centro" },
  { value: "right", label: "Derecha" },
];

const ANCHOR_Y_OPTIONS: { value: AnchorY; label: string }[] = [
  { value: "top", label: "Arriba" },
  { value: "center", label: "Centro" },
  { value: "bottom", label: "Abajo" },
];

function elementTypeLabel(el: HubElement): string {
  if (isGameMenuPreviewOnlyElement(el)) return "Preview";
  if (isGameMenuLabelElement(el)) return "Texto";
  if (el.type === "link") return "Enlace";
  if (el.type === "play-button") return "Jugar";
  if (el.type === "nav-item") return "Pestaña";
  if (el.type === "icon-button") return "Icono";
  if (el.type === "banner") return "Banner";
  if (el.type === "chip" || el.type === "minecraft-status-chip") return "Chip";
  return "Botón";
}

export function GameMenuElementProperties({ element }: { element: HubElement }) {
  const updateElement = useHubBuilderStore((s) => s.updateElement);
  const toggleVisible = useHubBuilderStore((s) => s.toggleVisible);
  const toggleLock = useHubBuilderStore((s) => s.toggleLock);

  const patch = (data: Partial<HubElement>) => updateElement(element.id, data);
  const applyStyle = (stylePatch: Partial<HubElement["style"]>) =>
    patch({ style: { ...element.style, ...stylePatch } });

  const isLabel = isGameMenuLabelElement(element);
  const isButton = isGameMenuButtonElement(element);
  const isPreviewOnly = isGameMenuPreviewOnlyElement(element);
  const { action: gameAction, url: gameUrl, server: gameServer } = useMemo(
    () => deriveGameMenuAction(element),
    [element]
  );
  const anchors = useMemo(() => hubElementAnchors(element), [element]);
  const activePreset = useMemo(() => matchGameMenuPreset(element.style), [element.style]);

  const applyAnchorPatch = (partial: Partial<Anchor> & { w?: number; h?: number }) => {
    const next: Anchor & { w: number; h: number } = {
      anchorX: partial.anchorX ?? anchors.anchorX,
      anchorY: partial.anchorY ?? anchors.anchorY,
      offsetX: partial.offsetX ?? anchors.offsetX,
      offsetY: partial.offsetY ?? anchors.offsetY,
      w: partial.w ?? anchors.w,
      h: partial.h ?? anchors.h,
    };
    const pos = anchorsToHubPosition(next, next.w, next.h);
    patch(pos);
  };

  const applyGameAction = (action: GameMenuAction, url?: string, server?: string) => {
    patch(gameMenuActionToHubPatch(action, url, server));
  };

  const displayName = element.label?.trim() || elementTypeLabel(element);

  return (
    <div className="space-y-3">
      <div className="space-y-1 border-b border-[var(--color-border-subtle)]/70 pb-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-[var(--color-text)]">Menú Minecraft</p>
          <span className="shrink-0 rounded bg-[#2b2e33] px-1.5 py-0.5 font-mono text-[9px] uppercase text-[var(--color-muted)]">
            {elementTypeLabel(element)}
          </span>
        </div>
        <p className="line-clamp-2 text-[10px] leading-snug text-[var(--color-muted)]" title={displayName}>
          {displayName}
        </p>
        {isPreviewOnly && (
          <p className="mt-1 text-[9px] text-amber-500/90">
            Solo preview en el editor — no se exporta al juego (Minecraft aún no lo renderiza).
          </p>
        )}
      </div>

      <PropertySection title="Elemento" defaultOpen>
        <Input
          compact
          label={isLabel || isPreviewOnly ? "Texto / título" : "Etiqueta del botón"}
          value={element.label ?? ""}
          onChange={(e) => patch({ label: e.target.value })}
          placeholder={isLabel ? "Minecraft 1.18.2" : "Singleplayer"}
        />

        <div className="flex gap-1.5">
          <ToggleChip
            active={element.visible !== false}
            onClick={() => toggleVisible(element.id)}
            icon={
              element.visible !== false ? (
                <Eye className="h-3 w-3" strokeWidth={1.5} />
              ) : (
                <EyeOff className="h-3 w-3" strokeWidth={1.5} />
              )
            }
            label="Visible"
          />
          <ToggleChip
            active={element.locked}
            onClick={() => toggleLock(element.id)}
            icon={
              element.locked ? (
                <Lock className="h-3 w-3" strokeWidth={1.5} />
              ) : (
                <LockOpen className="h-3 w-3" strokeWidth={1.5} />
              )
            }
            label="Bloqueado"
          />
        </div>

        <p className="text-[9px] leading-snug text-[var(--color-muted)]">
          Diseño en {GAME_MENU_W}×{GAME_MENU_H}px. En el juego se adapta con anclas al tamaño de ventana.
        </p>
      </PropertySection>

      {isButton && (
        <PropertySection title="Acción en el juego" defaultOpen>
          <Select
            compact
            label="Al hacer clic"
            value={gameAction}
            onChange={(e) => {
              const next = e.target.value as GameMenuAction;
              if (next === "join_server") {
                applyGameAction(next, undefined, gameServer ?? element.serverAddress ?? "play.miservidor.net");
              } else {
                applyGameAction(next, next === "url" ? gameUrl ?? "https://" : undefined);
              }
            }}
            options={GAME_MENU_ACTIONS.map((a) => ({ value: a.value, label: a.label }))}
          />

          {gameAction === "url" && (
            <Input
              compact
              label="URL"
              value={element.externalUrl ?? gameUrl ?? ""}
              onChange={(e) => applyGameAction("url", e.target.value)}
              placeholder="https://youtube.com/..."
            />
          )}

          {gameAction === "join_server" && (
            <Input
              compact
              label="IP / dominio del servidor"
              value={element.serverAddress ?? gameServer ?? ""}
              onChange={(e) => applyGameAction("join_server", undefined, e.target.value)}
              placeholder="play.miservidor.net o 192.168.1.10:25565"
            />
          )}

          <p className="text-[9px] leading-snug text-[var(--color-muted)]">
            Se exporta a <span className="font-mono">craftlauncher-ui.json</span> y el juego la ejecuta al pulsar.
          </p>
        </PropertySection>
      )}

      {isLabel && (
        <PropertySection title="Texto dinámico" defaultOpen>
          <Select
            compact
            label="Origen del texto"
            value={element.style.gameMenuBinding ?? ""}
            onChange={(e) => {
              const v = e.target.value as GameMenuBinding | "";
              applyStyle({
                gameMenuBinding: v || undefined,
              });
            }}
            options={[
              { value: "", label: "Texto fijo (manual)" },
              ...GAME_MENU_BINDINGS.map((b) => ({ value: b.value, label: b.label })),
            ]}
          />
          {element.style.gameMenuBinding ? (
            <p className="text-[9px] leading-snug text-[var(--color-muted)]">
              {GAME_MENU_BINDINGS.find((b) => b.value === element.style.gameMenuBinding)?.hint ??
                "Se actualiza solo en el juego según la versión de la instancia."}
            </p>
          ) : (
            <Input
              compact
              label="Texto"
              value={element.label}
              onChange={(e) => patch({ label: e.target.value })}
            />
          )}
        </PropertySection>
      )}

      <PropertySection title="Posición responsiva" defaultOpen>
        <div className="grid grid-cols-2 gap-1.5">
          <Select
            compact
            label="Ancla horizontal"
            value={anchors.anchorX}
            onChange={(e) => applyAnchorPatch({ anchorX: e.target.value as AnchorX })}
            options={ANCHOR_X_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
          <Select
            compact
            label="Ancla vertical"
            value={anchors.anchorY}
            onChange={(e) => applyAnchorPatch({ anchorY: e.target.value as AnchorY })}
            options={ANCHOR_Y_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
          <HubNumberField
            label="Offset X"
            value={anchors.offsetX}
            min={-999}
            max={999}
            step={1}
            onCommit={(offsetX) => applyAnchorPatch({ offsetX })}
          />
          <HubNumberField
            label="Offset Y"
            value={anchors.offsetY}
            min={-999}
            max={999}
            step={1}
            onCommit={(offsetY) => applyAnchorPatch({ offsetY })}
          />
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <HubNumberField
            label="Ancho"
            value={element.width}
            min={12}
            max={480}
            step={1}
            onCommit={(width) => applyAnchorPatch({ w: Math.max(12, width) })}
          />
          <HubNumberField
            label="Alto"
            value={element.height}
            min={8}
            max={120}
            step={1}
            onCommit={(height) => applyAnchorPatch({ h: Math.max(8, height) })}
          />
        </div>

        <HubNumberField
          label="Capa (z-index)"
          value={element.zIndex}
          min={0}
          max={999}
          step={1}
          onCommit={(zIndex) => patch({ zIndex })}
        />

        <p className="text-[9px] leading-snug text-[var(--color-muted)]">
          Canvas: X={element.x}, Y={element.y}. Las anclas definen el comportamiento al redimensionar Minecraft.
        </p>
      </PropertySection>

      <PropertySection title="Estilo Minecraft" defaultOpen>
        {isButton && (
          <>
            <p className="text-[9px] font-medium uppercase tracking-widest text-[var(--color-muted)]">
              Preset
            </p>
            <div className="grid grid-cols-2 gap-1">
              {GAME_MENU_STYLE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  title={preset.description}
                  onClick={() => applyStyle(preset.style as GameMenuStyle)}
                  className={cn(
                    "rounded-md border px-2 py-1.5 text-left transition-colors",
                    activePreset === preset.id
                      ? "border-[var(--color-accent-muted)] bg-[var(--color-accent)]/15"
                      : "border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-hover)]"
                  )}
                >
                  <span className="block text-[10px] font-medium text-[var(--color-text-soft)]">
                    {preset.label}
                  </span>
                  <span
                    className="mt-1 block h-3 rounded-sm border"
                    style={{
                      background: preset.style.backgroundColor ?? "#2b2e33",
                      borderColor: preset.style.borderColor ?? "#72757a",
                    }}
                  />
                </button>
              ))}
            </div>

            <HubColorPicker
              label="Fondo"
              value={element.style.backgroundColor ?? ""}
              fallback="#2b2e33"
              onChange={(v) => applyStyle({ backgroundColor: v })}
            />
            <HubColorPicker
              label="Fondo hover"
              value={element.style.backgroundColorHover ?? ""}
              fallback="#3a3e45"
              onChange={(v) => applyStyle({ backgroundColorHover: v })}
            />
            <HubColorPicker
              label="Borde"
              value={element.style.borderColor ?? ""}
              fallback="#72757a"
              onChange={(v) => applyStyle({ borderColor: v })}
            />
          </>
        )}

        <HubColorPicker
          label="Color del texto"
          value={element.style.textColor ?? ""}
          fallback={isLabel ? "#ffffff" : "#e8eaed"}
          onChange={(v) => applyStyle({ textColor: v })}
        />

        {isButton && (
          <>
            <HubNumberField
              label="Radio borde (px)"
              value={element.style.borderRadius ?? 0}
              min={0}
              max={24}
              step={1}
              onCommit={(borderRadius) => applyStyle({ borderRadius })}
            />
            <Select
              compact
              label="Peso texto"
              value={element.style.fontWeight ?? "normal"}
              onChange={(e) =>
                applyStyle({ fontWeight: e.target.value as HubElement["style"]["fontWeight"] })
              }
              options={[
                { value: "normal", label: "Normal" },
                { value: "medium", label: "Medio" },
                { value: "bold", label: "Negrita" },
              ]}
            />
            <HubNumberField
              label="Opacidad (%)"
              value={element.style.opacity ?? 100}
              min={0}
              max={100}
              step={5}
              onCommit={(opacity) => applyStyle({ opacity })}
            />
          </>
        )}

        <HubNumberField
          label="Tamaño texto (px)"
          value={element.style.fontSize ?? 8}
          min={6}
          max={isLabel ? 14 : 16}
          step={1}
          onCommit={(fontSize) => applyStyle({ fontSize })}
        />

        <p className="text-[9px] leading-snug text-[var(--color-muted)]">
          Elige un preset o personaliza colores, borde y hover. Se exporta tal cual al juego.
        </p>
      </PropertySection>
    </div>
  );
}
