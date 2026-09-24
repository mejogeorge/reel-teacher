import { parseEnv, webServerEnvSchema, type WebServerEnv } from "@wordcast/shared";

/**
 * Validated server-side env for the dashboard, parsed lazily and cached.
 * Call from server components / route handlers — not client code.
 */
let cached: WebServerEnv | undefined;
export function getWebServerEnv(): WebServerEnv {
  if (!cached) {
    cached = parseEnv(webServerEnvSchema, process.env, "web server");
  }
  return cached;
}
