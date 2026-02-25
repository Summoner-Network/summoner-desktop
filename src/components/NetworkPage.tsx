import React from "react";
import { formatValue } from "../utils/message";

type RemoteAgent = {
  addr: string;
  firstSeen: number;
  lastSeen: number;
  lastContent?: unknown;
};

export default function NetworkPage(props: {
  remoteByAddr: Record<string, RemoteAgent>;
  selectedRemoteAddr: string | null;
  onSelectRemoteAddr: (addr: string) => void;
}) {
  const { remoteByAddr, selectedRemoteAddr, onSelectRemoteAddr } = props;
  const agents = Object.values(remoteByAddr).sort((a, b) => b.lastSeen - a.lastSeen);
  const selected = selectedRemoteAddr ? remoteByAddr[selectedRemoteAddr] : agents[0];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="title">Network</div>
          <div className="subtitle">Agents discovered on remote servers.</div>
        </div>
      </div>

      <div className="page-grid">
        <div className="panel">
          <div className="panel-title">My Network</div>
          <div className="panel-list">
            {agents.length === 0 ? (
              <div className="small">No remote agents detected yet.</div>
            ) : null}
            {agents.map((agent) => (
              <div
                key={agent.addr}
                className={`panel-item ${agent.addr === selected?.addr ? "selected" : ""}`}
                onClick={() => onSelectRemoteAddr(agent.addr)}
                role="button"
                tabIndex={0}
              >
                <div className="fw600">{agent.addr}</div>
                <div className="small">Last seen: {new Date(agent.lastSeen).toLocaleTimeString()}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Agent Detail</div>
          {selected ? (
            <div className="detail-grid">
              <div className="detail-row">
                <span className="detail-label">Address</span>
                <span className="detail-value">{selected.addr}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">First seen</span>
                <span className="detail-value">{new Date(selected.firstSeen).toLocaleString()}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Last seen</span>
                <span className="detail-value">{new Date(selected.lastSeen).toLocaleString()}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Last content</span>
                <pre className="detail-pre">
                  {selected.lastContent === undefined ? "No structured payload yet." : formatValue(selected.lastContent)}
                </pre>
              </div>
            </div>
          ) : (
            <div className="small">Select a remote agent to view details.</div>
          )}
        </div>
      </div>
    </div>
  );
}
