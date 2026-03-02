import { contextBridge, ipcRenderer } from "electron";
import type { ConnectionState, InboundMessage } from "./tcp/types";

export type ServerProfile = {
  id: string;
  name: string;
  host: string;
  port: number;
};

export type ProjectSpec = {
  name: string;
  serverVersion: string;
  selections: Record<string, string[]>;
};

export type AgentImportSpec = {
  projectName: string;
  source: string;
  name?: string;
};

export type AgentListItem = {
  name: string;
  folderName: string;
  path: string;
  createdAt: number;
};

export type RunningAgent = {
  projectName: string;
  name: string;
  folderName: string;
  path: string;
  startedAt: number;
};

export type Api = {
  tcp: {
    connect: (args: { server: ServerProfile }) => Promise<{ ok: true } | { ok: false; error: string }>;
    reconnect: (args: { serverId: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
    disconnect: (args: { serverId: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
    sendChat: (args: { serverId: string; text: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
    onConnection: (cb: (state: ConnectionState) => void) => () => void;
    onMessage: (cb: (msg: InboundMessage) => void) => () => void;
  };
  projects: {
    create: (args: ProjectSpec) => Promise<{ ok: true } | { ok: false; error: string }>;
    reset: (args: { name: string; serverVersion: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
    remove: (args: { name: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
    list: () => Promise<
      | { ok: true; items: { name: string; serverVersion: string; selections: Record<string, string[]>; createdAt: number }[] }
      | { ok: false; error: string }
    >;
    envRead: (args: { name: string }) => Promise<{ ok: true; content: string } | { ok: false; error: string }>;
    envWrite: (args: { name: string; content: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
  };
  logs: {
    read: (args: { serverId: string; host?: string; port?: number; limit?: number; before?: number }) => Promise<
      | { ok: true; items: { ts: number; direction: "in" | "out"; raw: string }[]; before: number; hasMore: boolean }
      | { ok: false; error: string }
    >;
  };
  agents: {
    import: (args: AgentImportSpec) => Promise<{ ok: true } | { ok: false; error: string }>;
    list: (args: { projectName: string }) => Promise<
      | { ok: true; items: (AgentListItem & { hasIdentityFile?: boolean })[] }
      | { ok: false; error: string }
    >;
    start: (args: { projectName: string; agentName: string; options?: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
    stop: (args: { projectName: string; agentName: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
    listRunning: () => Promise<
      | { ok: true; items: RunningAgent[] }
      | { ok: false; error: string }
    >;
    getIdentity: (args: { projectName: string; agentName: string }) => Promise<
      | { ok: true; value: unknown }
      | { ok: false; error: string }
    >;
    identityRead: (args: { projectName: string; folderName: string }) => Promise<
      | { ok: true; exists: boolean; content: string }
      | { ok: false; error: string }
    >;
    identityWrite: (args: { projectName: string; folderName: string; content: string }) => Promise<
      | { ok: true }
      | { ok: false; error: string }
    >;
    onExit: (cb: (args: { projectName: string; name: string; folderName: string }) => void) => () => void;
    remove: (args: { projectName: string; agentName: string; folderName?: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
  };
  localServer: {
    loadConfig: (args: { projectName: string }) => Promise<
      | {
          ok: true;
          serverVersion: string;
          forcedVersion: string;
          configSource: "default" | "saved";
          configPath: string;
          config: Record<string, unknown>;
          tooltipsLong: Record<string, unknown>;
          tooltipsShort: Record<string, unknown>;
        }
      | { ok: false; error: string }
    >;
    saveConfig: (args: { projectName: string; config: Record<string, unknown> }) => Promise<{ ok: true } | { ok: false; error: string }>;
    run: (args: { projectName: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
    stop: (args: { projectName: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
    listRunning: () => Promise<{ ok: true; items: string[] } | { ok: false; error: string }>;
    onExit: (cb: (args: { projectName: string }) => void) => () => void;
    onStart: (cb: (args: { projectName: string }) => void) => () => void;
  };
  maps: {
    list: () => Promise<
      | { ok: true; items: { id: string; name: string; source: "bundle" | "local" }[]; selectedMapId?: string }
      | { ok: false; error: string }
    >;
    load: (args: { id: string }) => Promise<
      | { ok: true; svg: string; params: string }
      | { ok: false; error: string }
    >;
    select: (args: { id: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
    openFolder: () => Promise<{ ok: true; path: string } | { ok: false; error: string }>;
    geoLookup: (args: { ip: string }) => Promise<
      | { ok: true; lat: number; lon: number; city?: string; country?: string; cached: boolean }
      | { ok: false; error: string }
    >;
  };
  settings: {
    get: () => Promise<
      | {
          ok: true;
          platform: NodeJS.Platform;
          defaultSummonerBase: string;
          displayDefaultSummonerBase: string;
          summonerBase: string | null;
          effectiveSummonerBase: string;
          displayEffectiveSummonerBase: string;
          effectiveSummonerRoot: string;
          displayEffectiveSummonerRoot: string;
        }
      | { ok: false; error: string }
    >;
    set: (args: { summonerBase?: string | null }) => Promise<
      | {
          ok: true;
          platform: NodeJS.Platform;
          defaultSummonerBase: string;
          displayDefaultSummonerBase: string;
          summonerBase: string | null;
          effectiveSummonerBase: string;
          displayEffectiveSummonerBase: string;
          effectiveSummonerRoot: string;
          displayEffectiveSummonerRoot: string;
        }
      | { ok: false; error: string }
    >;
  };
};

const api: Api = {
  tcp: {
    connect: (args) => ipcRenderer.invoke("tcp:connect", args),
    reconnect: (args) => ipcRenderer.invoke("tcp:reconnect", args),
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
  },
  projects: {
    create: (args) => ipcRenderer.invoke("projects:create", args),
    reset: (args) => ipcRenderer.invoke("projects:reset", args),
    remove: (args) => ipcRenderer.invoke("projects:remove", args),
    list: () => ipcRenderer.invoke("projects:list"),
    envRead: (args) => ipcRenderer.invoke("projects:envRead", args),
    envWrite: (args) => ipcRenderer.invoke("projects:envWrite", args)
  },
  logs: {
    read: (args) => ipcRenderer.invoke("logs:read", args)
  },
  agents: {
    import: (args) => ipcRenderer.invoke("agents:import", args),
    list: (args) => ipcRenderer.invoke("agents:list", args),
    start: (args) => ipcRenderer.invoke("agents:start", args),
    stop: (args) => ipcRenderer.invoke("agents:stop", args),
    listRunning: () => ipcRenderer.invoke("agents:listRunning"),
    getIdentity: (args) => ipcRenderer.invoke("agents:getIdentity", args),
    identityRead: (args) => ipcRenderer.invoke("agents:identityRead", args),
    identityWrite: (args) => ipcRenderer.invoke("agents:identityWrite", args),
    onExit: (cb) => {
      const h = (_: unknown, payload: { projectName: string; name: string; folderName: string }) => cb(payload);
      ipcRenderer.on("evt:agent-exit", h);
      return () => ipcRenderer.removeListener("evt:agent-exit", h);
    },
    remove: (args) => ipcRenderer.invoke("agents:remove", args)
  },
  localServer: {
    loadConfig: (args) => ipcRenderer.invoke("localServer:loadConfig", args),
    saveConfig: (args) => ipcRenderer.invoke("localServer:saveConfig", args),
    run: (args) => ipcRenderer.invoke("localServer:run", args),
    stop: (args) => ipcRenderer.invoke("localServer:stop", args),
    listRunning: () => ipcRenderer.invoke("localServer:listRunning"),
    onExit: (cb) => {
      const h = (_: unknown, payload: { projectName: string }) => cb(payload);
      ipcRenderer.on("evt:localServer-exit", h);
      return () => ipcRenderer.removeListener("evt:localServer-exit", h);
    },
    onStart: (cb) => {
      const h = (_: unknown, payload: { projectName: string }) => cb(payload);
      ipcRenderer.on("evt:localServer-start", h);
      return () => ipcRenderer.removeListener("evt:localServer-start", h);
    }
  },
  maps: {
    list: () => ipcRenderer.invoke("maps:list"),
    load: (args) => ipcRenderer.invoke("maps:load", args),
    select: (args) => ipcRenderer.invoke("maps:select", args),
    openFolder: () => ipcRenderer.invoke("maps:openFolder"),
    geoLookup: (args) => ipcRenderer.invoke("maps:geoLookup", args)
  },
  settings: {
    get: () => ipcRenderer.invoke("settings:get"),
    set: (args) => ipcRenderer.invoke("settings:set", args)
  }
};

contextBridge.exposeInMainWorld("api", api);
