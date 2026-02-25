import React, { useEffect, useMemo, useState } from "react";
import type { ServerProfile, ConnectionStatus, Identity } from "../App";
import MessageList, { UiMessage } from "./MessageList";
import Composer from "./Composer";
import { formatValue, inferType, parseServerMessage, safeParseJson } from "../utils/message";

export default function ChatView(props: {
  server: ServerProfile;
  status: ConnectionStatus;
  desired: boolean;
  onConnect: (server: ServerProfile) => Promise<void>;
  onDisconnect: (serverId: string) => Promise<void>;
  toValue: unknown | null;
  toMode: "none" | "null" | "remote" | "agent";
  toLabel: string;
  onSetToMode: (mode: "none" | "null" | "remote" | "agent") => void;
  onSetToKey: (key: string) => void;
  availableToKeys: string[];
  selectedToKey: string;
  fromIdentity: Identity | null;
  onSetFromIdentity: (id: string | null) => void;
  identityOptions: Identity[];
}) {
  const {
    server,
    status,
    desired,
    onConnect,
    onDisconnect,
    toValue,
    toMode,
    toLabel,
    onSetToMode,
    onSetToKey,
    availableToKeys,
    selectedToKey,
    fromIdentity,
    onSetFromIdentity,
    identityOptions
  } = props;

  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Keep separate history per server later. For now, reset when switching.
  useEffect(() => {
    setMessages([]);
    setError(null);
    let mounted = true;
    window.api.logs.read({ serverId: server.id, host: server.host, port: server.port }).then((res) => {
      if (!mounted || !res.ok) return;
      const history = res.items.map((item, idx) => {
        if (item.direction === "in") {
          const parsed = parseServerMessage(item.raw);
          return {
            id: `${item.ts}-${idx}`,
            direction: "in" as const,
            ts: item.ts,
            raw: parsed.text,
            source: parsed.remoteAddr,
            typed: parsed.typed
          };
        }
        return {
          id: `${item.ts}-${idx}`,
          direction: "out" as const,
          ts: item.ts,
          raw: item.raw
        };
      });
      setMessages(history);
    });
    return () => {
      mounted = false;
    };
  }, [server.id]);

  useEffect(() => {
    const off = window.api.tcp.onMessage((msg) => {
      if (msg.serverId !== server.id) return;
      const parsed = parseServerMessage(msg.raw);

      setMessages((prev) => [
        ...prev,
        {
          id: `${msg.ts}-${Math.random().toString(16).slice(2)}`,
          direction: "in",
          ts: msg.ts,
          raw: parsed.text,
          source: parsed.remoteAddr,
          typed: parsed.typed
        }
      ]);
    });

    return () => off();
  }, [server.id]);

  const canSend = status === "connected";

  const headerTitle = useMemo(() => {
    return `${server.name} (${server.host}:${server.port})`;
  }, [server.host, server.name, server.port]);

  async function handleConnect() {
    setError(null);
    try {
      await onConnect(server);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect");
    }
  }

  async function handleDisconnect() {
    setError(null);
    try {
      await onDisconnect(server.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to disconnect");
    }
  }

  async function onSend(text: string) {
    setError(null);

    const parsed = safeParseJson(text);
    const nestedParsed = typeof parsed === "string" ? safeParseJson(parsed) : null;
    const effectiveParsed = nestedParsed !== null ? nestedParsed : parsed;
    let outgoingText = text;
    let display = text;
    let typed: UiMessage["typed"] | undefined;

  const hasTo =
      (toMode === "null") ||
      ((toMode === "remote" || toMode === "agent") && toValue !== null && toValue !== undefined);
    const hasFrom = !!fromIdentity;

    let payload: Record<string, unknown> | null = null;

    if (hasTo || hasFrom) {
      if (effectiveParsed && typeof effectiveParsed === "object" && !Array.isArray(effectiveParsed)) {
        payload = { ...(effectiveParsed as Record<string, unknown>) };
      } else if (effectiveParsed !== null) {
        payload = { payload: effectiveParsed };
      } else {
        payload = { payload: text };
      }

      if (!("to" in payload)) {
        if (toMode === "null") payload.to = null;
        if ((toMode === "remote" || toMode === "agent") && toValue !== null && toValue !== undefined) {
          payload.to = toValue;
        }
      }

      if (fromIdentity && !("from" in payload)) {
        payload.from = fromIdentity.value;
      }

      outgoingText = JSON.stringify(payload);
      display = formatValue(payload);
      typed = { value: payload, type: inferType(payload) };
    } else if (effectiveParsed && typeof effectiveParsed === "object" && !Array.isArray(effectiveParsed)) {
      outgoingText = JSON.stringify(effectiveParsed);
      display = formatValue(effectiveParsed);
      typed = { value: effectiveParsed, type: inferType(effectiveParsed) };
    } else if (effectiveParsed !== null) {
      outgoingText = JSON.stringify(effectiveParsed);
      display = formatValue(effectiveParsed);
      typed = { value: effectiveParsed, type: inferType(effectiveParsed) };
    }

    // Optimistic echo
    const ts = Date.now();
    setMessages((prev) => [
      ...prev,
      {
        id: `${ts}-${Math.random().toString(16).slice(2)}`,
        direction: "out",
        ts,
        raw: display,
        typed
      }
    ]);

    const res = await window.api.tcp.sendChat({ serverId: server.id, text: outgoingText });
    if (!res.ok) setError(res.error);
  }

  const label =
    status === "connected" ? "Online" : desired ? (status === "connecting" ? "Connecting" : "Reconnecting") : "Paused";

  return (
    <div className="content">
      <div className="chat-header">
        <div className="row align-center gap12">
          <div className="channel-badge">#</div>
          <div>
            <div className="fw700">{headerTitle}</div>
            <div className="small">Long-lived TCP session. Auto-reconnects unless you pause it.</div>
          </div>
        </div>

        <div className="row align-center gap10">
          <div className="pill">
            <span className={`status-dot ${status}`} />
            {label}
          </div>
          {desired ? (
            <button type="button" className="danger" onClick={handleDisconnect}>
              Disconnect
            </button>
          ) : (
            <button type="button" onClick={handleConnect} disabled={status === "connecting"}>
              Connect
            </button>
          )}
        </div>
      </div>

      <MessageList messages={messages} />

      <div className="chat-footer">
        {error ? (
          <div className="small error-bar">
            <span className="text-error">Error:</span> {error}
          </div>
        ) : null}
        <div className="send-context">
          <div className="context-row">
            <div className="context-label">Sending to</div>
            <div className="context-value">{toLabel}</div>
            <div className="context-actions">
              <select
                className="context-select"
                value={toMode === "remote" ? selectedToKey : toMode}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "none" || v === "null" || v === "agent") {
                    onSetToMode(v);
                  } else {
                    onSetToMode("remote");
                    onSetToKey(v);
                  }
                }}
              >
                <option value="none">none</option>
                <option value="null">null</option>
                {toMode === "agent" ? <option value="agent">agent</option> : null}
                {availableToKeys.map((k) => (
                  <option key={k} value={k}>
                    key: {k}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="context-row">
            <div className="context-label">Sending as</div>
            <div className="context-value">{fromIdentity ? fromIdentity.name : "none"}</div>
            <div className="context-actions">
              <select
                className="context-select"
                value={fromIdentity ? fromIdentity.id : "none"}
                onChange={(e) => {
                  const v = e.target.value;
                  onSetFromIdentity(v === "none" ? null : v);
                }}
              >
                <option value="none">none</option>
                {identityOptions.map((id) => (
                  <option key={id.id} value={id.id}>
                    {id.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <Composer disabled={!canSend} onSend={onSend} />
      </div>
    </div>
  );
}
