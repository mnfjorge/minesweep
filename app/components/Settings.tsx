"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export type Difficulty = "easy" | "normal" | "hard";

export default function Settings(props: {
  isOpen: boolean;
  activeTab: "settings" | "account";
  onChangeTab: (tab: "settings" | "account") => void;
  onClose: () => void;
  difficulty: Difficulty;
  applyDifficulty: (d: Difficulty) => void;
  onTrack?: (eventName: string) => void;
}) {
  const { isOpen, activeTab, onChangeTab, onClose, difficulty, applyDifficulty, onTrack } = props;
  const { data: session, status } = useSession();

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
            </div>
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

