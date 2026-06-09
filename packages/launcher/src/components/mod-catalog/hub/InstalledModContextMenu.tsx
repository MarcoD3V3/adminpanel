import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowUpCircle,
  Eye,
  Power,
  PowerOff,
  Trash2,
} from "lucide-react";
import type { InstalledModRow } from "@/lib/electron-api";

export type InstalledModMenuAnchor = {
  x: number;
  y: number;
  row: InstalledModRow;
};

type InstalledModContextMenuProps = {
  anchor: InstalledModMenuAnchor | null;
  busy: boolean;
  onClose: () => void;
  onPreview: (row: InstalledModRow) => void;
  onToggleEnabled: (fileName: string, currentlyDisabled: boolean) => void;
  onUpdate: (fileName: string) => void;
  onDelete: (fileName: string) => void;
};

function clampMenuPosition(x: number, y: number, menuW: number, menuH: number) {
  const margin = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = x;
  let top = y;

  if (left + menuW > vw - margin) left = vw - menuW - margin;
  if (top + menuH > vh - margin) top = vh - menuH - margin;
  if (left < margin) left = margin;
  if (top < margin) top = margin;

  return { left, top };
}

export function InstalledModContextMenu({
  anchor,
  busy,
  onClose,
  onPreview,
  onToggleEnabled,
  onUpdate,
  onDelete,
}: InstalledModContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });

  useLayoutEffect(() => {
    if (!anchor || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    setPos(clampMenuPosition(anchor.x, anchor.y, rect.width, rect.height));
  }, [anchor]);

  useEffect(() => {
    if (!anchor) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (menuRef.current?.contains(target)) return;
      onClose();
    };

    const onScroll = () => onClose();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onPointerDown, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onClose);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onPointerDown, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onClose);
    };
  }, [anchor, onClose]);

  const runAction = useCallback(
    (action: () => void) => {
      if (busy) return;
      action();
      onClose();
    },
    [busy, onClose]
  );

  if (!anchor || typeof document === "undefined") return null;

  const { row } = anchor;
  const label = row.displayName ?? row.fileName;
  const canUpdate = Boolean(row.modId) && !row.disabled;
  const hasUpdate = Boolean(row.updateAvailable);

  return createPortal(
    <div
      ref={menuRef}
      className="installed-mod-menu"
      style={{ top: pos.top, left: pos.left }}
      role="menu"
      aria-label={`Opciones de ${label}`}
      onContextMenu={(e) => e.preventDefault()}
    >
      <p className="installed-mod-menu__title" title={row.fileName}>
        {label}
      </p>

      <button
        type="button"
        className="installed-mod-menu__item"
        role="menuitem"
        disabled={busy}
        onClick={() => runAction(() => onPreview(row))}
      >
        <Eye size={13} aria-hidden />
        Ver detalles
      </button>

      <div className="installed-mod-menu__sep" role="separator" />

      <button
        type="button"
        className="installed-mod-menu__item"
        role="menuitem"
        disabled={busy}
        onClick={() => runAction(() => onToggleEnabled(row.fileName, Boolean(row.disabled)))}
      >
        {row.disabled ? <Power size={13} aria-hidden /> : <PowerOff size={13} aria-hidden />}
        {row.disabled ? "Activar mod" : "Desactivar mod"}
      </button>

      {canUpdate && hasUpdate && (
        <button
          type="button"
          className="installed-mod-menu__item"
          role="menuitem"
          disabled={busy}
          title={row.latestFileName ? `Nueva versión: ${row.latestFileName}` : "Actualizar mod"}
          onClick={() => runAction(() => onUpdate(row.fileName))}
        >
          <ArrowUpCircle size={13} aria-hidden />
          Actualizar mod
        </button>
      )}

      {!row.modId && (
        <p className="installed-mod-menu__hint">Instalado sin datos de CurseForge</p>
      )}

      <div className="installed-mod-menu__sep" role="separator" />

      <button
        type="button"
        className="installed-mod-menu__item installed-mod-menu__item--danger"
        role="menuitem"
        disabled={busy}
        onClick={() => runAction(() => onDelete(row.fileName))}
      >
        <Trash2 size={13} aria-hidden />
        Borrar mod
      </button>
    </div>,
    document.body
  );
}
