"use server";

import { auth } from "@/auth";
import { updateLeaderboardTop10, fetchLeaderboardTop10All } from "@/lib/redis";

export type Difficulty = "easy" | "normal" | "hard";

export async function submitRank(params: { seconds: number; difficulty: Difficulty }) {
  const session = await auth();
  if (!session || !session.user) {
    throw new Error("Unauthorized");
  }

  const secondsRaw = params?.seconds;
  const difficultyRaw = params?.difficulty;
  const seconds = typeof secondsRaw === "number" && isFinite(secondsRaw) && secondsRaw >= 0 ? secondsRaw : null;
  const difficulty: Difficulty | null = difficultyRaw === "easy" || difficultyRaw === "normal" || difficultyRaw === "hard" ? difficultyRaw : null;

  if (seconds === null) {
    throw new Error("Invalid payload");
  }
  if (!difficulty) {
    throw new Error("Invalid difficulty");
  }

  const firstNonEmpty = (...values: Array<unknown>): string => {
    for (const v of values) {
      if (typeof v === "string") {
        const t = v.trim();
        if (t && t.toLowerCase() !== "undefined" && t.toLowerCase() !== "null") return t;
      }
    }
    return "unknown";
  };

  const rawId = firstNonEmpty((session.user as any).id, session.user.email, session.user.name);
  const userId = rawId;
  const name = firstNonEmpty(session.user.name) || null;
  const email = firstNonEmpty(session.user.email) || null;

  await updateLeaderboardTop10({ userId, name, email, seconds, difficulty });

  return { ok: true } as const;
}

export async function getLeaderboardTop10All() {
  const { easy, normal, hard } = await fetchLeaderboardTop10All();
  return { easy, normal, hard } as const;
}

