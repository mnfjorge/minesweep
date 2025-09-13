"use client";

import { useEffect, useState } from "react";

type Entry = { userId: string; seconds: number; name: string | null; email: string | null };

export default function Ranking(props: {
  isOpen: boolean;
  onClose: () => void;
  fetchEntries: () => Promise<{ easy: Entry[]; normal: Entry[]; hard: Entry[] }>;
  onTrack?: (eventName: string) => void;
  formatSeconds: (n: number) => string;
}) {
  const { isOpen, onClose, fetchEntries, onTrack, formatSeconds } = props;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<{ easy: Entry[]; normal: Entry[]; hard: Entry[] }>({ easy: [], normal: [], hard: [] });

  useEffect(() => {
    if (!isOpen) return;
    if (onTrack) onTrack("open_ranking");
    let aborted = false;
    setLoading(true);
    setError(null);
    fetchEntries()
      .then(({ easy, normal, hard }) => {
        if (!aborted) setEntries({ easy: Array.isArray(easy) ? easy : [], normal: Array.isArray(normal) ? normal : [], hard: Array.isArray(hard) ? hard : [] });
      })
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : "Failed to load";
        if (!aborted) setError(message);
      })
      .finally(() => {
        if (!aborted) setLoading(false);
      });
    return () => {
      aborted = true;
    };
  }, [isOpen, fetchEntries, onTrack]);

  if (!isOpen) return null;

  return (
    <div className="ms-modal-overlay" role="dialog" aria-modal="true">
      <div className="ms-modal" role="document">
        <div className="ms-tabs">
          <button className="ms-tab" aria-selected={true}>
            🏆 Top 10
          </button>
          <button className="ms-tab ms-tab-right" onClick={onClose} aria-label="close-leaderboard" title="Close">
            ✕
          </button>
        </div>
        <div className="ms-modal-section">
          {loading && <div className="ms-copy">Loading…</div>}
          {error && <div className="ms-copy" style={{ color: "#b00020" }}>{error}</div>}
          {!loading && !error && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
              {(["easy", "normal", "hard"] as const).map((diff) => {
                const list = entries[diff];
                return (
                  <div key={diff}>
                    <div className="ms-section-title" style={{ marginBottom: 8, textTransform: "capitalize" }}>{diff}</div>
                    {Array.isArray(list) && list.length > 0 ? (
                      <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
                        {list.map((e, idx) => {
                          const safeUserId = typeof e.userId === "string" ? e.userId : String(e.userId ?? "");
                          const display = e.name || e.email || (safeUserId ? safeUserId.slice(0, 6) + "…" : "Unknown");
                          return (
                            <li key={safeUserId || String(idx)} style={{ display: "grid", gridTemplateColumns: "40px 1fr auto", alignItems: "center", gap: 8, padding: "6px 4px" }}>
                              <span style={{ fontWeight: 800, textAlign: "right" }}>{idx + 1}.</span>
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{display}</span>
                              <span style={{ fontWeight: 700 }}>{formatSeconds(e.seconds)}</span>
                            </li>
                          );
                        })}
                      </ol>
                    ) : (
                      <div className="ms-copy">No results yet.</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <button className="ms-modal-backdrop" aria-hidden="true" onClick={onClose} />
    </div>
  );
}

