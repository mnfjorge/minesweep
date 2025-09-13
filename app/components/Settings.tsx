"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";

export type Difficulty = "easy" | "normal" | "hard" | "custom";

export default function Settings(props: {
  isOpen: boolean;
  activeTab: "settings" | "account";
  onChangeTab: (tab: "settings" | "account") => void;
  onClose: () => void;
  difficulty: Difficulty;
  applyDifficulty: (d: Difficulty) => void;
  customMines: number;
  onChangeCustomMines: (n: number) => void;
  applyCustom: () => void;
  onTrack?: (eventName: string) => void;
}) {
  const { isOpen, activeTab, onChangeTab, onClose, difficulty, applyDifficulty, customMines, onChangeCustomMines, applyCustom, onTrack } = props;
  const { data: session, status } = useSession();

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
        <div className="ms-tabs">
          <button
            className={`ms-tab ${activeTab === "settings" ? "ms-tab-active" : ""}`}
            onClick={() => onChangeTab("settings")}
            aria-selected={activeTab === "settings"}
          >
            Settings
          </button>
          <button
            className={`ms-tab ${activeTab === "account" ? "ms-tab-active" : ""}`}
            onClick={() => onChangeTab("account")}
            aria-selected={activeTab === "account"}
          >
            Account
          </button>
          <button className="ms-tab ms-tab-right" onClick={onClose} aria-label="close" title="Close">
            ✕
          </button>
        </div>

        {activeTab === "settings" && (
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
                    // Allow empty string and numeric-only input
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
        )}

        {activeTab === "account" && (
          status === "authenticated" ? (
            <div className="ms-modal-section">
              <div className="ms-section-title">Account</div>
              <p className="ms-copy">
                You're signed in as {session?.user?.name || session?.user?.email || 'your account'}.
              </p>
              <button
                className="ms-button"
                onClick={() => { if (onTrack) onTrack("logout"); signOut({ callbackUrl: "/" }); }}
                aria-label="Logout"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="ms-modal-section">
              <div className="ms-section-title">Get Ranked</div>
              <p className="ms-copy">
                Create an account to join the website ranking once it launches. Your best
                times and wins will appear on the leaderboard.
              </p>
              <button
                className="ms-button"
                onClick={() => { if (onTrack) onTrack("login_google"); signIn("google"); }}
                aria-label="Sign in with Google"
              >
                Continue with Google
              </button>
            </div>
          )
        )}
      </div>
      <button className="ms-modal-backdrop" aria-hidden="true" onClick={onClose} />
    </div>
  );
}

