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

export type RankUpdatePayload = {
  userId: string;
  name: string | null;
  email: string | null;
  // Lower time is better; we store negative seconds to rank ascending times as higher scores
  seconds: number;
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
    const previous = await redis.zscore(LEADERBOARD_KEY, member);
    if (previous == null || score > previous) {
      await redis.zadd(LEADERBOARD_KEY, { score, member });
    }
  } catch {
    // fallback: best-effort insert
    await redis.zadd(LEADERBOARD_KEY, { score, member });
  }
  // Keep only top 10 (highest scores due to negative seconds => best times)
  await redis.zremrangebyrank(LEADERBOARD_KEY, 0, -11);
}

export type LeaderboardEntry = {
  userId: string;
  seconds: number;
  name: string | null;
  email: string | null;
};

export async function fetchLeaderboardTop10(): Promise<LeaderboardEntry[]> {
  if (!redis) return [];
  // Top 10 highest scores (i.e., least seconds)
  const rows = await redis.zrange<Array<{ member: string; score: number }>>(
    LEADERBOARD_KEY,
    0,
    9,
    { rev: true, withScores: true }
  );

  const results = await Promise.all(
    rows.map(async (row: { member: string; score: number }) => {
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

