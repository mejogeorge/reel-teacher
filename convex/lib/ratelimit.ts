import { HOUR, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";

/**
 * Rate limiter to cap LLM spend. Token bucket: sustained ~200 calls/hour with a
 * burst capacity of 30. Shared across word-pick, content and safety calls.
 */
export const rateLimiter = new RateLimiter(components.rateLimiter, {
  llm: { kind: "token bucket", rate: 200, period: HOUR, capacity: 30 },
});
