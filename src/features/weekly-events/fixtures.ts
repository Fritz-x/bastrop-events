// Test data: rows captured from the live feeds on 2026-11-14. Titles, dates,
// times, categories and venues are real; slugs and resource ids are made up.
import type { RawRecord } from './events.js';

// start | end | all_day | recurrence | category | title | location_name | location_address
const BCC_ROWS = `
2026-11-07T00:00:00|2026-12-26|1|none|food-drink|Bastrop Farmers & Makers Market|Hyperloop Plaza|
2026-11-08T00:00:00|2026-11-15|0|none|arts-entertainment|Hynafol 2026: The Grand Gathering|Sherwood Forest Faire|
2026-11-08T00:00:00|2026-11-15|0|none|community|The Grand Gathering of Hynafol 2026|Sherwood Forest Faire|
2026-11-15T00:00:00|2026-11-15|1|none|music|Robert Kraft|The Grace Miller "Gracie's"|
2026-11-15T14:00:00|2026-11-15T17:00:00|0|none|music|Dan Whitaker (solo) at Frontier Cellars|Frontier Cellars|157 Hector Road, Smithville, TX
2026-11-15T14:00:00|2026-11-15|0|none|arts-entertainment|LPAC Teen Art Club|Lost Pines Art Center|
2026-11-15T17:00:00||0|none|community|Community Pinewood Derby Race|Rosanky Baptist Church|2160 FM 535, Rosanky, TX 78953
2026-11-17T07:45:00|2026-11-17|0|none|business-networking|Bastrop's Blueprint & Breakfast|Bastrop, TX|
2026-11-17T16:00:00|2026-11-17|0|none|community|ROOTED AND RISING: Victory Celebration|Bastrop, TX|
2026-11-18T08:00:00|2026-11-18|0|none|business-networking|Bastrop Chamber Board Retreat|Bastrop, TX|
2026-11-19T09:00:00|2026-11-19|0|none|arts-entertainment|B.E.S.T. Leadership Program - Session 3|Bastrop, TX|
2026-11-19T13:00:00|2026-11-19|0|none|business-networking|Ribbon cutting for Carrie's Wigs & Boutique|Bastrop, TX|
2026-11-19T18:00:00|2026-11-19|0|none|community|McDade ‘s Colonial Supper 2026|McDade Historical Museum|
2026-11-20T00:00:00|2026-11-20|1|none|music|Tim Sparkman & Brandi Behlen|The Grace Miller "Gracie's"|
2026-11-20T00:00:00|2026-11-20|1|none|music|Chili Cook-Off, Late Night at The Bodega|Hyperloop Plaza|
2026-11-20T12:00:00|2026-11-20|0|none|business-networking|Ambassadors Committee Meeting|Bastrop, TX|
2026-11-20T18:00:00||0|none|music|Joni Mitchell and Beyond Concert in the Dark with Strings|Lumberyard Music Hall|1109 Main Street Unit A, Bastrop, TX 78602
2026-11-21T00:00:00|2026-11-21|1|none|family-kids|Trot with Tracy's|Fisherman's Park|
2026-11-21T00:00:00|2026-11-21|1|none|music|Jaime Krueger Group|The Grace Miller "Gracie's"|
2026-11-21T00:00:00|2026-11-21|1|none|community|The Baron’s Birthday Bash|Bastrop County Museum & Visitor Center|
2026-11-21T10:00:00|2026-11-21|0|none|arts-entertainment|Baron’s Birthday Bash 2026|Bastrop County Historical Society’s Museum & Visitor Center|
2026-11-21T10:00:00|2026-11-21|0|none|markets-shopping|Autumn Market Festival 2026|Rising Sun Vineyard|
2026-11-21T17:15:00||0|none|community|Bastrop CATS Kitty BINGO: Rhinestone Rodeo|Bastrop Convention & Exhibit Center|1408 Chestnut St., Bastrop, TX 78602
2026-11-21T17:15:00|2026-11-21|0|none|community|Kitty BINGO 2026: Rhinestone Rodeo|Bastrop, TX|
`;

