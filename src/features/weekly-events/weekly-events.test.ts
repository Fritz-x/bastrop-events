import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  centralNow,
  dayNum,
  isoDate,
  parseWhen,
  upcomingSunday,
} from './dates.js';
import {
  buildWeek,
  categorizeCity,
  cityVenue,
  compileExcludes,
  normalizeBcc,
  titleTokens,
  type RawRecord,
  type WeekEvent,
} from './events.js';
import { bccFixture, cityFixture } from './fixtures.js';
import {
  DEFAULT_TITLE,
  REDDIT_BODY_LIMIT,
  renderPost,
  whenLabel,
} from './render.js';

const WEEK = dayNum(2026, 11, 15); // a Sunday
const END = WEEK + 6;

function week(): WeekEvent[] {
  return buildWeek(bccFixture(), cityFixture(), WEEK);
}

function count(events: WeekEvent[], pattern: RegExp): number {
  return events.filter((e) => pattern.test(e.title)).length;
}

function find(events: WeekEvent[], pattern: RegExp): WeekEvent {
  const match = events.find((e) => pattern.test(e.title));
  assert.ok(match, `no event matching ${pattern}`);
  return match;
}

function bcc(overrides: RawRecord): RawRecord {
  return {
    slug: 'x',
    title: 'X',
    start_datetime: '2026-11-18T19:00:00',
    end_datetime: null,
    all_day: 0,
    recurrence: 'none',
    category: 'community',
    status: 'active',
    ...overrides,
  };
}

void test('dates: parsing, weekdays and Central time', () => {
  assert.deepEqual(parseWhen('2026-11-15'), { day: WEEK, minutes: null });
  assert.deepEqual(parseWhen('2026-11-15 14:30'), { day: WEEK, minutes: 870 });
  assert.deepEqual(parseWhen('2026-11-15T14:00:00'), {
    day: WEEK,
    minutes: 840,
  });
  // 01:30 UTC on the 16th is 7:30 PM Central on the 15th.
  assert.deepEqual(parseWhen('2026-11-16T01:30:00Z'), {
    day: WEEK,
    minutes: 1170,
  });
  assert.deepEqual(parseWhen('November 15, 2026T00:00:00'), {
    day: WEEK,
    minutes: 0,
  });
  assert.equal(parseWhen('soon'), null);
  assert.equal(parseWhen(null), null);
  assert.equal(isoDate(WEEK), '2026-11-15');
  assert.equal(upcomingSunday(WEEK), WEEK);
  assert.equal(upcomingSunday(WEEK - 1), WEEK); // Saturday
  assert.equal(upcomingSunday(WEEK + 1), WEEK + 7); // Monday
  // Noon Central is 18:00 UTC in winter and 17:00 UTC in summer.
  assert.deepEqual(centralNow(new Date('2026-11-15T18:05:00Z')), {
    day: WEEK,
    hour: 12,
    weekday: 0,
  });
  assert.equal(centralNow(new Date('2026-07-12T17:05:00Z')).hour, 12);
  assert.equal(centralNow(new Date('2026-11-16T03:00:00Z')).weekday, 0); // still Sunday in Bastrop
});

void test('duplicates collapse within and across sources', () => {
  const events = week();
  assert.equal(count(events, /Hynafol/), 1);
  assert.equal(count(events, /Birthday Bash/), 1);
  assert.equal(count(events, /kitty/i), 1); // two county listings + one city listing
  assert.equal(count(events, /Hunters Crossing/), 1); // listed twice the same evening
});

void test('distinct events survive', () => {
  const events = week();
  assert.equal(count(events, /^Preschool Storytime$/), 2); // Wed and Fri
  assert.equal(count(events, /^Tween D&D$/), 2);
  assert.equal(count(events, /1832/), 1);
  assert.equal(count(events, /Makers Market/), 1);
  assert.equal(count(events, /Library Closure/), 0); // Saturday the 14th
  assert.equal(events.length, 52);
});

void test('merge keeps the county category and fills the venue', () => {
  const kitty = find(week(), /kitty/i);
  assert.equal(kitty.source, 'bcc');
  assert.equal(kitty.category, 'community');
  assert.equal(kitty.venue, 'Bastrop Convention & Exhibit Center');
  assert.equal(kitty.startMin, 17 * 60 + 15);
});

