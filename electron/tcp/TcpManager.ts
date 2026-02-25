import net from "node:net";
import { EventEmitter } from "node:events";
import type { ConnectionState, InboundMessage } from "./types";

const DEFAULT_TIMEOUT_MS = 0;
const MAX_BUFFER_CHARS = 2_000_000; // avoid unbounded growth (basic DoS guard)
const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 15_000;

export class TcpManager extends EventEmitter {
  private sockets = new Map<string, net.Socket>();
  private buffers = new Map<string, string>();
  private desired = new Map<string, { host: string; port: number }>();
  private retryTimers = new Map<string, NodeJS.Timeout>();
  private retryAttempts = new Map<string, number>();

  connect(serverId: string, host: string, port: number) {
    this.desired.set(serverId, { host, port });
    this.clearRetry(serverId);

    // If already connected, no-op.
    if (this.sockets.has(serverId)) return;

    this.startConnect(serverId, host, port);
  }

  private startConnect(serverId: string, host: string, port: number) {
    this.emit("connection", { serverId, status: "connecting" } satisfies ConnectionState);

    const socket = net.createConnection({ host, port });
    if (DEFAULT_TIMEOUT_MS > 0) socket.setTimeout(DEFAULT_TIMEOUT_MS);
    socket.setKeepAlive(true, 30_000);
    socket.setNoDelay(true);

    this.sockets.set(serverId, socket);
    this.buffers.set(serverId, "");

    socket.on("connect", () => {
      this.retryAttempts.set(serverId, 0);
      this.emit("connection", { serverId, status: "connected" } satisfies ConnectionState);
    });

    if (DEFAULT_TIMEOUT_MS > 0) {
      socket.on("timeout", () => {
        socket.destroy(new Error("Socket timeout"));
      });
    }

    socket.on("data", (chunk) => {
      const prev = this.buffers.get(serverId) ?? "";
      const next = prev + chunk.toString("utf8");

      if (next.length > MAX_BUFFER_CHARS) {
        // Hard drop if server floods without delimiters.
        socket.destroy(new Error("Inbound buffer exceeded limit"));
        return;
      }

      const lines = next.split("\n");
      this.buffers.set(serverId, lines.pop() ?? "");

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        let json: unknown | undefined;
        try {
          json = JSON.parse(trimmed);
        } catch {
          // Keep raw line if not JSON
        }

        const msg: InboundMessage = {
          serverId,
          ts: Date.now(),
          raw: trimmed,
          json
        };

        this.emit("message", msg);
      }
    });

    const onCloseOrError = () => {
      this.sockets.delete(serverId);
      this.buffers.delete(serverId);
      this.emit("connection", { serverId, status: "disconnected" } satisfies ConnectionState);

      if (this.desired.has(serverId)) {
        this.scheduleRetry(serverId);
      }
    };

    socket.on("close", onCloseOrError);

    socket.on("error", () => {
      onCloseOrError();
    });
  }

  disconnect(serverId: string) {
    this.desired.delete(serverId);
    this.clearRetry(serverId);
    this.retryAttempts.delete(serverId);

    const socket = this.sockets.get(serverId);
    if (!socket) return;
    socket.destroy();
  }

  sendJson(serverId: string, obj: unknown) {
    const socket = this.sockets.get(serverId);
    if (!socket) throw new Error(`Not connected: ${serverId}`);

    const payload = JSON.stringify(obj);
    if (payload.length > 200_000) throw new Error("Payload too large");

    socket.write(payload + "\n");
  }

  sendRaw(serverId: string, text: string) {
    const socket = this.sockets.get(serverId);
    if (!socket) throw new Error(`Not connected: ${serverId}`);
    socket.write(text.endsWith("\n") ? text : text + "\n");
  }

  private scheduleRetry(serverId: string) {
    if (this.retryTimers.has(serverId)) return;

    const attempt = (this.retryAttempts.get(serverId) ?? 0) + 1;
    this.retryAttempts.set(serverId, attempt);

    const jitter = Math.floor(Math.random() * 250);
    const delay = Math.min(RETRY_BASE_MS * 2 ** (attempt - 1), RETRY_MAX_MS) + jitter;

    const timer = setTimeout(() => {
      this.retryTimers.delete(serverId);
      const target = this.desired.get(serverId);
      if (!target) return;
      if (this.sockets.has(serverId)) return;
      this.startConnect(serverId, target.host, target.port);
    }, delay);

    this.retryTimers.set(serverId, timer);
  }

  private clearRetry(serverId: string) {
    const timer = this.retryTimers.get(serverId);
    if (timer) clearTimeout(timer);
    this.retryTimers.delete(serverId);
  }
}
