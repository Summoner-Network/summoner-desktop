import React from "react";

export default function PlaceholderPanel(props: { title: string; subtitle: string }) {
  return (
    <div className="placeholder">
      <div className="fw600">{props.title}</div>
      <div className="small mt6">{props.subtitle}</div>
    </div>
  );
}