void test('county calendar record shapes', () => {
  const events = normalizeBcc(
    [
      bcc({
        title: 'weekly',
        start_datetime: '2026-07-08T15:00:00',
        recurrence: 'weekly',
        category: 'markets',
      }),
      bcc({
        title: 'weekly-future',
        start_datetime: '2026-12-02T15:00:00',
        recurrence: 'weekly',
      }),
      bcc({
        title: 'offset',
        start_datetime: '2026-11-18T19:00:00-06:00',
        category: 'kids',
      }),
      bcc({
        title: 'oddfmt',
        start_datetime: 'November 20, 2026T00:00:00',
        all_day: 1,
      }),
      bcc({ title: 'garbage', start_datetime: 'soon' }),
      bcc({
        title: 'past',
        start_datetime: '2026-06-10T17:00:00',
        end_datetime: '2026-06-10T18:00:00',
      }),
      bcc({ title: 'midnight', start_datetime: '2026-11-16T00:00:00' }),
      bcc({ title: 'unknown-cat', category: 'zzz' }),
      bcc({ title: 'inactive', status: 'cancelled' }),
    ],
    WEEK,
    END
  );
  const byTitle = new Map(events.map((e) => [e.title, e]));
  assert.deepEqual([...byTitle.keys()].sort(), [
    'midnight',
    'oddfmt',
    'offset',
    'unknown-cat',
    'weekly',
  ]);
  assert.equal(byTitle.get('weekly')?.day, dayNum(2026, 11, 18)); // a Wednesday
  assert.equal(byTitle.get('weekly')?.startMin, 900);
  assert.equal(byTitle.get('weekly')?.category, 'markets-shopping');
  assert.equal(byTitle.get('offset')?.startMin, 19 * 60);
  assert.equal(byTitle.get('offset')?.category, 'family-kids');
  assert.equal(byTitle.get('oddfmt')?.day, dayNum(2026, 11, 20));
  assert.equal(byTitle.get('midnight')?.startMin, null);
  assert.equal(byTitle.get('unknown-cat')?.category, 'community');
});

void test('city categories and venues', () => {
  assert.equal(
    categorizeCity('Planning and Zoning Commission', 'Bastrop Public Meetings'),
    'government-civic'
  );
  assert.equal(
    categorizeCity('Preschool Storytime', 'Bastrop Public Library'),
    'family-kids'
  );
  assert.equal(
    categorizeCity('Coffee & Friends', 'Bastrop Public Library'),
    'education'
  );
  assert.equal(
    categorizeCity('Burger Night', 'Store House Market & Eatery'),
    'food-drink'
  );
  assert.equal(
    categorizeCity(
      'Wine Not? Wednesdays + Live Music',
      'Store House Market & Eatery'
    ),
    'music'
  );
  assert.equal(
    categorizeCity('Eden East Farm Stand', 'Eden East Farm'),
    'markets-shopping'
  );
  assert.equal(
    categorizeCity('Red, White & Blue Banquet', 'Somebody'),
    'community'
  );
  assert.equal(
    cityVenue('1100 Church Street, Bastrop, TX, USA'),
    'Bastrop Public Library'
  );
  assert.equal(
    cityVenue('Eden East Farm, Main Street, Bastrop, TX, USA'),
    'Eden East Farm'
  );
  assert.equal(
    cityVenue('500 Elm Street, Bastrop, TX, USA'),
    '500 Elm Street, Bastrop'
  );
  assert.equal(cityVenue(''), '');
  assert.deepEqual(
    [...titleTokens('The Baron’s Birthday Bash')].sort(),
    [...titleTokens("Baron's Birthday Bash 2026")].sort()
  );
});

void test('rendered post', () => {
  const events = week();
  const { title, body } = renderPost(events, WEEK, DEFAULT_TITLE);
  assert.equal(title, 'Bastrop County Weekly Events | Nov 15 to Nov 21, 2026');
  assert.ok(body.length < REDDIT_BODY_LIMIT);
  assert.ok(!body.includes('—'));
  const lines = body.split('\n');
  const heads = lines.filter((l) => l.startsWith('## '));
  assert.ok(heads[0]?.endsWith('Community'));
  assert.ok(heads.at(-1)?.endsWith('Government & Civic'));
  assert.ok(!body.includes('Faith')); // empty sections are left out
  assert.ok(!body.includes('· Bastrop, TX'));
  assert.equal(lines.filter((l) => l.startsWith('* ')).length, events.length);
  assert.equal(
    whenLabel(find(events, /Hynafol/), WEEK, END),
    'Through Sun 11/15'
  );
  assert.equal(whenLabel(find(events, /Makers Market/), WEEK, END), 'All week');
  assert.equal(
    whenLabel(find(events, /Pinewood/), WEEK, END),
    'Sun 11/15, 5 PM'
  );
  assert.equal(
    whenLabel(find(events, /Blueprint/), WEEK, END),
    'Tue 11/17, 7:45 AM'
  );
  assert.ok(body.includes('52 events in 9 categories'));
});

void test('oversized posts are cut to fit', () => {
  const records = Array.from({ length: 400 }, (_, i) =>
    bcc({
      title: `Event number ${i} ${'x'.repeat(80)}`,
      slug: `e${i}`,
      location_name: `Somewhere ${'y'.repeat(60)}`,
      start_datetime: `2026-11-${15 + (i % 7)}T${String(8 + (i % 12)).padStart(2, '0')}:00:00`,
    })
  );
  const { body } = renderPost(buildWeek(records, null, WEEK), WEEK);
  assert.ok(body.length <= REDDIT_BODY_LIMIT);
  assert.ok(body.includes('shortened'));
  assert.ok(body.trimEnd().endsWith(')'));
});

void test('markdown escaping and excludes', () => {
  const events = buildWeek(
    [
      bcc({ title: 'Jazz [live] *tonight*' }),
      bcc({ title: 'Chamber Board Retreat', slug: 'b' }),
    ],
    null,
    WEEK,
    compileExcludes('board retreat\n\n([unclosed')
  );
  assert.deepEqual(
    events.map((e) => e.title),
    ['Jazz [live] *tonight*']
  );
  assert.ok(
    renderPost(events, WEEK).body.includes('[Jazz \\[live\\] \\*tonight\\*](')
  );
});
