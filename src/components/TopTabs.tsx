import React from "react";

export type TopTab = "servers" | "agents" | "network";

export default function TopTabs(props: {
  value: TopTab;
  onChange: (t: TopTab) => void;
}) {
  const { value, onChange } = props;

  return (
    <div className="tabs" aria-label="Top panel tabs">
      <button className={"tab " + (value === "servers" ? "active" : "")} onClick={() => onChange("servers")}
        type="button">
        Servers
      </button>
      <button className={"tab " + (value === "agents" ? "active" : "")} onClick={() => onChange("agents")}
        type="button">
        Agents
      </button>
      <button className={"tab " + (value === "network" ? "active" : "")} onClick={() => onChange("network")}
        type="button">
        Network
      </button>
    </div>
  );
}
