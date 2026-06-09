import type { HubElement } from "../types/hub-layout";
import type { HubContentAlign } from "../types/hub-layout";
import type { LauncherInstance } from "../types/launcher-config";
import {
  resolveHubContentAlignX,
  resolveHubContentAlignY,
} from "./hub-content-layout";
import { HUB_UI_CONSTANT_KEYS, hubGridStyle, resolveHubElementUi, type HubElementUi } from "./hub-element-ui";

export const DEFAULT_INSTANCE_ICON_COLOR = "#496f4f";

/** Paleta alineada con la vista previa del Hub Builder. */
export const INSTANCE_ICON_PALETTE = [
  "#c9a227",
  "#3d5a45",
  "#e67e22",
  "#496f4f",
  "#d4a574",
  "#5c8a61",
  "#c75050",
  "#6b5b95",
] as const;

export function resolveInstanceIconColor(
  instance: Pick<LauncherInstance, "name" | "id" | "iconColor">
): string {
  const custom = instance.iconColor?.trim();
  if (custom) return custom;
  const key = instance.name?.trim() || instance.id;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = ((h << 5) - h + key.charCodeAt(i)) | 0;
  return INSTANCE_ICON_PALETTE[Math.abs(h) % INSTANCE_ICON_PALETTE.length];
}

export type InstanceSortMode = "name" | "created-desc" | "created-asc" | "custom";
export type InstanceAvatarLayoutMode = "column" | "row" | "grid";
export type InstanceAvatarAlign = "start" | "center" | "end" | "stretch";
export type InstanceAvatarDistribute = "start" | "center" | "end" | "between" | "evenly";

export const INSTANCE_SORT_OPTIONS = [
  { value: "name", label: "Nombre (A–Z)" },
  { value: "created-desc", label: "Más recientes" },
  { value: "created-asc", label: "Más antiguos" },
  { value: "custom", label: "Orden personalizado" },
] as const;

export const INSTANCE_AVATAR_LAYOUT_OPTIONS = [
  { value: "column", label: "Columna (vertical)" },
  { value: "row", label: "Fila (horizontal)" },
  { value: "grid", label: "Grid responsive" },
] as const;

export const INSTANCE_AVATAR_ALIGN_OPTIONS = [
  { value: "start", label: "Inicio" },
  { value: "center", label: "Centro" },
  { value: "end", label: "Final" },
  { value: "stretch", label: "Estirar" },
] as const;

export const INSTANCE_AVATAR_DISTRIBUTE_OPTIONS = [
  { value: "start", label: "Inicio" },
  { value: "center", label: "Centro" },
  { value: "end", label: "Final" },
  { value: "between", label: "Espaciado entre" },
  { value: "evenly", label: "Espaciado uniforme" },
] as const;

export type InstanceAvatarLayoutConfig = {
  avatarSize: number;
  mode: InstanceAvatarLayoutMode;
  itemAlign: InstanceAvatarAlign;
  distribute: InstanceAvatarDistribute;
  groupGap: number;
  groupsRaw: string;
};

function readConst(constants: Record<string, unknown> | undefined, key: string): string {
  const v = constants?.[key];
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function readAlign(raw: string, fallback: InstanceAvatarAlign): InstanceAvatarAlign {
  return INSTANCE_AVATAR_ALIGN_OPTIONS.some((o) => o.value === raw)
    ? (raw as InstanceAvatarAlign)
    : fallback;
}

function readDistribute(raw: string): InstanceAvatarDistribute {
  return INSTANCE_AVATAR_DISTRIBUTE_OPTIONS.some((o) => o.value === raw)
    ? (raw as InstanceAvatarDistribute)
    : "start";
}

function readLayout(raw: string, elementType: HubElement["type"]): InstanceAvatarLayoutMode {
  if (INSTANCE_AVATAR_LAYOUT_OPTIONS.some((o) => o.value === raw)) {
    return raw as InstanceAvatarLayoutMode;
  }
  return elementType === "instance-avatar-grid" ? "column" : "column";
}

function toFlexAlign(value: InstanceAvatarAlign): string {
  if (value === "start") return "flex-start";
  if (value === "end") return "flex-end";
  if (value === "stretch") return "stretch";
  return "center";
}

function toFlexJustify(value: InstanceAvatarDistribute): string {
  if (value === "between") return "space-between";
  if (value === "evenly") return "space-evenly";
  return toFlexAlign(value as InstanceAvatarAlign);
}

export function instanceAvatarInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  return trimmed.charAt(0).toUpperCase();
}

