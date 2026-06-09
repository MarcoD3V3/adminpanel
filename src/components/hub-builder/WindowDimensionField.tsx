"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { AlertTriangle, Minus, Monitor, Plus } from "lucide-react";
import { LAUNCHER_CHROME_HEIGHT } from "@craftlauncher/shared";
import { cn } from "@/lib/utils";

function formatDraft(value: number | undefined): string {
  return value !== undefined && Number.isFinite(value) ? String(Math.round(value)) : "";
}

function parseDraft(raw: string): number | undefined | null {
  const t = raw.trim();
  if (!t) return undefined;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return n;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function WindowDimensionField({
  label,
  value,
  onCommit,
  min = 200,
  max = 3840,
  step = 10,
  placeholder = "Auto",
  hint,
}: {
  label: string;
  value: number | undefined;
  onCommit: (next: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  hint?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState(() => formatDraft(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(formatDraft(value));
  }, [value, focused]);

  const commit = useCallback(
    (raw: string) => {
      const parsed = parseDraft(raw);
      if (parsed === null) {
        setDraft(formatDraft(value));
        return;
      }
      if (parsed === undefined) {
        onCommit(undefined);
        setDraft("");
        return;
      }
      const clamped = clamp(parsed, min, max);
      onCommit(clamped);
      setDraft(String(clamped));
    },
    [max, min, onCommit, value]
  );

  const nudge = (delta: number) => {
    const base = value ?? min;
    const next = clamp(base + delta, min, max);
    onCommit(next);
    setDraft(String(next));
  };

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-[10px] font-medium text-[var(--color-text-soft)]">
        {label}
      </label>
      <div
        className={cn(
          "flex items-stretch overflow-hidden rounded-lg border bg-[var(--color-surface)] transition-colors",
          focused
            ? "border-[var(--color-accent-muted)] ring-1 ring-[var(--color-accent-muted)]/40"
            : "border-[var(--color-border)]"
        )}
      >
        <button
          type="button"
          aria-label={`Reducir ${label}`}
          className="flex w-8 shrink-0 items-center justify-center text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-soft)] disabled:opacity-30"
          disabled={value !== undefined && value <= min}
          onClick={() => nudge(-step)}
        >
          <Minus className="h-3.5 w-3.5" strokeWidth={2} />
        </button>

        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          value={draft}
          onFocus={() => setFocused(true)}
          onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit(draft);
              (e.target as HTMLInputElement).blur();
            }
            if (e.key === "Escape") {
              setDraft(formatDraft(value));
              (e.target as HTMLInputElement).blur();
            }
          }}
          onBlur={() => {
            setFocused(false);
            commit(draft);
          }}
          className="min-w-0 flex-1 border-x border-[var(--color-border-subtle)] bg-transparent px-2 py-1.5 text-center font-mono text-xs text-[var(--color-text)] outline-none placeholder:text-[var(--color-muted)]/50"
        />

        <button
          type="button"
          aria-label={`Aumentar ${label}`}
          className="flex w-8 shrink-0 items-center justify-center text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-soft)] disabled:opacity-30"
          disabled={value !== undefined && value >= max}
          onClick={() => nudge(step)}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>
      {hint && <p className="text-[9px] text-[var(--color-muted)]">{hint}</p>}
    </div>
  );
}

/** Campo numérico del panel Propiedades: edita libremente y aplica con Enter (o al salir del campo). */
export function HubNumberField({
  label,
  value,
  onCommit,
  min,
  max,
  step = 1,
  hint,
}: {
  label: string;
  value: number;
  onCommit: (next: number) => void;
  min: number;
  max: number;
  step?: number;
  hint?: string;
}) {
  return (
    <WindowDimensionField
      label={label}
      value={value}
      onCommit={(next) => {
        if (next !== undefined) onCommit(next);
      }}
      min={min}
      max={max}
      step={step}
      hint={hint ?? `Enter · ±${step}`}
    />
  );
}

