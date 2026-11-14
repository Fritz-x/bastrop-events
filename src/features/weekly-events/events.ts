// Event model, source normalizers, categorizing and de-duplication.
// Everything here is pure (no network, no Reddit), so it is unit tested.
import { parseWhen, weekdayOf, type DayNum } from './dates.js';

export type Source = 'bcc' | 'city';

export type WeekEvent = {
  title: string;
  /** First day of the event, or of this week's occurrence. */
  day: DayNum;
  /** Minutes after midnight Central; null when all day or unknown. */
  startMin: number | null;
  category: string;
  venue: string;
  url: string;
  source: Source;
  /** Set only for events that span several days. */
  lastDay: DayNum | null;
};

export type RawRecord = Record<string, unknown>;

/** The twelve bastropcountycalendar.com categories, in display order. */
export const CATEGORIES: ReadonlyArray<
  readonly [slug: string, heading: string]
> = [
  ['community', '🤝 Community'],
  ['arts-entertainment', '🎭 Arts & Entertainment'],
  ['music', '🎵 Music'],
  ['food-drink', '🍽️ Food & Drink'],
  ['family-kids', '👨‍👩‍👧 Family & Kids'],
  ['sports-outdoors', '🌲 Sports & Outdoors'],
  ['markets-shopping', '🛍️ Markets & Shopping'],
  ['education', '📚 Education'],
  ['faith', '⛪ Faith'],
  ['business-networking', '💼 Business & Networking'],
  ['government-civic', '🏛️ Government & Civic'],
  ['health-wellness', '💪 Health & Wellness'],
];

const CATEGORY_SLUGS = new Set(CATEGORIES.map(([slug]) => slug));

/** Stray category slugs in the county calendar feed that the site folds into the twelve. */
const CATEGORY_ALIASES: Record<string, string> = {
  family: 'family-kids',
  kids: 'family-kids',
  sports: 'sports-outdoors',
  outdoors: 'sports-outdoors',
  business: 'business-networking',
  government: 'government-civic',
  health: 'health-wellness',
  markets: 'markets-shopping',
  'arts-culture': 'arts-entertainment',
  arts: 'arts-entertainment',
  'festivals-fairs': 'community',
};

/**
 * The city calendar has no categories, so these rules assign one.
 * First match wins; the title is tested before the organizer name.
 */
const CITY_RULES: ReadonlyArray<readonly [category: string, pattern: RegExp]> =
  [
    [
      'government-civic',
      /public meetings|city council|commission|advisory board|\bboard\b|committee|corporation/,
    ],
    [
      'family-kids',
      /storytime|story time|preschool|toddler|tween|teen|kids|children|family/,
    ],
    [
      'markets-shopping',
      /farmer'?s? market|farm stand|\bmarket\b|bazaar|craft fair/,
    ],
    ['music', /live music|concert|open mic|karaoke|\bband\b/],
    [
      'food-drink',
      /trivia|bingo|happy hour|burger|wine|beer|brew|tasting|dinner|brunch/,
    ],
    ['health-wellness', /yoga|fitness|wellness|blood drive|health/],
    ['sports-outdoors', /\b5k\b|fun run|hike|paddle|tournament|fishing/],
    [
      'education',
      /library|book club|conversation|class|workshop|sewing|knit|fiber arts|lecture/,
    ],
  ];

/** The city calendar often gives only a street address. */
export const VENUE_ALIASES: ReadonlyArray<
  readonly [fragment: string, name: string]
> = [
  ['1100 Church St', 'Bastrop Public Library'],
  ['1408 Chestnut St', 'Bastrop Convention & Exhibit Center'],
];

