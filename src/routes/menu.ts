import { Hono } from 'hono';
import type { MenuItemRequest, UiResponse } from '@devvit/web/shared';
import {
  createWeeklyEventsManual,
  testWeeklyEventsSources,
  type ManualResult,
} from '../features/weekly-events/handlers.js';

// Router for menu actions declared in devvit.json/menu.items.
export const menu = new Hono();

async function toastFor(run: () => Promise<ManualResult>): Promise<string> {
  try {
    return (await run()).message;
  } catch (error) {
    console.error('[weekly-events] menu action failed', error);
    return `Something went wrong: ${error instanceof Error ? error.message : String(error)}`;
  }
}

menu.post('/post-weekly-events', async (c) => {
  await c.req.json<MenuItemRequest>();
  const message = await toastFor(createWeeklyEventsManual);
  return c.json<UiResponse>({ showToast: message }, 200);
});

menu.post('/test-weekly-events', async (c) => {
  await c.req.json<MenuItemRequest>();
  const message = await toastFor(testWeeklyEventsSources);
  return c.json<UiResponse>({ showToast: message }, 200);
});
