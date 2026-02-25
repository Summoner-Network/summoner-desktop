import { contextBridge, ipcRenderer } from "electron";
import type { ConnectionState, InboundMessage } from "./tcp/types";

export type ServerProfile = {
  id: string;
  name: string;
  host: string;
  port: number;
};

export type Api = {
  tcp: {
    connect: (args: { server: ServerProfile }) => Promise<{ ok: true } | { ok: false; error: string }>;
    disconnect: (args: { serverId: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
    sendChat: (args: { serverId: string; text: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
    onConnection: (cb: (state: ConnectionState) => void) => () => void;
    onMessage: (cb: (msg: InboundMessage) => void) => () => void;
  };
};

const api: Api = {
  tcp: {
    connect: (args) => ipcRenderer.invoke("tcp:connect", args),
    disconnect: (args) => ipcRenderer.invoke("tcp:disconnect", args),
    sendChat: (args) => ipcRenderer.invoke("tcp:sendChat", args),

    onConnection: (cb) => {
      const h = (_: unknown, state: ConnectionState) => cb(state);
      ipcRenderer.on("evt:connection", h);
      return () => ipcRenderer.removeListener("evt:connection", h);
    },

    onMessage: (cb) => {
      const h = (_: unknown, msg: InboundMessage) => cb(msg);
      ipcRenderer.on("evt:message", h);
      return () => ipcRenderer.removeListener("evt:message", h);
    }
  }
};

contextBridge.exposeInMainWorld("api", api);
