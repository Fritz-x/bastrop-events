// Network access. Both hosts must be listed under permissions.http.domains in
// devvit.json and approved by Reddit before these calls succeed.
import { toUtcDate, type DayNum } from './dates.js';
import type { RawRecord } from './events.js';

const BCC_URL = 'https://bastropcountycalendar.com/api/events';
// City of Bastrop community calendar (connect.cityofbastrop.org), hosted on With Apps.
const CITY_URL =
  'https://api.withapps.io/api/v2/organizations/56/communities/261/resources/published';
const HEADERS = {
  'Accept': 'application/json',
  'User-Agent': 'bastrop-events (Reddit Devvit app; weekly community calendar)',
};
const MAX_CITY_PAGES = 20;

export type Gathered = {
  bcc: RawRecord[] | null;
  city: RawRecord[] | null;
  errors: string[];
};

function isRecord(value: unknown): value is RawRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, { method: 'GET', headers: HEADERS });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${new URL(url).hostname}`);
  }
  const data: unknown = await response.json();
  return data;
}

export async function fetchBcc(): Promise<RawRecord[]> {
  const data = await getJson(BCC_URL);
  if (!Array.isArray(data)) {
    throw new Error('county calendar: expected a JSON list of events');
  }
  return data.filter(isRecord);
}

export async function fetchCity(weekStart: DayNum): Promise<RawRecord[]> {
  // Ask for a day of padding on each side; exact filtering happens in events.ts.
  const lo = Math.floor(toUtcDate(weekStart - 1).getTime() / 1000);
  const hi = Math.floor(toUtcDate(weekStart + 8).getTime() / 1000);
  const records: RawRecord[] = [];
  for (let page = 1; page <= MAX_CITY_PAGES; page += 1) {
    const query = new URLSearchParams({
      'filterBy[startsAt]': String(lo),
      'filterBy[endsAt]': String(hi),
      'filterBy[onlyDated]': 'true',
      'filterBy[includeSpanning]': 'true',
      'filterBy[resourceType][0]': 'regular',
      'pageSize': '50',
      'page': String(page),
    });
    const data = await getJson(`${CITY_URL}?${query.toString()}`);
    const payload =
      isRecord(data) && isRecord(data['data']) ? data['data'] : {};
    const pageRecords = payload['records'];
    if (Array.isArray(pageRecords))
      records.push(...pageRecords.filter(isRecord));
    const pagination = payload['pagination'];
    const totalPages =
      isRecord(pagination) && typeof pagination['totalPages'] === 'number'
        ? pagination['totalPages']
        : 1;
    if (page >= totalPages) break;
  }
  return records;
}

/** Fetches both sources. A source that fails comes back as null with its error recorded. */
export async function gather(weekStart: DayNum): Promise<Gathered> {
  const [bcc, city] = await Promise.allSettled([
    fetchBcc(),
    fetchCity(weekStart),
  ]);
  const errors: string[] = [];
  const describe = (reason: unknown): string =>
    reason instanceof Error ? reason.message : String(reason);
  if (bcc.status === 'rejected') {
    errors.push(`county calendar: ${describe(bcc.reason)}`);
  }
  if (city.status === 'rejected') {
    errors.push(`city calendar: ${describe(city.reason)}`);
  }
  for (const error of errors) console.error(`[weekly-events] ${error}`);
  return {
    bcc: bcc.status === 'fulfilled' ? bcc.value : null,
    city: city.status === 'fulfilled' ? city.value : null,
    errors,
  };
}
