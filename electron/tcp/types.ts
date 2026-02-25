export type ConnectionState =
  | { serverId: string; status: "disconnected" }
  | { serverId: string; status: "connecting" }
  | { serverId: string; status: "connected" };

export type InboundMessage = {
  serverId: string;
  ts: number;
  raw: string;
  json?: unknown;
};
