export {};

declare global {
  interface Window {
    api: {
      tcp: {
        connect: (args: { server: { id: string; name: string; host: string; port: number } }) => Promise<{ ok: true } | { ok: false; error: string }>;
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
        read: (args: { serverId: string; host?: string; port?: number }) => Promise<
          | { ok: true; items: { ts: number; direction: "in" | "out"; raw: string }[] }
          | { ok: false; error: string }
        >;
      };
      agents: {
        import: (args: { projectName: string; source: string; name?: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
        list: (args: { projectName: string }) => Promise<
          | { ok: true; items: { name: string; folderName: string; path: string; createdAt: number }[] }
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
        onExit: (cb: (args: { projectName: string; name: string; folderName: string }) => void) => () => void;
        remove: (args: { projectName: string; agentName: string; folderName?: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
      };
    };
  }
}
