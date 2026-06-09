"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { RgbaColorPicker } from "react-colorful";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import {
  formatHubColor,
  hubColorToPickerHex,
  isCssColorLiteral,
  parseHubColor,
  type Rgba,
} from "@/lib/hub-color-utils";

const PRESETS = [
  "transparent",
  "#0a0b0d",
  "#14161a",
  "#496f4f",
  "#d7d8da",
  "#ffffff",
  "rgba(255,255,255,0.06)",
  "rgba(255,255,255,0.12)",
];

type HubColorPickerProps = {
  label: string;
  value: string;
  fallback: string;
  onChange: (value: string | undefined) => void;
  allowTransparent?: boolean;
};

export function HubColorPicker({
  label,
  value,
  fallback,
  onChange,
  allowTransparent = true,
}: HubColorPickerProps) {
  const popoverId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const rgba = parseHubColor(value, fallback);

  const applyRgba = useCallback(
    (next: Rgba) => {
      onChange(formatHubColor(next));
    },
    [onChange]
  );

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const swatchCss =
    rgba.a <= 0
      ? "transparent"
      : rgba.a < 1
        ? formatHubColor(rgba)
        : hubColorToPickerHex(rgba);

  const alphaPct = Math.round(rgba.a * 100);

  return (
    <div ref={rootRef} className="relative space-y-1">
      <label className="text-[10px] font-medium text-[var(--color-text-soft)]">{label}</label>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={popoverId}
          onClick={() => setOpen((o) => !o)}
          className="relative h-8 w-9 shrink-0 overflow-hidden rounded-lg border border-[var(--color-border)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-muted)]"
          title="Abrir selector de color"
        >
          <span
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(45deg, #555 25%, transparent 25%), linear-gradient(-45deg, #555 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #555 75%), linear-gradient(-45deg, transparent 75%, #555 75%)",
              backgroundSize: "6px 6px",
              backgroundPosition: "0 0, 0 3px, 3px -3px, -3px 0",
            }}
          />
          <span className="absolute inset-0" style={{ backgroundColor: swatchCss }} />
        </button>
        <Input
          compact
          value={value}
          onChange={(e) => onChange(e.target.value || undefined)}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (!v) return;
            if (isCssColorLiteral(v)) onChange(formatHubColor(parseHubColor(v, fallback)));
          }}
          placeholder={fallback}
          className="font-mono text-[10px]"
        />
      </div>

      {open && (
        <div
          id={popoverId}
          className="absolute left-0 top-full z-[200] mt-1 w-[220px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-2.5 shadow-xl"
        >
          <div
            className="hub-rgba-picker overflow-hidden rounded-lg"
            style={{ width: "100%", height: 140 }}
          >
            <RgbaColorPicker
              color={rgba}
              onChange={applyRgba}
              style={{ width: "100%", height: "100%" }}
            />
          </div>

          <div className="mt-2 flex items-center gap-2">
            <span className="w-8 shrink-0 text-[9px] font-medium uppercase text-[var(--color-muted)]">
              Alfa
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={alphaPct}
              onChange={(e) => {
                const a = Number(e.target.value) / 100;
                applyRgba({ ...rgba, a });
              }}
              className="h-1.5 flex-1 cursor-pointer accent-[var(--color-accent)]"
            />
            <span className="w-8 text-right font-mono text-[9px] text-[var(--color-text-soft)]">
              {alphaPct}%
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-1">
            {PRESETS.filter((p) => allowTransparent || p !== "transparent").map((preset) => (
              <button
                key={preset}
                type="button"
                title={preset}
                onClick={() => onChange(preset === "transparent" ? "transparent" : preset)}
                className={cn(
                  "h-5 w-5 rounded border border-[var(--color-border-subtle)]",
                  preset === "transparent" &&
                    "bg-[linear-gradient(45deg,#555_25%,transparent_25%),linear-gradient(-45deg,#555_25%,transparent_25%)] bg-[length:6px_6px]"
                )}
                style={
                  preset !== "transparent"
                    ? { backgroundColor: preset }
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
