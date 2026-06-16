import { create } from "zustand";
import {
  fetchPortalChat,
  postPortalChat,
  type PortalChatFriend,
  type PortalChatSnapshot,
} from "@craftlauncher/shared";
import { getAdminApiUrl } from "./config";
import { useAuthStore } from "./auth-store";

const BUBBLE_POS_KEY = "cl_chat_bubble_pos_v1";

type BubbleSize = "mini" | "normal" | "large";

type BubbleGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
  size: BubbleSize;
};

const SIZE_PRESETS: Record<BubbleSize, { width: number; height: number }> = {
  mini: { width: 300, height: 380 },
  normal: { width: 360, height: 480 },
  large: { width: 440, height: 580 },
};

function loadGeometry(): BubbleGeometry {
  try {
    const raw = localStorage.getItem(BUBBLE_POS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as BubbleGeometry;
      if (typeof parsed.x === "number" && typeof parsed.width === "number") return parsed;
    }
  } catch {
    /* ignore */
  }
  const preset = SIZE_PRESETS.normal;
  return {
    x: Math.max(24, window.innerWidth - preset.width - 28),
    y: Math.max(80, window.innerHeight - preset.height - 100),
    width: preset.width,
    height: preset.height,
    size: "normal",
  };
}

function saveGeometry(geo: BubbleGeometry) {
  try {
    localStorage.setItem(BUBBLE_POS_KEY, JSON.stringify(geo));
  } catch {
    /* ignore */
  }
}

type PortalChatState = {
  isOpen: boolean;
  geometry: BubbleGeometry;
  chat: PortalChatSnapshot | null;
  peer: PortalChatFriend | null;
  draft: string;
  tab: "friends" | "explore";
  loading: boolean;
  error: string | null;
  toast: string | null;
};

type PortalChatActions = {
  toggle: () => void;
  open: () => void;
  close: () => void;
  setDraft: (value: string) => void;
  setTab: (tab: "friends" | "explore") => void;
  setPeer: (peer: PortalChatFriend | null) => void;
  setGeometry: (partial: Partial<BubbleGeometry>) => void;
  cycleSize: () => void;
  refresh: () => Promise<void>;
  sendMessage: () => Promise<void>;
  sendFriendRequest: (username: string) => Promise<void>;
  acceptRequest: (requestId: string, fromUserId: string) => Promise<void>;
  declineRequest: (requestId: string, fromUserId: string) => Promise<void>;
};

export const usePortalChatStore = create<PortalChatState & PortalChatActions>((set, get) => ({
  isOpen: false,
  geometry:
    typeof window !== "undefined"
      ? loadGeometry()
      : { x: 24, y: 80, ...SIZE_PRESETS.normal, size: "normal" as BubbleSize },
  chat: null,
  peer: null,
  draft: "",
  tab: "friends",
  loading: false,
  error: null,
  toast: null,

  toggle: () => {
    const next = !get().isOpen;
    set({ isOpen: next, error: null });
    if (next) void get().refresh();
  },

  open: () => {
    set({ isOpen: true, error: null });
    void get().refresh();
  },

  close: () => set({ isOpen: false, peer: null, draft: "", error: null }),

  setDraft: (value) => set({ draft: value }),

  setTab: (tab) => set({ tab }),

  setPeer: (peer) => {
    set({ peer, draft: "" });
    void get().refresh();
  },

  setGeometry: (partial) => {
    const geometry = { ...get().geometry, ...partial };
    saveGeometry(geometry);
    set({ geometry });
  },

  cycleSize: () => {
    const order: BubbleSize[] = ["mini", "normal", "large"];
    const current = get().geometry.size;
    const next = order[(order.indexOf(current) + 1) % order.length] ?? "normal";
    const preset = SIZE_PRESETS[next];
    get().setGeometry({ size: next, width: preset.width, height: preset.height });
  },

  refresh: async () => {
    const auth = await useAuthStore.getState().resolveHeaders();
    if (!auth) {
      set({ error: "Inicia sesión para usar el chat" });
      return;
    }
    set({ loading: !get().chat });
    const result = await fetchPortalChat(getAdminApiUrl(), auth, get().peer?.userId);
    if (!result.ok || !result.chat) {
      set({ loading: false, error: result.error ?? "No se pudo cargar el chat" });
      return;
    }
    const peer = get().peer;
    if (peer && !result.chat.friends.some((f) => f.userId === peer.userId)) {
      set({ chat: result.chat, peer: null, loading: false, error: null });
      return;
    }
    set({ chat: result.chat, loading: false, error: null });
  },

  sendMessage: async () => {
    const { peer, draft } = get();
    if (!peer || !draft.trim()) return;
    const auth = await useAuthStore.getState().resolveHeaders();
    if (!auth) return;
    const result = await postPortalChat(getAdminApiUrl(), auth, {
      action: "send",
      recipientUserId: peer.userId,
      text: draft,
    });
    if (!result.ok) {
      set({ error: result.error ?? "No se pudo enviar" });
      return;
    }
    set({ draft: "", chat: result.chat ?? get().chat, error: null });
  },

  sendFriendRequest: async (username) => {
    const auth = await useAuthStore.getState().resolveHeaders();
    if (!auth) return;
    const result = await postPortalChat(getAdminApiUrl(), auth, {
      action: "add_friend",
      username: username.trim(),
    });
    if (!result.ok) {
      set({ error: result.error ?? "No se pudo enviar la solicitud" });
      return;
    }
    if (result.type === "accepted" && result.chat) {
      set({ chat: result.chat, toast: "¡Amistad aceptada!", error: null });
    } else {
      set({ chat: result.chat ?? get().chat, toast: "Solicitud enviada", error: null });
    }
    window.setTimeout(() => set({ toast: null }), 3500);
  },

  acceptRequest: async (requestId, fromUserId) => {
    const auth = await useAuthStore.getState().resolveHeaders();
    if (!auth) return;
    const result = await postPortalChat(getAdminApiUrl(), auth, {
      action: "accept_friend",
      requestId,
      fromUserId,
    });
    if (!result.ok) {
      set({ error: result.error ?? "No se pudo aceptar" });
      return;
    }
    set({ chat: result.chat ?? get().chat, toast: "Solicitud aceptada", error: null });
    window.setTimeout(() => set({ toast: null }), 3500);
  },

  declineRequest: async (requestId, fromUserId) => {
    const auth = await useAuthStore.getState().resolveHeaders();
    if (!auth) return;
    const result = await postPortalChat(getAdminApiUrl(), auth, {
      action: "decline_friend",
      requestId,
      fromUserId,
    });
    if (!result.ok) {
      set({ error: result.error ?? "No se pudo rechazar" });
      return;
    }
    set({ chat: result.chat ?? get().chat, error: null });
  },
}));

export const portalChatActions = {
  toggle: () => usePortalChatStore.getState().toggle(),
  open: () => usePortalChatStore.getState().open(),
  close: () => usePortalChatStore.getState().close(),
  send: () => usePortalChatStore.getState().sendMessage(),
  setDraft: (v: string) => usePortalChatStore.getState().setDraft(v),
};
