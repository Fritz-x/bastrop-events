import { redis } from '@devvit/web/server';
import type { T5 } from '@devvit/web/shared';

// Which week (by its Sunday, e.g. "2026-11-15") already got an automatic post.
function lastWeekKey(subredditId: T5): string {
  return `weeklyEvents:lastPostedWeek:${subredditId}`;
}

// Short-lived lock so overlapping scheduler runs cannot both post.
function lockKey(subredditId: T5, week: string): string {
  return `weeklyEvents:lock:${subredditId}:${week}`;
}

export async function getLastPostedWeek(
  subredditId: T5
): Promise<string | undefined> {
  return redis.get(lastWeekKey(subredditId));
}

export async function setLastPostedWeek(
  subredditId: T5,
  week: string
): Promise<void> {
  await redis.set(lastWeekKey(subredditId), week);
}

export async function acquireLock(
  subredditId: T5,
  week: string
): Promise<boolean> {
  const result = await redis.set(lockKey(subredditId, week), '1', {
    nx: true,
    expiration: new Date(Date.now() + 5 * 60 * 1000),
  });
  return result === 'OK';
}

export async function releaseLock(
  subredditId: T5,
  week: string
): Promise<void> {
  await redis.del(lockKey(subredditId, week));
}
