import React, { useRef, useState } from "react";

export default function Composer(props: {
  disabled: boolean;
  onSend: (text: string) => Promise<void> | void;
}) {
  const [text, setText] = useState<string>("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  function resizeTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    const next = Math.min(el.scrollHeight, 180);
    el.style.height = `${next}px`;
  }

  async function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText("");
    requestAnimationFrame(resizeTextarea);
    await props.onSend(trimmed);
  }

  return (
    <div className="composer">
      <div className="composer-input">
        <textarea
          ref={textareaRef}
          rows={1}
          placeholder={props.disabled ? "Paused. Connect to send messages" : "Message the server…"}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            requestAnimationFrame(resizeTextarea);
          }}
          onInput={resizeTextarea}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          disabled={props.disabled}
        />
        <div className="composer-hint">Enter to send · Shift+Enter for newline</div>
      </div>
      <button type="button" className="primary" onClick={submit} disabled={props.disabled || text.trim().length === 0}>
        Send
      </button>
    </div>
  );
}
