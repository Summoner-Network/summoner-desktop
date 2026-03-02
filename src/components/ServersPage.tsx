import React, { useEffect, useMemo, useState } from "react";
import type { ServerProfile } from "../App";
import type { ProjectItem } from "./ProjectsPage";

export default function ServersPage(props: {
  servers: ServerProfile[];
  selectedServerId: string | null;
  onAddServer: (server: { name: string; host: string; port: number }) => void;
  onSelectServer: (id: string) => void;
  onDeleteServer: (id: string) => void;
  lastConnectedAt: Record<string, number | null>;
  projects: ProjectItem[];
  runningLocalServers: string[];
  onEnsureLocalhost: () => void;
  localhostStatus: "disconnected" | "connecting" | "connected";
}) {
  const {
    servers,
    selectedServerId,
    onAddServer,
    onSelectServer,
    onDeleteServer,
    lastConnectedAt,
    projects,
    runningLocalServers,
    onEnsureLocalhost,
    localhostStatus
  } = props;
  const selected = selectedServerId ? servers.find((s) => s.id === selectedServerId) ?? null : null;
  const hasServers = servers.length > 0;
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("8888");
  const [error, setError] = useState<string | null>(null);

  const [selectedProject, setSelectedProject] = useState<string>(projects[0]?.name ?? "");
  const [expandedByProject, setExpandedByProject] = useState<Record<string, boolean>>({});
  const [configByProject, setConfigByProject] = useState<
    Record<
      string,
      {
        config: Record<string, unknown>;
        tooltipsLong: Record<string, unknown>;
        tooltipsShort: Record<string, unknown>;
        serverVersion: string;
        forcedVersion: string;
        configSource: "default" | "saved";
        configPath: string;
        loading: boolean;
        saving: boolean;
        error?: string;
        dirty: boolean;
      }
    >
  >({});
  const [localRunStatus, setLocalRunStatus] = useState<Record<string, "idle" | "starting">>({});
  const [localRunWarning, setLocalRunWarning] = useState<Record<string, string>>({});
  const localRunTimerRef = React.useRef<Record<string, number>>({});
  const nullRestoreRef = React.useRef<Record<string, unknown>>({});

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

  useEffect(() => {
    if (projects.length === 0) {
      setSelectedProject("");
      return;
    }
    if (!projects.find((p) => p.name === selectedProject)) {
      setSelectedProject(projects[0].name);
    }
  }, [projects, selectedProject]);

  const isExpanded = !!expandedByProject[selectedProject];
  const configState = selectedProject ? configByProject[selectedProject] : undefined;
  const canRunLocal = !!selectedProject;

  async function loadConfig(projectName: string) {
    setConfigByProject((prev) => ({
      ...prev,
      [projectName]: {
        config: prev[projectName]?.config ?? {},
        tooltipsLong: prev[projectName]?.tooltipsLong ?? {},
        tooltipsShort: prev[projectName]?.tooltipsShort ?? {},
        serverVersion: prev[projectName]?.serverVersion ?? "",
        forcedVersion: prev[projectName]?.forcedVersion ?? "",
        configSource: prev[projectName]?.configSource ?? "default",
        configPath: prev[projectName]?.configPath ?? "configs/server_config.json",
        loading: true,
        saving: false,
        dirty: prev[projectName]?.dirty ?? false
      }
    }));
    try {
      const res = await window.api.localServer.loadConfig({ projectName });
      if (!res.ok) {
        setConfigByProject((prev) => ({
          ...prev,
          [projectName]: {
            config: {},
            tooltipsLong: {},
            tooltipsShort: {},
            serverVersion: "",
            forcedVersion: "",
            configSource: "default",
            configPath: "configs/server_config.json",
            loading: false,
            saving: false,
            dirty: false,
            error: res.error
          }
        }));
        return;
      }
      setConfigByProject((prev) => ({
        ...prev,
        [projectName]: {
          config: res.config,
          tooltipsLong: res.tooltipsLong,
          tooltipsShort: res.tooltipsShort,
          serverVersion: res.serverVersion,
          forcedVersion: res.forcedVersion,
          configSource: res.configSource,
          configPath: res.configPath,
          loading: false,
          saving: false,
          dirty: false
        }
      }));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load config";
      setConfigByProject((prev) => ({
        ...prev,
        [projectName]: {
          config: {},
          tooltipsLong: {},
          tooltipsShort: {},
          serverVersion: "",
          forcedVersion: "",
          configSource: "default",
          configPath: "configs/server_config.json",
          loading: false,
          saving: false,
          dirty: false,
          error: message
        }
      }));
    }
  }

  useEffect(() => {
    if (!selectedProject) return;
    const state = configByProject[selectedProject];
    if (!state || state.loading) {
      void loadConfig(selectedProject);
    }
  }, [selectedProject]);


  function toggleExpanded(projectName: string) {
    setExpandedByProject((prev) => ({ ...prev, [projectName]: !prev[projectName] }));
  }

  function setConfigValue(projectName: string, path: (string | number)[], value: unknown) {
    setConfigByProject((prev) => {
      const current = prev[projectName];
      if (!current) return prev;
      const nextConfig = updateAtPath(current.config, path, value);
      return {
        ...prev,
        [projectName]: {
          ...current,
          config: nextConfig,
          dirty: true
        }
      };
    });
  }

  async function saveConfig(projectName: string) {
    const current = configByProject[projectName];
    if (!current) return;
    setConfigByProject((prev) => ({
      ...prev,
      [projectName]: { ...current, saving: true, error: undefined }
    }));
    const res = await window.api.localServer.saveConfig({ projectName, config: current.config });
    setConfigByProject((prev) => ({
      ...prev,
      [projectName]: {
        ...current,
        saving: false,
        dirty: !res.ok,
        error: res.ok ? undefined : res.error,
        configSource: res.ok ? "saved" : current.configSource
      }
    }));
  }

  async function runLocalServer(projectName: string) {
    // Flow note: start server -> onEnsureLocalhost adds localhost if missing -> App listens to localServer:onStart
    // and triggers tcp reconnect attempts. We keep UI "Starting…" until localhostStatus reports connected.
    setLocalRunWarning((prev) => ({ ...prev, [projectName]: "" }));
    onEnsureLocalhost();
    setLocalRunStatus((prev) => ({ ...prev, [projectName]: "starting" }));
    const res = await window.api.localServer.run({ projectName });
    if (!res.ok) {
      setLocalRunStatus((prev) => ({ ...prev, [projectName]: "idle" }));
      setConfigByProject((prev) => ({
        ...prev,
        [projectName]: {
          ...(prev[projectName] ?? {
            config: {},
            tooltipsLong: {},
            tooltipsShort: {},
            serverVersion: "",
            forcedVersion: "",
            configSource: "default",
            configPath: "configs/server_config.json",
            loading: false,
            saving: false,
            dirty: false
          }),
          error: res.error
        }
      }));
      return;
    }
    const existing = localRunTimerRef.current[projectName];
    if (existing) window.clearTimeout(existing);
    localRunTimerRef.current[projectName] = window.setTimeout(() => {
      setLocalRunWarning((prev) => ({
        ...prev,
        [projectName]: "Still starting… If this persists, check server logs."
      }));
    }, 12_000);
    setTimeout(() => {
      setLocalRunStatus((prev) => {
        if (runningLocalServers.includes(projectName)) return prev;
        return { ...prev, [projectName]: "starting" };
      });
    }, 0);
    setTimeout(() => {
      setLocalRunStatus((prev) => {
        if (runningLocalServers.includes(projectName)) return prev;
        return { ...prev, [projectName]: "idle" };
      });
    }, 800);
  }

  useEffect(() => {
    if (!selectedProject) return;
    if (localhostStatus === "connected") {
      setLocalRunStatus((prev) => ({ ...prev, [selectedProject]: "idle" }));
      setLocalRunWarning((prev) => ({ ...prev, [selectedProject]: "" }));
      const existing = localRunTimerRef.current[selectedProject];
      if (existing) window.clearTimeout(existing);
    }
  }, [localhostStatus, selectedProject]);

  async function stopLocalServer(projectName: string) {
    setLocalRunWarning((prev) => ({ ...prev, [projectName]: "Stopping local server…" }));
    const res = await window.api.localServer.stop({ projectName });
    if (!res.ok) {
      setConfigByProject((prev) => ({
        ...prev,
        [projectName]: {
          ...(prev[projectName] ?? {
            config: {},
            tooltipsLong: {},
            tooltipsShort: {},
            serverVersion: "",
            forcedVersion: "",
            configSource: "default",
            configPath: "configs/server_config.json",
            loading: false,
            saving: false,
            dirty: false
          }),
          error: res.error
        }
      }));
      setLocalRunWarning((prev) => ({ ...prev, [projectName]: "Stop failed. Please try again." }));
      return;
    }
    setLocalRunStatus((prev) => ({ ...prev, [projectName]: "idle" }));
    setLocalRunWarning((prev) => ({ ...prev, [projectName]: "" }));
  }

  const projectOptions = useMemo(() => projects.map((p) => p.name), [projects]);
  const isRunning = selectedProject ? runningLocalServers.includes(selectedProject) : false;
  const isStarting = selectedProject ? localRunStatus[selectedProject] === "starting" : false;
  const warning = selectedProject ? localRunWarning[selectedProject] : "";
  const isStopFailure = (warning ?? "").toLowerCase().includes("failed");

  function getTooltip(
    tooltips: Record<string, unknown>,
    path: (string | number)[]
  ): string | undefined {
    let cur: unknown = tooltips;
    for (const part of path) {
      if (typeof part === "number") continue;
      if (!cur || typeof cur !== "object") return undefined;
      const next = (cur as Record<string, unknown>)[part];
      cur = next;
    }
    return typeof cur === "string" ? cur : undefined;
  }

  function canBeNullAtPath(state: typeof configState, path: (string | number)[]) {
    if (!state) return false;
    const shortTip = getTooltip(state.tooltipsShort, path) ?? "";
    const longTip = getTooltip(state.tooltipsLong, path) ?? "";
    return /null/i.test(shortTip) || /null/i.test(longTip);
  }

  function updateAtPath(obj: Record<string, unknown>, path: (string | number)[], value: unknown) {
    if (path.length === 0) return obj;
    const [head, ...rest] = path;
    if (typeof head === "number") {
      const arr = Array.isArray(obj) ? [...obj] : [];
      const idx = head;
      const nextVal =
        rest.length === 0
          ? value
          : updateAtPath((arr[idx] as Record<string, unknown>) ?? {}, rest, value);
      arr[idx] = nextVal;
      return arr as unknown as Record<string, unknown>;
    }
    const next = { ...obj };
    if (rest.length === 0) {
      next[head] = value;
      return next;
    }
    const child = next[head];
    next[head] = updateAtPath(
      (child && typeof child === "object" && !Array.isArray(child)
        ? (child as Record<string, unknown>)
        : {}) as Record<string, unknown>,
      rest,
      value
    );
    return next;
  }

  function renderField(
    key: string,
    value: unknown,
    path: (string | number)[],
    state: NonNullable<typeof configState>
  ): React.ReactNode {
    const shortTip = getTooltip(state.tooltipsShort, path);
    const longTip = getTooltip(state.tooltipsLong, path);
    const tooltipText = longTip || shortTip;
    const label = (
      <div className="config-label">
        <span className="config-key">{key}</span>
        {tooltipText ? (
          <span className="config-tip" data-tip={tooltipText}>
            ?
          </span>
        ) : null}
      </div>
    );

    const isVersion = key === "version";
    const allowNull = canBeNullAtPath(state, path);
    const tipText = `${shortTip ?? ""} ${longTip ?? ""}`.trim();
    const isListLike = Array.isArray(value) || (value === null && /list|\[\]/i.test(tipText));
    const forceText =
      /format|path|host|log_level|version/i.test(key) ||
      /format|string|hostname|path/i.test(tipText);
    const inferredScalarType =
      !forceText &&
      (typeof value === "number" || /port|count|size|secs|seconds|ms|threads|capacity|threshold|rate|timeout|interval|backoff/i.test(tipText))
        ? "number"
        : "text";

    if (value && typeof value === "object" && !Array.isArray(value)) {
      const entries = Object.entries(value as Record<string, unknown>);
      return (
        <div key={path.join(".")} className="config-section">
          <div className="config-section-title">{label}</div>
          {shortTip ? <div className="config-help">{shortTip}</div> : null}
          <div className="config-section-body">
            {entries.map(([k, v]) => renderField(k, v, [...path, k], state))}
          </div>
        </div>
      );
    }

    const pathKey = `${selectedProject}:${path.join(".")}`;

    if (isListLike) {
      const isNull = value === null;
      const items = Array.isArray(value) ? value : [];
      return (
        <div key={path.join(".")} className="config-row">
          <div className="config-labels">
            {label}
            {shortTip ? <div className="config-help">{shortTip}</div> : null}
          </div>
          <div className="config-control list">
            <div className="config-control-top">
              {allowNull ? (
                <label className="config-null-toggle">
                  <input
                    type="checkbox"
                    checked={isNull}
                    onChange={(e) => {
                      if (e.target.checked) {
                        nullRestoreRef.current[pathKey] = items;
                        setConfigValue(selectedProject, path, null);
                      } else {
                        const fallback = nullRestoreRef.current[pathKey];
                        setConfigValue(selectedProject, path, Array.isArray(fallback) ? fallback : []);
                      }
                    }}
                  />
                  Set to null
                </label>
              ) : null}
            </div>
            <div className={`config-list ${isNull ? "disabled" : ""}`}>
              {items.map((item, idx) => (
                <div key={`${path.join(".")}-${idx}`} className="config-list-row">
                  <input
                    type="text"
                    value={String(item ?? "")}
                    disabled={isNull}
                    onChange={(e) => {
                      const next = [...items];
                      next[idx] = e.target.value;
                      setConfigValue(selectedProject, path, next);
                    }}
                  />
                  <button
                    type="button"
                    className="env-remove"
                    disabled={isNull}
                    onClick={() => {
                      const next = [...items];
                      next.splice(idx, 1);
                      setConfigValue(selectedProject, path, next);
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
              <div className="config-list-actions">
                <button
                  type="button"
                  disabled={isNull}
                  onClick={() => setConfigValue(selectedProject, path, [...items, ""])}
                >
                  Add Row
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    const isNull = value === null;
    const type = typeof value;
    const inputId = path.join(".");

    if (type === "boolean") {
      return (
        <div key={path.join(".")} className="config-row">
          <div className="config-labels">
            {label}
            {shortTip ? <div className="config-help">{shortTip}</div> : null}
          </div>
          <div className="config-control scalar">
            {allowNull ? (
              <label className="config-null-toggle">
                <input
                  type="checkbox"
                  checked={isNull}
                  onChange={(e) => {
                    if (e.target.checked) {
                      nullRestoreRef.current[pathKey] = value;
                      setConfigValue(selectedProject, path, null);
                    } else {
                      const fallback = nullRestoreRef.current[pathKey];
                      setConfigValue(selectedProject, path, typeof fallback === "boolean" ? fallback : false);
                    }
                  }}
                />
                Set to null
              </label>
            ) : null}
            <label className="config-switch">
              <input
                id={inputId}
                type="checkbox"
                checked={Boolean(value)}
                disabled={isNull}
                onChange={(e) => setConfigValue(selectedProject, path, e.target.checked)}
              />
              <span>Enabled</span>
            </label>
          </div>
        </div>
      );
    }

    const displayValue = isVersion ? state.forcedVersion : value;

    return (
      <div key={path.join(".")} className="config-row">
        <div className="config-labels">
          {label}
          {shortTip ? <div className="config-help">{shortTip}</div> : null}
        </div>
          <div className="config-control scalar">
          {allowNull ? (
            <label className="config-null-toggle">
              <input
                type="checkbox"
                checked={isNull}
                onChange={(e) =>
                  (() => {
                    if (e.target.checked) {
                      nullRestoreRef.current[pathKey] = value;
                      setConfigValue(selectedProject, path, null);
                      return;
                    }
                    const fallback = nullRestoreRef.current[pathKey];
                    if (typeof fallback === "number" || typeof fallback === "string") {
                      setConfigValue(selectedProject, path, fallback);
                    } else {
                      setConfigValue(selectedProject, path, inferredScalarType === "number" ? 0 : "");
                    }
                  })()
                }
              />
              Set to null
            </label>
          ) : null}
          <input
            type={isNull ? "text" : type === "number" || inferredScalarType === "number" ? "number" : "text"}
            value={isNull ? "null" : String(displayValue ?? "")}
            disabled={isNull || isVersion}
            className={isNull || isVersion ? "config-input frozen" : "config-input"}
            onChange={(e) => {
              const raw = e.target.value;
              const next =
                type === "number" || inferredScalarType === "number" ? (raw.trim() === "" ? 0 : Number(raw)) : raw;
              setConfigValue(selectedProject, path, next);
            }}
          />
        </div>
      </div>
    );
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
                className={`panel-item ${selected && s.id === selected.id ? "selected" : ""}`}
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
          {hasServers && selected ? (
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
          ) : (
            <div className="small">No servers available. Add one below.</div>
          )}
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

      <div className="panel">
        <div className="panel-title">Run Local Server</div>
        <div className="localhost-body">
          <div className="form-grid mt6">
            <label className="form-field">
              <span className="detail-label">Project</span>
              <select
                className="context-select"
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                disabled={projectOptions.length === 0}
              >
                {projectOptions.length === 0 ? <option value="">No projects</option> : null}
                {projectOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-field">
              <span className="detail-label">Server version</span>
              <div className="detail-value">{configState?.forcedVersion || "—"}</div>
            </div>
            <div className="form-field">
              <span className="detail-label">Config source</span>
              <div className="detail-value">
                {configState?.configSource === "saved"
                  ? "configs/server_config.json"
                  : "desktop_data/default_config.json"}
              </div>
            </div>
          </div>

          <details
            className="config-details"
            open={isExpanded}
            onToggle={(e) => {
              if (!selectedProject) return;
              const nextOpen = (e.currentTarget as HTMLDetailsElement).open;
              setExpandedByProject((prev) => ({ ...prev, [selectedProject]: nextOpen }));
            }}
          >
            <summary className="config-summary">
              configs
            </summary>
            <div className="config-editor">
              <div className="row-between align-center">
                <div className="fw600">configs</div>
                <div className="small muted">{configState?.configPath ?? "configs/server_config.json"}</div>
              </div>
              {selectedProject && (configState?.loading || !configState) ? (
                <div className="small mt6">Loading config...</div>
              ) : null}
              {configState?.error ? <div className="small text-error mt6">{configState.error}</div> : null}
              {configState && !configState.loading ? (
                <>
                  <div className="config-fields">
                    {Object.entries(configState.config).length === 0 ? (
                      <div className="small muted">No config data found.</div>
                    ) : (
                      Object.entries(configState.config).map(([k, v]) => renderField(k, v, [k], configState))
                    )}
                  </div>
                  <div className="row gap10 mt10">
                    <button
                      type="button"
                      className="primary"
                      disabled={!configState.dirty || configState.saving}
                      onClick={() => saveConfig(selectedProject)}
                    >
                      {configState.saving ? "Saving..." : "Save config"}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </details>

          <div className="row gap10 mt10 run-row">
            {isRunning ? (
              <button type="button" className="danger" onClick={() => selectedProject && stopLocalServer(selectedProject)} disabled={!canRunLocal}>
                Stop server
              </button>
            ) : (
              <button type="button" onClick={() => selectedProject && runLocalServer(selectedProject)} disabled={!canRunLocal || isStarting}>
                {isStarting ? "Starting…" : "Run server"}
              </button>
            )}
            {isStarting && localhostStatus !== "connected" ? (
              <div className="small muted run-wait">Waiting for server to accept connections…</div>
            ) : null}
            {warning ? (
              <div className={`small ${isStopFailure ? "text-error" : "muted"}`}>{warning}</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
