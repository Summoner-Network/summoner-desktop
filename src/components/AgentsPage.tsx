import React, { useEffect, useMemo, useState } from "react";
import githubMark from "../../assets/originals/github-mark.svg";
import type { ProjectItem } from "./ProjectsPage";

type AgentItem = { name: string; folderName: string; path: string; createdAt: number; hasIdentityFile?: boolean };
type RunningAgent = { projectName: string; name: string; folderName: string };

export default function AgentsPage(props: {
  projects: ProjectItem[];
  onImport: (args: { projectName: string; source: string; name?: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
  onList: (args: { projectName: string }) => Promise<{ ok: true; items: AgentItem[] } | { ok: false; error: string }>;
  onStart: (args: { projectName: string; agentName: string; options?: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
  onStop: (args: { projectName: string; agentName: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
  onRemove: (args: { projectName: string; agentName: string; folderName?: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
  runningAgents: RunningAgent[];
}) {
  const { projects, onImport, onList, onStart, onStop, onRemove, runningAgents } = props;
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [source, setSource] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [optionsByAgent, setOptionsByAgent] = useState<Record<string, string>>({});
  const [agentError, setAgentError] = useState<Record<string, string>>({});
  const [identityDraftByAgent, setIdentityDraftByAgent] = useState<Record<string, string>>({});
  const [identityErrorByAgent, setIdentityErrorByAgent] = useState<Record<string, string>>({});
  const [identityStatusByAgent, setIdentityStatusByAgent] = useState<Record<string, string>>({});
  const [identityLoadingByAgent, setIdentityLoadingByAgent] = useState<Record<string, boolean>>({});
  const [expandedByAgent, setExpandedByAgent] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);

  const projectOptions = useMemo(() => projects.map((p) => ({ id: p.id, name: p.name })), [projects]);

  useEffect(() => {
    if (!selectedProject && projectOptions.length > 0) {
      setSelectedProject(projectOptions[0].id);
    }
  }, [projectOptions, selectedProject]);

  useEffect(() => {
    if (!selectedProject) return;
    onList({ projectName: selectedProject }).then((res) => {
      if (!res.ok) return;
      setAgents(res.items);
    });
  }, [selectedProject, onList]);

  async function loadIdentityFile(agent: AgentItem) {
    if (!selectedProject) return;
    const key = `${selectedProject}:${agent.folderName}`;
    setIdentityLoadingByAgent((prev) => ({ ...prev, [key]: true }));
    setIdentityErrorByAgent((prev) => ({ ...prev, [key]: "" }));
    setIdentityStatusByAgent((prev) => ({ ...prev, [key]: "" }));
    const res = await window.api.agents.identityRead({ projectName: selectedProject, folderName: agent.folderName });
    if (!res.ok) {
      setIdentityErrorByAgent((prev) => ({ ...prev, [key]: res.error }));
      setIdentityLoadingByAgent((prev) => ({ ...prev, [key]: false }));
      return;
    }
    if (!res.exists) {
      setIdentityErrorByAgent((prev) => ({ ...prev, [key]: "id.json not found for this agent." }));
    }
    setIdentityDraftByAgent((prev) => ({ ...prev, [key]: res.content ?? "" }));
    setIdentityLoadingByAgent((prev) => ({ ...prev, [key]: false }));
  }

  async function handleSaveIdentity(agent: AgentItem) {
    if (!selectedProject) return;
    const key = `${selectedProject}:${agent.folderName}`;
    setIdentityLoadingByAgent((prev) => ({ ...prev, [key]: true }));
    setIdentityErrorByAgent((prev) => ({ ...prev, [key]: "" }));
    setIdentityStatusByAgent((prev) => ({ ...prev, [key]: "" }));
    const content = identityDraftByAgent[key] ?? "";
    const res = await window.api.agents.identityWrite({
      projectName: selectedProject,
      folderName: agent.folderName,
      content
    });
    if (!res.ok) {
      setIdentityErrorByAgent((prev) => ({ ...prev, [key]: res.error }));
      setIdentityLoadingByAgent((prev) => ({ ...prev, [key]: false }));
      return;
    }
    setIdentityStatusByAgent((prev) => ({ ...prev, [key]: "Identity saved." }));
    setIdentityLoadingByAgent((prev) => ({ ...prev, [key]: false }));
  }

  async function handleImport() {
    if (!selectedProject) {
      setError("Select a project first.");
      return;
    }
    if (!source.trim()) {
      setError("Paste a GitHub URL or repo path.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await onImport({ projectName: selectedProject, source, name: name.trim() || undefined });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSource("");
      setName("");
      const list = await onList({ projectName: selectedProject });
      if (list.ok) setAgents(list.items);
    } finally {
      setBusy(false);
    }
  }

  async function handleStart(agent: AgentItem) {
    if (!selectedProject) return;
    setBusy(true);
    setAgentError((prev) => ({ ...prev, [agent.name]: "" }));
    try {
      const res = await onStart({
        projectName: selectedProject,
        agentName: agent.name,
        options: optionsByAgent[agent.name]
      });
      if (!res.ok) {
        setAgentError((prev) => ({ ...prev, [agent.name]: res.error }));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleStop(agent: AgentItem) {
    if (!selectedProject) return;
    setBusy(true);
    setAgentError((prev) => ({ ...prev, [agent.name]: "" }));
    try {
      const res = await onStop({ projectName: selectedProject, agentName: agent.name });
      if (!res.ok) {
        setAgentError((prev) => ({ ...prev, [agent.name]: res.error }));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(agent: AgentItem) {
    if (!selectedProject) return;
    setBusy(true);
    setAgentError((prev) => ({ ...prev, [agent.name]: "" }));
    try {
      const res = await onRemove({ projectName: selectedProject, agentName: agent.name, folderName: agent.folderName });
      if (!res.ok) {
        setAgentError((prev) => ({ ...prev, [agent.name]: res.error }));
        return;
      }
      const list = await onList({ projectName: selectedProject });
      if (list.ok) setAgents(list.items);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="title">Agents</div>
          <div className="subtitle">Agents live inside a project’s Summoner SDK folder.</div>
        </div>
      </div>

      <div className="agent-tip">
        <div className="agent-tip-title">
          <span className="agent-tip-icon" aria-hidden="true" />
          <span className="fw600">Agent folder structure</span>
        </div>
        <div className="small mt6">
          Required: <span className="mono">agent.py</span> is the entry point that runs your agent.
        </div>
        <div className="small mt6">
          Optional: <span className="mono">requirements.txt</span> installs dependencies, and{" "}
          <span className="mono">id.json</span> provides identity metadata.
        </div>
      </div>

      <div className="page-grid">
        <div className="panel">
          <div className="panel-title">Project Agents</div>
          <div className="form-field">
            <span className="detail-label">Project</span>
            <select
              className="context-select"
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              disabled={projectOptions.length === 0}
            >
              {projectOptions.length === 0 ? <option value="">No projects</option> : null}
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {agents.length === 0 ? (
            <div className="empty-state mt10">
              <div className="empty-title">No agents yet</div>
              <div className="small">Import a GitHub subfolder to add one.</div>
            </div>
          ) : (
            <div className="panel-list mt10">
              {agents.map((a) => (
                <div key={a.name} className="panel-item">
                  <div className="fw600">{a.name}</div>
                  <div className="agent-path">{a.path}</div>
                  <div className="agent-actions-row">
                    {runningAgents.some((r) => r.projectName === selectedProject && r.name === a.name) ? (
                      <button type="button" className="danger" onClick={() => handleStop(a)} disabled={busy}>
                        Stop
                      </button>
                    ) : (
                      <button type="button" onClick={() => handleStart(a)} disabled={busy}>
                        Run
                      </button>
                    )}
                    <button type="button" className="danger-outline" onClick={() => handleRemove(a)} disabled={busy}>
                      Delete
                    </button>
                  </div>
                  <div className="form-field mt10">
                    <span className="detail-label">Options</span>
                    <input
                      value={optionsByAgent[a.name] ?? ""}
                      onChange={(e) =>
                        setOptionsByAgent((prev) => ({ ...prev, [a.name]: e.target.value }))
                      }
                      placeholder="--name alice --avatar wizard"
                      disabled={busy}
                    />
                  </div>
                  {a.hasIdentityFile ? (
                    <details
                      className="identity-details mt10"
                      open={!!expandedByAgent[`${selectedProject}:${a.folderName}`]}
                      onToggle={(e) => {
                        const nextOpen = (e.currentTarget as HTMLDetailsElement).open;
                        const key = `${selectedProject}:${a.folderName}`;
                        setExpandedByAgent((prev) => ({ ...prev, [key]: nextOpen }));
                        if (nextOpen && !identityDraftByAgent[key]) {
                          void loadIdentityFile(a);
                        }
                      }}
                    >
                      <summary className="identity-summary">Identity Detail</summary>
                      <div className="identity-body">
                        <div className="small muted">Edit the agent identity payload (id.json).</div>
                        {identityLoadingByAgent[`${selectedProject}:${a.folderName}`] ? (
                          <div className="small mt6">Loading identity...</div>
                        ) : null}
                        <textarea
                          className="identity-textarea"
                          value={identityDraftByAgent[`${selectedProject}:${a.folderName}`] ?? ""}
                          onChange={(e) => {
                            const key = `${selectedProject}:${a.folderName}`;
                            setIdentityDraftByAgent((prev) => ({ ...prev, [key]: e.target.value }));
                          }}
                          placeholder={`{\n  "name": "Agent"\n}\n`}
                          disabled={identityLoadingByAgent[`${selectedProject}:${a.folderName}`]}
                        />
                        <div className="identity-actions">
                          <button
                            type="button"
                            className="primary"
                            onClick={() => handleSaveIdentity(a)}
                            disabled={identityLoadingByAgent[`${selectedProject}:${a.folderName}`]}
                          >
                            {identityLoadingByAgent[`${selectedProject}:${a.folderName}`] ? "Saving..." : "Save Identity"}
                          </button>
                        </div>
                        {identityStatusByAgent[`${selectedProject}:${a.folderName}`] ? (
                          <div className="small mt6">{identityStatusByAgent[`${selectedProject}:${a.folderName}`]}</div>
                        ) : null}
                        {identityErrorByAgent[`${selectedProject}:${a.folderName}`] ? (
                          <div className="small text-error mt6">{identityErrorByAgent[`${selectedProject}:${a.folderName}`]}</div>
                        ) : null}
                      </div>
                    </details>
                  ) : null}
                  {agentError[a.name] ? <div className="small text-error mt6">{agentError[a.name]}</div> : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-title">
            <span className="row align-center gap10">
              <img src={githubMark} alt="" className="icon-16" />
              GitHub Import
            </span>
          </div>
          <div className="detail-grid">
            <label className="form-field">
              <span className="detail-label">GitHub path or URL</span>
              <input
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="https://github.com/org/repo/tree/main/path/to/agent"
                disabled={busy}
              />
            </label>
            <label className="form-field">
              <span className="detail-label">Agent name (optional)</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my_agent"
                disabled={busy}
              />
            </label>
            {error ? (
              <div className="small text-error">{error}</div>
            ) : (
              <div className="small">You can paste paths that include `blob/main` or `tree/main`.</div>
            )}
            <button className="primary" type="button" onClick={handleImport} disabled={busy || !selectedProject}>
              Import Agent
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
