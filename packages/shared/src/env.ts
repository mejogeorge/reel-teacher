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

/** Convex-side env (set in the Convex dashboard). */
export const convexEnvSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL: z.string().min(1).default("claude-sonnet-4-6"),
  ANTHROPIC_MODEL_FAST: z.string().min(1).default("claude-haiku-4-5-20251001"),
  WORDNIK_API_KEY: z.string().optional(),
  WORKER_SECRET: z.string().min(1),
  ADMIN_EMAILS: z.string().optional(),
  CLERK_JWT_ISSUER_DOMAIN: z.string().min(1),
});
export type ConvexEnv = z.infer<typeof convexEnvSchema>;

/** Server-side env consumed by the Next.js dashboard. */
export const webServerEnvSchema = z.object({
  NEXT_PUBLIC_CONVEX_URL: z.string().url(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
});
export type WebServerEnv = z.infer<typeof webServerEnvSchema>;
