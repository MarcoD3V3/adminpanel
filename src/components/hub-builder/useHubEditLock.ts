"use client";

import { useEffect, useRef } from "react";
import {
  acquireHubEditLock,
  getHubEditorId,
  getHubEditorLabel,
  heartbeatHubEditLock,
  releaseHubEditLock,
} from "@/lib/hub-builder-edit-lock-client";
import { useHubBuilderStore } from "@/lib/hub-builder-store";

const HEARTBEAT_MS = 30_000;
const REMOTE_SYNC_MS = 8_000;
const LOCK_RETRY_MS = 12_000;

function safeAsync(fn: () => Promise<void>) {
  void fn().catch(() => {
    /* evita Runtime Error por promesas sin catch */
  });
}

export function useHubEditLock(active: boolean) {
  const editorIdRef = useRef<string | null>(null);
  const holderLabelRef = useRef("Editor");

  useEffect(() => {
    if (!active) return;

    const editorId = getHubEditorId();
    const holderLabel = getHubEditorLabel();
    editorIdRef.current = editorId;
    holderLabelRef.current = holderLabel;

    let cancelled = false;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let syncTimer: ReturnType<typeof setInterval> | null = null;
    let retryTimer: ReturnType<typeof setInterval> | null = null;

    const setAccess = useHubBuilderStore.getState().setHubEditAccess;

    const startHeartbeat = () => {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      heartbeatTimer = setInterval(() => {
        safeAsync(async () => {
          const ok = await heartbeatHubEditLock(editorId, holderLabelRef.current);
          if (!ok && !cancelled) {
            setAccess("viewer", holderLabelRef.current);
          }
        });
      }, HEARTBEAT_MS);
    };

    const tryAcquire = async () => {
      const status = await acquireHubEditLock(editorId, holderLabelRef.current);
      if (cancelled) return;
      setAccess(status.role === "editor" ? "editor" : "viewer", status.holderLabel);
      if (status.role === "editor") {
        startHeartbeat();
        if (retryTimer) {
          clearInterval(retryTimer);
          retryTimer = null;
        }
      }
    };

    safeAsync(async () => {
      await useHubBuilderStore.getState().loadSavedLayout();
      if (cancelled) return;
      await tryAcquire();
    });

    syncTimer = setInterval(() => {
      const state = useHubBuilderStore.getState();
      if (state.hubEditAccess === "viewer") {
        safeAsync(async () => {
          await state.syncRemoteDraft();
        });
        return;
      }
      if (state.hubEditAccess === "editor" && !state.editSessionActive) {
        safeAsync(async () => {
          await state.syncRemoteDraft();
        });
      }
    }, REMOTE_SYNC_MS);

    retryTimer = setInterval(() => {
      const state = useHubBuilderStore.getState();
      if (state.hubEditAccess !== "viewer") return;
      safeAsync(tryAcquire);
    }, LOCK_RETRY_MS);

    const onPageHide = () => {
      releaseHubEditLock(editorId);
    };

    window.addEventListener("pagehide", onPageHide);

    return () => {
      cancelled = true;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (syncTimer) clearInterval(syncTimer);
      if (retryTimer) clearInterval(retryTimer);
      window.removeEventListener("pagehide", onPageHide);
      releaseHubEditLock(editorId);
      setAccess("pending", null);
    };
  }, [active]);
}