function clean(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

// ------------------------------------------------ bastropcountycalendar.com

export function normalizeBcc(
  records: readonly RawRecord[],
  weekStart: DayNum,
  weekEnd: DayNum
): WeekEvent[] {
  const out: WeekEvent[] = [];
  for (const r of records) {
    const status = clean(r['status']) || 'active';
    if (status !== 'active') continue;
    const start = parseWhen(r['start_datetime']);
    if (!start) continue;
    const end = parseWhen(r['end_datetime']);
    const endDay = end ? Math.max(end.day, start.day) : start.day;
    const allDay = Boolean(r['all_day']);
    // Midnight on a timed event is a placeholder for "time not given".
    const startMin =
      allDay || start.minutes === 0 || start.minutes === null
        ? null
        : start.minutes;

    let day = start.day;
    let lastDay: DayNum | null = null;
    if (clean(r['recurrence']) === 'weekly') {
      // Stored once with its first date; find this week's occurrence.
      const offset = (weekdayOf(start.day) - weekdayOf(weekStart) + 7) % 7;
      day = weekStart + offset;
      if (day < start.day) continue;
    } else {
      if (start.day > weekEnd || endDay < weekStart) continue;
      if (endDay > start.day) lastDay = endDay;
    }

    const rawCategory = clean(r['category']).toLowerCase();
    const mapped = CATEGORY_ALIASES[rawCategory] ?? rawCategory;
    const slug = clean(r['slug']) || clean(r['id']);
    out.push({
      title: clean(r['title']),
      day,
      startMin,
      category: CATEGORY_SLUGS.has(mapped) ? mapped : 'community',
      venue: clean(r['location_name']) || clean(r['location_address']),
      url: slug
        ? `https://bastropcountycalendar.com/events/${slug}`
        : clean(r['event_url']),
      source: 'bcc',
      lastDay,
    });
  }
  return out;
}

// ------------------------------------------------ connect.cityofbastrop.org

export function categorizeCity(title: string, organizer: string): string {
  if (organizer.toLowerCase().includes('public meetings')) {
    return 'government-civic';
  }
  for (const hay of [title.toLowerCase(), organizer.toLowerCase()]) {
    for (const [category, pattern] of CITY_RULES) {
      if (pattern.test(hay)) return category;
    }
  }
  return 'community';
}

export function cityVenue(location: string): string {
  const loc = clean(location).replace(/,?\s*(USA|United States)$/, '');
  if (!loc) return '';
  for (const [fragment, name] of VENUE_ALIASES) {
    if (loc.toLowerCase().includes(fragment.toLowerCase())) return name;
  }
  const first = (loc.split(',')[0] ?? '').trim();
  // "Eden East Farm, Main Street, ..." -> "Eden East Farm"
  if (first && !/^\d/.test(first)) return first;
  // "500 Elm Street, Bastrop, TX" -> "500 Elm Street, Bastrop"
  return loc.replace(/,?\s*(TX|Texas)\b.*$/, '');
}

export function normalizeCity(
  records: readonly RawRecord[],
  weekStart: DayNum,
  weekEnd: DayNum
): WeekEvent[] {
  const out: WeekEvent[] = [];
  for (const r of records) {
    if (r['isPrivateEvent'] === true || r['closed'] === true) continue;
    const start = parseWhen(r['startsAt']);
    if (!start) continue;
    const end = parseWhen(r['endsAt']);
    const endDay = end ? Math.max(end.day, start.day) : start.day;
    if (start.day > weekEnd || endDay < weekStart) continue;
    // The city's editor leaves "_Copy" on cloned events.
    const title = clean(r['name']).replace(/[_ ]copy$/i, '');
    out.push({
      title,
      day: start.day,
      startMin: r['isAllDay'] === true ? null : start.minutes,
      category: categorizeCity(title, clean(r['leaderName'])),
      venue: cityVenue(clean(r['locationText']) || clean(r['location'])),
      url: (clean(r['resourceUrl']).split('?')[0] ?? '').trim(),
      source: 'city',
      lastDay: endDay > start.day ? endDay : null,
    });
  }
  return out;
}

// ------------------------------------------------ filtering and de-duplication

const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'of',
  'and',
  'at',
  'in',
  'on',
  'for',
  'with',
  'to',
]);

export function titleTokens(title: string): Set<string> {
  const words =
    title
      .toLowerCase()
      .replace(/[’']/g, '')
      .match(/[a-z0-9]+/g) ?? [];
  return new Set(
    words.filter((w) => !STOP_WORDS.has(w) && !/^(19|20)\d\d$/.test(w))
  );
}

function sameEvent(a: WeekEvent, b: WeekEvent): boolean {
  if (a.day !== b.day) return false;
  const ta = titleTokens(a.title);
  const tb = titleTokens(b.title);
  if (ta.size === 0 || tb.size === 0) return false;
  if (a.startMin !== null && b.startMin !== null) {
    if (Math.abs(a.startMin - b.startMin) > 90) return false;
  }
  let shared = 0;
  for (const token of ta) if (tb.has(token)) shared += 1;
  if (shared === ta.size && shared === tb.size) return true;
  const small = Math.min(ta.size, tb.size);
  return small >= 2 && shared / small >= 0.8;
}

const GENERIC_VENUE = /^bastrop(,? (tx|texas))?$/i;

/** Fills gaps in `keep` from `other`. */
function merge(keep: WeekEvent, other: WeekEvent): void {
  if (keep.startMin === null && other.startMin !== null) {
    keep.startMin = other.startMin;
  }
  if ((!keep.venue || GENERIC_VENUE.test(keep.venue)) && other.venue) {
    keep.venue = other.venue;
  }
  if (!keep.url) keep.url = other.url;
}

/** Collapses the same event listed more than once, within or across sources. */
export function dedupe(events: readonly WeekEvent[]): WeekEvent[] {
  // County calendar first so its hand-picked category wins over the city keyword guess.
  const rank = (e: WeekEvent): number =>
    (e.source === 'bcc' ? 0 : 2) + (e.startMin === null ? 1 : 0);
  const ordered = events
    .map((event, index) => ({ event, index }))
    .sort((x, y) => rank(x.event) - rank(y.event) || x.index - y.index);
  const kept: WeekEvent[] = [];
  for (const { event } of ordered) {
    const match = kept.find((k) => sameEvent(k, event));
    if (match) merge(match, event);
    else kept.push({ ...event });
  }
  return kept;
}

/** One regular expression per line; lines that do not compile are ignored. */
export function compileExcludes(text: string): RegExp[] {
  const out: RegExp[] = [];
  for (const line of text.split('\n')) {
    const pattern = line.trim();
    if (!pattern) continue;
    try {
      out.push(new RegExp(pattern, 'i'));
    } catch {
      console.warn(
        `[weekly-events] ignoring invalid exclude pattern: ${pattern}`
      );
    }
  }
  return out;
}

export function buildWeek(
  bccRecords: readonly RawRecord[] | null,
  cityRecords: readonly RawRecord[] | null,
  weekStart: DayNum,
  excludes: readonly RegExp[] = []
): WeekEvent[] {
  const weekEnd = weekStart + 6;
  const events = [
    ...(bccRecords ? normalizeBcc(bccRecords, weekStart, weekEnd) : []),
    ...(cityRecords ? normalizeCity(cityRecords, weekStart, weekEnd) : []),
  ].filter((e) => e.title && !excludes.some((rx) => rx.test(e.title)));
  return dedupe(events);
}
