"use client";

import type { PaletteCategory } from "@/types/hub-builder";
import { isHomeScreen } from "@craftlauncher/shared";
import {
  getPaletteByCategory,
  LOGIC_SCRIPT_TEMPLATES,
  paletteCategoryLabels,
} from "@/lib/hub-builder-data";
import { useHubBuilderStore } from "@/lib/hub-builder-store";
import type { MenuItemDef } from "@/components/hub-builder/HubContextMenu";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Clipboard,
  Copy,
  Eye,
  EyeOff,
  Grid3X3,
  Layers,
  Lock,
  Maximize2,
  Play,
  Plus,
  Redo2,
  Settings,
  Trash2,
  Unlock,
  ZoomIn,
  Star,
  Pencil,
} from "lucide-react";

const CATEGORIES: PaletteCategory[] = [
  "basic",
  "content",
  "layout",
  "logic",
  "instances",
  "account",
  "launch",
];

function paletteSubmenu(onAdd: (paletteId: string) => void, label = "Añadir componente"): MenuItemDef {
  return {
    id: "add-component",
    label,
    icon: Plus,
    children: CATEGORIES.map((cat) => ({
      id: `cat-${cat}`,
      label: paletteCategoryLabels[cat],
      children: getPaletteByCategory(cat).map((item) => ({
        id: `add-${item.id}`,
        label: item.label,
        onClick: () => onAdd(item.id),
      })),
    })),
  };
}

export function buildCanvasContextMenu(canvasX: number, canvasY: number): MenuItemDef[] {
  const store = useHubBuilderStore.getState();
  const { clipboard, showGrid, zoom, autoFit } = store;

  const addAt = (paletteId: string) => {
    store.addElementAt(paletteId, canvasX, canvasY);
    store.closeContextMenu();
  };

  return [
    paletteSubmenu(addAt),
    { id: "sep1", separator: true },
    {
      id: "edit-screen",
      label: "Editar pantalla",
      icon: Settings,
      children: [
        {
          id: "screen-bg",
          label: "Seleccionar pantalla",
          onClick: () => {
            store.selectElement(null);
            store.closeContextMenu();
          },
        },
        {
          id: "toggle-grid",
          label: showGrid ? "Ocultar grid" : "Mostrar grid",
          icon: Grid3X3,
          checked: showGrid,
          onClick: () => {
            store.setShowGrid(!showGrid);
            store.closeContextMenu();
          },
        },
        {
          id: "clear-selection",
          label: "Limpiar selección",
          onClick: () => {
            store.selectElement(null);
            store.closeContextMenu();
          },
        },
      ],
    },
    {
      id: "paste",
      label: "Pegar aquí",
      icon: Clipboard,
      shortcut: "Ctrl+V",
      disabled: !clipboard,
      onClick: () => {
        store.pasteElement(canvasX, canvasY);
        store.closeContextMenu();
      },
    },
    { id: "sep2", separator: true },
    {
      id: "view",
      label: "Vista",
      icon: ZoomIn,
      children: [
        {
          id: "fit",
          label: "Ajustar a pantalla",
          icon: Maximize2,
          checked: autoFit,
          onClick: () => {
            store.setAutoFit(true);
            store.closeContextMenu();
          },
        },
        {
          id: "zoom-50",
          label: "Zoom 50%",
          onClick: () => {
            store.setZoom(0.5);
            store.closeContextMenu();
          },
        },
        {
          id: "zoom-100",
          label: "Zoom 100%",
          onClick: () => {
            store.setZoom(1);
            store.closeContextMenu();
          },
        },
        {
          id: "zoom-150",
          label: "Zoom 150%",
          onClick: () => {
            store.setZoom(1.5);
            store.closeContextMenu();
          },
        },
        ...(store.editTarget === "launcher-chrome"
          ? ([
              {
                id: "zoom-200",
                label: "Zoom 200%",
                onClick: () => {
                  store.setZoom(2);
                  store.closeContextMenu();
                },
              },
              {
                id: "zoom-300",
                label: "Zoom 300%",
                onClick: () => {
                  store.setZoom(3);
                  store.closeContextMenu();
                },
              },
              {
                id: "zoom-400",
                label: "Zoom 400%",
                onClick: () => {
                  store.setZoom(4);
                  store.closeContextMenu();
                },
              },
            ] as const)
          : []),
      ],
    },
    {
      id: "zoom-current",
      label: `Zoom actual: ${Math.round(zoom * 100)}%`,
      disabled: true,
    },
  ];
}

