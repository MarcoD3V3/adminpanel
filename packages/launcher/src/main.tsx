import ReactDOM from "react-dom/client";
import App from "./App";
import { resolveAdminApiUrl } from "./lib/config";
import "./styles.css";

async function boot() {
  await resolveAdminApiUrl();
  ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
}

void boot();
