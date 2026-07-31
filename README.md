# weather-verify

A service for checking how accurate weather forecasts really are. Every day it collects
forecasts from several providers, separately collects the actual weather (reanalysis),
matches them up, and reports the **forecast error** — broken down by the forecast horizon
(lead time), i.e. how many days before the target date the forecast was issued.

## How it works

The idea is simple: the "promise" of weather and "what actually happened" are two separate
records that need to be joined on the same date.

1. **Forecast** — a forecast issued on `issuedDate` for the day `targetDate`. The gap
   between them is `leadTimeDays` (the forecast horizon).
2. **Observation** — the actual weather for `date` (taken from the Open-Meteo reanalysis
   archive with a ~5-day delay so the data has time to stabilize).
3. **Comparison** — for matching dates it computes the error `forecast − actual` for
   `tempMax` / `tempMin`, plus the **MAE** (mean absolute error) grouped by provider and
   by `leadTimeDays`.

Collection runs daily (an in-process cron plus an external trigger via GitHub Actions).
The frontend shows the forecast, a comparison table, and error-by-lead-time charts.

## Stack

- **Monorepo:** npm workspaces
- **API:** Node.js, TypeScript, [Fastify 5](https://fastify.dev/), [Prisma 6](https://www.prisma.io/) + PostgreSQL
- **Auth:** JWT in an httpOnly cookie
- **Scheduler:** `node-cron` (in-process) + GitHub Actions (external trigger)
- **Scraping:** `cheerio` (for the Gismeteo provider)
- **Validation:** `zod`
- **Web:** React 18, Vite 6, [Recharts](https://recharts.org/)
- **Shared code:** `@weather-verify/shared` package (shared TypeScript types)

## Repository layout

```
weather-verify/
├─ apps/
│  ├─ api/                 # Fastify + Prisma backend
│  │  ├─ prisma/           # schema.prisma and migrations
│  │  └─ src/
│  │     ├─ index.ts       # entry point, all routes
│  │     ├─ cron.ts        # in-process daily collection
│  │     ├─ providers.ts   # forecast provider registry
│  │     ├─ openMeteo*.ts   # Open-Meteo adapters (forecast / archive / previous runs)
│  │     ├─ weatherApi.ts  # WeatherAPI adapter
│  │     ├─ gismeteo.ts    # Gismeteo adapter (HTML parsing)
│  │     ├─ services/      # forecast/observation collection, daily run
│  │     ├─ schemas/       # zod request schemas
│  │     ├─ hooks/         # requireAuth
│  │     └─ utils/         # jwt, password, retry
│  └─ web/                 # React + Vite frontend
│     └─ src/              # App, charts, auth screen, api client
├─ packages/
│  └─ shared/              # shared types (HealthResponse, ComparisonRow, LeadTimeStat)
└─ .github/workflows/
   └─ daily-collection.yml # daily collection trigger via cron
```

## Requirements

- Node.js 20+
- PostgreSQL 14+ (local or hosted)
- A WeatherAPI key (the free tier is enough — 3-day forecast) — optional, only if you
  want the `weatherapi` provider

## Environment variables

The API reads its configuration from the environment (e.g. from `apps/api/.env`):

| Variable         | Required | Purpose                                                              |
| ---------------- | -------- | -------------------------------------------------------------------- |
| `DATABASE_URL`   | yes      | PostgreSQL connection string (for Prisma)                            |
| `JWT_SECRET`     | yes      | Secret used to sign auth JWTs                                        |
| `CRON_SECRET`    | yes\*    | Secret checked by `POST /api/cron/run` (`x-cron-secret` header)      |
| `WEATHERAPI_KEY` | no\*\*   | WeatherAPI key for the `weatherapi` provider                         |
| `PORT`           | no       | API port (defaults to `3000`)                                        |
| `NODE_ENV`       | no       | `production` enables the prod logger and `secure` cookies            |

\* Required if you use the `/api/cron/run` endpoint (external trigger).
\*\* Without it the `weatherapi` provider will fail; the other providers keep working.

Example `apps/api/.env`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/weather_verify"
JWT_SECRET="replace-with-a-long-random-string"
CRON_SECRET="replace-with-a-random-string"
WEATHERAPI_KEY="your-weatherapi-key"
PORT=3000
```

## Setup and running

```bash
# 1. Install dependencies for all workspaces
npm install

# 2. Apply migrations and generate the Prisma Client
cd apps/api
npx prisma migrate deploy      # or `npx prisma migrate dev` during development
npx prisma generate
cd ../..

# 3. Run the API and the web app together
npm run dev
```

`npm run dev` starts both apps via `concurrently`:

- **API** — `http://localhost:3000`
- **Web** — `http://localhost:5173` (`/api/*` requests are proxied to the API by Vite)

Individual commands:

```bash
npm run dev:api      # API only (tsx watch)
npm run dev:web      # frontend only (vite)
npm run typecheck    # type-check across all workspaces
```

First step after starting: register a user (`POST /api/auth/register`), log in, and add
locations.

## Forecast providers

Providers are declared in `apps/api/src/providers.ts`. Adding a new one = add a single line
to the `PROVIDERS` registry and implement an adapter function that returns a unified
`ForecastDay[]`.

| Provider     | id           | Source                                                          |
| ------------ | ------------ | -------------------------------------------------------------- |
| Open-Meteo   | `open-meteo` | Forecast API; the archive (reanalysis) is used for observations |
| WeatherAPI   | `weatherapi` | Forecast API (free tier — 3 days)                              |
| Gismeteo     | `gismeteo`   | Parses the 10-day forecast page (`cheerio`)                    |

Observations (the actuals) always come from the Open-Meteo archive — a single reference
for comparison.

## API

All `locations/*` endpoints and `auth/me` require authentication (the `token` cookie).

**Service**

| Method | Path          | Description        |
| ------ | ------------- | ------------------ |
| GET    | `/api/health` | Liveness check     |

**Auth**

| Method | Path                 | Description                                  |
| ------ | -------------------- | ------------------------------------------- |
| POST   | `/api/auth/register` | Register (`email`, `password`)              |
| POST   | `/api/auth/login`    | Log in, sets the httpOnly `token` cookie    |
| POST   | `/api/auth/logout`   | Log out, clears the cookie                  |
| GET    | `/api/auth/me`       | Current user                                |

**Locations and data**

| Method | Path                                          | Description                                                    |
| ------ | --------------------------------------------- | ------------------------------------------------------------- |
| GET    | `/api/locations`                              | User's locations                                              |
| GET    | `/api/locations/count`                        | Number of locations                                           |
| POST   | `/api/locations`                              | Add/attach a location                                         |
| GET    | `/api/locations/:id/forecast`                 | Fresh Open-Meteo forecast (not saved)                         |
| POST   | `/api/locations/:id/forecast`                 | Collect forecasts from all providers and **save** them        |
| POST   | `/api/locations/:id/observations`             | Collect actuals (reanalysis) for N days                       |
| GET    | `/api/locations/:id/comparison`               | Forecast-vs-actual comparison per provider                    |
| GET    | `/api/locations/:id/lead-time-stats`          | MAE by forecast horizon (per provider)                        |
| POST   | `/api/locations/:id/backfill-forecast`        | Fill "forecasts" for past dates from the archive (for demos)  |
| POST   | `/api/locations/:id/backfill-previous-runs`   | Load previous Open-Meteo forecast runs                        |

**Cron**

| Method | Path            | Description                                                  |
| ------ | --------------- | ----------------------------------------------------------- |
| POST   | `/api/cron/run` | Run the daily collection; requires the `x-cron-secret` header |

## Data model (Prisma)

- **Location** — a point (name, country, lat/lon, timezone, optional `gismeteoId` / `geonameId`).
- **Forecast** — a forecast: `issuedDate`, `targetDate`, `leadTimeDays`, `provider`, `tempMin/Max`, `precipMm`.
  Unique on `(locationId, provider, issuedDate, targetDate)`.
- **Observation** — an actual: `date`, `tempMin/Max`, `precipMm`. Unique on `(locationId, date)`.
- **User** — `email`, `passwordHash`.
- **UserLocation** — many-to-many link between users and locations.

## Data collection and scheduling

- **In-process cron** (`node-cron`) runs `runDailyCollection()` every day at 03:00
  `Asia/Jerusalem`: for each location it collects forecasts from all providers plus
  observations. A single provider's failure does not break the others (each runs in its
  own `try`).
- **External trigger** (`.github/workflows/daily-collection.yml`) runs daily at 00:00 UTC
  and `POST`s to `/api/cron/run` with the `x-cron-secret: ${{ secrets.CRON_SECRET }}`
  header. Useful for serverless/sleeping instances where the in-process cron might not fire.

## Deployment

The project targets deploying the API to [Render](https://render.com/) (the workflow calls
`https://weather-verify.onrender.com/api/cron/run`).

In the service settings, set the environment variables from the table above, and in the
GitHub repository secrets set `CRON_SECRET` to match the server value.

## Notes

- Observations are collected with a 5-day offset — fresh reanalysis data arrives with a
  delay.
- The `backfill-*` endpoints exist to quickly seed the database with historical data and
  see the comparison without waiting for real daily runs to accumulate.
