# WordCast

An automated **Word-of-the-Day** vertical-video pipeline. Every day it finds a
trending-but-learner-appropriate English word, enriches it (definition, examples,
narration, caption, hashtags), voices it with free local TTS, renders a 1080×1920
MP4 with voice + background music, and surfaces everything in an admin dashboard.

Publishing to Instagram/Facebook/YouTube is **Phase 2** (out of scope), but the data
model is kept Phase-2-ready.

## Stack

| Concern | Choice |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Backend / DB / cron / storage | Convex (+ `@convex-dev/workflow`) |
| Dashboard | Next.js (App Router) + shadcn/ui + Tailwind, Clerk auth |
| Video | Remotion (frame-driven) + `@remotion/player` preview |
| TTS | kokoro-js (Kokoro-82M, local, free) |
| LLM | Anthropic SDK (Claude) — content, word pick, safety |
| Render worker | Node + Chromium + ffmpeg in Docker (runs locally) |

## Layout

```
apps/web/        Next.js admin dashboard
apps/renderer/   Node worker: TTS + Remotion render + upload
packages/shared/ zod schemas, types, constants, pure utils
packages/video/  Remotion compositions, themes, scenes
packages/config/ shared tsconfig / eslint / prettier
convex/          Convex backend (schema, functions, crons, workflows)
```

## Prerequisites

- Node ≥ 22, pnpm 10
- Accounts (added as milestones need them): Convex, Clerk, Anthropic API key

## Getting started

```bash
pnpm install

# Link your Convex deployment (interactive, first time only)
pnpm convex:dev            # writes .env.local + convex/_generated

# Run the dashboard (needs Clerk keys — see apps/web/.env.example)
pnpm --filter @wordcast/web dev
```

Copy each `.env.example` to `.env.local` (web) / `.env` (renderer) and fill in keys.
Convex-side variables (Anthropic, `WORKER_SECRET`, `ADMIN_EMAILS`, `CLERK_JWT_ISSUER_DOMAIN`)
go in the **Convex dashboard**, not a local file — see the root `.env.example`.

## Checks

```bash
pnpm typecheck   # tsc across all packages
pnpm lint        # eslint
pnpm test        # vitest
```

CI (`.github/workflows/ci.yml`) runs all three on push / PR to `main`.

## Licence notes

- **Remotion** is free for individuals and companies of ≤ 3 people. Larger companies
  need a Remotion company licence — see <https://remotion.dev/license>.
- **Vercel Hobby** is for non-commercial use. If WordCast becomes a business, a Vercel
  Pro plan is required.
- **kokoro-js / Kokoro-82M** is Apache-2.0.
- Background music must be royalty-free; each track stores its source, licence URL and
  attribution. Auto-sourced music is pulled only from free-licensed providers.

## Status

Built milestone by milestone (M0 → M8). See `.claude/plans/` for the plan. Current: **M0 (scaffold)**.
