import { ipcMain, BrowserWindow } from "electron";
import type { ServerProfile } from "./preload";
import { TcpManager } from "./tcp/TcpManager";

function isValidHost(host: string): boolean {
  // Allow IPv4, localhost, and basic DNS names.
  // Keep this strict for a secure baseline. Expand later if needed.
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
  const dns = /^[a-zA-Z0-9.-]+$/;
  if (host === "localhost") return true;
  if (ipv4.test(host)) {
    const parts = host.split(".").map((p) => Number(p));
    return parts.length === 4 && parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255);
  }
  return dns.test(host) && host.length <= 253;
}

function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

function safeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Unknown error";
}

export function registerIpc(win: BrowserWindow, tcp: TcpManager) {
  // When the app is started twice (common on macOS activation edge cases),
  // Electron will throw if we register a second handler for the same channel.
  // Keep this idempotent for a stable, secure baseline.
  ipcMain.removeHandler("tcp:connect");
  ipcMain.removeHandler("tcp:disconnect");
  ipcMain.removeHandler("tcp:sendChat");

  ipcMain.handle("tcp:connect", async (_e, args: { server: ServerProfile }) => {
    try {
      const s = args.server;
      if (!s || typeof s !== "object") throw new Error("Missing server");
      if (typeof s.id !== "string" || s.id.length < 1) throw new Error("Invalid server id");
      if (typeof s.host !== "string" || !isValidHost(s.host)) throw new Error("Invalid host");
      if (typeof s.port !== "number" || !isValidPort(s.port)) throw new Error("Invalid port");

      tcp.connect(s.id, s.host, s.port);
      return { ok: true as const };
    } catch (e) {
      return { ok: false as const, error: safeError(e) };
    }
  });

  ipcMain.handle("tcp:disconnect", async (_e, args: { serverId: string }) => {
    try {
      if (typeof args.serverId !== "string" || args.serverId.length < 1) throw new Error("Invalid server id");
      tcp.disconnect(args.serverId);
      return { ok: true as const };
    } catch (e) {
      return { ok: false as const, error: safeError(e) };
    }
  });

  ipcMain.handle("tcp:sendChat", async (_e, args: { serverId: string; text: string }) => {
    try {
      if (typeof args.serverId !== "string" || args.serverId.length < 1) throw new Error("Invalid server id");
      if (typeof args.text !== "string") throw new Error("Invalid text");
      if (args.text.length === 0) throw new Error("Empty message");
      if (args.text.length > 8000) throw new Error("Message too large");

      tcp.sendRaw(args.serverId, args.text);

      return { ok: true as const };
    } catch (e) {
      return { ok: false as const, error: safeError(e) };
    }
  });

  const safeSend = (channel: string, payload: unknown) => {
    if (win.isDestroyed()) return;
    const wc = win.webContents;
    if (wc.isDestroyed()) return;
    wc.send(channel, payload);
  };

  const onConnection = (state: unknown) => safeSend("evt:connection", state);
  const onMessage = (msg: unknown) => safeSend("evt:message", msg);

  tcp.on("connection", onConnection);
  tcp.on("message", onMessage);

  win.on("closed", () => {
    tcp.off("connection", onConnection);
    tcp.off("message", onMessage);
  });
}