function WindowSizeSummary({
  width,
  height,
  screenWidth,
  screenHeight,
  screenName,
  chromeHeight = LAUNCHER_CHROME_HEIGHT,
}: {
  width: number;
  height: number;
  screenWidth: number;
  screenHeight: number;
  screenName: string;
  chromeHeight?: number;
}) {
  const chrome = chromeHeight;
  const contentH = Math.max(80, height - chrome);
  const clippedW = screenWidth > width;
  const clippedH = screenHeight > contentH;
  const clipped = clippedW || clippedH;
  const scale = Math.min(1, 140 / width, 72 / height);

  return (
    <div className="space-y-2 rounded-lg border border-[var(--color-border-subtle)] bg-[#0a0c0f]/80 p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--color-text-soft)]">
        <Monitor className="h-3 w-3 text-[var(--color-accent)]" strokeWidth={1.75} />
        Resumen del marco
      </div>

      <div className="flex gap-3">
        <div
          className="relative shrink-0 rounded-md border-2 border-[var(--color-border)] bg-[#14161a]"
          style={{
            width: Math.round(width * scale),
            height: Math.round(height * scale),
          }}
        >
          <div
            className="absolute inset-x-0 top-0 flex items-center justify-center border-b border-[var(--color-border-subtle)] bg-[#1a1d22] text-[7px] text-[var(--color-muted)]"
            style={{ height: Math.max(6, Math.round(chrome * scale)) }}
          >
            barra
          </div>
          <div
            className="absolute inset-x-0 overflow-hidden bg-[var(--color-accent)]/12"
            style={{
              top: Math.max(6, Math.round(chrome * scale)),
              height: Math.round(contentH * scale),
            }}
          >
            <div
              className="absolute left-0 top-0 border border-dashed border-[var(--color-accent)]/50"
              style={{
                width: Math.round(Math.min(screenWidth, width) * scale),
                height: Math.round(screenHeight * scale),
              }}
            />
            {clipped && (
              <div className="absolute bottom-0 left-0 right-0 h-px bg-amber-500/70" title="Recorte aquí" />
            )}
            <span className="absolute bottom-0.5 left-0.5 z-[1] text-[7px] text-[var(--color-accent)]">área visible</span>
          </div>
        </div>

        <dl className="min-w-0 flex-1 space-y-1 text-[9px]">
          <div className="flex justify-between gap-2">
            <dt className="text-[var(--color-muted)]">Ventana (Electron)</dt>
            <dd className="font-mono text-[var(--color-text-soft)]">
              {width}×{height}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-[var(--color-muted)]">Área en canvas</dt>
            <dd className="font-mono text-[var(--color-accent)]">
              {width}×{contentH}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-[var(--color-muted)]">Pantalla «{screenName}»</dt>
            <dd className="font-mono text-[var(--color-text-soft)]">
              {screenWidth}×{screenHeight}
            </dd>
          </div>
          <div className="flex justify-between gap-2 border-t border-[var(--color-border-subtle)]/60 pt-1">
            <dt className="text-[var(--color-muted)]">Barra superior</dt>
            <dd className="font-mono text-[var(--color-muted)]">−{chrome}px alto</dd>
          </div>
        </dl>
      </div>

      {clipped ? (
        <p className="flex items-start gap-1.5 rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-1.5 text-[9px] leading-snug text-amber-200/90">
          <AlertTriangle className="mt-px h-3 w-3 shrink-0" strokeWidth={2} />
          La pantalla es más grande que el marco: se recortará
          {clippedW && clippedH ? " ancho y alto" : clippedW ? " a los lados" : " abajo"} en el launcher.
        </p>
      ) : (
        <p className="text-[9px] leading-snug text-[var(--color-muted)]">
          La pantalla activa coincide con el área de diseño del canvas.
        </p>
      )}
    </div>
  );
}

function WindowSizeAutoHint({
  screenWidth,
  screenHeight,
  screenName,
}: {
  screenWidth: number;
  screenHeight: number;
  screenName: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-hover)]/50 px-2.5 py-2 text-[9px] leading-snug text-[var(--color-muted)]">
      <span className="font-medium text-[var(--color-text-soft)]">Modo automático</span> — el canvas sigue el
      tamaño de la pantalla activa («{screenName}»: {screenWidth}×{screenHeight}
      {LAUNCHER_CHROME_HEIGHT > 0 ? ` − ${LAUNCHER_CHROME_HEIGHT}px barra launcher` : ""}).
    </div>
  );
}

function detectBrowserWorkArea() {
  if (typeof window === "undefined") return { width: 1920, height: 1080 };
  const sw = window.screen;
  return {
    width: Math.max(320, Math.round(sw?.availWidth ?? sw?.width ?? 1920)),
    height: Math.max(200, Math.round(sw?.availHeight ?? sw?.height ?? 1080)),
  };
}

