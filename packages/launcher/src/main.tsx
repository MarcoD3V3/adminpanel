import ReactDOM from "react-dom/client";
import App from "./App";
import { initAuthSessionSync } from "./lib/auth-store";
import { resolveAdminApiUrl } from "./lib/config";
import "./styles.css";

async function boot() {
  await resolveAdminApiUrl();
  initAuthSessionSync();
  ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
}

void boot();
