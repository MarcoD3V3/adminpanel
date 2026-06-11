"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { HubEditorSettingsModal } from "@/components/hub-builder/HubEditorSettingsModal";
import { Toggle } from "@/components/ui/Toggle";
import { ScreenBar } from "@/components/hub-builder/ScreenBar";
import { cn } from "@/lib/utils";
import {
  Maximize2,
  MousePointer2,
  PanelLeft,
  PanelRight,
  Play,
  Download,
  FolderOpen,
  Redo2,
  RotateCcw,
  Settings,
  Save,
  Check,
  Send,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

function ToolbarDivider({ className }: { className?: string }) {
  return (
    <div
      className={cn("mx-1 hidden h-5 w-px shrink-0 bg-[var(--color-border-subtle)] sm:block", className)}
      aria-hidden
    />
  );
}

function ToolbarGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex shrink-0 items-center gap-0.5", className)}>{children}</div>
  );
}

/** Ancho fijo para una sola etiqueta visible (sin texto fantasma superpuesto). */
function ToolbarStableLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-block shrink-0 text-center whitespace-nowrap", className)}>
      {children}
    </span>
  );
}

interface HubEditorToolbarProps {
  leftOpen: boolean;
  rightOpen: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  showGrid: boolean;
  onToggleGrid: (v: boolean) => void;
  previewMode: boolean;
  onTogglePreview: () => void;
  autoFit: boolean;
  onFit: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  historyIndex: number;
  historyLength: number;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  showJson: boolean;
  onToggleJson: () => void;
  onSave: () => void;
  onPublish: () => void;
  onSaveFile: () => void;
  onLoadFile: () => void;
  onDownloadJson: () => void;
  saved: boolean;
  saveError: boolean;
  published: boolean;
  publishError: boolean;
  publishing?: boolean;
  needsSave?: boolean;
  needsPublish?: boolean;
}

