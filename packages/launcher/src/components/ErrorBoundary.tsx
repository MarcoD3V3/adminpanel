import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[CraftLauncher]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="auth-gate">
          <div className="auth-card">
            <h1 className="auth-title">Error en el launcher</h1>
            <p className="auth-desc">{this.state.error.message}</p>
            {this.state.error.stack && (
              <pre className="auth-foot" style={{ fontSize: 11, overflow: "auto", maxHeight: 120, textAlign: "left" }}>
                {this.state.error.stack.split("\n").slice(0, 6).join("\n")}
              </pre>
            )}
            <p className="auth-foot">
              Cierra la app, ejecuta <code>npm run launcher:dev</code> de nuevo y comprueba que el admin
              esté en <code>localhost:3000</code>.
            </p>
            <button
              type="button"
              className="launch-btn"
              style={{ marginTop: 12 }}
              onClick={() => window.location.reload()}
            >
              Reintentar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
