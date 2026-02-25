import React, { useMemo, useState } from "react";

type BundleConfig = {
  id: string;
  label: string;
  repo: string;
  modules: { id: string; label: string }[];
};

const BUNDLES: BundleConfig[] = [
  {
    id: "agentclass",
    label: "Agent Class",
    repo: "https://github.com/Summoner-Network/extension-agentclass.git",
    modules: [{ id: "aurora", label: "aurora" }]
  },
  {
    id: "utilities",
    label: "Utilities",
    repo: "https://github.com/Summoner-Network/extension-utilities.git",
    modules: [
      { id: "visionary", label: "visionary" },
      { id: "curl_tools", label: "curl_tools" },
      { id: "crypto_utils", label: "crypto_utils" },
      { id: "gpt_guardrails", label: "gpt_guardrails" }
    ]
  }
];

export type ProjectSpec = {
  name: string;
  serverVersion: string;
  selections: Record<string, string[]>;
};

export type ProjectItem = {
  name: string;
  serverVersion: string;
  selections: Record<string, string[]>;
  createdAt: number;
  status: "installing" | "ready" | "error";
  error?: string;
};

type EnvRow = { key: string; value: string };

function parseEnv(content: string): EnvRow[] {
  const rows: EnvRow[] = [];
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const cleaned = trimmed.startsWith("export ") ? trimmed.slice(7) : trimmed;
    const idx = cleaned.indexOf("=");
    if (idx === -1) return;
    const key = cleaned.slice(0, idx).trim();
    let value = cleaned.slice(idx + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    rows.push({ key, value });
  });
  return rows.length ? rows : [{ key: "", value: "" }];
}

