import React, { useMemo } from "react";
import type { ConnectionStatus, ServerProfile } from "../App";
import type { ProjectItem } from "./ProjectsPage";

type RemoteAgent = {
  addr: string;
  firstSeen: number;
  lastSeen: number;
  lastSeenServerId?: string;
};

type RunningAgent = { projectName: string; name: string; folderName: string; startedAt: number };

type DashboardProps = {
  servers: ServerProfile[];
  conn: Record<string, ConnectionStatus>;
  desired: Record<string, boolean>;
  lastConnectedAt: Record<string, number | null>;
  remoteByAddr: Record<string, RemoteAgent>;
  runningAgents: RunningAgent[];
  runningLocalServers: string[];
  projects: ProjectItem[];
};

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms)) return "—";
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSec / 60);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d ${hrs % 24}h`;
  if (hrs > 0) return `${hrs}h ${mins % 60}m`;
  if (mins > 0) return `${mins}m`;
  return `${totalSec}s`;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

export default function DashboardPage(props: DashboardProps) {
  const { servers, conn, desired, lastConnectedAt, remoteByAddr, runningAgents, runningLocalServers, projects } = props;
  const now = Date.now();

  const stats = useMemo(() => {
    const serverTotal = servers.length;
    const serverConnected = servers.filter((s) => conn[s.id] === "connected").length;
    const serverConnecting = servers.filter((s) => conn[s.id] === "connecting").length;
    const serverDesired = servers.filter((s) => desired[s.id]).length;
    const connectedIds = new Set(servers.filter((s) => conn[s.id] === "connected").map((s) => s.id));
    const connectedLast24h = servers.filter((s) => {
      const ts = lastConnectedAt[s.id];
      return typeof ts === "number" && now - ts <= 24 * 60 * 60 * 1000;
    }).length;

    const remotes = Object.values(remoteByAddr);
    const remoteTotal = remotes.length;
    const remoteActive5m = remotes.filter((r) => now - r.lastSeen <= 5 * 60 * 1000).length;
    const remoteActive1h = remotes.filter((r) => now - r.lastSeen <= 60 * 60 * 1000).length;
    const remoteNew24h = remotes.filter((r) => now - r.firstSeen <= 24 * 60 * 60 * 1000).length;
    const remoteStale24h = remotes.filter((r) => now - r.lastSeen > 24 * 60 * 60 * 1000).length;
    const mostRecentSeen = remotes.length ? now - Math.max(...remotes.map((r) => r.lastSeen)) : null;

    const reachByServer = new Map<string, number>();
    let unknownReach = 0;
    remotes.forEach((r) => {
      if (r.lastSeenServerId) {
        reachByServer.set(r.lastSeenServerId, (reachByServer.get(r.lastSeenServerId) ?? 0) + 1);
      } else {
        unknownReach += 1;
      }
    });
    const reachList = servers
      .map((s) => ({
        id: s.id,
        name: s.name,
        host: s.host,
        count: reachByServer.get(s.id) ?? 0,
        connected: conn[s.id] === "connected"
      }))
      .sort((a, b) => b.count - a.count);
    const serversWithReach = reachList.filter((s) => s.count > 0).length;

    const agentsRunning = runningAgents.length;
    const agentsStarted24h = runningAgents.filter((a) => now - a.startedAt <= 24 * 60 * 60 * 1000).length;
    const agentUptimeMedian = median(runningAgents.map((a) => now - a.startedAt));

    const projectsTotal = projects.length;
    const projectsWithAgents = new Set(runningAgents.map((a) => a.projectName)).size;
    const localServersRunning = runningLocalServers.length;
    const remotePerConnected = serverConnected > 0 ? remoteActive1h / serverConnected : 0;

    const agentsByProject = Array.from(
      runningAgents.reduce((map, a) => {
        map.set(a.projectName, (map.get(a.projectName) ?? 0) + 1);
        return map;
      }, new Map<string, number>())
    )
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return {
      serverTotal,
      serverConnected,
      serverConnecting,
      serverDesired,
      connectedLast24h,
      remoteTotal,
      remoteActive5m,
      remoteActive1h,
      remoteNew24h,
      remoteStale24h,
      mostRecentSeen,
      serversWithReach,
      reachList,
      unknownReach,
      agentsRunning,
      agentsStarted24h,
      agentUptimeMedian,
      projectsTotal,
      projectsWithAgents,
      localServersRunning,
      remotePerConnected,
      agentsByProject
    };
  }, [servers, conn, desired, lastConnectedAt, remoteByAddr, runningAgents, runningLocalServers, projects, now]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="title">Dashboard</div>
          <div className="subtitle">Operational activity and agent presence.</div>
        </div>
      </div>

      <div className="fw700">Executive Summary</div>
      <div className="dashboard-grid mt10">
        <div className="panel stat-card">
          <div className="stat-label">Connected Servers</div>
          <div className="stat-value">
            {stats.serverConnected} / {stats.serverTotal}
          </div>
          <div className="stat-meta">{stats.serverConnecting} connecting</div>
        </div>
        <div className="panel stat-card">
          <div className="stat-label">Agents Running</div>
          <div className="stat-value">{stats.agentsRunning}</div>
          <div className="stat-meta">{stats.agentsStarted24h} started in 24h</div>
        </div>
        <div className="panel stat-card">
          <div className="stat-label">Remote Agents</div>
          <div className="stat-value">{stats.remoteTotal}</div>
          <div className="stat-meta">{stats.remoteActive1h} active in 1h</div>
        </div>
        <div className="panel stat-card">
          <div className="stat-label">Projects</div>
          <div className="stat-value">{stats.projectsTotal}</div>
          <div className="stat-meta">{stats.projectsWithAgents} with agents</div>
        </div>
        <div className="panel stat-card">
          <div className="stat-label">Local Servers</div>
          <div className="stat-value">{stats.localServersRunning}</div>
          <div className="stat-meta">running now</div>
        </div>
        <div className="panel stat-card">
          <div className="stat-label">Active Remotes / Server</div>
          <div className="stat-value">{stats.remotePerConnected.toFixed(1)}</div>
          <div className="stat-meta">based on 1h activity</div>
        </div>
      </div>

      <div className="fw700 mt18">Activity Windows</div>
      <div className="dashboard-grid mt10">
        <div className="panel stat-card">
          <div className="stat-label">Active Remotes (5m)</div>
          <div className="stat-value">{stats.remoteActive5m}</div>
          <div className="stat-meta">{stats.remoteActive1h} in 1h</div>
        </div>
        <div className="panel stat-card">
          <div className="stat-label">New Remotes (24h)</div>
          <div className="stat-value">{stats.remoteNew24h}</div>
          <div className="stat-meta">{stats.remoteStale24h} stale &gt;24h</div>
        </div>
        <div className="panel stat-card">
          <div className="stat-label">Median Agent Uptime</div>
          <div className="stat-value">
            {stats.agentUptimeMedian === null ? "—" : formatDuration(stats.agentUptimeMedian)}
          </div>
          <div className="stat-meta">running agents only</div>
        </div>
        <div className="panel stat-card">
          <div className="stat-label">Recent Remote Seen</div>
          <div className="stat-value">
            {stats.mostRecentSeen === null ? "—" : formatDuration(stats.mostRecentSeen)}
          </div>
          <div className="stat-meta">time since last activity</div>
        </div>
        <div className="panel stat-card">
          <div className="stat-label">Servers with Reach</div>
          <div className="stat-value">{stats.serversWithReach}</div>
          <div className="stat-meta">{stats.connectedLast24h} connected in 24h</div>
        </div>
        <div className="panel stat-card">
          <div className="stat-label">Desired Servers</div>
          <div className="stat-value">{stats.serverDesired}</div>
          <div className="stat-meta">set to auto-connect</div>
        </div>
      </div>

      <div className="dashboard-split mt18">
        <div className="panel">
          <div className="panel-title">Top Servers by Remote Reach</div>
          <div className="stat-list">
            {stats.reachList.length === 0 ? (
              <div className="small">No remote activity yet.</div>
            ) : (
              stats.reachList.slice(0, 6).map((s) => (
                <div key={s.id} className="stat-list-item">
                  <div>
                    <div className="fw600">{s.name}</div>
                    <div className="small">{s.host}</div>
                  </div>
                  <div className="stat-list-right">
                    <div className="fw600">{s.count}</div>
                    <div className={`pill status-dot ${s.connected ? "connected" : "disconnected"}`} aria-hidden="true" />
                  </div>
                </div>
              ))
            )}
            {stats.unknownReach > 0 ? (
              <div className="stat-list-item">
                <div>
                  <div className="fw600">Unknown source</div>
                  <div className="small">remotes without server id</div>
                </div>
                <div className="stat-list-right">
                  <div className="fw600">{stats.unknownReach}</div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Agents by Project</div>
          <div className="stat-list">
            {stats.agentsByProject.length === 0 ? (
              <div className="small">No running agents.</div>
            ) : (
              stats.agentsByProject.slice(0, 8).map((p) => (
                <div key={p.name} className="stat-list-item">
                  <div className="fw600">{p.name}</div>
                  <div className="stat-list-right">
                    <div className="fw600">{p.count}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
