import { Hono } from 'hono';
import type { TaskRequest, TaskResponse } from '@devvit/web/server';
import { runWeeklyEventsCheck } from '../features/weekly-events/handlers.js';

// Router for scheduled task endpoints declared in devvit.json/scheduler.tasks.
export const schedulerRoutes = new Hono();

schedulerRoutes.post('/weekly-events-check', async (c) => {
  const input = await c.req.json<TaskRequest>();
  try {
    const result = await runWeeklyEventsCheck();
    console.log(`[weekly-events] task ${input.name}:`, result);
  } catch (error) {
    // Log and return normally; the next hourly run retries.
    console.error(`[weekly-events] task ${input.name} failed`, error);
  }
  return c.json<TaskResponse>({}, 200);
});
