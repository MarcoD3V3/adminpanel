import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Lock, ShieldCheck, User } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { getLauncherApi } from "@/lib/electron-api";

interface AuthGateProps {
  children: ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const status = useAuthStore((s) => s.status);
  const error = useAuthStore((s) => s.error);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const api = getLauncherApi();

  useEffect(() => {
    void useAuthStore.getState().bootstrap();
  }, []);

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
    if (!tokenInput.trim()) return;
    setSubmitting(true);
    const ok = await useAuthStore.getState().activateWithToken(tokenInput);
    setSubmitting(false);
    if (ok) setTokenInput("");
  };

  if (status === "checking") {
    return (
      <div className="auth-gate">
        <div className="auth-card">
          <ShieldCheck size={28} className="auth-icon" />
          <p className="auth-title">Verificando sesión…</p>
        </div>
      </div>
    );
  }

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
          <User size={28} className="auth-icon" />
          <h1 className="auth-title">Iniciar sesión</h1>
          <p className="auth-desc">
            Usa la cuenta creada en el panel admin. La sesión se guarda en este equipo; no tendrás que
            volver a iniciar sesión en cada arranque.
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
            <button type="submit" disabled={submitting || !username.trim() || !password}>
              {submitting ? "Entrando…" : "Entrar"}
            </button>
          </form>

          <button
            type="button"
            className="auth-link-btn"
            onClick={() => setShowToken((v) => !v)}
          >
            {showToken ? "Ocultar activación por token" : "Tengo un token de activación"}
          </button>

          {showToken && (
            <form className="auth-form auth-form-token" onSubmit={(e) => void handleToken(e)}>
              <Lock size={16} className="auth-icon-inline" />
              <input
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="clakt_…"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                disabled={submitting}
              />
              <button type="submit" disabled={submitting || !tokenInput.trim()}>
                Activar con token
              </button>
            </form>
          )}

          <p className="auth-foot">
            Crea usuarios en Admin → Acceso Launcher → Cuentas de usuario.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
