import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ClipboardPaste, FlaskConical, ShieldCheck, User } from "lucide-react";
import { parseProfileClipboard } from "@craftlauncher/shared";
import { useAuthStore } from "@/lib/auth-store";
import {
  accessSettingsFootnote,
  loadLauncherAccessSettings,
  type LauncherAccessSettingsState,
} from "@/lib/access-settings";
import { getLauncherApi } from "@/lib/electron-api";
import { readTextFromClipboard } from "@/lib/clipboard";
import { usesLocalTesterAuth } from "@/lib/auth-api";
import { ADMIN_API_URL_LOCAL, getAdminApiSource, getAdminApiUrl } from "@/lib/config";

const MIN_TOKEN_LEN = 40;

function isCompleteActivationToken(token: string): boolean {
  const t = token.trim();
  return t.startsWith("clakt_") && t.length >= MIN_TOKEN_LEN && /^[a-zA-Z0-9_-]+$/.test(t);
}

interface AuthGateProps {
  children: ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const status = useAuthStore((s) => s.status);
  const error = useAuthStore((s) => s.error);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [authMode, setAuthMode] = useState<"account" | "tester">("account");
  const [testerModeEnabled, setTesterModeEnabled] = useState(false);
  const [accessSettingsLoaded, setAccessSettingsLoaded] = useState(false);
  const [accessSettingsMeta, setAccessSettingsMeta] = useState<LauncherAccessSettingsState | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);
  const [pasteHint, setPasteHint] = useState<string | null>(null);
  const api = getLauncherApi();

  const rejectTesterAccess = (message: string) => {
    setPasteHint(null);
    useAuthStore.setState({ error: message });
  };

  const applyClipboardPayload = async (text: string): Promise<boolean> => {
    const parsed = parseProfileClipboard(text);
    if (!parsed) return false;

    useAuthStore.setState({ error: null });

    const token = parsed.codigo?.trim();
    const hasPassword = Boolean(parsed.contraseña?.trim());
    const isTesterToken = Boolean(token && isCompleteActivationToken(token));

    if (parsed.nombre) setUsername(parsed.nombre);
    if (hasPassword) setPassword(parsed.contraseña!);

    // Perfil con usuario + contraseña → siempre pestaña Cuenta (no modo testeo)
    if (hasPassword) {
      setAuthMode("account");
      setTokenInput("");
      setPasteHint(`Importado: ${parsed.nombre ?? "—"} · contraseña. Pulsa «Entrar».`);
      return true;
    }

    if (isTesterToken) {
      if (!testerModeEnabled) {
        rejectTesterAccess(
          "El modo testeo está desactivado. Inicia sesión con tu cuenta o pide al admin que lo active."
        );
        return true;
      }
      setAuthMode("tester");
      setTokenInput(token!);
      setPasteHint(`Token testeo — activando como ${parsed.nombre ?? "jugador"}…`);
      setSubmitting(true);
      const ok = await useAuthStore.getState().activateWithToken(token!);
      setSubmitting(false);
      if (ok) {
        setTokenInput("");
        setPasteHint(null);
      } else {
        setPasteHint("Token pegado. Pulsa «Entrar en modo testeo» si no entró solo.");
      }
      return true;
    }

    setAuthMode("account");
    setTokenInput("");
    setPasteHint(
      parsed.nombre
        ? `Importado: ${parsed.nombre}. Falta contraseña — resetea en Admin → Perfiles.`
        : "Datos importados (sin contraseña ni token válido)."
    );
    return true;
  };

  const importFromClipboard = async () => {
    setPasteHint(null);
    const text = await readTextFromClipboard();
    if (!text) {
      setPasteHint("No se pudo leer el portapapeles. Pega manualmente el token o credenciales.");
      return;
    }
    const pasted = text.trim();
    if (pasted.startsWith("clakt_")) {
      if (!testerModeEnabled) {
        rejectTesterAccess(
          "El modo testeo está desactivado. Solo puedes iniciar sesión con cuenta."
        );
        return;
      }
      setAuthMode("tester");
      setTokenInput(pasted);
      useAuthStore.setState({ error: null });
      setPasteHint(
        isCompleteActivationToken(pasted)
          ? "Token pegado. Pulsa «Entrar en modo testeo»."
          : `Token incompleto (${pasted.length} caracteres). Vuelve a copiarlo entero desde Admin.`
      );
      return;
    }
    if (await applyClipboardPayload(text)) return;
    setPasteHint("No se reconoció el formato. Copia desde Admin → Acceso Launcher o Perfiles.");
  };

  useEffect(() => {
    let cancelled = false;

    const refreshAccessSettings = async () => {
      const state = await loadLauncherAccessSettings();
      if (cancelled) return;
      setAccessSettingsMeta(state);
      setTesterModeEnabled(state.testerModeEnabled);
      setAccessSettingsLoaded(true);
      if (state.testerModeEnabled) {
        setAuthMode((mode) => (mode === "account" ? "tester" : mode));
      } else {
        setAuthMode("account");
        setTokenInput("");
      }
    };

    const init = async () => {
      await refreshAccessSettings();
      if (!cancelled) await useAuthStore.getState().bootstrap();
    };

    void init();
    const timer = window.setInterval(() => void refreshAccessSettings(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (testerModeEnabled || authMode === "account") return;
    setAuthMode("account");
    setTokenInput("");
  }, [testerModeEnabled, authMode]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setSubmitting(true);
    const ok = await useAuthStore.getState().loginWithCredentials(username, password);
    setSubmitting(false);
    if (ok) {
      setPassword("");
      setUsername("");
    }
  };

  const handleToken = async (e: FormEvent) => {
    e.preventDefault();
    if (!testerModeEnabled) {
      rejectTesterAccess("El modo testeo está desactivado.");
      return;
    }
    const token = tokenInput.trim();
    if (!token) return;
    if (!isCompleteActivationToken(token)) {
      setPasteHint(null);
      useAuthStore.setState({
        error: `Token incompleto (${token.length} caracteres). Copia el token entero desde Admin → Copiar.`,
      });
      return;
    }
    setPasteHint(null);
    setSubmitting(true);
    const ok = await useAuthStore.getState().activateWithToken(token);
    setSubmitting(false);
    if (ok) {
      setTokenInput("");
    }
  };

  if (status === "checking") {
    return (
      <div className="auth-gate">
        <div className="auth-card">
          <ShieldCheck size={22} className="auth-icon" />
          <p className="auth-title">Verificando sesión…</p>
        </div>
      </div>
    );
  }

  const settingsFootnote = accessSettingsMeta ? accessSettingsFootnote(accessSettingsMeta) : null;
  const authServerLabel = usesLocalTesterAuth()
    ? `Auth testeo: ${ADMIN_API_URL_LOCAL} · Hub: ${getAdminApiUrl()}`
    : `Servidor: ${getAdminApiUrl()} (${getAdminApiSource() === "local" ? "local" : "producción"})`;

  if (status === "locked") {
    return (
      <div className="auth-gate">
        <header className="auth-chrome">
          <span className="app-mark">CraftLauncher</span>
          <div className="chrome-actions">
            <button type="button" title="Minimizar" onClick={() => void api?.minimize()}>
              —
            </button>
            <button type="button" title="Cerrar" className="close" onClick={() => void api?.close()}>
              ×
            </button>
          </div>
        </header>

        <div className="auth-card">
          {testerModeEnabled && accessSettingsLoaded && (
            <div className="auth-mode-tabs">
              <button
                type="button"
                className={authMode === "tester" ? "auth-mode-tab active" : "auth-mode-tab"}
                onClick={() => {
                  setAuthMode("tester");
                  setPasteHint(null);
                  useAuthStore.setState({ error: null });
                }}
              >
                <span className="auth-mode-tab-inner">
                  <FlaskConical size={14} aria-hidden />
                  <span>Modo testeo</span>
                </span>
              </button>
              <button
                type="button"
                className={authMode === "account" ? "auth-mode-tab active" : "auth-mode-tab"}
                onClick={() => {
                  setAuthMode("account");
                  setPasteHint(null);
                  useAuthStore.setState({ error: null });
                }}
              >
                <span className="auth-mode-tab-inner">
                  <User size={14} aria-hidden />
                  <span>Cuenta</span>
                </span>
              </button>
            </div>
          )}

          <div className="auth-card-body">
          {!accessSettingsLoaded ? (
            <>
              <ShieldCheck size={22} className="auth-icon" />
              <p className="auth-title">Comprobando acceso…</p>
            </>
          ) : authMode === "tester" && testerModeEnabled ? (
            <>
              <FlaskConical size={22} className="auth-icon" />
              <h1 className="auth-title">Modo testeo</h1>
              <p className="auth-desc">
                Token Tester de Admin → Acceso Launcher. Sin contraseña; el nombre MC va en el token.
              </p>
              <form className="auth-form" onSubmit={(e) => void handleToken(e)}>
                <input
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="clakt_…"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  disabled={submitting}
                />
                {error && <p className="auth-error">{error}</p>}
                {pasteHint && (
                  <p className="auth-foot" style={{ color: "var(--accent, #8fd9a8)" }}>
                    {pasteHint}
                  </p>
                )}
                <button type="submit" disabled={submitting || !tokenInput.trim()}>
                  {submitting ? "Activando…" : "Entrar en modo testeo"}
                </button>
              </form>
              <button
                type="button"
                className="auth-link-btn"
                onClick={() => void importFromClipboard()}
                disabled={submitting}
              >
                <ClipboardPaste size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                Pegar token del portapapeles
              </button>
              <p className="auth-meta">
                {settingsFootnote ? `${settingsFootnote} · ` : ""}
                {authServerLabel}
              </p>
            </>
          ) : accessSettingsLoaded ? (
            <>
              <User size={22} className="auth-icon" />
              <h1 className="auth-title">Iniciar sesión</h1>
              <p className="auth-desc">
                Usuario y contraseña del panel admin. La sesión se guarda en este equipo.
              </p>
              <form className="auth-form" onSubmit={(e) => void handleLogin(e)}>
                <input
                  type="text"
                  autoComplete="username"
                  spellCheck={false}
                  placeholder="Usuario"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={submitting}
                />
                <input
                  type="password"
                  autoComplete="current-password"
                  placeholder="Contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                />
                {error && <p className="auth-error">{error}</p>}
                {pasteHint && (
                  <p className="auth-foot" style={{ color: "var(--accent, #8fd9a8)" }}>
                    {pasteHint}
                  </p>
                )}
                <button type="submit" disabled={submitting || !username.trim() || !password}>
                  {submitting ? "Entrando…" : "Entrar"}
                </button>
              </form>
              <button
                type="button"
                className="auth-link-btn"
                onClick={() => void importFromClipboard()}
                disabled={submitting}
              >
                <ClipboardPaste size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                Importar credenciales del admin
              </button>
              <p className="auth-meta">
                {settingsFootnote ? `${settingsFootnote} · ` : ""}
                {authServerLabel}
              </p>
            </>
          ) : null}
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
