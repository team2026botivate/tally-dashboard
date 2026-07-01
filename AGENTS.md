# Tally ERP Next.js Migration

## Project Structure
- Next.js App Router in `src/`
- Agent WebSocket server in `agent-server/`
- Prisma schema in `prisma/`

## Key Commands
- `npm run dev` — start dev server
- `npm run build` — type-check + production build
- `npm run db:generate` — regenerate Prisma Client
- `npm run db:migrate` — run Prisma migrations
- `npm run db:push` — push schema to DB

## Agent Server
- `cd agent-server && npm run dev` — start WebSocket gateway
- Sits between Tally instances and Next.js API
- Calls Next.js API routes for DB writes (PATCH for status, POST for sync triggers)

## Build Notes
- After modifying any file, run `npm run build` to verify
- `tsconfig.json` excludes `agent-server`, `backend`, `frontend` directories
- `next.config.ts` has `serverExternalPackages: ["bcryptjs"]`

## Important Patterns
- Edge middleware (`src/middleware.ts`) validates JWT from httpOnly cookie
- Auth endpoints use cookie-based sessions (not localStorage)
- Sync engine in `src/lib/sync-engine.ts` runs fire-and-forget in API routes
- Dashboard components use client-side data fetching with `useAuth` context
