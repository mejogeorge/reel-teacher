# WordCast

An automated **Word-of-the-Day** vertical-video pipeline. Every day it finds a
trending-but-learner-appropriate English word, enriches it (definition, examples,
narration, caption, hashtags), renders a 1080×1920 MP4 with on-screen text (and
optional voice/music), and surfaces everything in an admin dashboard.

Publishing to Instagram/Facebook/YouTube is **Phase 2** (out of scope); the data
model is kept Phase-2-ready.

## Stack

| Concern | Choice |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Backend / DB / cron / storage | Convex (`@convex-dev/workflow`, `@convex-dev/rate-limiter`) |
| Dashboard | Next.js (App Router) + shadcn/ui + Tailwind, Convex Auth (email + password) |
| Video | Remotion (frame-driven) + `@remotion/player` preview |
| LLM | Anthropic SDK (Claude) — word pick, content, safety |
| Voiceover (TTS) | **Deferred** — videos are silent/text-only; voice is pluggable (see below) |
| Render worker | Node + Chromium + ffmpeg in Docker (runs locally) |

## Layout

```
apps/web/        Next.js admin dashboard
apps/renderer/   Node worker: Remotion render + upload (Docker)
packages/shared/ zod schemas, types, constants, pure utils (trend, timing, dictionary, state machine)
packages/video/  Remotion compositions, themes, scenes
packages/config/ shared tsconfig / eslint / prettier
convex/          Convex backend (schema, functions, crons, workflow)
```

## Pipeline

```
cron tick → startDailyRun (idempotent by date) → workflow:
  discoverCandidates (RSS → score) → pickWord (Claude, fallback list)
  → fetchDefinition → generateContent (Claude, zod-validated) → safetyCheck (fail-closed)
  → approve (auto after delay, or manual) → enqueue renderJob
renderer worker: claim (lease) → render MP4 + thumbnail → upload → word = rendered
```

## Prerequisites

- Node ≥ 22, pnpm 10
- Accounts: **Convex**, and an LLM key (**Anthropic** or **Gemini**). Auth is built-in (Convex Auth).
- For the worker: Docker (or a machine with Chromium + ffmpeg)

## Setup

```bash
pnpm install

# 1. Link your Convex deployment (interactive, first time). Generates
#    convex/_generated and writes .env.local. Leave running while developing.
pnpm convex:dev

# 2. Set up Convex Auth signing keys (email+password login, no third party):
npx @convex-dev/auth        # sets JWT_PRIVATE_KEY, JWKS, SITE_URL on the deployment

# 3. In the Convex dashboard (Settings → Environment Variables) set an LLM key
#    and admin config: GEMINI_API_KEY (or ANTHROPIC_API_KEY), WORKER_SECRET,
#    ADMIN_EMAILS (comma-separated). Optional: WORDNIK_API_KEY. See root .env.example.

# 4. Dashboard env: cp apps/web/.env.example apps/web/.env.local and set
#    NEXT_PUBLIC_CONVEX_URL. Then:
pnpm --filter @wordcast/web dev        # http://localhost:3000

# 5. Sign up at /login with an email in ADMIN_EMAILS, then open Today and click
#    "Seed" (settings + blocklist + fallback words).

# 6. Worker env: cp apps/renderer/.env.example apps/renderer/.env and fill
#    CONVEX_URL + WORKER_SECRET (matching the dashboard). Then:
docker compose -f apps/renderer/docker-compose.yml up --build
#    (or, locally: pnpm --filter @wordcast/renderer build && pnpm --filter @wordcast/renderer start)
```

## Checks

```bash
pnpm typecheck && pnpm lint && pnpm test    # workspace gate (shared+video unit tests)

# Convex layer (after `pnpm convex:dev` has generated _generated):
pnpm typecheck:convex && pnpm test:convex   # schema compiles + convex-test auth guards

# Video render (proves the composition end-to-end):
pnpm --filter @wordcast/video render:fixture   # out/fixture.mp4
pnpm --filter @wordcast/video studio           # interactive Remotion Studio
```

## Deploy

- **Convex:** `pnpm convex:deploy` (or connect the repo in the Convex dashboard). Set prod env vars there.
- **Dashboard (Vercel):** import `apps/web`, set `NEXT_PUBLIC_CONVEX_URL`. Note: Vercel **Hobby is non-commercial** — use Pro if this becomes a business.
- **Worker:** the `apps/renderer` Docker image on any always-on host:
  - **Local:** `docker compose -f apps/renderer/docker-compose.yml up -d` on a machine that stays awake. Missed days auto-catch-up when it reconnects.
  - **Railway / Fly.io / VPS:** deploy the Dockerfile; set `CONVEX_URL`, `WORKER_SECRET`, `WORKER_ID`.

## Costs (roughly, ~1 video/day)

- **Anthropic:** a few LLM calls/day (pick + content + safety) → cents/month.
- **Convex:** free tier is ample at this volume.
- **Worker host:** the only real recurring cost — free if local, ~$5–20/mo managed.

## Reliability posture (Phase 1)

- ✅ Env validated with zod at startup (web/renderer/convex), fail-fast.
- ✅ External calls: timeouts, per-feed isolation, zod-validated responses; LLM retries with error feedback.
- ✅ Idempotent runs (keyed by date); render jobs keyed by word + renderVersion.
- ✅ State transitions guarded (`assertTransition`); illegal transitions throw.
- ✅ Lease-based job claiming + heartbeat + 5-min requeue cron; dead-letter after max attempts.
- ✅ Fail-closed safety; `events` audit log; webhook alerts on run failure + 6h watchdog.
- ✅ `pipelinePaused` kill switch; `@convex-dev/rate-limiter` cap on LLM spend.
- ✅ Worker functions require `WORKER_SECRET` (constant-time); admin functions require a Convex Auth admin (ADMIN_EMAILS).

## Deferred in Phase 1 (pluggable / easy to add later)

- **TTS voiceover:** videos are currently silent with on-screen text; scene timing is
  estimated from narration text. Add a TTS adapter + key (OpenAI/ElevenLabs/cloud) and
  fill `VoiceSegment.src` to turn narration on with no other changes.
- **Auto-sourced music:** `backgroundMusicMode: "auto"` currently behaves like "library".
  Uploaded tracks work today; wire a free-music API (Pixabay/Jamendo) to enable auto.
- **1280×720 thumbnail** variant (for future YouTube) — only the 1080×1920 still is produced.

## Licences

- **Remotion:** free for individuals and companies ≤ 3 people; larger companies need a
  company licence — <https://remotion.dev/license>.
- **Vercel Hobby:** non-commercial only (Pro for business).
- Background music must be royalty-free; each track stores source, licence URL and attribution.

## Status

Milestones M0–M8 complete. Pure logic (state machine, trend scoring, dictionary,
timing, schemas) is unit-tested (36 tests); video render is verified locally; the
Convex backend + worker loop verify once a deployment is linked.
