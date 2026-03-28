import React, { useEffect, useMemo, useState } from "react";
import Sidebar from "./components/Sidebar";
import ChatView from "./components/ChatView";
import ServersPage from "./components/ServersPage";
import AgentsPage from "./components/AgentsPage";
import NetworkPage from "./components/NetworkPage";
import DashboardPage from "./components/DashboardPage";
import IdentitiesPage from "./components/IdentitiesPage";
import ProjectsPage, { ProjectItem, ProjectSpec } from "./components/ProjectsPage";
import HelpPage from "./components/HelpPage";
import PlaceholderPanel from "./components/PlaceholderPanel";
import ForkGamePage from "./games/fork-chronicle/ui/ForkGamePage";
import { formatValue, parseServerMessage } from "./utils/message";
import { useMapData } from "./hooks/useMapData";
import { useForkGame } from "./games/fork-chronicle/ui/useForkGame";
import logoMage from "../assets/icons/logo_mage.png";

export type ServerProfile = {
  id: string;
  name: string;
  host: string;
  port: number;
};

export type ConnectionStatus = "disconnected" | "connecting" | "connected";
export type Identity = { id: string; name: string; value: Record<string, unknown> };
type View = "chat" | "servers" | "projects" | "agents" | "network" | "identities" | "help" | "dashboard" | "fork";
type RemoteAgent = {
  addr: string;
  firstSeen: number;
  lastSeen: number;
  lastMessage: string;
  lastContent?: unknown;
  lastSeenServerId?: string;
};

const INITIAL_SERVERS: ServerProfile[] = [
  {
    id: "default-187-77-102-80-8888",
    name: "Default Space",
    host: "187.77.102.80",
    port: 8888
  },
  {
    id: "localhost-127-0-0-1-8888",
    name: "Localhost",
    host: "127.0.0.1",
    port: 8888
  }
];

function buildInitialStatus(servers: ServerProfile[]) {
  const status: Record<string, ConnectionStatus> = {};
  servers.forEach((s) => {
    status[s.id] = "disconnected";
  });
  return status;
}

function buildInitialLastConnected(servers: ServerProfile[]) {
  const out: Record<string, number | null> = {};
  servers.forEach((s) => {
    out[s.id] = null;
  });
  return out;
}

function buildInitialDesired(servers: ServerProfile[]) {
  const out: Record<string, boolean> = {};
  servers.forEach((s) => {
    out[s.id] = true;
  });
  return out;
}

function findLocalhost(servers: ServerProfile[]) {
  return servers.find((s) => s.host === "127.0.0.1" && s.port === 8888) ?? null;
}

