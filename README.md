# TallyPrime Remote Data Gateway

A secure integration system for connecting SaaS web applications to local TallyPrime installations running on remote client PCs. Uses a lightweight local agent that tunnels data over an outbound-only WebSocket connection to a cloud server. **No inbound ports, port-forwarding, or firewalls need to be configured on the client PC.**

## Architecture

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│  TallyPrime  │◄───►│  Local Agent     │────►│  Agent       │
│  (Port 9000) │     │  (customer PC)   │ WS  │  Server      │
└──────────────┘     └──────────────────┘     │  (Port 3001) │
                                              └──────┬───────┘
                                                     │ HTTP
                                              ┌──────▼───────┐
                                              │  Next.js     │
                                              │  (Port 3000) │
                                              └──────┬───────┘
                                                     │ Prisma
                                              ┌──────▼───────┐
                                              │  Supabase    │
                                              │  PostgreSQL  │
                                              └──────────────┘
```

## Project Structure

| Directory | Purpose |
|-----------|---------|
| `src/` | Next.js App Router — pages, API routes, components |
| `agent-server/` | WebSocket gateway server (Express + Socket.IO) |
| `agent/` | Client-side agent for customer PCs |
| `prisma/` | Database schema, migrations, seed |
| `docs/` | Architecture documentation |
| `scripts/` | Utility scripts |

## Quick Start

### 1. Start the Next.js app
```bash
npm install
npm run dev
# → http://localhost:3000
```

### 2. Start the WebSocket gateway (for remote agents)
```bash
cd agent-server
npm install
npm run dev
# → http://localhost:3001
```

### 3. Deploy the client agent (on the remote Windows PC running Tally)
Copy the `agent/` directory to the target PC, then:
```bash
cd agent
npm install
# Edit .env with your gateway credentials
npm run start
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
| `TALLY_HOST` | Tally instance IP (for direct mode) |
| `TALLY_PORT` | Tally XML port (default 9000) |
| `AGENT_SERVICE_URL` | Agent WebSocket server URL |
