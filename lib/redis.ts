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
  await redis.zadd(LEADERBOARD_KEY, { score, member });
  // Keep only top 10 (highest scores due to negative seconds => best times)
  await redis.zremrangebyrank(LEADERBOARD_KEY, 0, -11);
}

