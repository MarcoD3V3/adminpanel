import type { LauncherEvent, RemoteCommand, WsEnvelope } from "../types/protocol";

export type LauncherClientHandlers = {
  onCommand?: (cmd: RemoteCommand) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
};

/** Cliente WebSocket del launcher hacia el admin/backend */
export class LauncherWsClient {
  private ws: WebSocket | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private wsUrl: string,
    private launcherId: string,
    private handlers: LauncherClientHandlers = {}
  ) {}

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = () => {
      this.handlers.onConnect?.();
      this.startHeartbeat();
    };

    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as WsEnvelope;
        if (msg.channel === "command") {
          this.handlers.onCommand?.(msg.payload);
        }
        if (msg.channel === "ping") {
          this.send({ channel: "pong", ts: Date.now() });
        }
      } catch {
        /* ignore malformed */
      }
    };

    this.ws.onclose = () => {
      this.stopHeartbeat();
      this.handlers.onDisconnect?.();
      this.scheduleReconnect();
    };

    this.ws.onerror = (e) => this.handlers.onError?.(e);
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.stopHeartbeat();
    this.ws?.close();
    this.ws = null;
  }

  sendEvent(event: LauncherEvent) {
    this.send({ channel: "event", payload: event });
  }

  private send(envelope: WsEnvelope) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(envelope));
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.sendEvent({
        type: "heartbeat",
        launcherId: this.launcherId,
        ramMb: 0,
        cpuPercent: 0,
        status: "idle",
      });
    }, 30_000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 5000);
  }
}
