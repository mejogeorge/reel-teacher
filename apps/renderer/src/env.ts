import { parseEnv, rendererEnvSchema, type RendererEnv } from "@wordcast/shared";

/** Validated renderer env, parsed lazily and cached. Throws on first use if invalid. */
let cached: RendererEnv | undefined;
export function getRendererEnv(): RendererEnv {
  if (!cached) {
    cached = parseEnv(rendererEnvSchema, process.env, "renderer");
  }
  return cached;
}
