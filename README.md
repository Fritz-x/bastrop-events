# Bastrop Events

A Reddit (Devvit) app that posts one weekly community events calendar to the subreddit it is
installed in. Every Sunday at noon Central it gathers the next seven days of events
(Sunday through Saturday) for Bastrop County, Texas, groups them by category, and submits a
single text post from the app account.

## What it does

1. Reads events from two public community calendars (see Fetch Domains).
2. Keeps events that fall in the Sunday to Saturday window, including multi day events and
   weekly repeating events.
3. Sorts them into twelve categories (Community, Arts & Entertainment, Music, Food & Drink,
   Family & Kids, Sports & Outdoors, Markets & Shopping, Education, Faith,
   Business & Networking, Government & Civic, Health & Wellness).
4. Collapses duplicates: same day, similar title, start times within 90 minutes.
5. Submits one markdown text post. Empty categories are left out.

The app posts at most once per week per subreddit. It does not read, store, or act on any user
content, posts, comments, or messages.

## Moderator controls

Subreddit menu (moderators only):

* **Weekly events: post now** posts the calendar for the week starting this coming Sunday.
* **Weekly events: test sources** reads both calendars and reports the event count. It posts nothing.

Install settings:

* **Post the weekly events calendar automatically** (on by default)
* **Post title** (`{start}`, `{end}`, `{year}` placeholders)
* **Leave out events whose title matches** (one pattern per line)
* **Pin the post**

## Fetch Domains

The following domains are requested for this app:

* `bastropcountycalendar.com` - The Bastrop County Calendar, a public community events site.
  The app makes one GET request per run to its public events list (`/api/events`) to read event
  titles, dates, venues, and categories.
* `api.withapps.io` - Host of the City of Bastrop's public community calendar
  (connect.cityofbastrop.org). The app makes one or two GET requests per run to the same public
  listing endpoint the city's calendar page uses, to read library programs, public meetings, and
  city events.

Both are read only, unauthenticated requests for public event listings. Nothing is sent to
either domain, and no Reddit user data leaves Reddit. The app normally makes these requests
once per week.

## Data stored

Redis holds one value per subreddit: the date of the last week that was posted, so the app
never posts the same week twice.

## Development

```bash
npm install
npm run dev        # playtest in the dev subreddit
npm run test       # types, lint, unit tests, build
npm run deploy     # upload a new version
npm run launch     # submit for review
```

Code layout:

* `src/features/weekly-events/events.ts` normalizes, categorizes, and de-duplicates events
* `src/features/weekly-events/render.ts` builds the post
* `src/features/weekly-events/sources.ts` fetches the two calendars
* `src/features/weekly-events/handlers.ts` scheduler and menu logic
* `devvit.json` schedule (`0 * * * 0`, hourly on Sundays UTC; the handler posts only in the
  noon to 3 PM Central window, which covers daylight saving changes and gives two retries)
