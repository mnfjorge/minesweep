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
  const member = payload.userId;
  // We want lower seconds to be ranked higher, so score = -seconds
  const score = -Math.max(0, Math.floor(payload.seconds));
  // Store basic user metadata for display purposes
  try {
    await redis.hset(`user:${member}`, {
      name: payload.name ?? '',
      email: payload.email ?? '',
    });
  } catch {}

  // Only update if this is a better (higher) score than existing
  try {
    const previous = await redis.zscore<number>(LEADERBOARD_KEY, member);
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
  const rows = await redis.zrange<{ member: string; score: number }>(
    LEADERBOARD_KEY,
    0,
    9,
    { rev: true, withScores: true }
  );

  const results = await Promise.all(
    rows.map(async (row: { member: string; score: number }) => {
      const meta = await redis!.hgetall<Record<string, string>>(`user:${row.member}`);
      return {
        userId: row.member,
        seconds: Math.max(0, -Math.floor(Number(row.score || 0))),
        name: meta?.name ? meta.name : null,
        email: meta?.email ? meta.email : null,
      } as LeaderboardEntry;
    })
  );

  return results;
}