export function resolveInstanceSort(element: HubElement): {
  sort: InstanceSortMode;
  order: string;
} {
  const raw = readConst(element.logic?.constants, HUB_UI_CONSTANT_KEYS.INSTANCE_SORT) || "name";
  const sort = (INSTANCE_SORT_OPTIONS.some((o) => o.value === raw) ? raw : "name") as InstanceSortMode;
  return {
    sort,
    order: readConst(element.logic?.constants, HUB_UI_CONSTANT_KEYS.INSTANCE_ORDER),
  };
}

export function resolveInstanceAvatarSize(element: HubElement): number {
  const raw = parseInt(readConst(element.logic?.constants, HUB_UI_CONSTANT_KEYS.AVATAR_SIZE) || "0", 10);
  return Number.isFinite(raw) ? Math.min(128, Math.max(0, raw)) : 0;
}

/** Tamaño en px siempre definido (evita avatares cuadrados/estirados en el Hub). */
export function resolveInstanceAvatarRenderSize(
  element: HubElement,
  layout: InstanceAvatarLayoutConfig
): number {
  if (layout.avatarSize > 0) return layout.avatarSize;
  const boxW = Math.max(24, element.width ?? 48);
  const boxH = Math.max(24, element.height ?? 48);
  return Math.max(24, Math.min(128, Math.min(boxW, boxH) - 4));
}

export function resolveInstanceAvatarLayout(element: HubElement): InstanceAvatarLayoutConfig {
  const c = element.logic?.constants;
  const groupGapRaw = parseInt(readConst(c, HUB_UI_CONSTANT_KEYS.AVATAR_GROUP_GAP) || "12", 10);
  return {
    avatarSize: resolveInstanceAvatarSize(element),
    mode: readLayout(readConst(c, HUB_UI_CONSTANT_KEYS.AVATAR_LAYOUT), element.type),
    itemAlign: readAlign(readConst(c, HUB_UI_CONSTANT_KEYS.AVATAR_ITEM_ALIGN), "center"),
    distribute: readDistribute(readConst(c, HUB_UI_CONSTANT_KEYS.AVATAR_DISTRIBUTE)),
    groupGap: Number.isFinite(groupGapRaw) ? Math.min(48, Math.max(0, groupGapRaw)) : 12,
    groupsRaw: readConst(c, HUB_UI_CONSTANT_KEYS.INSTANCE_GROUPS),
  };
}

/** Grupos: líneas o bloques separados por `;`. Opcional etiqueta `nombre: id1, id2`. */
export function parseInstanceGroupIds(raw: string): string[][] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  return trimmed
    .split(/[;\n]+/)
    .map((chunk) => {
      const part = chunk.trim();
      if (!part) return [];
      const colon = part.indexOf(":");
      const idsPart = colon >= 0 ? part.slice(colon + 1) : part;
      return idsPart
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    })
    .filter((group) => group.length > 0);
}

export function bucketInstancesByGroups(
  instances: LauncherInstance[],
  groupSpecs: string[][],
  sort: InstanceSortMode,
  order: string
): LauncherInstance[][] {
  const sorted = sortLauncherInstances(instances, sort, order);
  if (!groupSpecs.length) return [sorted];

  const used = new Set<string>();
  const buckets: LauncherInstance[][] = [];

  for (const spec of groupSpecs) {
    const group: LauncherInstance[] = [];
    for (const id of spec) {
      const inst = sorted.find((i) => i.id === id);
      if (inst && !used.has(id)) {
        group.push(inst);
        used.add(id);
      }
    }
    if (group.length) buckets.push(group);
  }

  const rest = sorted.filter((i) => !used.has(i.id));
  if (rest.length) buckets.push(rest);
  return buckets;
}

