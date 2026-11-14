import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createServer, getServerPort } from '@devvit/web/server';
import { menu } from './routes/menu.js';
import { schedulerRoutes } from './routes/scheduler.js';

// Root app for all HTTP endpoints served by the Devvit Web server bundle.
const app = new Hono();
// Devvit calls these internal endpoints for menu actions and scheduled tasks.
const internal = new Hono();

internal.route('/menu', menu);
internal.route('/scheduler', schedulerRoutes);
app.route('/internal', internal);

// Start Node server with Devvit-provided server factory and assigned port.
serve({
  fetch: app.fetch,
  createServer,
  port: getServerPort(),
});
