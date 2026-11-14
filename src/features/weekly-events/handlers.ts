import { context, reddit } from '@devvit/web/server';
import { centralNow, isoDate, upcomingSunday, type DayNum } from './dates.js';
import { buildWeek, compileExcludes, type WeekEvent } from './events.js';
import { renderPost, renderTitle } from './render.js';
import {
  getWeeklyEventsSettings,
  type WeeklyEventsSettings,
} from './settings.js';
import { gather } from './sources.js';
import {
  acquireLock,
  getLastPostedWeek,
  releaseLock,
  setLastPostedWeek,
} from './storage.js';

// Automatic posts go out on Sunday from noon Central. The scheduler runs
// hourly on Sundays, so if noon fails (a source is down) 1 PM and 2 PM retry.
const POST_HOUR_START = 12;
const POST_HOUR_END = 15;

export type SchedulerResult =
  | { posted: true; postId: string; events: number }
  | { posted: false; reason: string };

export type ManualResult = { success: boolean; message: string };

type Week = { events: WeekEvent[]; errors: string[]; allFailed: boolean };

async function loadWeek(
  weekStart: DayNum,
  config: WeeklyEventsSettings
): Promise<Week> {
  const { bcc, city, errors } = await gather(weekStart);
  const events = buildWeek(
    bcc,
    city,
    weekStart,
    compileExcludes(config.excludeText)
  );
  return { events, errors, allFailed: bcc === null && city === null };
}

async function submit(
  events: WeekEvent[],
  weekStart: DayNum,
  config: WeeklyEventsSettings
): Promise<string> {
  const { title, body } = renderPost(events, weekStart, config.title);
  const subreddit = await reddit.getCurrentSubreddit();
  const post = await reddit.submitPost({
    subredditName: subreddit.name,
    title,
    text: body,
    runAs: 'APP',
    sendreplies: false,
  });
  if (config.sticky) {
    try {
      await post.sticky();
    } catch (error) {
      // Pinning is a nice-to-have; never fail the run over it.
      console.warn('[weekly-events] could not pin the post', error);
    }
  }
  return post.id;
}

/** Called hourly on Sundays by the scheduler. Posts at most once per week. */
export async function runWeeklyEventsCheck(
  now: Date = new Date()
): Promise<SchedulerResult> {
  const config = await getWeeklyEventsSettings();
  if (!config.enabled) return { posted: false, reason: 'feature-disabled' };

  const central = centralNow(now);
  if (
    central.weekday !== 0 ||
    central.hour < POST_HOUR_START ||
    central.hour >= POST_HOUR_END
  ) {
    return { posted: false, reason: 'outside-sunday-noon-window' };
  }

  const weekStart = central.day;
  const weekKey = isoDate(weekStart);
  if ((await getLastPostedWeek(context.subredditId)) === weekKey) {
    return { posted: false, reason: 'already-posted-this-week' };
  }
  if (!(await acquireLock(context.subredditId, weekKey))) {
    return { posted: false, reason: 'lock-not-acquired' };
  }

  try {
    const week = await loadWeek(weekStart, config);
    if (week.events.length === 0) {
      // Leave the week unmarked so the next hourly run tries again.
      await releaseLock(context.subredditId, weekKey);
      return {
        posted: false,
        reason: week.allFailed ? 'all-sources-failed' : 'no-events',
      };
    }
    const postId = await submit(week.events, weekStart, config);
    await setLastPostedWeek(context.subredditId, weekKey);
    return { posted: true, postId, events: week.events.length };
  } catch (error) {
    await releaseLock(context.subredditId, weekKey);
    throw error;
  }
}

function sourceFailureHint(errors: string[]): string {
  return (
    `Could not read the calendars (${errors.join('; ')}). ` +
    'If this app was just uploaded, its fetch domains may still be awaiting Reddit approval.'
  );
}

/** Menu action: fetch and count only. Posts nothing. */
export async function testWeeklyEventsSources(): Promise<ManualResult> {
  const config = await getWeeklyEventsSettings();
  const weekStart = upcomingSunday(centralNow(new Date()).day);
  const week = await loadWeek(weekStart, config);
  if (week.allFailed) {
    return { success: false, message: sourceFailureHint(week.errors) };
  }
  const { body } = renderPost(week.events, weekStart, config.title);
  const range = renderTitle('{start} to {end}', weekStart);
  const warning = week.errors.length
    ? ` Warning: ${week.errors.join('; ')}.`
    : '';
  return {
    success: true,
    message: `${week.events.length} events for ${range} (${body.length} characters).${warning}`,
  };
}

/** Menu action: post now for the week starting this coming Sunday (today, if Sunday). */
export async function createWeeklyEventsManual(): Promise<ManualResult> {
  const currentUser = await reddit.getCurrentUser();
  if (!currentUser) {
    return { success: false, message: 'Unable to identify current user.' };
  }
  const subreddit = await reddit.getCurrentSubreddit();
  const permissions = await currentUser.getModPermissionsForSubreddit(
    subreddit.name
  );
  if (!permissions.includes('all') && !permissions.includes('posts')) {
    return {
      success: false,
      message: 'You need mod post permissions to post the weekly events.',
    };
  }

  const config = await getWeeklyEventsSettings();
  const weekStart = upcomingSunday(centralNow(new Date()).day);
  const week = await loadWeek(weekStart, config);
  if (week.allFailed) {
    return { success: false, message: sourceFailureHint(week.errors) };
  }
  if (week.events.length === 0) {
    return { success: false, message: 'No events found for that week.' };
  }
  // Manual posts intentionally skip the once-per-week marker so they can be
  // used for testing without suppressing Sunday's automatic post.
  await submit(week.events, weekStart, config);
  return {
    success: true,
    message: `Posted ${week.events.length} events for the week of ${isoDate(weekStart)}.`,
  };
}
