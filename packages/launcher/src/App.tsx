import { AuthGate } from "./components/AuthGate";
import { AccountShell } from "./components/AccountShell";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { LauncherShell } from "./components/LauncherShell";
import { LaunchProgressShell } from "./components/LaunchProgressShell";
import { HubScreenShell } from "./components/HubScreenShell";
import { parseHubScreenIdFromHash } from "@craftlauncher/shared";

const hash =
  typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "";

const isAccountWindow = hash === "/account" || hash === "account";
const isLaunchWindow = hash === "/launch" || hash === "launch";
const hubScreenId = parseHubScreenIdFromHash(hash);

export default function App() {
  if (hubScreenId) {
    return (
      <ErrorBoundary>
        <AuthGate>
          <HubScreenShell />
        </AuthGate>
      </ErrorBoundary>
    );
  }

  if (isLaunchWindow) {
    return (
      <ErrorBoundary>
        <LaunchProgressShell />
      </ErrorBoundary>
    );
  }

  if (isAccountWindow) {
    return (
      <ErrorBoundary>
        <AuthGate>
          <AccountShell />
        </AuthGate>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <AuthGate>
        <LauncherShell />
      </AuthGate>
    </ErrorBoundary>
  );
}