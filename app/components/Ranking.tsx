"use client";

import { useEffect, useRef, useState } from "react";

export default function Ranking(props: {
  isOpen: boolean;
  onClose: () => void;
  onTrack?: (eventName: string) => void;
  formatSeconds: (n: number) => string;
}) {
  const { isOpen, onClose, onTrack, formatSeconds } = props;
  const [myBest, setMyBest] = useState<{ easy: { name: string; seconds: number; updatedAt?: string } | null; normal: { name: string; seconds: number; updatedAt?: string } | null; hard: { name: string; seconds: number; updatedAt?: string } | null; }>({ easy: null, normal: null, hard: null });

  // Keep latest callbacks stable without retriggering fetch effect
  const onTrackRef = useRef(onTrack);
  useEffect(() => { onTrackRef.current = onTrack; }, [onTrack]);

  useEffect(() => {
    if (!isOpen) return;
    if (onTrackRef.current) onTrackRef.current("open_ranking");
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
    return () => {};
  }, [isOpen]);

  const handleClear = () => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('ms_best_v1');
      }
    } catch {}
    setMyBest({ easy: null, normal: null, hard: null });
    if (onTrackRef.current) onTrackRef.current('clear_ranking');
  };

  if (!isOpen) return null;

  return (
    <div className="ms-modal-overlay" role="dialog" aria-modal="true">
      <div className="ms-modal" role="document">
        <div className="ms-tabs">
          <div className="ms-section-title" style={{ margin: 8 }}>Your Best</div>
          <button className="ms-tab ms-tab-right" onClick={onClose} aria-label="close-leaderboard" title="Close">✕</button>
        </div>
        <div className="ms-modal-section">
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
            {(["easy", "normal", "hard"] as const).map((diff) => {
              const best = myBest[diff];
              return (
                <div key={diff}>
                  <div className="ms-section-title" style={{ marginBottom: 8, textTransform: "capitalize" }}>{diff}</div>
                  {best ? (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 8, padding: "6px 4px" }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{best.name || 'You'}</span>
                      <span style={{ fontWeight: 700 }}>{formatSeconds(best.seconds)} ({best.seconds}s)</span>
                    </div>
                  ) : (
                    <div className="ms-copy">No best score yet.</div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
            <button className="ms-button" onClick={handleClear} aria-label="clear-best-scores" title="Clear your best times">
              Clear
            </button>
          </div>
        </div>
      </div>
      <button className="ms-modal-backdrop" aria-hidden="true" onClick={onClose} />
    </div>
  );
}