const PRESETS: { label: string; width?: number; height?: number; borderlessFullscreen?: boolean }[] = [
  { label: "Auto", width: undefined, height: undefined, borderlessFullscreen: false },
  { label: "Pantalla completa", borderlessFullscreen: true },
  { label: "980×520", width: 980, height: 520, borderlessFullscreen: false },
  { label: "980×240", width: 980, height: 240, borderlessFullscreen: false },
  { label: "1280×720", width: 1280, height: 720, borderlessFullscreen: false },
  { label: "800×600", width: 800, height: 600, borderlessFullscreen: false },
];

export function LauncherWindowSizeControls({
  width,
  height,
  borderlessFullscreen = false,
  screenWidth,
  screenHeight,
  screenName = "Inicio",
  chromeHeight = LAUNCHER_CHROME_HEIGHT,
  onWidth,
  onHeight,
  onApplyBoth,
  onApplyPreset,
}: {
  width: number | undefined;
  height: number | undefined;
  borderlessFullscreen?: boolean;
  screenWidth: number;
  screenHeight: number;
  screenName?: string;
  chromeHeight?: number;
  onWidth: (w: number | undefined) => void;
  onHeight: (h: number | undefined) => void;
  onApplyBoth?: (width: number | undefined, height: number | undefined) => void;
  onApplyPreset?: (preset: {
    width?: number;
    height?: number;
    borderlessFullscreen?: boolean;
  }) => void;
}) {
  const bothSet = width !== undefined && height !== undefined;

  return (
    <div className="space-y-3">
      {borderlessFullscreen ? (
        <div className="rounded-lg border border-[var(--color-accent-muted)]/40 bg-[var(--color-accent-soft)]/40 px-2.5 py-2 text-[9px] leading-snug text-[var(--color-text-soft)]">
          <span className="font-medium text-[var(--color-accent)]">Pantalla completa (ventana sin bordes)</span>
          {" — "}en cada PC el launcher ocupará el área útil del monitor
          {bothSet ? ` (referencia de diseño: ${width}×${height})` : ""}.
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <WindowDimensionField
          label="Ancho"
          value={width}
          onCommit={onWidth}
          min={320}
          max={3840}
          step={10}
          hint="Enter · ±10"
        />
        <WindowDimensionField
          label="Alto"
          value={height}
          onCommit={onHeight}
          min={200}
          max={2160}
          step={10}
          hint="Enter · ±10"
        />
      </div>

      {bothSet ? (
        <WindowSizeSummary
          width={width}
          height={height}
          screenWidth={screenWidth}
          screenHeight={screenHeight}
          screenName={screenName}
          chromeHeight={chromeHeight}
        />
      ) : (
        <WindowSizeAutoHint
          screenWidth={screenWidth}
          screenHeight={screenHeight}
          screenName={screenName}
        />
      )}

      <div className="space-y-1">
        <span className="text-[9px] uppercase tracking-wide text-[var(--color-muted)]">Presets</span>
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((p) => {
            const active = p.borderlessFullscreen
              ? borderlessFullscreen
              : p.width === undefined && p.height === undefined
                ? !borderlessFullscreen && width === undefined && height === undefined
                : !borderlessFullscreen && p.width === width && p.height === height;
            return (
              <button
                key={p.label}
                type="button"
                className={cn(
                  "rounded-md border px-2 py-1 font-mono text-[9px] transition-colors",
                  active
                    ? "border-[var(--color-accent-muted)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                    : "border-[var(--color-border-subtle)] text-[var(--color-muted)] hover:border-[var(--color-border)] hover:text-[var(--color-text-soft)]"
                )}
                onClick={() => {
                  if (p.borderlessFullscreen) {
                    const area = detectBrowserWorkArea();
                    if (onApplyPreset) {
                      onApplyPreset({
                        width: area.width,
                        height: area.height,
                        borderlessFullscreen: true,
                      });
                      return;
                    }
                    onApplyBoth?.(area.width, area.height);
                    return;
                  }
                  if (onApplyPreset) {
                    onApplyPreset({
                      width: p.width,
                      height: p.height,
                      borderlessFullscreen: false,
                    });
                    return;
                  }
                  if (onApplyBoth) onApplyBoth(p.width, p.height);
                  else {
                    onWidth(p.width);
                    onHeight(p.height);
                  }
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-[10px] leading-snug text-[var(--color-muted)]">
        <kbd className="rounded border border-[var(--color-border-subtle)] px-1 font-mono text-[9px]">Enter</kbd> aplica al
        canvas. Con ancho y alto definidos, la pantalla activa se ajusta al área visible (ventana − barra).
      </p>
    </div>
  );
}
