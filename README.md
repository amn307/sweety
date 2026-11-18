# Sweety — Blood Glucose Tracker

Sweety is a full-stack application for recording and reviewing blood glucose readings. Users can register, sign in, manage readings across four daily time slots, and view daily, month-to-date, and previous-month reports.

## Tech stack

- **Frontend:** React 19, TypeScript, Vite 8
- **Backend:** Node.js, Express 5
- **Database:** PostgreSQL 16, Prisma ORM 6
- **Authentication:** JWT and bcryptjs
- **Testing:** Vitest and Supertest
- **Local database:** Docker Compose

## Features

- Register and sign in with an account
- Create, view, edit, and delete your own glucose readings
- Record one reading per date and time slot: morning (fasting), after breakfast, after lunch, or after dinner
- Validate glucose values between 40 and 600 mg/dL and prevent future dates
- View daily, month-to-date, and previous-month statistics (highest, lowest, average, and count)
- Browse reading history

## Prerequisites

- Node.js and npm compatible with Vite 8 (Node.js 20.19+ or 22.12+)
- Docker with Docker Compose

## Local setup

### 1. Clone the repository

```bash
git clone https://github.com/amn307/sweety.git
cd sweety
```

### 2. Start PostgreSQL

```bash
docker compose up -d
```

The Compose file starts PostgreSQL on `127.0.0.1:5432`, with a persistent Docker volume. Its credentials are for **local development only**.

### 3. Configure and run the backend

```bash
cd server
npm ci
cp .env.example .env
```

The example `DATABASE_URL` matches the included Docker Compose configuration. Replace `JWT_SECRET` with a strong, random secret in your local `.env` file. Never commit real `.env` files.

Apply the database migrations and generate the Prisma client:

```bash
npx prisma migrate deploy
npx prisma generate
```

Start the API:

```bash
npm run dev
```

By default, the backend runs at `http://localhost:5001`. Check `http://localhost:5001/api/health` for its health endpoint.

### 4. Configure and run the frontend

In another terminal:

```bash
cd sweety/client
npm ci
cp .env.example .env
npm run dev
```

If you are already at the repository root, use `cd client` instead. Open the local URL printed by Vite (typically `http://localhost:5173`).

## Demo data

With the backend environment configured and the database migrated:

```bash
cd server
npm run seed
```

The seed script populates sample readings for a demo account. **Check the seed script for its current credentials before publishing them in assessment materials.** You can also register a new account from the UI.

## API overview

All routes are prefixed with `/api`. Protected routes require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/auth/register` | Register an account |
| POST | `/auth/login` | Sign in and obtain a token |
| GET | `/health` | Health check |
| GET | `/me` | Current authenticated user |
| GET | `/readings` | List the user's readings |
| GET | `/readings/:id` | Get a single reading |
| POST | `/readings` | Create a reading |
| PUT | `/readings/:id` | Update a reading |
| DELETE | `/readings/:id` | Delete a reading |
| GET | `/reports/daily?date=YYYY-MM-DD` | Selected-day statistics and readings |
| GET | `/reports/mtd?date=YYYY-MM-DD` | Month-to-date statistics |
| GET | `/reports/monthly?date=YYYY-MM-DD` | Previous calendar month statistics |

### Reading data

Example request body for creating or updating a reading:

```json
{
  "date": "2026-11-18",
  "slot": "MORNING",
  "value": 105
}
```

Supported slots: `MORNING`, `AFTER_BREAKFAST`, `AFTER_LUNCH`, `AFTER_DINNER`. Values are integers in mg/dL.

The browser sends an `X-Timezone-Offset` header when saving readings so future-date validation can use the browser's current calendar date. Stored reading dates and report boundaries use UTC calendar dates.

## Testing and quality checks

Backend tests:

```bash
cd server
npm test
```

The integration tests require a separate PostgreSQL test database and the corresponding `server/.env.test` configuration. Create `sweety_test` in PostgreSQL and copy `.env.test.example` to `.env.test` if that example is present. Verify the test database configuration before running tests to avoid modifying development data.

Frontend checks:

```bash
cd client
npm run lint
npm run build
```

## Project structure

```text
sweety/
├── client/               # React + TypeScript frontend
├── server/
│   ├── prisma/           # Schema, migrations, seed script
│   ├── src/              # Express API and middleware
│   └── tests/            # Integration tests
├── docker-compose.yml    # Local PostgreSQL
└── README.md
```

## Notes

- This application is a coding assessment project, not a medical device or clinical decision-support tool.
- The included Docker credentials are for local development only. Change them before any shared or production deployment.
- Do not commit `.env`, `.env.test`, generated builds, or `node_modules`.
