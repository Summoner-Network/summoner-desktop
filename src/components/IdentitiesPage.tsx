import React, { useEffect, useState } from "react";
import type { Identity } from "../App";
import { formatValue, safeParseJson } from "../utils/message";

export default function IdentitiesPage(props: {
  identities: Identity[];
  selectedIdentityId: string | null;
  onSelectIdentityId: (id: string | null) => void;
  onAddIdentity: (next: { name: string; value: unknown }) => void;
  onUpdateIdentity: (id: string, next: { name: string; value: unknown }) => void;
}) {
  const { identities, selectedIdentityId, onSelectIdentityId, onAddIdentity, onUpdateIdentity } = props;
  const selected = identities.find((id) => id.id === selectedIdentityId) ?? identities[0];
  const [draftName, setDraftName] = useState<string>(selected?.name ?? "");
  const [draftJson, setDraftJson] = useState<string>(selected ? formatValue(selected.value) : "{}");
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newJson, setNewJson] = useState("{\n  \n}");

  useEffect(() => {
    if (!selected) return;
    setDraftName(selected.name);
    setDraftJson(formatValue(selected.value));
    setError(null);
  }, [selected?.id]);

  function save() {
    if (!selected) return;
    setError(null);
    const parsed = safeParseJson(draftJson);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return setError("Identity JSON must be a single object.");
    }
    if (!draftName.trim()) return setError("Name is required.");
    onUpdateIdentity(selected.id, { name: draftName.trim(), value: parsed });
  }

  function add() {
    setError(null);
    const parsed = safeParseJson(newJson);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return setError("New identity JSON must be a single object.");
    }
    if (!newName.trim()) return setError("New identity name is required.");
    onAddIdentity({ name: newName.trim(), value: parsed });
    setNewName("");
    setNewJson("{\n  \n}");
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="title">Identities</div>
          <div className="subtitle">Profiles used to populate the "from" field in outbound payloads.</div>
        </div>
      </div>

      <div className="page-grid">
        <div className="panel">
          <div className="panel-title">My IDs</div>
          <div className="panel-list">
            {identities.map((id) => (
              <div
                key={id.id}
                className={`panel-item ${id.id === selected?.id ? "selected" : ""}`}
                onClick={() => onSelectIdentityId(id.id)}
                role="button"
                tabIndex={0}
              >
                <div className="fw600">{id.name}</div>
                <div className="small">{typeof id.value === "object" ? "JSON payload" : String(id.value)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Identity Detail</div>
          {selected ? (
            <div className="detail-grid">
              <label className="form-field">
                <span className="detail-label">Name</span>
                <input value={draftName} onChange={(e) => setDraftName(e.target.value)} />
              </label>
              <label className="form-field">
                <span className="detail-label">JSON Payload</span>
                <textarea rows={8} value={draftJson} onChange={(e) => setDraftJson(e.target.value)} />
              </label>
              <button className="primary" type="button" onClick={save}>
                Save Identity
              </button>
            </div>
          ) : (
            <div className="small">Select an identity to view details.</div>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">Add Identity</div>
        <div className="detail-grid">
          <label className="form-field">
            <span className="detail-label">Name</span>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New Identity" />
          </label>
          <label className="form-field">
            <span className="detail-label">JSON Payload</span>
            <textarea rows={6} value={newJson} onChange={(e) => setNewJson(e.target.value)} />
          </label>
          <button className="primary" type="button" onClick={add}>
            Add Identity
          </button>
          {error ? <div className="small text-error">{error}</div> : null}
        </div>
      </div>
    </div>
  );
}