export function HubEditorToolbar({
  leftOpen,
  rightOpen,
  onToggleLeft,
  onToggleRight,
  showGrid,
  onToggleGrid,
  previewMode,
  onTogglePreview,
  autoFit,
  onFit,
  zoom,
  onZoomIn,
  onZoomOut,
  historyIndex,
  historyLength,
  onUndo,
  onRedo,
  onReset,
  showJson,
  onToggleJson,
  onSave,
  onPublish,
  onSaveFile,
  onLoadFile,
  onDownloadJson,
  saved,
  saveError,
  published,
  publishError,
  publishing = false,
  needsSave = false,
  needsPublish = false,
}: HubEditorToolbarProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <header className="shrink-0 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface)]">
      <HubEditorSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {/* Fila 1 — título + ventanas (scroll independiente) */}
      <div className="flex h-10 items-center gap-3 border-b border-[var(--color-border-subtle)]/60 px-4">
        <h1 className="shrink-0 text-sm font-medium text-[var(--color-text)]">Editor Hub</h1>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setSettingsOpen(true)}
          title="Ajustes del editor"
          className="h-7 shrink-0 gap-1.5 px-2 text-[10px] text-[var(--color-muted)] hover:text-[var(--color-text-soft)]"
        >
          <Settings className="h-3.5 w-3.5" strokeWidth={1.5} />
          <span className="hidden sm:inline">Ajustes</span>
        </Button>
        <div className="hidden h-4 w-px shrink-0 bg-[var(--color-border-subtle)] sm:block" />
        <ScreenBar />
      </div>

      {/* Fila 2 — controles fijos, no dependen del nº de ventanas */}
      <div className="flex h-11 items-center justify-between gap-4 overflow-x-auto px-4">
        <ToolbarGroup className="min-w-0">
          <Button size="sm" variant="ghost" onClick={onToggleLeft} title="Paleta">
            <PanelLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
          </Button>
          <Button size="sm" variant="ghost" onClick={onToggleRight} title="Propiedades">
            <PanelRight className="h-3.5 w-3.5" strokeWidth={1.5} />
          </Button>

          <ToolbarDivider />

          <Toggle compact checked={showGrid} onChange={onToggleGrid} label="Grid" />
          <Button
            size="sm"
            variant={previewMode ? "secondary" : "ghost"}
            onClick={onTogglePreview}
            title="Probar clics — abre ventanas y ejecuta acciones"
            className="shrink-0"
          >
            {previewMode ? (
              <MousePointer2 className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
            ) : (
              <Play className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
            )}
            <ToolbarStableLabel className="w-[2.85rem]">
              {previewMode ? "Editar" : "Probar"}
            </ToolbarStableLabel>
          </Button>
          <Button size="sm" variant={autoFit ? "secondary" : "ghost"} onClick={onFit} title="Ajustar a pantalla">
            <Maximize2 className="h-3.5 w-3.5" strokeWidth={1.5} />
          </Button>

          <ToolbarDivider />

          <Button size="sm" variant="ghost" onClick={onZoomOut} title="Alejar">
            <ZoomOut className="h-3.5 w-3.5" strokeWidth={1.5} />
          </Button>
          <span className="w-10 shrink-0 text-center text-[11px] tabular-nums text-[var(--color-muted)]">
            {Math.round(zoom * 100)}%
          </span>
          <Button size="sm" variant="ghost" onClick={onZoomIn} title="Acercar">
            <ZoomIn className="h-3.5 w-3.5" strokeWidth={1.5} />
          </Button>
        </ToolbarGroup>

        <ToolbarGroup className="ml-auto">
          <Button size="sm" variant="ghost" onClick={onUndo} disabled={historyIndex <= 0} title="Deshacer">
            <Undo2 className="h-3.5 w-3.5" strokeWidth={1.5} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onRedo}
            disabled={historyIndex >= historyLength - 1}
            title="Rehacer"
          >
            <Redo2 className="h-3.5 w-3.5" strokeWidth={1.5} />
          </Button>
          <Button size="sm" variant="ghost" onClick={onReset} title="Restablecer layout">
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
          </Button>

          <ToolbarDivider />

          <Button size="sm" variant={showJson ? "secondary" : "outline"} onClick={onToggleJson}>
            JSON
          </Button>
          <Button size="sm" variant="outline" onClick={onSaveFile} title="Guardar en tu PC y en data/hub-layouts">
            <Save className="h-3.5 w-3.5" strokeWidth={1.5} />
            Archivo
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onLoadFile}
            title="Abrir layout firmado (.json) — rechaza archivos editados a mano"
          >
            <FolderOpen className="h-3.5 w-3.5" strokeWidth={1.5} />
            Cargar
          </Button>
          <Button size="sm" variant="outline" onClick={onDownloadJson} title="Descargar JSON firmado digitalmente">
            <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onSave}
            title={
              saveError
                ? "Error al guardar"
                : needsSave
                  ? "Cambios sin guardar (navegador + borrador servidor)"
                  : undefined
            }
            className={cn(
              "shrink-0",
              needsSave &&
                !saved &&
                !saveError &&
                "border-[var(--color-muted)] text-[var(--color-text)]",
              saved && "border-[var(--color-border)] text-[var(--color-accent-muted)]",
              saveError && "border-[var(--color-danger-text)]/40 text-[var(--color-danger-text)]"
            )}
          >
            <Save className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
            <ToolbarStableLabel className="w-[4.65rem]">
              {saved ? "Guardado" : saveError ? "Error" : "Guardar"}
            </ToolbarStableLabel>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onPublish}
            disabled={publishing}
            title={
              publishError
                ? "Guardado en este navegador; el servidor no respondió"
                : needsPublish && !published && !publishing
                  ? "Cambios sin publicar — el launcher no los verá"
                  : published
                    ? "Publicado"
                    : undefined
            }
            className={cn(
              "shrink-0",
              needsPublish &&
                !published &&
                !publishError &&
                !publishing &&
                "border-[var(--color-accent-muted)]/45 bg-[var(--color-accent-soft)]/50 text-[var(--color-text)]",
              published &&
                "border-[var(--color-accent-muted)]/35 text-[var(--color-accent-muted)]",
              publishError && !published && "border-[var(--color-danger-text)]/40 text-[var(--color-danger-text)]"
            )}
          >
            {published ? (
              <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
            ) : (
              <Send className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
            )}
            <ToolbarStableLabel className="w-[5.85rem]">
              {publishing
                ? "Publicando…"
                : published
                  ? "Publicado"
                  : publishError
                    ? "Solo local"
                    : "Publicar"}
            </ToolbarStableLabel>
          </Button>
        </ToolbarGroup>
      </div>
    </header>
  );
}
