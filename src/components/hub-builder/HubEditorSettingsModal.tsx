"use client";

import { useEffect } from "react";
import { Settings, X } from "lucide-react";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { HubColorPicker } from "@/components/hub-builder/HubColorPicker";
import { HubNumberField } from "@/components/hub-builder/WindowDimensionField";
import { useHubBuilderStore } from "@/lib/hub-builder-store";
import {
  DEFAULT_HUB_EDITOR_CANVAS_SETTINGS,
  resolveHubCanvasGridOverlayStyle,
  resolveHubEditorCanvasStyle,
  type HubEditorCanvasSettings,
} from "@/lib/hub-editor-canvas-settings";

type HubEditorSettingsModalProps = {
  open: boolean;
  onClose: () => void;
};

function SettingHint({ children }: { children: React.ReactNode }) {
  return <p className="text-[9px] leading-snug text-[var(--color-muted)]">{children}</p>;
}

export function HubEditorSettingsModal({ open, onClose }: HubEditorSettingsModalProps) {
  const settings = useHubBuilderStore((s) => s.editorCanvasSettings);
  const updateEditorCanvasSettings = useHubBuilderStore((s) => s.updateEditorCanvasSettings);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const patch = (data: Partial<HubEditorCanvasSettings>) => updateEditorCanvasSettings(data);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Cerrar ajustes"
        className="absolute inset-0 bg-black/65"
        onClick={onClose}
      />

      <div className="relative z-10 flex max-h-[min(90dvh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border-subtle)] px-4 py-3">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-[var(--color-accent)]" strokeWidth={1.5} />
            <div>
              <h2 className="text-sm font-medium text-[var(--color-text)]">Ajustes del Editor Hub</h2>
              <p className="text-[10px] text-[var(--color-muted)]">Preferencias locales del editor (no se publican)</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-soft)]"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <section className="space-y-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-muted)]">Canvas</p>
              <p className="mt-0.5 text-[10px] text-[var(--color-text-soft)]">
                Fondo del área de trabajo donde editas el launcher.
              </p>
            </div>

            <Select
              compact
              label="1. Tipo de fondo"
              value={settings.backgroundType}
              onChange={(e) => {
                const backgroundType = e.target.value as HubEditorCanvasSettings["backgroundType"];
                const next: Partial<HubEditorCanvasSettings> = { backgroundType };
                if (backgroundType === "pattern" && settings.patternType === "none") {
                  next.patternType = "dots";
                }
                patch(next);
              }}
              options={[
                { value: "solid", label: "Color sólido" },
                { value: "gradient", label: "Gradiente" },
                { value: "image", label: "Imagen" },
                { value: "pattern", label: "Patrón" },
              ]}
            />

            <HubColorPicker
              label="2. Color base"
              value={settings.solidColor}
              fallback={DEFAULT_HUB_EDITOR_CANVAS_SETTINGS.solidColor}
              onChange={(v) => patch({ solidColor: v ?? DEFAULT_HUB_EDITOR_CANVAS_SETTINGS.solidColor })}
              allowTransparent={false}
            />
            <SettingHint>Color de respaldo y base cuando usas imagen o patrón.</SettingHint>

            <div className="grid grid-cols-2 gap-2">
              <HubColorPicker
                label="3. Gradiente inicio"
                value={settings.gradientFrom}
                fallback={DEFAULT_HUB_EDITOR_CANVAS_SETTINGS.gradientFrom}
                onChange={(v) => patch({ gradientFrom: v ?? DEFAULT_HUB_EDITOR_CANVAS_SETTINGS.gradientFrom })}
                allowTransparent={false}
              />
              <HubColorPicker
                label="4. Gradiente fin"
                value={settings.gradientTo}
                fallback={DEFAULT_HUB_EDITOR_CANVAS_SETTINGS.gradientTo}
                onChange={(v) => patch({ gradientTo: v ?? DEFAULT_HUB_EDITOR_CANVAS_SETTINGS.gradientTo })}
                allowTransparent={false}
              />
            </div>
            <Select
              compact
              label="5. Dirección del gradiente"
              value={settings.gradientDirection}
              onChange={(e) =>
                patch({
                  gradientDirection: e.target.value as HubEditorCanvasSettings["gradientDirection"],
                })
              }
              options={[
                { value: "horizontal", label: "Horizontal →" },
                { value: "vertical", label: "Vertical ↓" },
                { value: "diagonal", label: "Diagonal ↘" },
                { value: "diagonal-reverse", label: "Diagonal ↗" },
                { value: "radial", label: "Radial (centro)" },
              ]}
            />
            <SettingHint>Activo cuando el tipo es «Gradiente».</SettingHint>

            <Input
              compact
              label="6. URL de imagen"
              value={settings.imageUrl}
              onChange={(e) => patch({ imageUrl: e.target.value })}
              placeholder="https://..."
            />
            <Select
              compact
              label="7. Ajuste de imagen"
              value={settings.imageFit}
              onChange={(e) => patch({ imageFit: e.target.value as HubEditorCanvasSettings["imageFit"] })}
              options={[
                { value: "cover", label: "Cubrir (cover)" },
                { value: "contain", label: "Contener (contain)" },
                { value: "repeat", label: "Repetir (mosaico)" },
                { value: "stretch", label: "Estirar" },
              ]}
            />
            <HubNumberField
              label="8. Opacidad de imagen %"
              value={settings.imageOpacity}
              min={0}
              max={100}
              step={5}
              onCommit={(imageOpacity) => patch({ imageOpacity })}
            />
            <SettingHint>Activo cuando el tipo es «Imagen».</SettingHint>

            <Select
              compact
              label="9. Tipo de patrón"
              value={settings.patternType}
              onChange={(e) =>
                patch({ patternType: e.target.value as HubEditorCanvasSettings["patternType"] })
              }
              options={[
                { value: "none", label: "Sin patrón" },
                { value: "dots", label: "Puntos" },
                { value: "grid", label: "Cuadrícula" },
                { value: "lines", label: "Líneas diagonales" },
              ]}
            />

            <HubColorPicker
              label="10. Color del patrón"
              value={settings.patternColor}
              fallback={DEFAULT_HUB_EDITOR_CANVAS_SETTINGS.patternColor}
              onChange={(v) => patch({ patternColor: v ?? DEFAULT_HUB_EDITOR_CANVAS_SETTINGS.patternColor })}
            />
            <div className="grid grid-cols-2 gap-2">
              <HubNumberField
                label="11. Tamaño patrón (px)"
                value={settings.patternSize}
                min={8}
                max={64}
                step={2}
                onCommit={(patternSize) => patch({ patternSize })}
              />
              <HubNumberField
                label="12. Opacidad patrón %"
                value={settings.patternOpacity}
                min={0}
                max={100}
                step={5}
                onCommit={(patternOpacity) => patch({ patternOpacity })}
              />
            </div>
            <SettingHint>El patrón se aplica como textura encima del fondo elegido.</SettingHint>

            <div
              className="mt-2 h-20 overflow-hidden rounded-lg border border-[var(--color-border-subtle)]"
              style={resolveHubEditorCanvasStyle(settings)}
            />
          </section>

          <section className="mt-5 space-y-3 border-t border-[var(--color-border-subtle)]/70 pt-4">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-muted)]">
                Cuadrícula
              </p>
              <p className="mt-0.5 text-[10px] text-[var(--color-text-soft)]">
                El snap controla el movimiento; la guía visual es independiente.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <HubNumberField
                label="Paso snap pantalla (px)"
                value={settings.snapGridSize}
                min={1}
                max={64}
                step={1}
                onCommit={(snapGridSize) => patch({ snapGridSize })}
              />
              <HubNumberField
                label="Paso snap barra (px)"
                value={settings.snapChromeGridSize}
                min={1}
                max={32}
                step={1}
                onCommit={(snapChromeGridSize) => patch({ snapChromeGridSize })}
              />
            </div>
            <SettingHint>Cuánto «saltan» los elementos al arrastrar o con las flechas.</SettingHint>

            <Select
              compact
              label="Estilo guía visual"
              value={settings.visualGridStyle}
              onChange={(e) =>
                patch({ visualGridStyle: e.target.value as HubEditorCanvasSettings["visualGridStyle"] })
              }
              options={[
                { value: "dots", label: "Puntos" },
                { value: "lines", label: "Líneas horizontales" },
                { value: "cross", label: "Cuadrícula (cruz)" },
              ]}
            />

            <div className="grid grid-cols-2 gap-2">
              <HubNumberField
                label="Separación visual (px)"
                value={settings.visualGridStep}
                min={4}
                max={128}
                step={2}
                onCommit={(visualGridStep) => patch({ visualGridStep })}
              />
              <HubNumberField
                label="Tamaño punto (px)"
                value={settings.visualGridDotSize}
                min={0.5}
                max={8}
                step={0.5}
                onCommit={(visualGridDotSize) => patch({ visualGridDotSize })}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <HubNumberField
                label="Grosor línea (px)"
                value={settings.visualGridLineWidth}
                min={0.5}
                max={4}
                step={0.5}
                onCommit={(visualGridLineWidth) => patch({ visualGridLineWidth })}
              />
              <HubNumberField
                label="Opacidad guía %"
                value={settings.visualGridOpacity}
                min={0}
                max={100}
                step={5}
                onCommit={(visualGridOpacity) => patch({ visualGridOpacity })}
              />
            </div>

            <HubColorPicker
              label="Color guía visual"
              value={settings.visualGridColor}
              fallback={DEFAULT_HUB_EDITOR_CANVAS_SETTINGS.visualGridColor}
              onChange={(v) => patch({ visualGridColor: v ?? DEFAULT_HUB_EDITOR_CANVAS_SETTINGS.visualGridColor })}
            />

            <div className="grid grid-cols-2 gap-2">
              <HubNumberField
                label="Desplazamiento X (px)"
                value={settings.visualGridOffsetX}
                min={-64}
                max={64}
                step={1}
                onCommit={(visualGridOffsetX) => patch({ visualGridOffsetX })}
              />
              <HubNumberField
                label="Desplazamiento Y (px)"
                value={settings.visualGridOffsetY}
                min={-64}
                max={64}
                step={1}
                onCommit={(visualGridOffsetY) => patch({ visualGridOffsetY })}
              />
            </div>
            <SettingHint>
              La separación y el tamaño del punto/línea no cambian el paso de movimiento.
            </SettingHint>

            <div
              className="relative mt-2 h-20 overflow-hidden rounded-lg border border-[var(--color-border-subtle)] bg-[#14161a]"
              style={resolveHubCanvasGridOverlayStyle(settings, false)}
            />
          </section>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[var(--color-border-subtle)] px-4 py-3">
          <Button
            size="sm"
            variant="ghost"
            className="text-[10px]"
            onClick={() => updateEditorCanvasSettings(DEFAULT_HUB_EDITOR_CANVAS_SETTINGS)}
          >
            Restablecer todo
          </Button>
          <Button size="sm" variant="secondary" onClick={onClose}>
            Listo
          </Button>
        </div>
      </div>
    </div>
  );
}
