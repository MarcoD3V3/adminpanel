import { appendAuditLog } from "./audit";
import { loadAuthStore, mutateAuthStore } from "./store";

export async function isTesterModeEnabled(): Promise<boolean> {
  const store = await loadAuthStore();
  return store.testerModeEnabled === true;
}

export async function setTesterModeEnabled(enabled: boolean, ipHint?: string): Promise<boolean> {
  await mutateAuthStore((store) => {
    store.testerModeEnabled = enabled;
  });
  await appendAuditLog(enabled ? "tester_mode_enabled" : "tester_mode_disabled", ipHint);
  return enabled;
}
