export {};

declare global {
  interface Window {
    api: {
      tcp: {
        connect: (args: { server: { id: string; name: string; host: string; port: number } }) => Promise<{ ok: true } | { ok: false; error: string }>;
        reconnect: (args: { serverId: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
        disconnect: (args: { serverId: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
        sendChat: (args: { serverId: string; text: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
        onConnection: (cb: (state: { serverId: string; status: "disconnected" | "connecting" | "connected" }) => void) => () => void;
        onMessage: (cb: (msg: { serverId: string; ts: number; raw: string; json?: unknown }) => void) => () => void;
      };
      projects: {
        create: (args: {
          name: string;
          serverVersion: string;
          selections: Record<string, string[]>;
        }) => Promise<{ ok: true } | { ok: false; error: string }>;
        reset: (args: { projectId: string; serverVersion: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
        remove: (args: { projectId: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
        list: () => Promise<
          | { ok: true; items: { id: string; name: string; serverVersion: string; selections: Record<string, string[]>; createdAt: number }[] }
          | { ok: false; error: string }
        >;
        envRead: (args: { projectId: string }) => Promise<{ ok: true; content: string } | { ok: false; error: string }>;
        envWrite: (args: { projectId: string; content: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
      };
      logs: {
        read: (args: { serverId: string; host?: string; port?: number; limit?: number; before?: number }) => Promise<
          | { ok: true; items: { ts: number; direction: "in" | "out"; raw: string }[]; before: number; hasMore: boolean }
          | { ok: false; error: string }
        >;
      };
      agents: {
        import: (args: { projectName: string; source: string; name?: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
        list: (args: { projectName: string }) => Promise<
          | { ok: true; items: { name: string; folderName: string; path: string; createdAt: number; hasIdentityFile?: boolean }[] }
          | { ok: false; error: string }
        >;
        start: (args: { projectName: string; agentName: string; options?: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
        stop: (args: { projectName: string; agentName: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
        listRunning: () => Promise<
          | { ok: true; items: { projectName: string; name: string; folderName: string; path: string; startedAt: number }[] }
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
              platform: string;
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
              platform: string;
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
      identities: {
        get: () => Promise<
          | { ok: true; identities: { id: string; name: string; value: Record<string, unknown> }[]; selectedIdentityId: string | null }
          | { ok: false; error: string }
        >;
        save: (args: { identities: { id: string; name: string; value: Record<string, unknown> }[]; selectedIdentityId: string | null }) => Promise<
          | { ok: true }
          | { ok: false; error: string }
        >;
      };
      servers: {
        list: () => Promise<{ ok: true; items: { id: string; name: string; host: string; port: number }[]; desiredById: Record<string, boolean> } | { ok: false; error: string }>;
        save: (args: { servers: { id: string; name: string; host: string; port: number }[]; desiredById?: Record<string, boolean> }) => Promise<
          | { ok: true }
          | { ok: false; error: string }
        >;
      };
    };
  }
}
