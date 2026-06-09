"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  fetchAdminSessionStatus,
  loginAdminSession,
  logoutAdminSession,
  readAdminRememberPreference,
  writeAdminRememberPreference,
} from "@/lib/admin-session-client";

type AdminSessionContextValue = {
  authenticated: boolean;
  configured: boolean;
  devFallbackActive: boolean;
  loading: boolean;
  modalOpen: boolean;
  remember: boolean;
  openModal: () => void;
  closeModal: () => void;
  setRemember: (value: boolean) => void;
  refresh: () => Promise<void>;
  login: (key: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
};

const AdminSessionContext = createContext<AdminSessionContextValue | null>(null);

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [devFallbackActive, setDevFallbackActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [remember, setRememberState] = useState(true);

  useEffect(() => {
    setRememberState(readAdminRememberPreference());
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchAdminSessionStatus();
      setAuthenticated(Boolean(data.authenticated));
      setConfigured(Boolean(data.configured));
      setDevFallbackActive(Boolean(data.devFallbackActive));
    } catch {
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setRemember = useCallback((value: boolean) => {
    setRememberState(value);
    writeAdminRememberPreference(value);
  }, []);

  const login = useCallback(
    async (key: string) => {
      const result = await loginAdminSession(key, remember);
      if (result.ok) {
        await refresh();
        setModalOpen(false);
      }
      return { ok: result.ok, error: result.error };
    },
    [remember, refresh]
  );

  const logout = useCallback(async () => {
    await logoutAdminSession();
    setAuthenticated(false);
    setModalOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      authenticated,
      configured,
      devFallbackActive,
      loading,
      modalOpen,
      remember,
      openModal: () => setModalOpen(true),
      closeModal: () => setModalOpen(false),
      setRemember,
      refresh,
      login,
      logout,
    }),
    [
      authenticated,
      configured,
      devFallbackActive,
      loading,
      modalOpen,
      remember,
      setRemember,
      refresh,
      login,
      logout,
    ]
  );

  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>;
}

export function useAdminSession() {
  const ctx = useContext(AdminSessionContext);
  if (!ctx) {
    throw new Error("useAdminSession debe usarse dentro de AdminSessionProvider");
  }
  return ctx;
}