// startsAt | endsAt | name | leaderName | locationText
const CITY_ROWS = `
2026-11-14 10:00|2026-11-14 16:00|Library Closure|Bastrop Public Library|1100 Church Street, Bastrop Texas
2026-11-16 13:00|2026-11-16 16:00|Sewing Group|Bastrop Public Library|1100 Church Street, Bastrop, TX, USA
2026-11-16 16:00|2026-11-16 17:30|Tween D&D|Bastrop Public Library|1100 Church Street, Bastrop, TX, USA
2026-11-16 17:00||Bastrop Economic Development Corporation|Bastrop Public Meetings|
2026-11-16 18:00||Main Street Advisory Board|Bastrop Public Meetings|
2026-11-17 14:00|2026-11-17 15:00|French Conversation|Amie Cuvelier|1100 Church Street, Bastrop, TX, USA
2026-11-17 14:00||Knitters Nook|Bastrop Public Library|1100 Church Street, Bastrop, TX, USA
2026-11-17 17:00||Bastrop Economic Development Corporation|Bastrop Public Meetings|
2026-11-17 17:30||Hunters Crossing Local Government Corporation Board|Bastrop Public Meetings|
2026-11-17 18:00||Main Street Advisory Board|Bastrop Public Meetings|
2026-11-17 18:00|2026-11-17 20:00|Bastrop Fiber Arts|Bastrop Public Library|1100 Church Street, Bastrop, TX, USA
2026-11-17 18:00||Hunters Crossing Local Government Corporation Board|Bastrop Public Meetings|
2026-11-17 18:30||Special City Council Meeting|Bastrop Public Meetings|
2026-11-17 19:00|2026-11-17 20:00|Bastrop Public Library Walking Audiobook Club_Copy|Bastrop Public Library|1100 Church Street, Bastrop, TX, USA
2026-11-18 09:00|2026-11-18 13:00|Eden East Farm Stand|Eden East Farm|Eden East Farm, Main Street, Bastrop, TX, USA
2026-11-18 10:30|2026-11-18 12:00|Preschool Storytime|Bastrop Public Library|1100 Church Street, Bastrop, TX, USA
2026-11-18 14:00||Investment Committee|Bastrop Public Meetings|
2026-11-18 15:00|2026-11-18 16:30|Coffee & Friends|Bastrop Public Library|1100 Church Street, Bastrop, TX, USA
2026-11-18 17:00|2026-11-18 22:00|Wine Not? Wednesdays + Live Music|Store House Market & Eatery|Store House Market & Eatery, Main Street, Bastrop, TX, USA
2026-11-18 18:00||Fairview Cemetery Advisory Board|Bastrop Public Meetings|
2026-11-18 19:00|2026-11-18 21:00|Bingo|Bastrop Beer Company|Bastrop Beer Company, Main Street, Bastrop, TX, USA
2026-11-19 11:00|2026-11-19 22:00|Burger Night|Store House Market & Eatery|Store House Market & Eatery, Main Street, Bastrop, TX, USA
2026-11-19 11:30|2026-11-19 12:30|Bilingual Storytime|Bastrop Public Library|1100 Church Street, Bastrop, TX, USA
2026-11-19 12:00|2026-11-19 19:00|Happy Hour!|Film Alley|Film Alley Bastrop, Chestnut Street, Bastrop, TX, USA
2026-11-19 14:00|2026-11-19 16:30|Tween D&D|Bastrop Public Library|1100 Church Street, Bastrop, TX, USA
2026-11-19 16:30|2026-11-19 18:00|Teen Thursday|Bastrop Public Library|1100 Church Street, Bastrop, TX, USA
2026-11-19 18:00||Planning and Zoning Commission|Bastrop Public Meetings|
2026-11-19 19:00|2026-11-19 21:00|TRIVIA|Bastrop Beer Company|Bastrop Beer Company, Main Street, Bastrop, TX, USA
2026-11-20 10:30|2026-11-20 12:00|Preschool Storytime|Bastrop Public Library|1100 Church Street, Bastrop, TX, USA
2026-11-20 15:00|2026-11-20 17:00|Bastrop Fiber Arts|Bastrop Public Library|1100 Church Street, Bastrop, TX, USA
2026-11-21 09:00|2026-11-21 13:00|Eden East Farm Stand|Eden East Farm|Eden East Farm, Main Street, Bastrop, TX, USA
2026-11-21 10:00|2026-11-21 14:00|Bastrop 1832 Farmer's Market|Bastrop 1832 Farmers Market|Bastrop 1832 Farmers Market, Chestnut Street, Bastrop, TX, USA
2026-11-21 11:00|2026-11-21 12:30|Library Book Club|Bastrop Public Library|1100 Church Street, Bastrop, TX, USA
2026-11-21 18:00|2026-11-21 22:00|Bastrop Cats Anonymous - Kitty Bingo|Bastrop Convention & Exhibit Center|1408 Chestnut Street, Bastrop, TX, USA
`;

function rows(text: string): string[][] {
  return text
    .trim()
    .split('\n')
    .map((line) => line.split('|'));
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function bccFixture(): RawRecord[] {
  return rows(BCC_ROWS).map((cols) => {
    const [
      start = '',
      end = '',
      allDay,
      recurrence,
      category,
      title = '',
      loc,
      addr,
    ] = cols;
    const slug = `${slugify(title)}-${start.slice(0, 10)}`;
    return {
      id: slug,
      slug,
      title,
      start_datetime: start,
      end_datetime: end || null,
      all_day: Number(allDay),
      recurrence,
      category,
      location_name: loc || null,
      location_address: addr || null,
      status: 'active',
    };
  });
}

export function cityFixture(): RawRecord[] {
  return rows(CITY_ROWS).map((cols, index) => {
    const [start, end, name, leader, loc] = cols;
    const id = 260200000 + index;
    return {
      resourceId: id,
      name,
      startsAt: start,
      endsAt: end,
      isAllDay: null,
      isPrivateEvent: false,
      closed: false,
      leaderName: leader,
      locationText: loc,
      resourceUrl: `https://connect.cityofbastrop.org/bastroptx/${id}?utm_source=bewith&utm_medium=calendar`,
    };
  });
}
