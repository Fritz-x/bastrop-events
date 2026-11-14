// Turns a week of events into one Reddit post (title + markdown body).
import { toUtcDate, type DayNum } from './dates.js';
import { CATEGORIES, type Source, type WeekEvent } from './events.js';

export const REDDIT_BODY_LIMIT = 40_000;
export const DEFAULT_TITLE =
  'Bastrop County Weekly Events | {start} to {end}, {year}';

const SOURCE_LINKS: ReadonlyArray<readonly [Source, string]> = [
  ['bcc', '[Bastrop County Calendar](https://bastropcountycalendar.com)'],
  [
    'city',
    '[City of Bastrop Community Calendar](https://connect.cityofbastrop.org/bastroptx)',
  ],
];

// Says nothing useful, so it is left off the line.
const GENERIC_VENUE = /^bastrop(,? (tx|texas))?$/i;

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const MONTH_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function mdEscape(text: string): string {
  return text.replace(/([\\[\]*_~^`|#])/g, '\\$1');
}

export function fmtTime(minutes: number): string {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hour = h24 % 12 || 12;
  const suffix = h24 < 12 ? 'AM' : 'PM';
  return m === 0
    ? `${hour} ${suffix}`
    : `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

function monthDay(day: DayNum): string {
  const d = toUtcDate(day);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

function fmtDay(day: DayNum): string {
  return `${DAY_SHORT[toUtcDate(day).getUTCDay()] ?? ''} ${monthDay(day)}`;
}

function fmtLong(day: DayNum): string {
  const d = toUtcDate(day);
  return `${DAY_LONG[d.getUTCDay()] ?? ''}, ${MONTH_LONG[d.getUTCMonth()] ?? ''} ${d.getUTCDate()}`;
}

function fmtShortMonth(day: DayNum): string {
  const d = toUtcDate(day);
  return `${(MONTH_LONG[d.getUTCMonth()] ?? '').slice(0, 3)} ${d.getUTCDate()}`;
}

export function whenLabel(
  ev: WeekEvent,
  weekStart: DayNum,
  weekEnd: DayNum
): string {
  let label: string;
  if (ev.lastDay !== null) {
    const first = Math.max(ev.day, weekStart);
    const last = Math.min(ev.lastDay, weekEnd);
    if (first === weekStart && last === weekEnd) label = 'All week';
    else if (ev.day < weekStart) label = `Through ${fmtDay(last)}`;
    else if (ev.lastDay > weekEnd) {
      label = `${fmtDay(first)} through ${monthDay(ev.lastDay)}`;
    } else label = `${fmtDay(first)} to ${fmtDay(last)}`;
  } else {
    label = fmtDay(ev.day);
  }
  return ev.startMin === null ? label : `${label}, ${fmtTime(ev.startMin)}`;
}

export function renderTitle(template: string, weekStart: DayNum): string {
  const weekEnd = weekStart + 6;
  return template
    .replaceAll('{start}', fmtShortMonth(weekStart))
    .replaceAll('{end}', fmtShortMonth(weekEnd))
    .replaceAll('{year}', String(toUtcDate(weekEnd).getUTCFullYear()));
}

function footer(events: readonly WeekEvent[]): string {
  const used = SOURCE_LINKS.filter(([source]) =>
    events.some((e) => e.source === source)
  ).map(([, link]) => link);
  return [
    used.length ? `Sources: ${used.join(' and ')}.` : '',
    'Times and details can change, so please confirm with the organizer before you go.',
    'Know of something that is missing? Add it to one of the calendars above or leave a comment.',
    '^(I am a bot. This post is generated every Sunday at noon. Message the moderators with corrections.)',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function renderBody(
  events: readonly WeekEvent[],
  weekStart: DayNum,
  compact = false
): string {
  const weekEnd = weekStart + 6;
  const byCategory = new Map<string, WeekEvent[]>();
  for (const ev of events) {
    const group = byCategory.get(ev.category) ?? [];
    group.push(ev);
    byCategory.set(ev.category, group);
  }

  const lines: string[] = [
    `Here is what is happening around Bastrop County from **${fmtLong(weekStart)}** ` +
      `through **${fmtLong(weekEnd)}**: ${events.length} events in ${byCategory.size} categories.`,
    '',
  ];
  for (const [slug, heading] of CATEGORIES) {
    const group = byCategory.get(slug);
    if (!group) continue;
    group.sort(
      (a, b) =>
        Math.max(a.day, weekStart) - Math.max(b.day, weekStart) ||
        (a.startMin ?? 0) - (b.startMin ?? 0) ||
        a.title.toLowerCase().localeCompare(b.title.toLowerCase())
    );
    lines.push(`## ${heading}`, '');
    for (const ev of group) {
      const title = mdEscape(ev.title);
      const link = ev.url ? `[${title}](${ev.url})` : title;
      let line = `* **${whenLabel(ev, weekStart, weekEnd)}** · ${link}`;
      if (ev.venue && !compact && !GENERIC_VENUE.test(ev.venue)) {
        line += ` · ${mdEscape(ev.venue)}`;
      }
      lines.push(line);
    }
    lines.push('');
  }
  lines.push('---', '', footer(events));
  return lines.join('\n');
}

export function renderPost(
  events: readonly WeekEvent[],
  weekStart: DayNum,
  titleTemplate: string = DEFAULT_TITLE
): { title: string; body: string } {
  const title = renderTitle(titleTemplate || DEFAULT_TITLE, weekStart);
  let body = renderBody(events, weekStart);
  // Too long for one post: drop venues first, then cut whole lines.
  if (body.length > REDDIT_BODY_LIMIT) {
    body = renderBody(events, weekStart, true);
  }
  if (body.length > REDDIT_BODY_LIMIT) {
    const tail =
      '\n\n*This list was shortened to fit in one post. See the calendars below for everything.*\n\n---\n\n' +
      footer(events);
    const cut = body.slice(0, REDDIT_BODY_LIMIT - tail.length);
    body = cut.slice(0, cut.lastIndexOf('\n')) + tail;
  }
  return { title, body };
}
