import React from "react";

export default function AgentsPage() {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="title">Agents</div>
          <div className="subtitle">Local agents and SDK environments managed by this app.</div>
        </div>
        <button className="primary" type="button">
          Add Agent
        </button>
      </div>

      <div className="panel">
        <div className="panel-title">My Agents</div>
        <div className="empty-state">
          <div className="empty-title">No agents yet</div>
          <div className="small">This will list local agents detected from your file system and runtime.</div>
        </div>
      </div>
    </div>
  );
}
