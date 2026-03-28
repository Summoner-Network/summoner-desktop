import React, { useEffect, useRef, useState } from "react";
import type { ServerProfile, ConnectionStatus, Identity } from "../App";
import iconServer from "../../assets/svg_icons/server.svg";
import iconAgents from "../../assets/svg_icons/robot.svg";
import iconNetwork from "../../assets/svg_icons/router-fill.svg";
import iconIdentities from "../../assets/svg_icons/person-vcard.svg";

export default function Sidebar(props: {
  servers: ServerProfile[];
  selectedServerId: string | null;
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
  runningAgents: { projectName: string; name: string; folderName: string }[];
  selectedAgentKey: string | null;
  onSelectAgent: (agent: { projectName: string; name: string; folderName: string }) => void;
  identities: Identity[];
  selectedIdentityId: string | null;
  onSelectIdentityId: (id: string | null) => void;
  onSelectPage?: (page: string) => void;
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
    runningAgents,
    selectedAgentKey,
    onSelectAgent,
    identities,
    selectedIdentityId,
    onSelectIdentityId,
    onSelectPage
  } = props;
  const remotes = Object.values(remoteByAddr).sort((a, b) => b.lastSeen - a.lastSeen);
  const serversListRef = useRef<HTMLDivElement | null>(null);
  const agentsListRef = useRef<HTMLDivElement | null>(null);
  const networkListRef = useRef<HTMLDivElement | null>(null);
  const idsListRef = useRef<HTMLDivElement | null>(null);
  const [scrollableBySection, setScrollableBySection] = useState({
    servers: false,
    agents: false,
    network: false,
    ids: false,
    fork: false
  });
  const [collapsed, setCollapsed] = useState({
    servers: false,
    agents: false,
    network: false,
    ids: false,
    fork: false
  });

  useEffect(() => {
    const checkScrollable = () => {
      setScrollableBySection({
        servers: !!serversListRef.current && serversListRef.current.scrollHeight > serversListRef.current.clientHeight + 1,
        agents: !!agentsListRef.current && agentsListRef.current.scrollHeight > agentsListRef.current.clientHeight + 1,
        network: !!networkListRef.current && networkListRef.current.scrollHeight > networkListRef.current.clientHeight + 1,
        ids: !!idsListRef.current && idsListRef.current.scrollHeight > idsListRef.current.clientHeight + 1,
        fork: false
      });
    };
    const raf = requestAnimationFrame(checkScrollable);
    window.addEventListener("resize", checkScrollable);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", checkScrollable);
    };
  }, [servers.length, runningAgents.length, remotes.length, identities.length, selectedIdentityId, selectedServerId, selectedRemoteAddr, selectedAgentKey]);

  return (
    <div className="sidebar">
      <div className={`sidebar-section sidebar-servers ${collapsed.servers ? "collapsed" : ""}`}>
        <button
          type="button"
          className="sidebar-section-title"
          onClick={() => setCollapsed((prev) => ({ ...prev, servers: !prev.servers }))}
          aria-expanded={!collapsed.servers}
        >
          <span className="section-caret" aria-hidden="true" />
          <span>My Servers</span>
        </button>
        <div className={`sidebar-list-frame ${scrollableBySection.servers ? "scrollable" : ""}`}>
          <div
            ref={serversListRef}
            className="list sidebar-list"
            aria-hidden={collapsed.servers}
          >
          {servers.map((s) => {
          const status = statusById[s.id] ?? "disconnected";
          const desired = desiredById[s.id] ?? false;
          const selected = selectedServerId ? s.id === selectedServerId : false;
          return (
            <div
              key={s.id}
              className={`list-item clickable ${selected ? "selected" : ""}`}
              onClick={() => onSelectServer(s.id)}
              role="button"
              tabIndex={0}
            >
              <div className="row-between gap10 sidebar-row">
                <div className="row align-center gap12">
                  <div className="list-icon-wrap">
                    <span className="list-icon icon-server" aria-hidden="true" />
                  </div>
                  <div className="sidebar-text">
                    <div className="fw600 sidebar-title">{s.name}</div>
                    <div className="small sidebar-subtitle">
                      {s.host}:{s.port}
                    </div>
                  </div>
                </div>
                <div className={`pill status-dot ${status}`} aria-label={status} />
              </div>
            </div>
          );
          })}
          </div>
        </div>
      </div>

      <div className={`sidebar-section sidebar-agents ${collapsed.agents ? "collapsed" : ""}`}>
        <button
          type="button"
          className="sidebar-section-title"
          onClick={() => setCollapsed((prev) => ({ ...prev, agents: !prev.agents }))}
          aria-expanded={!collapsed.agents}
        >
          <span className="section-caret" aria-hidden="true" />
          <span>My Agents</span>
        </button>
        <div className={`sidebar-list-frame ${scrollableBySection.agents ? "scrollable" : ""}`}>
          <div
            ref={agentsListRef}
            className="list sidebar-list"
            aria-hidden={collapsed.agents}
          >
          {runningAgents.length === 0 ? <div className="small">No active agents.</div> : null}
          {runningAgents.map((agent) => (
          <div
            key={`${agent.projectName}:${agent.folderName}`}
            className={`list-item clickable ${
              selectedAgentKey === `${agent.projectName}:${agent.folderName}` ? "selected" : ""
            }`}
            onClick={() => onSelectAgent(agent)}
            role="button"
            tabIndex={0}
          >
            <div className="row align-center gap12">
              <div className="list-icon-wrap">
                <span className="list-icon icon-agents" aria-hidden="true" />
              </div>
              <div className="sidebar-text">
                <div className="fw600 sidebar-title">{agent.name}</div>
                <div className="small sidebar-subtitle">{agent.projectName}</div>
              </div>
            </div>
          </div>
          ))}
          </div>
        </div>
      </div>

      <div className={`sidebar-section sidebar-network ${collapsed.network ? "collapsed" : ""}`}>
        <button
          type="button"
          className="sidebar-section-title"
          onClick={() => setCollapsed((prev) => ({ ...prev, network: !prev.network }))}
          aria-expanded={!collapsed.network}
        >
          <span className="section-caret" aria-hidden="true" />
          <span>My Network</span>
        </button>
        <div className={`sidebar-list-frame ${scrollableBySection.network ? "scrollable" : ""}`}>
          <div
            ref={networkListRef}
            className="list sidebar-list"
            aria-hidden={collapsed.network}
          >
          {remotes.length === 0 ? <div className="small">No remote agents yet.</div> : null}
          {remotes.map((agent) => (
          <div
            key={agent.addr}
            className={`list-item clickable ${agent.addr === selectedRemoteAddr ? "selected" : ""}`}
            onClick={() => onSelectRemoteAddr(agent.addr)}
            role="button"
            tabIndex={0}
          >
            <div className="row align-center gap12">
              <div className="list-icon-wrap">
                <span className="list-icon icon-network" aria-hidden="true" />
              </div>
              <div className="sidebar-text">
                <div className="fw600 sidebar-title">{agent.addr}</div>
                <div className="small sidebar-subtitle">
                  Last seen: {new Date(agent.lastSeen).toLocaleTimeString()}
                </div>
              </div>
            </div>
          </div>
          ))}
          </div>
        </div>
      </div>

      <div className={`sidebar-section sidebar-ids ${collapsed.ids ? "collapsed" : ""}`}>
        <button
          type="button"
          className="sidebar-section-title"
          onClick={() => setCollapsed((prev) => ({ ...prev, ids: !prev.ids }))}
          aria-expanded={!collapsed.ids}
        >
          <span className="section-caret" aria-hidden="true" />
          <span>My IDs</span>
        </button>
        <div className={`sidebar-list-frame ${scrollableBySection.ids ? "scrollable" : ""}`}>
          <div
            ref={idsListRef}
            className="list sidebar-list"
            aria-hidden={collapsed.ids}
          >
          <div
            className={`list-item clickable ${selectedIdentityId === null ? "selected" : ""}`}
            onClick={() => onSelectIdentityId(null)}
            role="button"
            tabIndex={0}
          >
            <div className="row align-center gap12">
              <div className="list-icon-wrap">
                <span className="list-icon icon-identities" aria-hidden="true" />
              </div>
              <div className="sidebar-text">
                <div className="fw600 sidebar-title">None</div>
                <div className="small sidebar-subtitle">Do not set "from"</div>
              </div>
            </div>
          </div>
          {identities.map((id) => (
          <div
            key={id.id}
            className={`list-item clickable ${id.id === selectedIdentityId ? "selected" : ""}`}
            onClick={() => onSelectIdentityId(id.id)}
            role="button"
            tabIndex={0}
          >
            <div className="row align-center gap12">
              <div className="list-icon-wrap">
                <span className="list-icon icon-identities" aria-hidden="true" />
              </div>
              <div className="sidebar-text">
                <div className="fw600 sidebar-title">{id.name}</div>
                <div className="small sidebar-subtitle">
                  {typeof id.value === "object" ? "JSON payload" : String(id.value)}
                </div>
              </div>
            </div>
          </div>
          ))}
          </div>
        </div>
      </div>

      <div className={`sidebar-section sidebar-fork ${collapsed.fork ? "collapsed" : ""}`}>
        <button
          type="button"
          className="sidebar-section-title"
          onClick={() => setCollapsed((prev) => ({ ...prev, fork: !prev.fork }))}
          aria-expanded={!collapsed.fork}
        >
          <span className="section-caret" aria-hidden="true" />
          <span>Fork Chronicle</span>
        </button>
        <div className="sidebar-list-frame">
          <div className="list sidebar-list" aria-hidden={collapsed.fork}>
            <div
              className="list-item clickable"
              onClick={() => onSelectPage?.("fork")}
              role="button"
              tabIndex={0}
            >
              <div className="row align-center gap12">
                <div className="list-icon-wrap">
                  <svg
                    className="list-icon"
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M8 2 L8 6 M8 10 L8 14 M5 5 L8 2 L11 5 M5 11 L8 14 L11 11 M4 8 L12 8" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="sidebar-text">
                  <div className="fw600 sidebar-title">Launch Fork Chronicle</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
