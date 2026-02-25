import React, { useEffect, useMemo, useState } from "react";
import Sidebar from "./components/Sidebar";
import ChatView from "./components/ChatView";
import ServersPage from "./components/ServersPage";
import AgentsPage from "./components/AgentsPage";
import NetworkPage from "./components/NetworkPage";
import IdentitiesPage from "./components/IdentitiesPage";
import HelpPage from "./components/HelpPage";
import { formatValue, parseServerMessage } from "./utils/message";
import logoMage from "../assets/icons/logo_mage.png";

export type ServerProfile = {
  id: string;
  name: string;
  host: string;
  port: number;
};

export type ConnectionStatus = "disconnected" | "connecting" | "connected";
export type Identity = { id: string; name: string; value: unknown };
type View = "chat" | "servers" | "agents" | "network" | "identities" | "help";
type RemoteAgent = {
  addr: string;
  firstSeen: number;
  lastSeen: number;
  lastContent?: unknown;
};

export default function App() {
  const [view, setView] = useState<View>("chat");

  // First iteration: one hardcoded server profile.
  // Next iteration: add CRUD + persistence.
  const [servers, setServers] = useState<ServerProfile[]>([
    {
      id: "default-187-77-102-80-8888",
      name: "Default Summoner Space",
      host: "187.77.102.80",
      port: 8888
    },
    {
      id: "localhost-127-0-0-1-8888",
      name: "Localhost",
      host: "127.0.0.1",
      port: 8888
    }
  ]);

  const [selectedServerId, setSelectedServerId] = useState<string>(servers[0].id);
  const selectedServer = servers.find((s) => s.id === selectedServerId) ?? servers[0];

  const [conn, setConn] = useState<Record<string, ConnectionStatus>>({
    [servers[0].id]: "disconnected"
  });
  const [lastConnectedAt, setLastConnectedAt] = useState<Record<string, number | null>>({
    [servers[0].id]: null,
    [servers[1].id]: null
  });
  const [desired, setDesired] = useState<Record<string, boolean>>({
    [servers[0].id]: true
  });
  const [remoteByAddr, setRemoteByAddr] = useState<Record<string, RemoteAgent>>({});
  const [selectedRemoteAddr, setSelectedRemoteAddr] = useState<string | null>(null);

  const [identities, setIdentities] = useState<Identity[]>([
    { id: "id-default", name: "Default Identity", value: { name: "Summoner", role: "client" } },
    { id: "id-bot", name: "Bot Agent", value: { name: "Bot", type: "agent" } }
  ]);
  const [selectedIdentityId, setSelectedIdentityId] = useState<string | null>(null);
  const selectedIdentity = identities.find((id) => id.id === selectedIdentityId) ?? null;

  const [toMode, setToMode] = useState<"none" | "null" | "remote">("none");
  const [selectedToKey, setSelectedToKey] = useState<string>("from");

  useEffect(() => {
    const off1 = window.api.tcp.onConnection((state) => {
      setConn((prev) => ({ ...prev, [state.serverId]: state.status }));
      if (state.status === "connected") {
        setLastConnectedAt((prev) => ({ ...prev, [state.serverId]: Date.now() }));
      }
    });
    return () => {
      off1();
    };
  }, []);

  useEffect(() => {
    const nextDesired: Record<string, boolean> = {};
    servers.forEach((s) => {
      nextDesired[s.id] = true;
      void window.api.tcp.connect({ server: s });
    });
    setDesired(nextDesired);
  }, [servers]);

  function handleAddServer(next: { name: string; host: string; port: number }) {
    const id = `${next.name}-${next.host}-${next.port}-${Date.now()}`.replace(/\s+/g, "-").toLowerCase();
    const server: ServerProfile = { id, ...next };
    setServers((prev) => [...prev, server]);
    setSelectedServerId(server.id);
    setLastConnectedAt((prev) => ({ ...prev, [server.id]: null }));
  }

  function handleSelectServerInPage(id: string) {
    setSelectedServerId(id);
  }

  function handleDeleteServer(id: string) {
    setServers((prev) => prev.filter((s) => s.id !== id));
    setConn((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setDesired((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setLastConnectedAt((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (selectedServerId === id && servers.length > 1) {
      const fallback = servers.find((s) => s.id !== id);
      if (fallback) setSelectedServerId(fallback.id);
    }
  }

  function handleAddIdentity(next: { name: string; value: unknown }) {
    const id = `${next.name}-${Date.now()}`.replace(/\s+/g, "-").toLowerCase();
    const identity: Identity = { id, ...next };
    setIdentities((prev) => [...prev, identity]);
    setSelectedIdentityId(identity.id);
  }

  function handleUpdateIdentity(id: string, next: { name: string; value: unknown }) {
    setIdentities((prev) => prev.map((it) => (it.id === id ? { ...it, ...next } : it)));
  }

  useEffect(() => {
    const off = window.api.tcp.onMessage((msg) => {
      const parsed = parseServerMessage(msg.raw);
      if (!parsed.remoteAddr) return;
      setRemoteByAddr((prev) => {
        const existing = prev[parsed.remoteAddr];
        return {
          ...prev,
          [parsed.remoteAddr]: {
            addr: parsed.remoteAddr,
            firstSeen: existing?.firstSeen ?? msg.ts,
            lastSeen: msg.ts,
            lastContent: parsed.content
          }
        };
      });
      setSelectedRemoteAddr((prev) => prev ?? parsed.remoteAddr);
    });
    return () => off();
  }, []);

  const status = conn[selectedServerId] ?? "disconnected";
  const isDesired = desired[selectedServerId] ?? false;

  const selectedRemote = selectedRemoteAddr ? remoteByAddr[selectedRemoteAddr] : null;
  function buildPaths(value: unknown, prefix = ""): string[] {
    if (value === null || value === undefined) return [];
    if (Array.isArray(value)) {
      return value.flatMap((v, i) => buildPaths(v, prefix ? `${prefix}[${i}]` : `[${i}]`));
    }
    if (typeof value === "object") {
      const out: string[] = [];
      Object.entries(value as Record<string, unknown>).forEach(([k, v]) => {
        const path = prefix ? `${prefix}.${k}` : k;
        out.push(path);
        out.push(...buildPaths(v, path));
      });
      return out;
    }
    return [];
  }

  function getValueAtPath(value: unknown, path: string): unknown {
    if (!path) return value;
    let cur: unknown = value;
    const parts = path.split(".").flatMap((part) => {
      const items: string[] = [];
      let rest = part;
      while (rest.length) {
        const idx = rest.indexOf("[");
        if (idx === -1) {
          items.push(rest);
          rest = "";
        } else {
          if (idx > 0) items.push(rest.slice(0, idx));
          const end = rest.indexOf("]");
          if (end > idx) {
            items.push(rest.slice(idx, end + 1));
            rest = rest.slice(end + 1);
          } else {
            items.push(rest);
            rest = "";
          }
        }
      }
      return items.filter(Boolean);
    });

    for (const part of parts) {
      if (part.startsWith("[") && part.endsWith("]")) {
        const idx = Number(part.slice(1, -1));
        if (!Array.isArray(cur) || !Number.isInteger(idx)) return undefined;
        cur = cur[idx];
      } else {
        if (!cur || typeof cur !== "object") return undefined;
        cur = (cur as Record<string, unknown>)[part];
      }
    }
    return cur;
  }

  const availableToKeys = selectedRemote
    ? [
        "remote_addr",
        ...(selectedRemote.lastContent ? buildPaths(selectedRemote.lastContent) : [])
      ]
    : [];

  let toValue: unknown = null;
  if (toMode === "remote" && selectedRemote) {
    if (selectedToKey === "remote_addr") {
      toValue = selectedRemote.addr;
    } else if (selectedRemote.lastContent !== undefined) {
      toValue = getValueAtPath(selectedRemote.lastContent, selectedToKey);
    }
  }
  const toLabel =
    toMode === "none"
      ? "none"
      : toMode === "null"
        ? "null"
        : toValue === null || toValue === undefined
          ? "unavailable"
          : formatValue(toValue);

  useEffect(() => {
    if (toMode === "remote" && availableToKeys.length === 0) {
      setToMode("none");
      return;
    }
    if (toMode === "remote" && availableToKeys.length > 0 && !availableToKeys.includes(selectedToKey)) {
      setSelectedToKey(availableToKeys[0]);
    }
  }, [toMode, availableToKeys, selectedToKey]);

  async function handleConnect(server: ServerProfile) {
    setDesired((prev) => ({ ...prev, [server.id]: true }));
    const res = await window.api.tcp.connect({ server });
    if (!res.ok) throw new Error(res.error);
  }

  async function handleDisconnect(serverId: string) {
    setDesired((prev) => ({ ...prev, [serverId]: false }));
    const res = await window.api.tcp.disconnect({ serverId });
    if (!res.ok) throw new Error(res.error);
  }

  function handleSelectServer(id: string) {
    setSelectedServerId(id);
    setView("chat");
  }

  return (
    <div className="app-shell">
      <div className="left-rail">
        <button className="workspace-badge" type="button" onClick={() => setView("chat")} aria-label="Summoner Home">
          <img src={logoMage} alt="Summoner" className="workspace-logo" />
        </button>
        <div className="rail-sep" />
        <button
          className={`rail-btn ${view === "servers" ? "active" : ""}`}
          onClick={() => setView("servers")}
          type="button"
        >
          Servers
        </button>
        <button
          className={`rail-btn ${view === "agents" ? "active" : ""}`}
          onClick={() => setView("agents")}
          type="button"
        >
          Agents
        </button>
        <button
          className={`rail-btn ${view === "network" ? "active" : ""}`}
          onClick={() => setView("network")}
          type="button"
        >
          Network
        </button>
        <button
          className={`rail-btn ${view === "identities" ? "active" : ""}`}
          onClick={() => setView("identities")}
          type="button"
        >
          Identities
        </button>
        <div className="rail-grow" />
        <button
          className={`rail-btn ghost ${view === "help" ? "active" : ""}`}
          type="button"
          onClick={() => setView("help")}
        >
          ?
        </button>
      </div>

      <Sidebar
        servers={servers}
        selectedServerId={selectedServerId}
        onSelectServer={handleSelectServer}
        statusById={conn}
        desiredById={desired}
        remoteByAddr={remoteByAddr}
        selectedRemoteAddr={selectedRemoteAddr}
        onSelectRemoteAddr={(addr) => {
          setSelectedRemoteAddr(addr);
          setView("chat");
          setToMode("remote");
          setSelectedToKey("remote_addr");
        }}
        identities={identities}
        selectedIdentityId={selectedIdentityId}
        onSelectIdentityId={setSelectedIdentityId}
      />

      <div className="main">
        {view === "chat" ? (
          <>
            <ChatView
              server={selectedServer}
              status={status}
              desired={isDesired}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              toValue={toValue}
              toMode={toMode}
              toLabel={toLabel}
              onSetToMode={setToMode}
              onSetToKey={setSelectedToKey}
              availableToKeys={availableToKeys}
              selectedToKey={selectedToKey}
              fromIdentity={selectedIdentity}
              onSetFromIdentity={setSelectedIdentityId}
              identityOptions={identities}
            />
          </>
        ) : null}

        {view !== "chat" ? (
          <div className="page-frame">
            {view === "servers" ? (
              <ServersPage
                servers={servers}
                selectedServerId={selectedServerId}
                onAddServer={handleAddServer}
                onSelectServer={handleSelectServerInPage}
                onDeleteServer={handleDeleteServer}
                lastConnectedAt={lastConnectedAt}
              />
            ) : null}
            {view === "agents" ? <AgentsPage /> : null}
            {view === "network" ? (
              <NetworkPage
                remoteByAddr={remoteByAddr}
                selectedRemoteAddr={selectedRemoteAddr}
                onSelectRemoteAddr={setSelectedRemoteAddr}
              />
            ) : null}
            {view === "identities" ? (
              <IdentitiesPage
                identities={identities}
                selectedIdentityId={selectedIdentityId}
                onSelectIdentityId={setSelectedIdentityId}
                onAddIdentity={handleAddIdentity}
                onUpdateIdentity={handleUpdateIdentity}
              />
            ) : null}
            {view === "help" ? <HelpPage /> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
