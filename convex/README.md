# Convex backend

This directory holds the Convex schema, functions, crons and workflows. It is
driven by the Convex CLI from the repo root (not a pnpm workspace package).

## First-time setup (manual — needs your Convex account)

```bash
# from the repo root
pnpm convex:dev      # runs `npx convex dev`
```

The first run will prompt you to log in and create/link a deployment. It writes
a local `.env.local` (with `CONVEX_URL` / `NEXT_PUBLIC_CONVEX_URL`) and generates
`convex/_generated/` (git-ignored). Leave `convex dev` running while developing —
it pushes code and regenerates types on change.

## Environment variables

Set these in the Convex dashboard (Settings → Environment Variables). See the
root `.env.example` for the full list (Anthropic keys, `WORKER_SECRET`,
`ADMIN_EMAILS`, `CLERK_JWT_ISSUER_DOMAIN`, …).
