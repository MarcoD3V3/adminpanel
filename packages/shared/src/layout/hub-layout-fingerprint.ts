import type { HubLayout } from "../types/hub-layout";

/** Huella estable del layout (ignora `updatedAt`) para comparar publicaciones. */
export function hubLayoutFingerprint(layout: HubLayout): string {
  const copy = JSON.parse(JSON.stringify(layout)) as HubLayout;
  copy.updatedAt = "";
  return JSON.stringify(copy);
}
