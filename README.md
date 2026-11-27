# GridLine Backend

REST API for GridLine, a power distribution company. Zone Managers publish when each area will lose
power to load shedding, customers report unplanned outages that technicians fix while customers
follow along, and each zone hires its own technicians, with applicants paying the application fee
through Stripe.

| Link          | URL                                                            |
| ------------- | -------------------------------------------------------------- |
| Live site     | <https://ph-se-07-052-fa.vercel.app>                           |
| Live API      | <https://ph-se-07-043.vercel.app/api/v1>                       |
| Frontend repo | [ph-se-07-052-fa](https://github.com/xcdtasif/ph-se-07-052-fa) |
| Backend repo  | [ph-se-07-043](https://github.com/xcdtasif/ph-se-07-043)       |

## Overview

The grid has three levels: a **zone** (such as Mirpur) has **feeders**, and each feeder supplies
**areas** (such as Mirpur 10, Block C). Load shedding and outages happen per feeder; customers know
their area.

| Role         | Can do                                                                                                                 |
| ------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Public       | Read the load shedding schedule of an area, feeder or zone, follow an outage's status page, browse job postings        |
| Customer     | Report an outage in their own area and follow their reports                                                            |
| Technician   | See the outages assigned to them and move each to in progress and restored, with its cause                             |
| Zone Manager | Run one zone: schedule slots, confirm or dismiss reports, assign technicians, post technician jobs and hire, analytics |
| Admin        | Run the company: the grid, users (ban), Zone Manager jobs and hiring, every payment, analytics, stats and audit logs   |

A login is a `User`. Roles come from profiles: a `Customer` profile for an electricity connection,
and an `Employee` row for a job at the company. Any logged-in user who isn't an employee can apply
for a job, and a hire turns their existing account into an employee. Admin 01 is created by the
seed script.

### Load Shedding

A Zone Manager adds `TENTATIVE` slots on their zone's feeders for the week ahead, then confirms each
day's slots (`CONFIRMED`) or cancels one. Slots on one feeder can't overlap. Anyone can read an
area's schedule by Dhaka day. See [Schedule](docs/api-docs/schedule.md).

### Outages

1. A customer reports that their area has no power (`PENDING`).
2. The Zone Manager dismisses the report, or confirms an outage covering one or more areas. Pending
   reports in those areas are `LINKED` to it, and later reports from them join it at once.
3. The Zone Manager assigns a technician of the zone (`ASSIGNED`); each technician has one active
   job at a time.
4. The technician starts work (`IN_PROGRESS`) and restores power (`RESTORED`), setting the cause. A
   `TEMPORARY_TRIP` can be restored straight from `ASSIGNED`.

Each outage has a public status page that a reporting customer is linked to. See
[Outage](docs/api-docs/outage.md).

### Hiring

1. A Zone Manager posts `TECHNICIAN` jobs for their zone; an admin posts `ZONE_MANAGER` jobs.
2. A logged-in user applies with a phone number and a PDF CV (`PAYMENT_PENDING`).
3. They pay the application fee on Stripe Checkout. Stripe's signed webhook marks the payment
   `COMPLETED`, submits the application (`SUBMITTED`) and emails a PDF invoice.
4. The poster's role reviews it: `SHORTLISTED`, then `HIRED`, or `REJECTED`. Each change is emailed
   to the applicant.
5. A hire creates the applicant's `Employee` row, within the posting's vacancies and one Zone
   Manager per zone.

See [Job Posting](docs/api-docs/job-posting.md), [Application](docs/api-docs/application.md) and
[Payment](docs/api-docs/payment.md).

### Reliability

- **Concurrency**: assigning, hiring, scheduling and paying lock the rows they depend on in a
  transaction, and status changes are conditional updates, so two people acting at once can't
  both win (for example, two hires for the last vacancy).
- **Audit log**: bans, grid deletes, schedule and outage changes, hiring and payments are written to
  the audit log in the same transaction as the change.
- **Soft deletes**: zones, feeders, areas and job postings keep their rows with `deletedAt`, and a
  delete is refused while something still depends on the row.
- **Payments**: only the signed Stripe webhook changes a payment's status, and a replayed event
  changes nothing.

## Tech Stack

| Area       | Technology                                               |
| ---------- | -------------------------------------------------------- |
| Runtime    | Node.js 24, TypeScript                                   |
| Framework  | Express 5, helmet, CORS                                  |
| Database   | PostgreSQL (Neon) with Prisma 7                          |
| Validation | Zod                                                      |
| Auth       | JWT Bearer tokens, bcrypt, email OTP, Google sign-in     |
| Bot check  | Cloudflare Turnstile                                     |
| Cache      | Upstash Redis: rate limits, OTPs and public read caching |
| Payments   | Stripe Checkout and webhooks                             |
| Files      | Multer and Cloudinary (CVs), pdfkit (invoices)           |
| Email      | Nodemailer with Gmail                                    |
| Tooling    | pnpm, oxlint, oxfmt, tsx, mise                           |
| Deployment | Vercel                                                   |

## Getting Started

### Prerequisites

- [mise](https://mise.jdx.dev) (installs Node 24), or Node 24 installed yourself, and pnpm
- A PostgreSQL database, for example [Neon](https://neon.tech)
- An [Upstash](https://upstash.com) Redis database
- A Gmail account with an app password, for sending email
- A [Cloudinary](https://cloudinary.com) account with "Allow delivery of PDF and ZIP files" on (Settings > Security)
- A Stripe account and the [Stripe CLI](https://docs.stripe.com/stripe-cli)
- A Google OAuth client and a Cloudflare Turnstile widget

### Setup

```
mise install
pnpm install
cp .env.example .env.local
```

Fill in `.env.local`, then create the database tables and sample data:

```
pnpm db:migrate
pnpm db:generate
pnpm db:seed
```

Start the server, and in a second terminal forward Stripe webhooks to it:

```
pnpm dev
pnpm stripe:listen
```

`stripe:listen` prints a signing secret. Put it in `STRIPE_WEBHOOK_SECRET`.

### Environment Variables

The server reads every variable below except `ADMIN_*` at startup and refuses to start if one is
missing. Only the seed script reads `ADMIN_*`, and `ADMIN_NAME` is optional.

| Variable                       | Purpose                                                                          |
| ------------------------------ | -------------------------------------------------------------------------------- |
| `NODE_ENV`                     | `development` or `production`                                                    |
| `PORT`                         | Port the server listens on                                                       |
| `CLIENT_URL`                   | Frontend origin, used for CORS and the links in emails and Stripe redirects      |
| `FRONTEND_SECRET`              | Shared with the frontend, which sends it with the visitor's IP for rate limiting |
| `DATABASE_URL`                 | Pooled database connection                                                       |
| `DATABASE_URL_UNPOOLED`        | Direct connection, used for migrations                                           |
| `UPSTASH_REDIS_REST_URL`       | Upstash Redis REST URL                                                           |
| `UPSTASH_REDIS_REST_TOKEN`     | Upstash Redis REST token                                                         |
| `BCRYPT_SALT_ROUNDS`           | Password hashing cost                                                            |
| `JWT_ACCESS_SECRET`            | Access token signing secret                                                      |
| `JWT_ACCESS_TOKEN_EXPIRES_IN`  | Access token lifetime, such as `15m`                                             |
| `JWT_REFRESH_SECRET`           | Refresh token signing secret                                                     |
| `JWT_REFRESH_TOKEN_EXPIRES_IN` | Refresh token lifetime, such as `7d`                                             |
| `SMTP_USER`                    | Gmail address that sends email                                                   |
| `SMTP_PASS`                    | Its app password                                                                 |
| `TURNSTILE_SECRET_KEY`         | Turnstile secret key; see [Bot Check](#bot-check)                                |
| `GOOGLE_CLIENT_ID`             | Google OAuth client id                                                           |
| `GOOGLE_CLIENT_SECRET`         | Google OAuth client secret                                                       |
| `CLOUDINARY_URL`               | `cloudinary://<api_key>:<api_secret>@<cloud_name>`                               |
| `STRIPE_SECRET_KEY`            | Stripe API key (test mode)                                                       |
| `STRIPE_PRODUCT_ID`            | Stripe product used for application fee checkouts                                |
| `STRIPE_WEBHOOK_SECRET`        | Webhook signing secret                                                           |
| `ADMIN_EMAIL`                  | Email of Admin 01, whom the seed creates                                         |
| `ADMIN_PASSWORD`               | Password of Admin 01                                                             |
| `ADMIN_NAME`                   | Name of Admin 01, `Admin 01` by default                                          |

### Bot Check

Register, log in and forgot password need a Turnstile token. With Cloudflare's test secret
`1x0000000000000000000000000000000AA` in `TURNSTILE_SECRET_KEY`, the API accepts the dummy token
`XXXX.DUMMY.TOKEN.XXXX`, which is what the Postman requests send. With a real secret, only a token
from the frontend's widget passes.

### Seed Data

`pnpm db:seed` is safe to repeat: each seeder adds only what's missing. It runs in production too,
since the live demo needs the accounts. All sample users share the password `1a2s3d4f`; Admin 01
uses `ADMIN_PASSWORD`.

| Data          | What it contains                                                                                                       |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Grid          | Mirpur, Dhanmondi and Uttara, two feeders each, with their areas                                                       |
| Customers     | `customer01@example.com` to `customer08@example.com`; `customer05` is banned, `customer08` has no customer profile yet |
| Technicians   | `technician01` to `technician03` in Mirpur, `technician04` and `technician05` in Dhanmondi                             |
| Zone Managers | `zonemanager01` runs Mirpur, `zonemanager02` Dhanmondi; Uttara has none and an open Zone Manager posting               |
| Schedules     | Tentative and confirmed slots on the Mirpur and Dhanmondi feeders, from yesterday to six days ahead                    |
| Outages       | One per status, with linked and pending reports, and a month of restored outages for the analytics                     |
| Job postings  | Open, closed and past-deadline postings                                                                                |
| Applications  | Every status, with completed and failed payments; their CVs link one sample PDF                                        |
| Audit logs    | The entries the services would have written for the seeded outages, payments, reviews and ban                          |

The `01` of each role is the demo account, with data for every feature of its role:
`customer01@example.com`, `technician01@example.com`, `zonemanager01@example.com` and Admin 01.

### Scripts

| Script               | What it does                                                    |
| -------------------- | --------------------------------------------------------------- |
| `pnpm dev`           | Start the server with reload                                    |
| `pnpm build`         | Compile to `dist`                                               |
| `pnpm start`         | Run the compiled server                                         |
| `pnpm db:migrate`    | Format the schema and create or apply a migration               |
| `pnpm db:generate`   | Generate the Prisma client and the ERD                          |
| `pnpm db:seed`       | Add the sample data that's missing                              |
| `pnpm db:delete`     | Delete all data. Refuses to run when `NODE_ENV` is `production` |
| `pnpm db:reseed`     | Delete all data, then seed                                      |
| `pnpm fmt`           | Format the code                                                 |
| `pnpm lint`          | Lint the code and apply fixes                                   |
| `pnpm stripe:listen` | Forward Stripe webhooks to the local server                     |
| `pnpm vc:env-sync`   | Replace the Vercel project's env vars with `.env.production`    |

## API Docs

Every route is under `/api/v1`. Each module has its own page with an endpoint table, the object
shape, and every request with its validation rules and responses.

| Module                                      | Covers                                                                     |
| ------------------------------------------- | -------------------------------------------------------------------------- |
| [Auth](docs/api-docs/auth.md)               | Signup with an email code, login, Google sign-in, tokens, password reset   |
| [User](docs/api-docs/user.md)               | Own profile, admin user list, ban and unban                                |
| [Customer](docs/api-docs/customer.md)       | Own customer profile: area and meter number                                |
| [Grid](docs/api-docs/grid.md)               | Zones, feeders and areas: public reads, admin management                   |
| [Schedule](docs/api-docs/schedule.md)       | Load shedding slots: public schedule, Zone Manager planning                |
| [Outage](docs/api-docs/outage.md)           | Reports, confirming, assigning, technician status updates, the status page |
| [Employee](docs/api-docs/employee.md)       | Employee lists and ending an employment                                    |
| [Job Posting](docs/api-docs/job-posting.md) | Public postings, Zone Manager and admin management                         |
| [Application](docs/api-docs/application.md) | Applying with a CV, own applications, review and hiring                    |
| [Payment](docs/api-docs/payment.md)         | Fee checkout, payment history, invoices, admin list, Stripe webhook        |
| [Analytics](docs/api-docs/analytics.md)     | Outage analytics for a zone or the whole company                           |
| [Admin](docs/api-docs/admin.md)             | Company stats and the audit log                                            |

The endpoints are also in a Postman collection, grouped by module and then by role. To run them
against your own server or the live API, see the [Postman Guide](docs/postman-guide.md).

### Conventions

#### Authentication

Login, signup, Google sign-in and refresh return an `accessToken` and a `refreshToken` in the body.
Send the access token on every protected request:

```
Authorization: Bearer <accessToken>
```

When it expires, trade the refresh token for a new pair. Logging out or changing the password ends
every session. Protected routes return `401` when the token is missing, invalid, expired or from
an ended session, and `403` when the user is banned or their role isn't allowed. See
[Tokens](docs/api-docs/auth.md#tokens).

#### Response Envelope

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Outages fetched successfully",
  "data": [],
  "meta": { "page": 1, "limit": 10, "total": 42 }
}
```

`meta` is present on paginated lists only. An error has `success: false` and an `errors` array of
`{ path, message }`, empty when no field is to blame:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation of body failed",
  "errors": [{ "path": "email", "message": "Invalid email address" }]
}
```

#### Pagination

List endpoints take `page` (default `1`) and `limit` (default `10`, `20` for audit logs, at most `50`) and return
`meta` with `page`, `limit` and `total`. Rows that tie on the sort are ordered by `id`, so paging
never shows a row twice or skips one.

#### Dates

Timestamps are UTC ISO strings. Days, such as a schedule's range, a posting's deadline or an
analytics range, are Dhaka calendar days written like `2026-11-28`.

#### Errors

| Status | Meaning                                                                                           |
| ------ | ------------------------------------------------------------------------------------------------- |
| 400    | Validation of `body`, `query` or `params` failed (a CV over 2 MB too), or a wrong or expired code |
| 401    | Not authenticated, or invalid credentials                                                         |
| 403    | Authenticated but not allowed (wrong role, banned, another zone's data)                           |
| 404    | Resource or route not found                                                                       |
| 409    | Conflict: a duplicate, a status that has moved on, or a rule that blocks it                       |
| 413    | JSON body too large                                                                               |
| 429    | Too many requests (`Retry-After` says when to retry), or Stripe is busy                           |
| 500    | Internal server error                                                                             |
| 502    | Stripe rejected the request or failed                                                             |
| 503    | Database or Stripe unavailable                                                                    |

Unknown routes return `404` with the message `Route <METHOD> <path> not found`. Bodies, queries and
params are strict: unknown fields are rejected with `400`.

#### Rate Limits

Every IP gets 100 requests a minute. Signup, login, password and email-code routes have tighter
limits per IP and email, and applying is limited per user.

## Database

Fourteen models: `User`, `Customer`, `Employee`, `Zone`, `Feeder`, `Area`, `LoadSheddingSlot`,
`OutageReport`, `Outage`, `OutageArea`, `JobPosting`, `Application`, `Payment` and `AuditLog`. See
the [ERD](docs/erd.svg). The schema is split by domain in `prisma/models`, with migrations in
`prisma/migrations`.

## Project Structure

```
src/
  app.ts          Express app: middleware and route mounting
  server.ts       Entry point. Listens locally, exports the app for Vercel
  config/         Validated environment variables
  middlewares/    authenticate, authorize, validate, rate limit, Turnstile, CV upload, errors
  modules/<name>/ <name>.routes.ts, .controller.ts, .service.ts, .schema.ts
  db/             Seed and delete scripts
  lib/            Prisma, Redis, Stripe, Cloudinary, Google and mail clients, cache, audit log
  utils/          Helpers: Dhaka time, row locks, errors, responses
prisma/           Schema, models and migrations
docs/             API docs (api-docs/, one page per module), Postman guide and ERD
```

## Deployment

The app deploys to Vercel, which builds `src/server.ts` as a function; `server.ts` only calls
`listen` outside Vercel. Set the environment variables in the project (`pnpm vc:env-sync` copies
`.env.production`), apply migrations to the production database, and add a Stripe webhook endpoint
at `https://<host>/api/v1/stripe/webhook` for the `checkout.session.completed` and
`checkout.session.expired` events.
