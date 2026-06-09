"use client";

import type { HubElement, HubScreen } from "@/types/hub-builder";
import {
  CHROME_VISIBLE_SCREENS_KEY,
  formatChromeVisibleScreens,
  parseChromeVisibleScreens,
} from "@craftlauncher/shared";

type ChromeVisibleScreensEditorProps = {
  element: HubElement;
  screens: HubScreen[];
  onChange: (constants: Record<string, string | number | boolean>) => void;
};

export function ChromeVisibleScreensEditor({
  element,
  screens,
  onChange,
}: ChromeVisibleScreensEditorProps) {
  const allowed = parseChromeVisibleScreens(element);
  const allScreens = !allowed;

  const toggleAll = () => {
    const next = { ...element.logic?.constants };
    if (allScreens) {
      next[CHROME_VISIBLE_SCREENS_KEY] = screens[0]?.id ?? "";
    } else {
      delete next[CHROME_VISIBLE_SCREENS_KEY];
    }
    onChange(next);
  };

  const toggleScreen = (screenId: string) => {
    const current = new Set(allowed ?? screens.map((s) => s.id));
    if (current.has(screenId)) current.delete(screenId);
    else current.add(screenId);
    const next = { ...element.logic?.constants };
    if (current.size === 0 || current.size >= screens.length) {
      delete next[CHROME_VISIBLE_SCREENS_KEY];
    } else {
      next[CHROME_VISIBLE_SCREENS_KEY] = formatChromeVisibleScreens([...current]);
    }
    onChange(next);
  };

  return (
    <div className="space-y-1.5 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-hover)]/40 p-2">
      <p className="text-[9px] leading-snug text-[var(--color-muted)]">
        Controla en qué ventanas aparece este elemento en la barra superior. Vacío = todas.
      </p>
      <label className="flex items-center gap-2 text-[10px] text-[var(--color-text-soft)]">
        <input
          type="checkbox"
          checked={allScreens}
          onChange={toggleAll}
          className="rounded border-[var(--color-border)]"
        />
        Todas las ventanas
      </label>
      {!allScreens && (
        <div className="max-h-32 space-y-1 overflow-y-auto hub-scroll-hidden pl-1">
          {screens.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-[10px] text-[var(--color-text-soft)]">
              <input
                type="checkbox"
                checked={allowed?.includes(s.id) ?? false}
                onChange={() => toggleScreen(s.id)}
                className="rounded border-[var(--color-border)]"
              />
              {s.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
