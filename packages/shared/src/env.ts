import { z } from "zod";

/** Thrown when an environment fails validation — fail fast with a readable message. */
export class EnvValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvValidationError";
  }
}

/**
 * Validate an env-like object against a zod schema, throwing a readable, aggregated
 * error listing every missing/invalid variable at once.
 */
export function parseEnv<T extends z.ZodTypeAny>(
  schema: T,
  source: Record<string, string | undefined>,
  label: string,
): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new EnvValidationError(`Invalid ${label} environment:\n${issues}`);
  }
  return result.data;
}

/** Renderer worker env. */
export const rendererEnvSchema = z.object({
  CONVEX_URL: z.string().url(),
  WORKER_SECRET: z.string().min(1),
  WORKER_ID: z.string().min(1).default("local-worker-1"),
  RENDER_CONCURRENCY: z.coerce.number().int().min(1).default(1),
  MODEL_CACHE_DIR: z.string().min(1).default("./.model-cache"),
});
export type RendererEnv = z.infer<typeof rendererEnvSchema>;

/**
 * Convex-side env (set in the Convex dashboard). The LLM provider is chosen at
 * runtime: Anthropic if ANTHROPIC_API_KEY is set, else Gemini if GEMINI_API_KEY
 * is set. At least one must be present for the pipeline's LLM steps.
 */
export const convexEnvSchema = z.object({
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().min(1).default("claude-sonnet-4-6"),
  ANTHROPIC_MODEL_FAST: z.string().min(1).default("claude-haiku-4-5-20251001"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().min(1).default("gemini-flash-lite-latest"),
  GEMINI_MODEL_FAST: z.string().min(1).default("gemini-flash-lite-latest"),
  WORDNIK_API_KEY: z.string().optional(),
  WORKER_SECRET: z.string().min(1),
  ADMIN_EMAILS: z.string().optional(),
  // Instagram publishing (Phase 2). Absent = publishing disabled.
  IG_USER_ID: z.string().optional(),
  IG_ACCESS_TOKEN: z.string().optional(),
  IG_GRAPH_VERSION: z.string().min(1).default("v21.0"),
  // Facebook Page publishing (same Meta app + Page token). Absent = disabled.
  FB_PAGE_ID: z.string().optional(),
  FB_ACCESS_TOKEN: z.string().optional(),
});
export type ConvexEnv = z.infer<typeof convexEnvSchema>;

/** Server-side env consumed by the Next.js dashboard. */
export const webServerEnvSchema = z.object({
  NEXT_PUBLIC_CONVEX_URL: z.string().url(),
});
export type WebServerEnv = z.infer<typeof webServerEnvSchema>;
