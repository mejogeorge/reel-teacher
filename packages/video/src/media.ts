import { staticFile } from "remotion";

/** Resolve an audio/media src: absolute URLs pass through, bare names use staticFile(). */
export function resolveSrc(src: string): string {
  return /^(https?:|data:|blob:|file:|\/)/.test(src) ? src : staticFile(src);
}
