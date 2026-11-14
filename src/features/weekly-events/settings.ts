import { settings } from '@devvit/web/server';
import { DEFAULT_TITLE } from './render.js';

export type WeeklyEventsSettings = {
  enabled: boolean;
  title: string;
  excludeText: string;
  sticky: boolean;
};

// Setting names match the keys under settings.subreddit in devvit.json.
export async function getWeeklyEventsSettings(): Promise<WeeklyEventsSettings> {
  const enabled = await settings.get<boolean>('weeklyEventsEnabled');
  const title = await settings.get<string>('weeklyEventsTitle');
  const excludeText = await settings.get<string>('weeklyEventsExclude');
  const sticky = await settings.get<boolean>('weeklyEventsSticky');
  return {
    // Missing means "never configured", which is on by default.
    enabled: enabled !== false,
    title:
      typeof title === 'string' && title.trim() ? title.trim() : DEFAULT_TITLE,
    excludeText: typeof excludeText === 'string' ? excludeText : '',
    sticky: sticky === true,
  };
}