export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // First iteration: one hardcoded server profile.
  // Next iteration: add CRUD + persistence.
  const [servers, setServers] = useState<ServerProfile[]>(() => [...INITIAL_SERVERS]);
  const [serversHydrated, setServersHydrated] = useState(false);
  const serversPersistReadyRef = React.useRef(false);

  const [selectedServerId, setSelectedServerId] = useState<string | null>(() => INITIAL_SERVERS[0]?.id ?? null);
  const selectedServer = servers.length > 0 ? servers.find((s) => s.id === selectedServerId) ?? null : null;

  const [conn, setConn] = useState<Record<string, ConnectionStatus>>(() => buildInitialStatus(INITIAL_SERVERS));
  const [lastConnectedAt, setLastConnectedAt] = useState<Record<string, number | null>>(
    () => buildInitialLastConnected(INITIAL_SERVERS)
  );
  const [desired, setDesired] = useState<Record<string, boolean>>(() => buildInitialDesired(INITIAL_SERVERS));
  const [remoteByAddr, setRemoteByAddr] = useState<Record<string, RemoteAgent>>({});
  const [selectedRemoteAddr, setSelectedRemoteAddr] = useState<string | null>(null);
  const connRef = React.useRef(conn);

  useEffect(() => {
    connRef.current = conn;
  }, [conn]);

  const [identities, setIdentities] = useState<Identity[]>([]);
  const [selectedIdentityId, setSelectedIdentityId] = useState<string | null>(null);
  const selectedIdentity = identities.find((id) => id.id === selectedIdentityId) ?? null;
  const [identitiesHydrated, setIdentitiesHydrated] = useState(false);
  const identitiesSaveTimerRef = React.useRef<number | null>(null);

  // Fork Chronicle hooks
  const mapData = useMapData();
  const forkGame = useForkGame();

  useEffect(() => {
    let active = true;
    window.api.identities.get().then((res) => {
      if (!active) return;
      if (res.ok) {
        setIdentities(res.identities);
        setSelectedIdentityId(res.selectedIdentityId);
        setIdentitiesHydrated(true);
      } else {
        setIdentitiesHydrated(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!identitiesHydrated) return;
    if (identitiesSaveTimerRef.current !== null) {
      window.clearTimeout(identitiesSaveTimerRef.current);
    }
    identitiesSaveTimerRef.current = window.setTimeout(() => {
      identitiesSaveTimerRef.current = null;
      void window.api.identities.save({
        identities,
        selectedIdentityId
      });
    }, 500);
    return () => {
      if (identitiesSaveTimerRef.current !== null) {
        window.clearTimeout(identitiesSaveTimerRef.current);
        identitiesSaveTimerRef.current = null;
      }
    };
  }, [identities, selectedIdentityId, identitiesHydrated]);

  useEffect(() => {
    if (selectedIdentityId && !identities.some((id) => id.id === selectedIdentityId)) {
      setSelectedIdentityId(null);
    }
  }, [identities, selectedIdentityId]);

  useEffect(() => {
    let active = true;
    window.api.servers.list().then((res) => {
      if (!active) return;
      if (res.ok) {
        setServers(res.items);
        setConn(buildInitialStatus(res.items));
        setLastConnectedAt(buildInitialLastConnected(res.items));
        setDesired(() => {
          const base = buildInitialDesired(res.items);
          Object.entries(res.desiredById ?? {}).forEach(([id, value]) => {
            if (typeof value === "boolean") base[id] = value;
          });
          return base;
        });
        setSelectedServerId(res.items[0]?.id ?? null);
        setServersHydrated(true);
      } else {
        setServersHydrated(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [workspaceNonce, setWorkspaceNonce] = useState(0);

  const [toMode, setToMode] = useState<"none" | "null" | "remote" | "agent">("none");
  const [selectedToKey, setSelectedToKey] = useState<string>("from");
  const [agentToValue, setAgentToValue] = useState<unknown | null>(null);
  const [agentToLabel, setAgentToLabel] = useState<string | null>(null);
  const [selectedAgentKey, setSelectedAgentKey] = useState<string | null>(null);
  const [runningAgents, setRunningAgents] = useState<
    { projectName: string; name: string; folderName: string; path: string; startedAt: number }[]
  >([]);
  const [runningLocalServers, setRunningLocalServers] = useState<string[]>([]);

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
    let mounted = true;
    window.api.projects.list().then((res) => {
      if (!mounted) return;
      if (!res.ok) return;
      setProjects(
        res.items.map((p) => ({
          ...p,
          status: "ready" as const
        }))
      );
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    window.api.agents.listRunning().then((res) => {
      if (res.ok) setRunningAgents(res.items);
    });
    const off = window.api.agents.onExit(() => {
      window.api.agents.listRunning().then((res) => {
        if (res.ok) setRunningAgents(res.items);
      });
    });
    return () => {
      off();
    };
  }, []);

  const refreshWorkspaceData = React.useCallback(async () => {
    if (identitiesSaveTimerRef.current !== null) {
      window.clearTimeout(identitiesSaveTimerRef.current);
      identitiesSaveTimerRef.current = null;
    }
    setIdentitiesHydrated(false);
    setServersHydrated(false);
    serversPersistReadyRef.current = false;

    const [projectsRes, agentsRes, localRes, identitiesRes, serversRes] = await Promise.all([
      window.api.projects.list(),
      window.api.agents.listRunning(),
      window.api.localServer.listRunning(),
      window.api.identities.get(),
      window.api.servers.list()
    ]);

    if (identitiesRes.ok) {
      setIdentities(identitiesRes.identities);
      setSelectedIdentityId(identitiesRes.selectedIdentityId);
      setIdentitiesHydrated(true);
    } else {
      setIdentities([]);
      setSelectedIdentityId(null);
      setIdentitiesHydrated(false);
    }

    if (serversRes.ok) {
      setServers(serversRes.items);
      setConn(buildInitialStatus(serversRes.items));
      setLastConnectedAt(buildInitialLastConnected(serversRes.items));
      setDesired(() => {
        const base = buildInitialDesired(serversRes.items);
        Object.entries(serversRes.desiredById ?? {}).forEach(([id, value]) => {
          if (typeof value === "boolean") base[id] = value;
        });
        return base;
      });
      setSelectedServerId(serversRes.items[0]?.id ?? null);
      setServersHydrated(true);
    } else {
      setServers([]);
      setConn({});
      setLastConnectedAt({});
      setDesired({});
      setSelectedServerId(null);
      setServersHydrated(true);
    }

    if (projectsRes.ok) {
      setProjects(
        projectsRes.items.map((p) => ({
          ...p,
          status: "ready" as const
        }))
      );
    } else {
      setProjects([]);
    }
    if (agentsRes.ok) {
      setRunningAgents(agentsRes.items);
    } else {
      setRunningAgents([]);
    }
    if (localRes.ok) {
      setRunningLocalServers(localRes.items);
    } else {
      setRunningLocalServers([]);
    }

    // Clear path-scoped runtime selections after switching workspace.
    setRemoteByAddr({});
    setSelectedRemoteAddr(null);
    setSelectedAgentKey(null);
    setAgentToValue(null);
    setAgentToLabel(null);
    setToMode("none");
    setSelectedToKey("from");

    setWorkspaceNonce((prev) => prev + 1);
  }, []);

  useEffect(() => {
    window.api.localServer.listRunning().then((res) => {
      if (res.ok) setRunningLocalServers(res.items);
    });
    const off = window.api.localServer.onExit(() => {
      window.api.localServer.listRunning().then((res) => {
        if (res.ok) setRunningLocalServers(res.items);
      });
    });
    const offStart = window.api.localServer.onStart(() => {
      window.api.localServer.listRunning().then((res) => {
        if (res.ok) setRunningLocalServers(res.items);
      });
      const local = findLocalhost(servers);
      if (local) {
        const attempt = (delayMs: number) => {
          setTimeout(() => {
            const status = connRef.current[local.id];
            if (status !== "connected") {
              void window.api.tcp.reconnect({ serverId: local.id });
            }
          }, delayMs);
        };
        attempt(0);
        attempt(1000);
        attempt(3000);
      }
    });
    return () => {
      off();
      offStart();
    };
  }, [servers]);

  useEffect(() => {
    setDesired((prev) => {
      const next: Record<string, boolean> = { ...prev };
      servers.forEach((s) => {
        if (typeof next[s.id] !== "boolean") next[s.id] = true;
      });
      Object.keys(next).forEach((id) => {
        if (!servers.some((s) => s.id === id)) delete next[id];
      });
      return next;
    });
  }, [servers]);

  useEffect(() => {
    servers.forEach((s) => {
      if (desired[s.id]) void window.api.tcp.connect({ server: s });
    });
  }, [servers, desired]);

  useEffect(() => {
    if (!serversHydrated) return;
    if (!serversPersistReadyRef.current) {
      serversPersistReadyRef.current = true;
      return;
    }
    void window.api.servers.save({ servers, desiredById: desired });
  }, [servers, serversHydrated, desired]);

  useEffect(() => {
    if (servers.length === 0) {
      if (selectedServerId !== null) setSelectedServerId(null);
      if (view === "chat") setView("servers");
      return;
    }
    if (!servers.some((s) => s.id === selectedServerId)) {
      setSelectedServerId(servers[0].id);
    }
  }, [servers, selectedServerId, view]);

  function handleAddServer(next: { name: string; host: string; port: number }) {
    const id = `${next.name}-${next.host}-${next.port}-${Date.now()}`.replace(/\s+/g, "-").toLowerCase();
    const server: ServerProfile = { id, ...next };
    setServers((prev) => [...prev, server]);
    setSelectedServerId(server.id);
    setLastConnectedAt((prev) => ({ ...prev, [server.id]: null }));
  }

  function ensureLocalhostServer() {
    const host = "127.0.0.1";
    const port = 8888;
    const id = "localhost-127-0-0-1-8888";
    let added = false;
    const server: ServerProfile = { id, name: "Localhost", host, port };
    setServers((prev) => {
      if (prev.some((s) => s.host === host && s.port === port)) return prev;
      added = true;
      return [...prev, server];
    });
    setLastConnectedAt((prev) => (prev[id] ? prev : { ...prev, [id]: null }));
    setConn((prev) => (prev[id] ? prev : { ...prev, [id]: "disconnected" }));
    setDesired((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
    if (added) {
      setTimeout(() => {
        void window.api.tcp.connect({ server });
      }, 0);
    }
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
    if (selectedServerId === id) {
      const remaining = servers.filter((s) => s.id !== id);
      if (remaining.length > 0) {
        setSelectedServerId(remaining[0].id);
      } else {
        setSelectedServerId("");
      }
    }
  }

  async function handleCreateProject(spec: ProjectSpec) {
    const createdAt = Date.now();
    const pendingId = `pending-${createdAt}`;
    setProjects((prev) => {
      return [...prev, { id: pendingId, ...spec, createdAt, status: "installing" }];
    });

    const res = await window.api.projects.create(spec);
    if (res.ok) {
      const listRes = await window.api.projects.list();
      if (listRes.ok) {
        setProjects(
          listRes.items.map((p) => ({
            ...p,
            status: "ready" as const
          }))
        );
      } else {
        setProjects((prev) => prev.filter((p) => p.id !== pendingId));
      }
    } else {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === pendingId
            ? { ...p, status: "error", error: res.error }
            : p
        )
      );
    }
    return res;
  }

  async function handleResetProject(args: { projectId: string; serverVersion: string }) {
    return window.api.projects.reset(args);
  }

  async function handleDeleteProject(projectId: string) {
    const res = await window.api.projects.remove({ projectId });
    if (!res.ok) return res;
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    return res;
  }

  function handleAddIdentity(next: { name: string; value: Record<string, unknown> }) {
    const base = next.name.trim().toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[-.]+|[-.]+$/g, "");
    const safeBase = base || "identity";
    const existing = new Set(identities.map((i) => i.id));
    let id = safeBase;
    let n = 2;
    while (existing.has(id)) {
      const suffix = `-${n}`;
      const maxBase = Math.max(1, 64 - suffix.length);
      id = `${safeBase.slice(0, maxBase)}${suffix}`;
      n += 1;
    }
    const identity: Identity = { id, ...next };
    setIdentities((prev) => [...prev, identity]);
    setSelectedIdentityId(identity.id);
  }

  function handleUpdateIdentity(id: string, next: { name: string; value: Record<string, unknown> }) {
    setIdentities((prev) => prev.map((it) => (it.id === id ? { ...it, ...next } : it)));
  }

  useEffect(() => {
    const off = window.api.tcp.onMessage((msg) => {
      const parsed = parseServerMessage(msg.raw);
      if (typeof parsed.remoteAddr !== "string") return;
      const addr = parsed.remoteAddr;
      setRemoteByAddr((prev) => {
        const existing = prev[addr];
        return {
          ...prev,
          [addr]: {
            addr,
            firstSeen: existing?.firstSeen ?? msg.ts,
            lastSeen: msg.ts,
            lastMessage: parsed.text,
            lastContent: parsed.content,
            lastSeenServerId: msg.serverId
          }
        };
      });
      setSelectedRemoteAddr((prev) => prev ?? addr);
    });
    return () => off();
  }, []);

  const status = selectedServerId ? conn[selectedServerId] ?? "disconnected" : "disconnected";
  const isDesired = selectedServerId ? desired[selectedServerId] ?? false : false;
  const localhostServer = findLocalhost(servers);
  const localhostStatus = localhostServer ? conn[localhostServer.id] ?? "disconnected" : "disconnected";

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
  } else if (toMode === "agent") {
    toValue = agentToValue;
  }
  const toLabel =
    toMode === "none"
      ? "none"
      : toMode === "null"
        ? "null"
        : toMode === "agent"
          ? agentToLabel ?? "agent"
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
    <div className={`app-shell ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <div className="left-rail">
        <button
          className="rail-toggle"
          type="button"
          onClick={() => setIsSidebarCollapsed((prev) => !prev)}
          aria-label={isSidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
        >
          <span className="rail-toggle-icon" aria-hidden="true">
            {isSidebarCollapsed ? "›" : "‹"}
          </span>
        </button>
        <button
          className="workspace-badge"
          type="button"
          onClick={() => setView("dashboard")}
          aria-label="Summoner Dashboard"
        >
          <img src={logoMage} alt="Summoner" className="workspace-logo" />
        </button>
        <div className="rail-sep" />
        <button
          className={`rail-btn ${view === "projects" ? "active" : ""}`}
          onClick={() => setView("projects")}
          type="button"
        >
          <span className="rail-icon icon-projects" aria-hidden="true" />
          <span className="rail-label">Projects</span>
        </button>
        <button
          className={`rail-btn ${view === "servers" ? "active" : ""}`}
          onClick={() => setView("servers")}
          type="button"
        >
          <span className="rail-icon icon-server" aria-hidden="true" />
          <span className="rail-label">Servers</span>
        </button>
        <button
          className={`rail-btn ${view === "agents" ? "active" : ""}`}
          onClick={() => setView("agents")}
          type="button"
        >
          <span className="rail-icon icon-agents" aria-hidden="true" />
          <span className="rail-label">Agents</span>
        </button>
        <button
          className={`rail-btn ${view === "network" ? "active" : ""}`}
          onClick={() => setView("network")}
          type="button"
        >
          <span className="rail-icon icon-network" aria-hidden="true" />
          <span className="rail-label">Network</span>
        </button>
        <button
          className={`rail-btn ${view === "identities" ? "active" : ""}`}
          onClick={() => setView("identities")}
          type="button"
        >
          <span className="rail-icon icon-identities" aria-hidden="true" />
          <span className="rail-label">Identities</span>
        </button>
        <div className="rail-grow" />
        <button
          className={`rail-btn ghost ${view === "help" ? "active" : ""}`}
          type="button"
          onClick={() => setView("help")}
        >
          <span className="rail-icon icon-settings" aria-hidden="true" />
          <span className="rail-label">Settings</span>
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
          const remote = remoteByAddr[addr];
          setSelectedRemoteAddr(addr);
          if (remote?.lastSeenServerId && servers.some((s) => s.id === remote.lastSeenServerId)) {
            setSelectedServerId(remote.lastSeenServerId);
          }
          setView("chat");
          setToMode("remote");
          setSelectedToKey("remote_addr");
        }}
        runningAgents={runningAgents}
        selectedAgentKey={selectedAgentKey}
        onSelectAgent={async (agent) => {
          const res = await window.api.agents.getIdentity({
            projectName: agent.projectName,
            agentName: agent.name
          });
          if (!res.ok) return;
          setAgentToValue(res.value);
          setAgentToLabel(typeof res.value === "string" ? res.value : `agent:${agent.name}`);
          setSelectedAgentKey(`${agent.projectName}:${agent.folderName}`);
          setToMode("agent");
          setView("chat");
        }}
        identities={identities}
        selectedIdentityId={selectedIdentityId}
        onSelectIdentityId={setSelectedIdentityId}
        onSelectPage={(page) => setView(page as View)}
      />

      <div className="main">
        {view === "chat" ? (
          selectedServer ? (
            <ChatView
              key={`chat-${workspaceNonce}-${selectedServer.id}`}
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
          ) : (
            <PlaceholderPanel
              title="No servers available"
              subtitle="Add a server in the Servers tab to start chatting."
            />
          )
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
          projects={projects}
          runningLocalServers={runningLocalServers}
          onEnsureLocalhost={ensureLocalhostServer}
          localhostStatus={localhostStatus}
        />
      ) : null}
            {view === "agents" ? (
              <AgentsPage
                key={`agents-${workspaceNonce}`}
                projects={projects}
                onImport={(args) => window.api.agents.import(args)}
                onList={(args) => window.api.agents.list(args)}
                onStart={async (args) => {
                  const res = await window.api.agents.start(args);
                  if (res.ok) {
                    const running = await window.api.agents.listRunning();
                    if (running.ok) setRunningAgents(running.items);
                  }
                  return res;
                }}
                onStop={async (args) => {
                  const res = await window.api.agents.stop(args);
                  if (res.ok) {
                    const running = await window.api.agents.listRunning();
                    if (running.ok) setRunningAgents(running.items);
                  }
                  return res;
                }}
                onRemove={async (args) => {
                  const res = await window.api.agents.remove(args);
                  if (res.ok) {
                    const running = await window.api.agents.listRunning();
                    if (running.ok) setRunningAgents(running.items);
                  }
                  return res;
                }}
                runningAgents={runningAgents}
              />
            ) : null}
            {view === "dashboard" ? (
              <DashboardPage
                servers={servers}
                conn={conn}
                desired={desired}
                lastConnectedAt={lastConnectedAt}
                remoteByAddr={remoteByAddr}
                runningAgents={runningAgents}
                runningLocalServers={runningLocalServers}
                projects={projects}
              />
            ) : view === "projects" ? (
              <ProjectsPage
                key={`projects-${workspaceNonce}`}
                projects={projects}
                onCreate={handleCreateProject}
                onReset={handleResetProject}
                onDelete={handleDeleteProject}
                onReadEnv={(args) => window.api.projects.envRead(args)}
                onWriteEnv={(args) => window.api.projects.envWrite(args)}
              />
            ) : null}
            {view === "network" ? (
              <NetworkPage
                key={`network-${workspaceNonce}`}
                remoteByAddr={remoteByAddr}
                selectedRemoteAddr={selectedRemoteAddr}
                onSelectRemoteAddr={setSelectedRemoteAddr}
                serverById={servers.reduce<Record<string, { name: string; host: string; port: number }>>(
                  (acc, s) => {
                    acc[s.id] = { name: s.name, host: s.host, port: s.port };
                    return acc;
                  },
                  {}
                )}
                serverStatusById={conn}
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
            {view === "fork" ? (
              <ForkGamePage
                mapParams={mapData.mapParams}
                mapSvgInner={mapData.mapSvgInner}
                mapRootAttrs={mapData.mapRootAttrs}
                mapViewBox={mapData.mapViewBox}
                gameState={forkGame.gameState}
                isRunning={forkGame.isRunning}
                turnSpeed={forkGame.turnSpeed}
                playerState={forkGame.playerState}
                onStartGame={forkGame.startGame}
                onStopGame={forkGame.stopGame}
                onSetTurnSpeed={forkGame.setTurnSpeed}
                onPlaceBet={forkGame.placeBet}
                onPlayEventCard={forkGame.playEventCard}
                onPatronBacking={forkGame.patronBacking}
              />
            ) : null}
            {view === "help" ? <HelpPage onWorkspaceChange={refreshWorkspaceData} /> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
