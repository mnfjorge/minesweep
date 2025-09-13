"use client";

export default function ToolToggle(props: {
  tool: "reveal" | "flag";
  onToggle: (next: "reveal" | "flag") => void;
  onTrack?: (eventName: string) => void;
}) {
  const { tool, onToggle, onTrack } = props;
  return (
    <button
      className={`ms-tool ${tool === "flag" ? "ms-tool-active" : ""}`}
      onClick={() => {
        const next = tool === "flag" ? "reveal" : "flag";
        onToggle(next);
        if (onTrack) onTrack(next === "flag" ? "tool_flag" : "tool_reveal");
      }}
      aria-label="toggle-flag"
      style={{ width: 36, height: 36 }}
    >
      {tool === "flag" ? "🚩" : "⛏️"}
    </button>
  );
}

