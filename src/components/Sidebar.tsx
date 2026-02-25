import React from "react";
import type { ServerProfile, ConnectionStatus, Identity } from "../App";

export default function Sidebar(props: {
  servers: ServerProfile[];
  selectedServerId: string;
  onSelectServer: (id: string) => void;
  statusById: Record<string, ConnectionStatus>;
  desiredById: Record<string, boolean>;
  remoteByAddr: Record<
    string,
    {
      addr: string;
      lastSeen: number;
      lastMessage: string;
    }
  >;
  selectedRemoteAddr: string | null;
  onSelectRemoteAddr: (addr: string) => void;
  identities: Identity[];
  selectedIdentityId: string | null;
  onSelectIdentityId: (id: string | null) => void;
}) {
  const {
    servers,
    selectedServerId,
    onSelectServer,
    statusById,
    desiredById,
    remoteByAddr,
    selectedRemoteAddr,
    onSelectRemoteAddr,
    identities,
    selectedIdentityId,
    onSelectIdentityId
  } = props;
  const remotes = Object.values(remoteByAddr).sort((a, b) => b.lastSeen - a.lastSeen);

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="fw700">My Servers</div>
      </div>
      <div className="list">
        {servers.map((s) => {
          const status = statusById[s.id] ?? "disconnected";
          const desired = desiredById[s.id] ?? false;
          const selected = s.id === selectedServerId;
          return (
            <div
              key={s.id}
              className={`list-item clickable ${selected ? "selected" : ""}`}
              onClick={() => onSelectServer(s.id)}
              role="button"
              tabIndex={0}
            >
              <div className="row-between gap10">
                <div className="row align-center gap10">
                  <div className="fw600">{s.name}</div>
                </div>
                <div className={`pill status-dot ${status}`} aria-label={status} />
              </div>
              <div className="small mt6">
                {s.host}:{s.port}
              </div>
            </div>
          );
        })}
      </div>

      <div className="fw700 mt18">My Agents</div>
      <div className="small mt6">No local agents detected yet.</div>

      <div className="fw700 mt18">My Network</div>
      <div className="list mt6">
        {remotes.length === 0 ? <div className="small">No remote agents yet.</div> : null}
        {remotes.map((agent) => (
          <div
            key={agent.addr}
            className={`list-item clickable ${agent.addr === selectedRemoteAddr ? "selected" : ""}`}
            onClick={() => onSelectRemoteAddr(agent.addr)}
            role="button"
            tabIndex={0}
          >
            <div className="fw600">{agent.addr}</div>
            <div className="small mt6">Last seen: {new Date(agent.lastSeen).toLocaleTimeString()}</div>
          </div>
        ))}
      </div>

      <div className="fw700 mt18">My IDs</div>
      <div className="list mt6">
        {identities.map((id) => (
          <div
            key={id.id}
            className={`list-item clickable ${id.id === selectedIdentityId ? "selected" : ""}`}
            onClick={() => onSelectIdentityId(id.id)}
            role="button"
            tabIndex={0}
          >
            <div className="fw600">{id.name}</div>
            <div className="small mt6">{typeof id.value === "object" ? "JSON payload" : String(id.value)}</div>
          </div>
        ))}
        <div
          className={`list-item clickable ${selectedIdentityId === null ? "selected" : ""}`}
          onClick={() => onSelectIdentityId(null)}
          role="button"
          tabIndex={0}
        >
          <div className="fw600">None</div>
          <div className="small mt6">Do not set "from"</div>
        </div>
      </div>
    </div>
  );
}
