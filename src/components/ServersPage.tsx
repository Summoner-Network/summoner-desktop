import React, { useState } from "react";
import type { ServerProfile } from "../App";

export default function ServersPage(props: {
  servers: ServerProfile[];
  selectedServerId: string;
  onAddServer: (server: { name: string; host: string; port: number }) => void;
  onSelectServer: (id: string) => void;
  onDeleteServer: (id: string) => void;
  lastConnectedAt: Record<string, number | null>;
}) {
  const { servers, selectedServerId, onAddServer, onSelectServer, onDeleteServer, lastConnectedAt } = props;
  const selected = servers.find((s) => s.id === selectedServerId) ?? servers[0];
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("8888");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    const trimmedName = name.trim();
    const trimmedHost = host.trim();
    const portNum = Number(port);
    if (!trimmedName) return setError("Name is required.");
    if (!trimmedHost) return setError("Host is required.");
    if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) return setError("Port must be 1-65535.");
    onAddServer({ name: trimmedName, host: trimmedHost, port: portNum });
    setName("");
    setHost("");
    setPort("8888");
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="title">Servers</div>
          <div className="subtitle">Manage your server library and connection details.</div>
        </div>
      </div>

      <div className="page-grid">
        <div className="panel">
          <div className="panel-title">My Servers</div>
          <div className="panel-list">
            {servers.map((s) => (
              <div
                key={s.id}
                className={`panel-item ${s.id === selected.id ? "selected" : ""}`}
                onClick={() => onSelectServer(s.id)}
                role="button"
                tabIndex={0}
              >
                <div className="row-between gap10">
                  <div className="fw600">{s.name}</div>
                  <button
                    type="button"
                    className="ghost-btn danger-outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteServer(s.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
                <div className="small">
                  {s.host}:{s.port}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Server Detail</div>
          <div className="detail-grid">
            <div className="detail-row">
              <span className="detail-label">Name</span>
              <span className="detail-value">{selected.name}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Host</span>
              <span className="detail-value">{selected.host}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Port</span>
              <span className="detail-value">{selected.port}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Last connected</span>
              <span className="detail-value">
                {lastConnectedAt[selected.id]
                  ? new Date(lastConnectedAt[selected.id] as number).toLocaleString()
                  : "Never"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">Add Server</div>
        <div className="form-grid">
          <label className="form-field">
            <span className="detail-label">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Server" />
          </label>
          <label className="form-field">
            <span className="detail-label">Host</span>
            <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="127.0.0.1" />
          </label>
          <label className="form-field">
            <span className="detail-label">Port</span>
            <input value={port} onChange={(e) => setPort(e.target.value)} placeholder="8888" />
          </label>
          <button className="primary" type="button" onClick={submit}>
            Add Server
          </button>
        </div>
        {error ? <div className="small text-error mt6">{error}</div> : null}
      </div>
    </div>
  );
}
