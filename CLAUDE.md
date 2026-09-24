# WordCast — Conventions

Word-of-the-Day vertical-video pipeline. Monorepo (pnpm + Turborepo), TypeScript
strict everywhere. Read `.claude/plans/*` for the milestone build plan.

## Structure

- `packages/shared` — zod schemas, types, constants, pure utils. **Depends on nothing internal.**
- `packages/video` — Remotion compositions/themes/scenes. Depends on `shared`.
- `packages/config` — shared tsconfig / eslint / prettier presets.
- `apps/web` — Next.js admin dashboard (Vercel). Depends on `shared`, `video`.
- `apps/renderer` — Node worker: Kokoro TTS + Remotion render + upload (Docker). Depends on `shared`, `video`.
- `convex/` — Convex backend (schema, functions, crons, workflows). Driven by the Convex CLI from repo root.

**No app imports another app.** Chromium + ffmpeg + Kokoro live ONLY in `apps/renderer` —
never in Convex or Vercel.

## TypeScript

- `strict: true`; **no `any`** (use `unknown` + zod). No non-null assertions without an explanatory comment.
- zod schemas live in `packages/shared`; infer types with `z.infer` — never duplicate a type by hand.
- Inline type imports (`import { type Foo }`) — enforced by lint.

## Convex

- Public functions validate args with `v.*`.
- Admin-only functions call `requireAdmin(ctx)`; worker functions call `requireWorker(args.secret)`
  (constant-time compare). Internal logic lives in `internal*` functions.
- Actions needing Node APIs start with `"use node"` and live in separate files.

## Validation & resilience

- zod at every boundary: env, external APIs, LLM output, worker I/O.
- Every external call: timeout, retry with backoff + jitter, zod-parsed response, error event, test.
- Pipeline steps are idempotent (runs keyed by date, jobs keyed by word + renderVersion).
- State transitions go through `assertTransition(from, to)` — illegal transitions throw.
- Fail closed on safety.

## Remotion

- Motion ONLY via `useCurrentFrame` / `interpolate` / `spring`.
- **Never** use CSS `@keyframes`, `transition`, or `animation` for motion — non-deterministic renders.
- CSS is for layout/styling only.

## React

- No business logic in components — put it in `shared` (pure) or Convex.

## Workflow

- Small commits per milestone; conventional commit messages.
- Every milestone: `pnpm typecheck && pnpm lint && pnpm test` must pass before committing.
