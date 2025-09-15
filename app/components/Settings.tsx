"use client";

import { useEffect, useState } from "react";

export type Difficulty = "easy" | "normal" | "hard" | "custom";

export default function Settings(props: {
  isOpen: boolean;
  onClose: () => void;
  difficulty: Difficulty;
  applyDifficulty: (d: Difficulty) => void;
  customMines: number;
  onChangeCustomMines: (n: number) => void;
  applyCustom: () => void;
  onTrack?: (eventName: string) => void;
}) {
  const { isOpen, onClose, difficulty, applyDifficulty, customMines, onChangeCustomMines, applyCustom } = props;

  // Allow clearing the custom input while typing; commit on blur/Enter
  const [customMinesText, setCustomMinesText] = useState<string>(
    String(Number.isFinite(customMines) ? Math.max(1, customMines) : 1)
  );

  useEffect(() => {
    // Keep local text in sync when external value changes
    setCustomMinesText(String(Number.isFinite(customMines) ? Math.max(1, customMines) : 1));
  }, [customMines, isOpen]);

  const commitCustomMines = () => {
    const parsed = Math.floor(Number(customMinesText));
    const nextValue = Number.isFinite(parsed) && parsed > 0 ? parsed : Math.max(1, customMines || 1);
    onChangeCustomMines(nextValue);
    if (difficulty === "custom") applyCustom();
    // Normalize displayed text after commit
    setCustomMinesText(String(nextValue));
  };

  if (!isOpen) return null;

  return (
    <div className="ms-modal-overlay" role="dialog" aria-modal="true">
      <div className="ms-modal" role="document">
        <button
          className="ms-button"
          onClick={onClose}
          aria-label="close"
          title="Close"
          style={{ position: "absolute", top: 8, right: 8 }}
        >
          ✕
        </button>

        <div className="ms-modal-section">
          <div className="ms-section-title">Difficulty</div>
          <div className="ms-radio-group">
            <label className="ms-radio">
              <input
                type="radio"
                name="difficulty"
                value="easy"
                checked={difficulty === "easy"}
                onChange={() => applyDifficulty("easy")}
              />
              <span>Easy</span>
            </label>
            <label className="ms-radio">
              <input
                type="radio"
                name="difficulty"
                value="normal"
                checked={difficulty === "normal"}
                onChange={() => applyDifficulty("normal")}
              />
              <span>Normal</span>
            </label>
            <label className="ms-radio">
              <input
                type="radio"
                name="difficulty"
                value="hard"
                checked={difficulty === "hard"}
                onChange={() => applyDifficulty("hard")}
              />
              <span>Hard</span>
            </label>
            <label className="ms-radio" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="radio"
                name="difficulty"
                value="custom"
                checked={difficulty === "custom"}
                onChange={() => applyCustom()}
              />
              <span>Custom</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                min={1}
                step={1}
                value={customMinesText}
                onChange={(e: any) => {
                  const next = e.target.value;
                  if (next === "" || /^[0-9]+$/.test(next)) {
                    setCustomMinesText(next);
                  }
                }}
                onBlur={commitCustomMines}
                onKeyDown={(e: any) => { if (e.key === "Enter") { e.preventDefault(); commitCustomMines(); } }}
                aria-label="Custom bombs count"
                style={{ width: 96 }}
              />
              <span style={{ opacity: 0.8 }}>
                bombs
              </span>
            </label>
          </div>
          <div className="ms-hint">Custom games do not save to leaderboard.</div>
          <div className="ms-hint">Changes apply immediately and restart the board.</div>
        </div>
      </div>
      <button className="ms-modal-backdrop" aria-hidden="true" onClick={onClose} />
    </div>
  );
}