export function buildElementContextMenu(elementId: string, canvasX?: number, canvasY?: number): MenuItemDef[] {
  const store = useHubBuilderStore.getState();
  const screen = store.getActiveScreen();
  const el = screen.elements.find((e) => e.id === elementId);
  if (!el) return [];

  const close = () => store.closeContextMenu();
  const isMulti = (store.selectedIds ?? []).length > 1 && (store.selectedIds ?? []).includes(elementId);
  const ids = isMulti ? (store.selectedIds ?? []) : [elementId];
  const addNear = (paletteId: string) => {
    const x = canvasX ?? el.x + 8;
    const y = canvasY ?? el.y + el.height + 8;
    store.addElementAt(paletteId, x, y);
    close();
  };

  const logicChildren: MenuItemDef[] = [
    {
      id: "logic-toggle",
      label: el.logic?.enabled ? "Desactivar lógica" : "Activar lógica",
      onClick: () => {
        store.updateElement(elementId, {
          logic: {
            enabled: !el.logic?.enabled,
            trigger: el.logic?.trigger ?? "click",
            script: el.logic?.script ?? 'ctx.log("ok");',
          },
        });
        close();
      },
    },
    {
      id: "logic-run",
      label: "Ejecutar script ahora",
      icon: Play,
      disabled: !el.logic?.script,
      onClick: () => {
        void store.runElementLogic(elementId);
        close();
      },
    },
    {
      id: "logic-templates",
      label: "Plantillas de script",
      children: LOGIC_SCRIPT_TEMPLATES.map((t, i) => ({
        id: `tpl-${i}`,
        label: t.label,
        onClick: () => {
          store.updateElement(elementId, {
            logic: {
              enabled: true,
              trigger: el.logic?.trigger ?? "click",
              script: t.script,
              intervalMs: el.logic?.intervalMs,
              apiUrl: el.logic?.apiUrl,
              apiMethod: el.logic?.apiMethod,
            },
          });
          close();
        },
      })),
    },
    {
      id: "logic-enable-script",
      label: "Añadir lógica (script vacío)",
      onClick: () => {
        store.updateElement(elementId, {
          logic: {
            enabled: true,
            trigger: "click",
            script: 'ctx.log("Script de", ctx.element.label);',
          },
        });
        close();
      },
    },
  ];

  return [
    paletteSubmenu(addNear, "Añadir cerca"),
    { id: "sep0", separator: true },
    {
      id: "layers",
      label: "Capas",
      icon: Layers,
      children: [
        { id: "front", label: "Traer al frente", onClick: () => { store.bringToFront(elementId); close(); } },
        { id: "back", label: "Enviar atrás", onClick: () => { store.sendToBack(elementId); close(); } },
        { id: "up", label: "Subir capa", icon: ArrowUp, onClick: () => { store.reorderElement(elementId, "up"); close(); } },
        { id: "down", label: "Bajar capa", icon: ArrowDown, onClick: () => { store.reorderElement(elementId, "down"); close(); } },
      ],
    },
    {
      id: "align",
      label: "Alinear en pantalla",
      children: [
        { id: "al", label: "Izquierda", icon: AlignLeft, onClick: () => { store.alignElement(elementId, "left"); close(); } },
        { id: "ach", label: "Centro horizontal", icon: AlignCenter, onClick: () => { store.alignElement(elementId, "center-h"); close(); } },
        { id: "ar", label: "Derecha", icon: AlignRight, onClick: () => { store.alignElement(elementId, "right"); close(); } },
        { id: "sep-a", separator: true },
        { id: "at", label: "Arriba", onClick: () => { store.alignElement(elementId, "top"); close(); } },
        { id: "acv", label: "Centro vertical", onClick: () => { store.alignElement(elementId, "center-v"); close(); } },
        { id: "ab", label: "Abajo", onClick: () => { store.alignElement(elementId, "bottom"); close(); } },
      ],
    },
    {
      id: "logic",
      label: "Lógica y scripts",
      icon: Play,
      children: logicChildren,
    },
    { id: "sep1", separator: true },
    {
      id: "copy",
      label: "Copiar",
      icon: Copy,
      shortcut: "Ctrl+C",
      onClick: () => { store.copyElement(elementId); close(); },
    },
    {
      id: "duplicate",
      label: "Duplicar",
      icon: Redo2,
      onClick: () => { store.duplicateElement(elementId); close(); },
    },
    {
      id: "paste-near",
      label: "Pegar dentro",
      icon: Clipboard,
      disabled: !store.clipboard,
      onClick: () => {
        store.pasteElement(undefined, undefined, elementId);
        close();
      },
    },
    { id: "sep2", separator: true },
    {
      id: "lock",
      label: el.locked ? "Desbloquear" : "Bloquear",
      icon: el.locked ? Unlock : Lock,
      onClick: () => { store.toggleLock(elementId); close(); },
    },
    {
      id: "visible",
      label: el.visible ? "Ocultar" : "Mostrar",
      icon: el.visible ? EyeOff : Eye,
      onClick: () => { store.toggleVisible(elementId); close(); },
    },
    { id: "sep3", separator: true },
    {
      id: "delete",
      label: "Eliminar",
      icon: Trash2,
      danger: true,
      shortcut: "Del",
      onClick: () => { store.removeElements(ids); close(); },
    },
  ];
}

