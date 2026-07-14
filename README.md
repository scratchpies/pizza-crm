# Scratch Pies CRM

A CRM built from your real "Scratch Pies CRM-2026.xlsx" spreadsheet (Customers /
Opportunities / Events_Sales tabs). Next.js + Postgres, deployable to Vercel + Neon,
works on desktop and mobile.

## What's included

- **Contacts** (325 imported from the Customers tab) — search, filter by type, full
  edit, "do not email" flag.
- **Leads** (110 imported from the Opportunities tab) — pipeline view, inline stage/
  status updates, linked to the matching contact where we could tell.
- **Events** (24 imported from Events_Sales) — booking/order history: date, guest
  count, pizzas, revenue, deposit, payment method, staff, feedback.
- **Reports** — win-back list (current customers quiet 90+ days), stale leads
  (open leads untouched 30+ days), upcoming events/leads in the next 60 days.
- **Export** — CSV formatted for Omnisend's contact import (Email, First/Last Name,
  Phone, City, Country, Postal Code, plus Tag & Contact Type as custom properties),
  filterable by contact type and tag.
- **Import** — CSV upload for adding/updating contacts going forward.
- Single login (one shared password via `ADMIN_PASSWORD`), responsive layout.

## Data notes worth knowing

- Of 110 leads, 100 auto-matched to a contact by name; 10 didn't (the name
  in Opportunities didn't match anything in Customers) — check the Leads page,
  the unmatched ones show the raw name from the sheet instead of a link.
- Of 24 events, 19 matched to a contact; 5 didn't for the same reason.
- 29 contacts have no email, 164 have no phone, and 31 have a duplicate email
  shared with another contact — normal for a few years of hand-entered data, but
  worth a cleanup pass once you're in the app.
- There was no explicit "opted in to marketing" column in your sheet, so the
  export includes everyone by default except anyone you mark "Do not email" —
  treat that checkbox as your suppression list.
- The one-time historical import (`prisma/seed.js` + `prisma/seed-data/*.json`)
  is already built from your actual file — no re-parsing needed, just run it
  once your database is live (steps below).

## Setup

1. **Database**: create a free project at [neon.tech](https://neon.tech), copy the
   pooled connection string.
2. Copy `.env.example` to `.env` and fill in `DATABASE_URL`, `ADMIN_PASSWORD`
   (whatever password you want to log in with), and `SESSION_SECRET` (run
   `openssl rand -hex 32`).
3. Install and set up locally:
   ```
   npm install
   npm run db:push     # creates the tables in Neon
   npm run db:seed     # loads your real 325 contacts / 110 leads / 24 events
   npm run dev          # http://localhost:3000
   ```

## Deploying (Vercel)

1. Push this folder to a GitHub repo.
2. Import the repo at [vercel.com/new](https://vercel.com/new).
3. Add the same three environment variables (`DATABASE_URL`, `ADMIN_PASSWORD`,
   `SESSION_SECRET`) in the Vercel project settings.
4. Deploy. Vercel runs `npm run build` automatically, which also generates the
   Prisma client.
5. Open the Vercel URL on your phone — it's fully responsive.

You mentioned you already have IONOS hosting. IONOS's shared hosting plans don't
run persistent Node.js apps the way this needs, so Vercel (free tier, zero
server maintenance) is the simpler path for one user. If you'd rather self-host
on IONOS VPS or elsewhere, this is a standard Next.js + Postgres app and will run
anywhere Node 18+ and a Postgres connection are available — just say so and I'll
adjust the deploy instructions.

## What's next / possible follow-ups

- Add a second login if staff need their own accounts.
- Add a "new lead" / "new event" quick-add form (currently those are seeded from
  your sheet and editable, but creating brand new ones from scratch is basic).
- Clean up the 31 duplicate emails and 29 missing emails directly in the app.
- Tighten the name-matching for the 10 unmatched leads / 5 unmatched events.
