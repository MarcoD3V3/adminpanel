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
  anchorsToHubPosition,
  hubElementAnchors,
  type AnchorX,
  type AnchorY,
} from "@/lib/game-ui-export";
import {
  GAME_LOADING_SCREEN_ID,
  GAME_LOADING_W,
  GAME_LOADING_H,
  isLoadingProgressElement,
  LOADING_PROGRESS_ELEMENT_ID,
} from "@/lib/loading-ui-export";

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

const ANCHOR_X: { value: AnchorX; label: string }[] = [
  { value: "left", label: "Izquierda" },
  { value: "center", label: "Centro" },
  { value: "right", label: "Derecha" },
];
const ANCHOR_Y: { value: AnchorY; label: string }[] = [
  { value: "top", label: "Arriba" },
  { value: "center", label: "Centro" },
  { value: "bottom", label: "Abajo" },
];

export function GameLoadingElementProperties({ element }: { element: HubElement }) {
  const updateElement = useHubBuilderStore((s) => s.updateElement);
  const updateScreen = useHubBuilderStore((s) => s.updateScreen);
  const layout = useHubBuilderStore((s) => s.layout);
  const toggleVisible = useHubBuilderStore((s) => s.toggleVisible);
  const toggleLock = useHubBuilderStore((s) => s.toggleLock);

  const screen = layout.screens.find((s) => s.id === GAME_LOADING_SCREEN_ID);
  const isProgress = isLoadingProgressElement(element);
  const anchors = useMemo(
    () => hubElementAnchors(element, GAME_LOADING_W, GAME_LOADING_H),
    [element]
  );

  const patch = (data: Partial<HubElement>) => updateElement(element.id, data);
  const applyStyle = (stylePatch: Partial<HubElement["style"]>) =>
    patch({ style: { ...element.style, ...stylePatch } });

  const applyAnchor = (partial: Partial<{ anchorX: AnchorX; anchorY: AnchorY; offsetX: number; offsetY: number; w: number; h: number }>) => {
    const next = {
      anchorX: partial.anchorX ?? anchors.anchorX,
      anchorY: partial.anchorY ?? anchors.anchorY,
      offsetX: partial.offsetX ?? anchors.offsetX,
      offsetY: partial.offsetY ?? anchors.offsetY,
      w: partial.w ?? anchors.w,
      h: partial.h ?? anchors.h,
    };
    patch(anchorsToHubPosition(next, next.w, next.h, GAME_LOADING_W, GAME_LOADING_H));
  };

  const typeLabel = isProgress ? "Barra progreso" : "Texto";

  return (
    <div className="space-y-3">
      <div className="space-y-1 border-b border-[var(--color-border-subtle)]/70 pb-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-[var(--color-text)]">Pantalla de carga</p>
          <span className="shrink-0 rounded bg-[#1a1d22] px-1.5 py-0.5 font-mono text-[9px] uppercase text-[var(--color-muted)]">
            {typeLabel}
          </span>
        </div>
      </div>

      {!isProgress && (
        <PropertySection title="Texto" defaultOpen>
          <Input
            compact
            label="Contenido"
            value={element.label ?? ""}
            onChange={(e) => patch({ label: e.target.value })}
            placeholder="CraftLauncher"
          />
          <HubColorPicker
            label="Color"
            value={element.style?.textColor ?? ""}
            fallback="#c8cad0"
            onChange={(v) => applyStyle({ textColor: v })}
          />
          <HubNumberField
            label="Tamaño (px)"
            value={element.style?.fontSize ?? 10}
            min={6}
            max={20}
            step={1}
            onCommit={(fontSize) => applyStyle({ fontSize })}
          />
        </PropertySection>
      )}

      {isProgress && (
        <PropertySection title="Barra de progreso" defaultOpen>
          <p className="text-[9px] text-[var(--color-muted)]">
            En el juego avanza sola según la carga real de Minecraft.
          </p>
          <HubColorPicker
            label="Color relleno"
            value={element.style?.textColor ?? ""}
            fallback="#6b9e78"
            onChange={(v) => applyStyle({ textColor: v })}
          />
          <HubColorPicker
            label="Color fondo"
            value={element.style?.backgroundColor ?? ""}
            fallback="#1a1d22"
            onChange={(v) => applyStyle({ backgroundColor: v })}
          />
          <HubNumberField
            label="Grosor (px)"
            value={element.height}
            min={2}
            max={12}
            step={1}
            onCommit={(h) => applyAnchor({ h: Math.max(2, h) })}
          />
        </PropertySection>
      )}

      <PropertySection title="Posición" defaultOpen>
        <div className="grid grid-cols-2 gap-1.5">
          <Select
            compact
            label="Ancla H"
            value={anchors.anchorX}
            onChange={(e) => applyAnchor({ anchorX: e.target.value as AnchorX })}
            options={ANCHOR_X.map((o) => ({ value: o.value, label: o.label }))}
          />
          <Select
            compact
            label="Ancla V"
            value={anchors.anchorY}
            onChange={(e) => applyAnchor({ anchorY: e.target.value as AnchorY })}
            options={ANCHOR_Y.map((o) => ({ value: o.value, label: o.label }))}
          />
          <HubNumberField label="Offset X" value={anchors.offsetX} min={-999} max={999} step={1} onCommit={(v) => applyAnchor({ offsetX: v })} />
          <HubNumberField label="Offset Y" value={anchors.offsetY} min={-999} max={999} step={1} onCommit={(v) => applyAnchor({ offsetY: v })} />
        </div>
        {!isProgress && (
          <div className="grid grid-cols-2 gap-1.5">
            <HubNumberField label="Ancho" value={element.width} min={20} max={480} step={1} onCommit={(w) => applyAnchor({ w })} />
            <HubNumberField label="Alto" value={element.height} min={8} max={40} step={1} onCommit={(h) => applyAnchor({ h })} />
          </div>
        )}
        {isProgress && (
          <HubNumberField
            label="Ancho"
            value={element.width}
            min={40}
            max={480}
            step={1}
            onCommit={(w) => applyAnchor({ w })}
          />
        )}
      </PropertySection>

      <PropertySection title="Pantalla" defaultOpen>
        <HubColorPicker
          label="Fondo"
          value={screen?.backgroundColor ?? ""}
          fallback="#0a0b0d"
          onChange={(v) => screen && updateScreen(screen.id, { backgroundColor: v ?? "#0a0b0d" })}
        />
        <Input
          compact
          label="Imagen fondo (URL)"
          value={screen?.backgroundImage ?? ""}
          onChange={(e) => screen && updateScreen(screen.id, { backgroundImage: e.target.value })}
          placeholder="https://… (opcional, estilo Lunar)"
        />
      </PropertySection>

      <PropertySection title="Visibilidad">
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => toggleVisible(element.id)}
            className="flex flex-1 items-center justify-center gap-1 rounded-md border border-[var(--color-border-subtle)] px-2 py-1.5 text-[10px]"
          >
            {element.visible !== false ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            Visible
          </button>
          <button
            type="button"
            onClick={() => toggleLock(element.id)}
            className="flex flex-1 items-center justify-center gap-1 rounded-md border border-[var(--color-border-subtle)] px-2 py-1.5 text-[10px]"
          >
            {element.locked ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />}
            Bloqueado
          </button>
        </div>
        {element.id === LOADING_PROGRESS_ELEMENT_ID && (
          <p className="text-[9px] text-amber-500/90">Recomendado: mantener al menos una barra de progreso.</p>
        )}
      </PropertySection>
    </div>
  );
}