export function buildScreenTabContextMenu(screenId: string): MenuItemDef[] {
  const store = useHubBuilderStore.getState();
  const layout = store.layout;
  const screen = layout.screens.find((s) => s.id === screenId);
  if (!screen) return [];

  const close = () => store.closeContextMenu();
  const isHome = isHomeScreen(layout, screenId);
  const canDelete = layout.screens.length > 1;

  return [
    {
      id: "screen-open",
      label: "Abrir esta ventana",
      onClick: () => {
        store.setEditTarget("screen");
        store.setActiveScreen(screenId);
        close();
      },
    },
    {
      id: "screen-set-home",
      label: isHome ? "Ventana principal (activa)" : "Establecer como ventana principal",
      icon: Star,
      checked: isHome,
      onClick: () => {
        if (!isHome) {
          store.updateLayout({ ui: { homeScreenId: screenId } });
        }
        close();
      },
    },
    { id: "screen-sep1", separator: true },
    {
      id: "screen-rename",
      label: "Renombrar ventana…",
      icon: Pencil,
      onClick: () => {
        const next = window.prompt("Nombre de la ventana", screen.name);
        if (next?.trim()) {
          store.updateScreen(screenId, { name: next.trim() });
        }
        close();
      },
    },
    {
      id: "screen-duplicate",
      label: "Duplicar ventana",
      icon: Copy,
      onClick: () => {
        store.duplicateScreen(screenId);
        close();
      },
    },
    { id: "screen-sep2", separator: true },
    {
      id: "screen-delete",
      label: "Eliminar ventana",
      icon: Trash2,
      danger: true,
      disabled: !canDelete,
      onClick: () => {
        if (canDelete) store.removeScreen(screenId);
        close();
      },
    },
  ];
}

export function getContextMenuItems(): MenuItemDef[] {
  const menu = useHubBuilderStore.getState().contextMenu;
  if (!menu?.open) return [];

  if (menu.target === "screen" && menu.screenId) {
    return buildScreenTabContextMenu(menu.screenId);
  }

  if (menu.target === "element" && menu.elementId) {
    return buildElementContextMenu(menu.elementId, menu.canvasX, menu.canvasY);
  }

  return buildCanvasContextMenu(menu.canvasX ?? 0, menu.canvasY ?? 0);
}
