// Calendar-day helpers. Events are handled as plain calendar days plus
// minutes-after-midnight in America/Chicago, never as UTC instants, so a
// "7 PM" event stays 7 PM regardless of where the server runs.

/** Whole days since 1970-01-01. */
export type DayNum = number;

export type When = { day: DayNum; minutes: number | null };

const MS_PER_DAY = 86_400_000;
const TIME_ZONE = 'America/Chicago';
const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

export function dayNum(year: number, month: number, day: number): DayNum {
  return Math.floor(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

export function toUtcDate(day: DayNum): Date {
  return new Date(day * MS_PER_DAY);
}

/** 0 = Sunday ... 6 = Saturday. */
export function weekdayOf(day: DayNum): number {
  return toUtcDate(day).getUTCDay();
}

export function isoDate(day: DayNum): string {
  return toUtcDate(day).toISOString().slice(0, 10);
}

export type CentralNow = { day: DayNum; hour: number; weekday: number };

/** The calendar day and hour it currently is in Bastrop. */
export function centralNow(now: Date): CentralNow {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string): number =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const day = dayNum(get('year'), get('month'), get('day'));
  return { day, hour: get('hour'), weekday: weekdayOf(day) };
}

/** Sunday on or after the given day. */
export function upcomingSunday(day: DayNum): DayNum {
  return day + ((7 - weekdayOf(day)) % 7);
}

const ISO_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?)?(Z|[+-]\d{2}:?\d{2})?$/;
const LONG_PATTERN = /^([A-Za-z]+) (\d{1,2}), (\d{4})(?:T(\d{2}):(\d{2}))?/;

/**
 * Parses the date shapes seen in the feeds:
 * "2026-11-15", "2026-11-15T14:00:00", "2026-11-15 14:00",
 * "2026-11-18T19:00:00-06:00" and "December 5, 2026T00:00:00".
 */
export function parseWhen(value: unknown): When | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return null;

  const iso = ISO_PATTERN.exec(text);
  if (iso) {
    const [, y, mo, d, h, mi, offset] = iso;
    if (offset && h !== undefined) {
      // A real instant: convert it to Central wall-clock time.
      const instant = new Date(text.replace(' ', 'T'));
      if (Number.isNaN(instant.getTime())) return null;
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: TIME_ZONE,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hourCycle: 'h23',
      }).formatToParts(instant);
      const get = (type: string): number =>
        Number(parts.find((p) => p.type === type)?.value ?? 0);
      return {
        day: dayNum(get('year'), get('month'), get('day')),
        minutes: get('hour') * 60 + get('minute'),
      };
    }
    return {
      day: dayNum(Number(y), Number(mo), Number(d)),
      minutes: h === undefined ? null : Number(h) * 60 + Number(mi),
    };
  }

  const long = LONG_PATTERN.exec(text);
  if (long) {
    const [, monthName, d, y, h, mi] = long;
    const month = MONTHS.indexOf((monthName ?? '').toLowerCase());
    if (month < 0) return null;
    return {
      day: dayNum(Number(y), month + 1, Number(d)),
      minutes: h === undefined ? null : Number(h) * 60 + Number(mi),
    };
  }
  return null;
}