export function resolveInstanceAvatarBuckets(
  instances: LauncherInstance[],
  element: HubElement
): LauncherInstance[][] {
  const { sort, order } = resolveInstanceSort(element);
  const layout = resolveInstanceAvatarLayout(element);
  const groups = parseInstanceGroupIds(layout.groupsRaw);
  return bucketInstancesByGroups(instances, groups, sort, order);
}

function resolveFlexCrossAlign(
  layoutValue: InstanceAvatarAlign,
  contentValue: HubContentAlign
): string {
  if (layoutValue === "stretch") return toFlexAlign("stretch");
  if (layoutValue === "end") return toFlexAlign("end");
  if (layoutValue === "center") return toFlexAlign("center");
  return toFlexAlign(contentValue);
}

function resolveFlexMainDistribute(
  layoutValue: InstanceAvatarDistribute,
  contentValue: HubContentAlign
): string {
  if (layoutValue === "between" || layoutValue === "evenly" || layoutValue === "end") {
    return toFlexJustify(layoutValue);
  }
  if (layoutValue === "center") return toFlexJustify("center");
  return toFlexAlign(contentValue);
}

export function instanceAvatarClusterStyle(
  layout: InstanceAvatarLayoutConfig,
  ui: HubElementUi,
  element: HubElement
): Record<string, string | number> {
  const contentX = resolveHubContentAlignX(element.style);
  const contentY = resolveHubContentAlignY(element.style);

  if (layout.mode === "grid") {
    return {
      ...hubGridStyle(ui),
      width: "100%",
      height: "100%",
      maxHeight: "100%",
      minHeight: 0,
      overflow: "hidden",
      justifyItems: resolveFlexCrossAlign(layout.itemAlign, contentX),
      alignItems: resolveFlexCrossAlign(layout.itemAlign, contentY),
      alignContent: resolveFlexMainDistribute(layout.distribute, contentY),
    };
  }

  const isColumn = layout.mode === "column";
  const crossAlign = isColumn
    ? resolveFlexCrossAlign(layout.itemAlign, contentX)
    : resolveFlexCrossAlign(layout.itemAlign, contentY);
  const mainAlign = isColumn
    ? resolveFlexMainDistribute(layout.distribute, contentY)
    : resolveFlexMainDistribute(layout.distribute, contentX);

  return {
    display: "flex",
    flexDirection: isColumn ? "column" : "row",
    flexWrap: isColumn ? "nowrap" : "wrap",
    gap: ui.gridGap,
    alignItems: crossAlign,
    justifyContent: mainAlign,
    width: "100%",
    height: "100%",
    maxWidth: "100%",
    maxHeight: "100%",
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
    boxSizing: "border-box",
  };
}

export function instanceAvatarGroupsWrapStyle(
  layout: InstanceAvatarLayoutConfig
): Record<string, string | number> {
  return {
    display: "flex",
    flexDirection: "column",
    gap: layout.groupGap,
    width: "100%",
    height: "100%",
    minHeight: 0,
    minWidth: 0,
    overflow: "hidden",
    boxSizing: "border-box",
  };
}

export function instanceAvatarShellStyle(element: HubElement): Record<string, string | number> {
  return {
    width: "100%",
    height: "100%",
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
    boxSizing: "border-box",
  };
}

export function resolveInstanceAvatarUi(element: HubElement) {
  return {
    ui: resolveHubElementUi(element),
    layout: resolveInstanceAvatarLayout(element),
  };
}

export function sortLauncherInstances(
  instances: LauncherInstance[],
  mode: InstanceSortMode,
  customOrder?: string
): LauncherInstance[] {
  const list = [...instances];
  if (mode === "name") {
    return list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }
  if (mode === "created-desc") {
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  if (mode === "created-asc") {
    return list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  if (mode === "custom" && customOrder) {
    const order = customOrder
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const rank = new Map(order.map((id, i) => [id, i]));
    return list.sort((a, b) => {
      const ra = rank.has(a.id) ? rank.get(a.id)! : 9999;
      const rb = rank.has(b.id) ? rank.get(b.id)! : 9999;
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
  }
  return list;
}
