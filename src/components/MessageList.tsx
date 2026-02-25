import React, { useEffect, useRef } from "react";

export type UiMessage = {
  id: string;
  direction: "in" | "out";
  ts: number;
  raw: string;
  source?: string;
  typed?: { value: unknown; type: unknown };
};

function renderToken(value: unknown, type: unknown): React.ReactNode {
  if (type === "int" || type === "float") return <span className="token number">{String(value)}</span>;
  if (type === "bool") return <span className="token boolean">{String(value)}</span>;
  if (type === "null") return <span className="token null">null</span>;
  if (type === "str") return <span className="token string">{String(value)}</span>;
  return <span className="token unknown">{String(value)}</span>;
}

function renderTyped(value: unknown, type: unknown, indent = 0): React.ReactNode {
  const pad = " ".repeat(indent);
  const nextIndent = indent + 2;

  if (type === "str" || type === "bool" || type === "int" || type === "float" || type === "null") {
    return renderToken(value, type);
  }

  if (Array.isArray(type) && Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return (
      <>
        {"["}
        {"\n"}
        {value.map((v, i) => (
          <span key={i}>
            {pad}  {renderTyped(v, type[i], nextIndent)}
            {i < value.length - 1 ? "," : ""}
            {"\n"}
          </span>
        ))}
        {pad}
        {"]"}
      </>
    );
  }

  if (type && typeof type === "object" && value && typeof value === "object" && !Array.isArray(value)) {
    const t = type as Record<string, unknown>;
    const v = value as Record<string, unknown>;
    const keys = Object.keys({ ...v, ...t });
    if (keys.length === 0) return "{}";
    return (
      <>
        {"{"}
        {"\n"}
        {keys.map((k, idx) => (
          <span key={k}>
            {pad}  <span className="token key">{k}</span>
            {": "}
            {renderTyped(v[k], t[k], nextIndent)}
            {idx < keys.length - 1 ? "," : ""}
            {"\n"}
          </span>
        ))}
        {pad}
        {"}"}
      </>
    );
  }

  return renderToken(value, type);
}

function fmt(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString();
}

export default function MessageList(props: { messages: UiMessage[] }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [props.messages.length]);

  return (
    <div className="messages" ref={ref}>
      {props.messages.length === 0 ? (
        <div className="empty-state">
          <div className="empty-title">No messages yet</div>
          <div className="small">Start the conversation or wait for the server to speak.</div>
        </div>
      ) : null}

      {props.messages.map((m) => (
        <div key={m.id} className={`msg ${m.direction}`}>
          <div className="msg-meta">
            <div className="row align-center gap10">
              <div className="avatar">{m.direction === "in" ? "S" : "Y"}</div>
              <div className="fw600">{m.direction === "in" ? "Server" : "You"}</div>
              <div className="time">{fmt(m.ts)}</div>
            </div>
            {m.source ? <div className="msg-source">{m.source}</div> : null}
          </div>
          <div className="msg-raw">{m.typed ? renderTyped(m.typed.value, m.typed.type) : m.raw}</div>
        </div>
      ))}
    </div>
  );
}
