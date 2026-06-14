const EDITOR_ID_KEY = "craftlauncher-hub-editor-id";
const EDITOR_LABEL_KEY = "craftlauncher-hub-editor-label";

export type HubEditLockStatus = {
  role: "editor" | "viewer" | "pending";
  holderLabel: string | null;
  holderSince: string | null;
};

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `ed-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getHubEditorId(): string {
  if (typeof window === "undefined") return "server";
  try {
    let id = sessionStorage.getItem(EDITOR_ID_KEY);
    if (!id) {
      id = randomId();
      sessionStorage.setItem(EDITOR_ID_KEY, id);
    }
    return id;
  } catch {
    return randomId();
  }
}

export function getHubEditorLabel(): string {
  if (typeof window === "undefined") return "Editor";
  try {
    const saved = localStorage.getItem(EDITOR_LABEL_KEY)?.trim();
    if (saved) return saved.slice(0, 64);
  } catch {
    /* ignore */
  }
  const id = getHubEditorId();
  return `Editor ${id.slice(0, 4)}`;
}

export function setHubEditorLabel(label: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(EDITOR_LABEL_KEY, label.trim().slice(0, 64));
  } catch {
    /* ignore */
  }
}

export async function fetchHubEditLockStatus(editorId: string): Promise<HubEditLockStatus> {
  try {
    const res = await fetch(`/api/hub-builder/lock?editorId=${encodeURIComponent(editorId)}`, {
      cache: "no-store",
      credentials: "include",
    });
    if (!res.ok) return { role: "pending", holderLabel: null, holderSince: null };
    const data = (await res.json()) as {
      locked?: boolean;
      isOwner?: boolean;
      holder?: { label?: string; since?: string };
    };
    if (!data.locked) return { role: "pending", holderLabel: null, holderSince: null };
    if (data.isOwner) {
      return {
        role: "editor",
        holderLabel: data.holder?.label ?? null,
        holderSince: data.holder?.since ?? null,
      };
    }
    return {
      role: "viewer",
      holderLabel: data.holder?.label ?? "Otro editor",
      holderSince: data.holder?.since ?? null,
    };
  } catch {
    return { role: "pending", holderLabel: null, holderSince: null };
  }
}

async function parseLockJson(res: Response): Promise<{
  ok?: boolean;
  role?: "editor" | "viewer";
  holder?: { label?: string; since?: string };
}> {
  try {
    return (await res.json()) as {
      ok?: boolean;
      role?: "editor" | "viewer";
      holder?: { label?: string; since?: string };
    };
  } catch {
    return {};
  }
}

export async function acquireHubEditLock(
  editorId: string,
  holderLabel: string
): Promise<HubEditLockStatus> {
  try {
    const res = await fetch("/api/hub-builder/lock", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ editorId, holderLabel }),
    });
    const data = await parseLockJson(res);
    if (res.ok && data.ok && data.role === "editor") {
      return {
        role: "editor",
        holderLabel: data.holder?.label ?? holderLabel,
        holderSince: data.holder?.since ?? null,
      };
    }
    if (res.status === 409) {
      return {
        role: "viewer",
        holderLabel: data.holder?.label ?? "Otro editor",
        holderSince: data.holder?.since ?? null,
      };
    }
    // API caída o sin sesión: permitir editar (sin lock multi-usuario)
    return { role: "editor", holderLabel: holderLabel, holderSince: null };
  } catch {
    return { role: "editor", holderLabel: holderLabel, holderSince: null };
  }
}

export async function heartbeatHubEditLock(
  editorId: string,
  holderLabel: string
): Promise<boolean> {
  try {
    const res = await fetch("/api/hub-builder/lock", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ editorId, holderLabel }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function releaseHubEditLock(editorId: string): void {
  if (typeof window === "undefined") return;
  try {
    void fetch(`/api/hub-builder/lock?editorId=${encodeURIComponent(editorId)}`, {
      method: "DELETE",
      credentials: "include",
      keepalive: true,
    }).catch(() => {
      /* ignore: navegación / red */
    });
  } catch {
    /* ignore */
  }
}
