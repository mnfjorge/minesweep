import { Redis } from '@upstash/redis';

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.REDIS_TOKEN;

function createRedis(): Redis | null {
  if (REDIS_URL && REDIS_TOKEN) {
    return new Redis({ url: REDIS_URL, token: REDIS_TOKEN });
  }
  if (!REDIS_URL) {
    console.warn('Redis URL missing. Set REDIS_URL or UPSTASH_REDIS_REST_URL.');
  }
  if (!REDIS_TOKEN) {
    console.warn('Redis token missing. Set REDIS_TOKEN or UPSTASH_REDIS_REST_TOKEN.');
  }
  return null;
}

export const redis: Redis | null = createRedis();

export const LEADERBOARD_KEY = 'leaderboard:top';

export type Difficulty = 'easy' | 'normal' | 'hard';

function leaderboardKeyFor(difficulty: Difficulty): string {
  return `leaderboard:top:${difficulty}`;
}

export type RankUpdatePayload = {
  userId: string;
  name: string | null;
  email: string | null;
  // Lower time is better; we store negative seconds to rank ascending times as higher scores
  seconds: number;
  difficulty: Difficulty;
};

export async function updateLeaderboardTop10(payload: RankUpdatePayload) {
  if (!redis) return;
  const member = typeof payload.userId === 'string' ? payload.userId : String(payload.userId);
  // We want lower seconds to be ranked higher, so score = -seconds
  const score = -Math.max(0, Math.floor(payload.seconds));
  // Store basic user metadata for display purposes
  try {
    const sanitize = (value: unknown): string => {
      if (typeof value !== 'string') return '';
      const trimmed = value.trim();
      const lower = trimmed.toLowerCase();
      if (!trimmed || lower === 'undefined' || lower === 'null') return '';
      return trimmed;
    };
    await redis.hset(`user:${member}`, {
      name: sanitize(payload.name),
      email: sanitize(payload.email),
    });
  } catch {}

  // Only update if this is a better (higher) score than existing
  try {
    // Upstash zscore returns number | null and does not take a generic
    const key = leaderboardKeyFor(payload.difficulty);
    const previous = await redis.zscore(key, member);
    if (previous == null || score > previous) {
      await redis.zadd(key, { score, member });
    }
  } catch {
    // fallback: best-effort insert
    const key = leaderboardKeyFor(payload.difficulty);
    await redis.zadd(key, { score, member });
  }
  // Keep only top 10 (highest scores due to negative seconds => best times)
  await redis.zremrangebyrank(leaderboardKeyFor(payload.difficulty), 0, -11);
}

export type LeaderboardEntry = {
  userId: string;
  seconds: number;
  name: string | null;
  email: string | null;
};

export async function fetchLeaderboardTop10ByDifficulty(difficulty: Difficulty): Promise<LeaderboardEntry[]> {
  if (!redis) return [];
  // Top 10 highest scores (i.e., least seconds)
  // Fetch extra in case we filter out invalid members
  const rows = await redis.zrange<Array<{ member: string; score: number }>>(
    leaderboardKeyFor(difficulty),
    0,
    49,
    { rev: true, withScores: true }
  );

  const invalidMembers: string[] = [];
  const cleaned = rows.filter((row) => {
    const memberStr = String((row as any)?.member ?? '').trim().toLowerCase();
    if (!memberStr || memberStr === 'undefined' || memberStr === 'null' || memberStr === 'unknown') {
      const original = String((row as any)?.member ?? '').trim();
      if (original) invalidMembers.push(original);
      return false;
    }
    return true;
  });

  if (invalidMembers.length > 0) {
    try {
      await (redis as any).zrem(leaderboardKeyFor(difficulty), ...invalidMembers);
    } catch {}
  }

  const results = await Promise.all(
    cleaned.slice(0, 10).map(async (row: { member: string; score: number }) => {
      const meta = await redis!.hgetall<Record<string, string>>(`user:${row.member}`);
      const sanitizeToNull = (value: unknown): string | null => {
        if (typeof value !== 'string') return null;
        const trimmed = value.trim();
        const lower = trimmed.toLowerCase();
        if (!trimmed || lower === 'undefined' || lower === 'null') return null;
        return trimmed;
      };
      return {
        userId: typeof row.member === 'string' ? row.member : String(row.member),
        seconds: Math.max(0, -Math.floor(Number(row.score || 0))),
        name: sanitizeToNull(meta?.name),
        email: sanitizeToNull(meta?.email),
      } as LeaderboardEntry;
    })
  );

  return results;
}

export async function fetchLeaderboardTop10All(): Promise<{ easy: LeaderboardEntry[]; normal: LeaderboardEntry[]; hard: LeaderboardEntry[] }> {
  const [easy, normal, hard] = await Promise.all([
    fetchLeaderboardTop10ByDifficulty('easy'),
    fetchLeaderboardTop10ByDifficulty('normal'),
    fetchLeaderboardTop10ByDifficulty('hard'),
  ]);
  return { easy, normal, hard };
}

