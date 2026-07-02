# TallyPrime Next.js

Next.js application for integrating with local TallyPrime installations. Deploys to Vercel (serverless).

## Architecture

```
┌──────────────┐         ┌────────────────────┐
│  TallyPrime  │◄────────│  Next.js on Vercel │
│  (Port 9000) │  HTTP   │  (API Routes)      │
└──────────────┘         └────────┬───────────┘
                                  │ Prisma
                           ┌──────▼───────────┐
                           │  Supabase        │
                           │  PostgreSQL      │
                           └──────────────────┘
```

The Next.js app connects directly to TallyPrime via HTTP XML requests — no intermediate agent or WebSocket gateway required.

## Project Structure

| Directory | Purpose |
|-----------|---------|
| `src/` | Next.js App Router — pages, API routes, components |
| `prisma/` | Database schema, migrations, seed |

## Quick Start

```bash
npm install
npm run dev
# → http://localhost:3000
```

## Key Commands

```bash
npm run dev          # Start Next.js dev server
npm run build        # Type-check + production build
npm run db:generate  # Regenerate Prisma Client
npm run db:migrate   # Run database migrations
npm run db:push      # Push schema to database
```

## Configuration

Set these in `.env.local`:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Supabase PostgreSQL connection string (pooled) |
| `DIRECT_URL` | Direct DB connection for migrations |
| `JWT_SECRET` | Secret for signing auth tokens |
| `TALLY_HOST` | Tally instance IP |
| `TALLY_PORT` | Tally XML port (default 9000) |



cd agent-server
npm install
$env:CLOUD_URL="https://tallyprimeone.vercel.app"; npm start