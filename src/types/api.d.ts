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
    };
  }
}
