"use client";

import { createContext, useContext, useMemo } from "react";
import type { HubElement } from "@/types/hub-builder";
import { compileHubAdvancedCssSheet, resolveEffectiveHubCss } from "@craftlauncher/shared";

export const HubCssElementsContext = createContext<HubElement[]>([]);

export function HubCssElementsProvider({
  elements,
  children,
}: {
  elements: HubElement[];
  children: React.ReactNode;
}) {
  return (
    <HubCssElementsContext.Provider value={elements}>{children}</HubCssElementsContext.Provider>
  );
}

export function useHubCssElements(): HubElement[] {
  return useContext(HubCssElementsContext);
}

export function useEffectiveHubCss(element: HubElement): Record<string, string | number> {
  const elements = useHubCssElements();
  return useMemo(() => resolveEffectiveHubCss(element, elements), [element, elements]);
}

export function HubAdvancedCssSheet({ elements }: { elements: HubElement[] }) {
  const css = useMemo(() => compileHubAdvancedCssSheet(elements), [elements]);
  if (!css.trim()) return null;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
