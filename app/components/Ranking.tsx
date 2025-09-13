"use client";

import { useEffect, useRef, useState } from "react";

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
  const [activeTab, setActiveTab] = useState<'me' | 'top10'>('me');
  const [myBest, setMyBest] = useState<{ easy: { name: string; seconds: number; updatedAt?: string } | null; normal: { name: string; seconds: number; updatedAt?: string } | null; hard: { name: string; seconds: number; updatedAt?: string } | null; }>({ easy: null, normal: null, hard: null });

  // Keep latest callbacks stable without retriggering fetch effect
  const fetchEntriesRef = useRef(fetchEntries);
  const onTrackRef = useRef(onTrack);
  useEffect(() => { fetchEntriesRef.current = fetchEntries; }, [fetchEntries]);
  useEffect(() => { onTrackRef.current = onTrack; }, [onTrack]);

  useEffect(() => {
    if (!isOpen) return;
    if (onTrackRef.current) onTrackRef.current("open_ranking");
    let aborted = false;
    setLoading(true);
    setError(null);
    fetchEntriesRef.current()
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
    // Load local best scores
    try {
      if (typeof window !== 'undefined') {
        const raw = window.localStorage.getItem('ms_best_v1');
        let parsed: any = null;
        try { if (raw) parsed = JSON.parse(raw); } catch {}
        const pick = (d: 'easy' | 'normal' | 'hard') => {
          const v = parsed && typeof parsed === 'object' ? parsed[d] : null;
          if (v && typeof v === 'object' && typeof v.seconds === 'number') {
            const name = typeof v.name === 'string' && v.name.trim() ? v.name.trim() : 'You';
            const updatedAt = typeof v.updatedAt === 'string' ? v.updatedAt : undefined;
            return { name, seconds: Math.max(0, Math.floor(v.seconds)), updatedAt };
          }
          return null;
        };
        setMyBest({ easy: pick('easy'), normal: pick('normal'), hard: pick('hard') });
      }
    } catch {}
    return () => {
      aborted = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="ms-modal-overlay" role="dialog" aria-modal="true">
      <div className="ms-modal" role="document">
        <div className="ms-tabs">
          <button
            className={`ms-tab ${activeTab === 'me' ? 'ms-tab-active' : ''}`}
            onClick={() => { setActiveTab('me'); if (onTrackRef.current) onTrackRef.current('ranking_tab_my_best'); }}
            aria-selected={activeTab === 'me'}
          >
            ⭐ Your Best
          </button>
          <button
            className={`ms-tab ${activeTab === 'top10' ? 'ms-tab-active' : ''}`}
            onClick={() => { setActiveTab('top10'); if (onTrackRef.current) onTrackRef.current('ranking_tab_top10'); }}
            aria-selected={activeTab === 'top10'}
          >
            🏆 Top 10
          </button>
          <button className="ms-tab ms-tab-right" onClick={onClose} aria-label="close-leaderboard" title="Close">
            ✕
          </button>
        </div>
        <div className="ms-modal-section">
          {activeTab === 'top10' ? (
            <>
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
            </>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
              {(["easy", "normal", "hard"] as const).map((diff) => {
                const best = myBest[diff];
                return (
                  <div key={diff}>
                    <div className="ms-section-title" style={{ marginBottom: 8, textTransform: "capitalize" }}>{diff}</div>
                    {best ? (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 8, padding: "6px 4px" }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{best.name || 'You'}</span>
                        <span style={{ fontWeight: 700 }}>{formatSeconds(best.seconds)}</span>
                      </div>
                    ) : (
                      <div className="ms-copy">No best score yet.</div>
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

