import { launchForgeMinecraft } from "./minecraft-launcher.mjs";

process.on("message", async (msg) => {
  if (msg?.type !== "launch") return;

  try {
    await launchForgeMinecraft(
      msg.versionId,
      (payload) => {
        process.send?.({ type: "progress", payload });
      },
      {
        userData: msg.userData,
        waitForClose: true,
        instanceId: msg.instanceId ?? null,
        launchWindow: msg.launchWindow ?? null,
      }
    );
    process.send?.({ type: "done" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.send?.({ type: "progress", payload: { stage: "error", message } });
    process.send?.({ type: "done", error: message });
  } finally {
    setTimeout(() => process.exit(0), 100);
  }
});

process.on("uncaughtException", (err) => {
  process.send?.({
    type: "progress",
    payload: { stage: "error", message: err instanceof Error ? err.message : String(err) },
  });
  process.exit(1);
});