function serializeEnv(rows: EnvRow[]): string {
  const lines = rows
    .filter((r) => r.key.trim().length > 0)
    .map((r) => {
      const key = r.key.trim();
      let value = r.value ?? "";
      if (/[#\s]/.test(value)) {
        value = `"${value.replace(/"/g, "\\\"")}"`;
      }
      return `export ${key}=${value}`;
    });
  return lines.join("\n") + (lines.length ? "\n" : "");
}

export default function ProjectsPage(props: {
  projects: ProjectItem[];
  onCreate: (spec: ProjectSpec) => Promise<{ ok: true } | { ok: false; error: string }>;
  onReset: (spec: { name: string; serverVersion: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
  onDelete: (name: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  onReadEnv: (args: { name: string }) => Promise<{ ok: true; content: string } | { ok: false; error: string }>;
  onWriteEnv: (args: { name: string; content: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const { projects, onCreate, onReset, onDelete, onReadEnv, onWriteEnv } = props;
  const [name, setName] = useState<string>("");
  const [serverVersion, setServerVersion] = useState<string>("v1_1_0");
  const [selected, setSelected] = useState<Record<string, Record<string, boolean>>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [envRows, setEnvRows] = useState<EnvRow[]>([{ key: "", value: "" }]);
  const [envError, setEnvError] = useState<string | null>(null);

  const selectionSummary = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const b of BUNDLES) {
      const mods = b.modules.filter((m) => selected[b.id]?.[m.id]).map((m) => m.id);
      if (mods.length > 0) out[b.id] = mods;
    }
    return out;
  }, [selected]);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter a project name.");
      return;
    }
    if (Object.keys(selectionSummary).length === 0) {
      setError("Select at least one module.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await onCreate({ name: trimmed, serverVersion, selections: selectionSummary });
      if (!res.ok) setError(res.error);
      if (res.ok) {
        setName("");
        setSelected({});
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleReset(projectName: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await onReset({ name: projectName, serverVersion });
      if (!res.ok) setError(res.error);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(projectName: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await onDelete(projectName);
      if (!res.ok) setError(res.error);
    } finally {
      setBusy(false);
    }
  }

  async function loadEnv(projectName: string) {
    setEnvError(null);
    const res = await onReadEnv({ name: projectName });
    if (!res.ok) {
      setEnvError(res.error);
      return;
    }
    setEnvRows(parseEnv(res.content));
  }

  async function saveEnv() {
    if (!activeProject) return;
    setEnvError(null);
    const content = serializeEnv(envRows);
    const res = await onWriteEnv({ name: activeProject, content });
    if (!res.ok) setEnvError(res.error);
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="title">Projects</div>
          <div className="subtitle">Create Summoner SDK projects with selected bundles and modules.</div>
        </div>
      </div>

      <div className="page-grid">
        <div className="panel">
          <div className="panel-title">Your Projects</div>
          {projects.length === 0 ? (
            <div className="small">No projects created yet.</div>
          ) : (
            <div className="panel-list">
              {projects.map((p) => (
                <div
                  key={p.name}
                  className={`panel-item ${activeProject === p.name ? "selected" : ""}`}
                  onClick={() => {
                    setActiveProject(p.name);
                    void loadEnv(p.name);
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="row-between align-center gap10">
                    <div>
                      <div className="fw600">{p.name}</div>
                      <div className="small mt6">Server: {p.serverVersion || "v1_1_0"}</div>
                    </div>
                    <div className="row gap10">
                      {p.status === "installing" ? (
                        <div className="pill pill-loading">Installing…</div>
                      ) : (
                        <button type="button" onClick={() => handleReset(p.name)} disabled={busy}>
                          Reset
                        </button>
                      )}
                      <button
                        type="button"
                        className="danger"
                        onClick={() => handleDelete(p.name)}
                        disabled={busy || p.status === "installing"}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="small mt6">
                    {Object.entries(p.selections)
                      .map(([bundleId, mods]) => `${bundleId}: ${mods.join(", ")}`)
                      .join(" | ")}
                  </div>
                  {p.status === "error" && p.error ? (
                    <div className="small mt6">
                      <span className="text-error">Install failed:</span> {p.error}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-title">New Project</div>
          <div className="form-grid">
            <div className="form-field">
              <label className="detail-label">Project name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my_project"
                disabled={busy}
              />
            </div>
            <div className="form-field">
              <label className="detail-label">Server version (mac/linux)</label>
              <input
                value={serverVersion}
                onChange={(e) => setServerVersion(e.target.value)}
                placeholder="v1_1_0"
                disabled={busy}
              />
            </div>
          </div>

          <div className="mt10">
            {BUNDLES.map((bundle) => (
              <div key={bundle.id} className="detail-row mt10">
                <div className="detail-label">{bundle.label}</div>
                <div className="bundle-grid">
                  {bundle.modules.map((m) => (
                    <label key={m.id} className="bundle-option">
                      <input
                        type="checkbox"
                        checked={!!selected[bundle.id]?.[m.id]}
                        onChange={(e) => {
                          setSelected((prev) => ({
                            ...prev,
                            [bundle.id]: { ...prev[bundle.id], [m.id]: e.target.checked }
                          }));
                        }}
                        disabled={busy}
                      />
                      <span>{m.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {error ? (
            <div className="small mt10">
              <span className="text-error">Error:</span> {error}
            </div>
          ) : null}

          <div className="mt10">
            <button type="button" className="primary" onClick={handleCreate} disabled={busy}>
              Create Project
            </button>
          </div>
        </div>
      </div>

      <div className="panel mt18">
        <div className="panel-title">Project Environment (.env)</div>
        {activeProject ? (
          <div className="detail-grid">
            <div className="small">Editing: {activeProject}</div>
            <div className="env-table">
              <div className="env-head">Variable</div>
              <div className="env-head">Value</div>
              <div className="env-head" />
              {envRows.map((row, idx) => (
                <React.Fragment key={idx}>
                  <input
                    value={row.key}
                    onChange={(e) => {
                      const next = [...envRows];
                      next[idx] = { ...row, key: e.target.value };
                      setEnvRows(next);
                    }}
                    placeholder="API_KEY"
                  />
                  <input
                    value={row.value}
                    onChange={(e) => {
                      const next = [...envRows];
                      next[idx] = { ...row, value: e.target.value };
                      setEnvRows(next);
                    }}
                    placeholder="value"
                  />
                  <button
                    type="button"
                    className="env-remove"
                    onClick={() => {
                      const next = envRows.filter((_, i) => i !== idx);
                      setEnvRows(next.length ? next : [{ key: "", value: "" }]);
                    }}
                    aria-label="Remove row"
                  >
                    ×
                  </button>
                </React.Fragment>
              ))}
            </div>
            <div className="row gap10">
              <button
                type="button"
                onClick={() => setEnvRows((prev) => [...prev, { key: "", value: "" }])}
              >
                Add Row
              </button>
              <button type="button" className="primary" onClick={saveEnv}>
                Save .env
              </button>
            </div>
            {envError ? <div className="small text-error">{envError}</div> : null}
          </div>
        ) : (
          <div className="small">Select a project to edit its environment.</div>
        )}
      </div>
    </div>
  );
}
