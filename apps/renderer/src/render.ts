import { createRequire } from "node:module";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { estimateTimingSegments, type RenderRequest, type VideoInputProps } from "@wordcast/shared";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";

const require = createRequire(import.meta.url);
const MUSIC_VOLUME = 0.12;
const COMPOSITION_ID = "WordVideo";

/** Locate packages/video/src/entry.ts from the installed workspace package. */
function videoEntryPoint(): string {
  const pkgJson = require.resolve("@wordcast/video/package.json");
  return path.join(path.dirname(pkgJson), "src", "entry.ts");
}

let cachedServeUrl: string | undefined;
export async function ensureBundle(): Promise<string> {
  if (!cachedServeUrl) {
    cachedServeUrl = await bundle({ entryPoint: videoEntryPoint() });
  }
  return cachedServeUrl;
}

export interface RenderResult {
  outDir: string;
  videoPath: string;
  thumbPath: string;
  durationSec: number;
  bytes: number;
  width: number;
  height: number;
}

export interface RenderOptions {
  music?: { url: string } | null;
  onProgress?: (progress: number) => void;
}

/** Render a job's MP4 + thumbnail into a fresh temp directory. */
export async function renderJob(
  request: RenderRequest,
  options: RenderOptions = {},
): Promise<RenderResult> {
  const serveUrl = await ensureBundle();

  const inputProps: VideoInputProps = {
    content: request.content,
    themeId: request.themeId,
    brandHandle: request.brandHandle,
    voice: { segments: estimateTimingSegments(request.content) },
    music:
      request.backgroundMusicMode !== "none" && options.music
        ? { src: options.music.url, volume: MUSIC_VOLUME }
        : undefined,
  };

  const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps });
  const outDir = await fs.mkdtemp(path.join(os.tmpdir(), "wordcast-render-"));
  const videoPath = path.join(outDir, "video.mp4");
  const thumbPath = path.join(outDir, "thumb.png");

  await renderMedia({
    serveUrl,
    composition,
    codec: "h264",
    crf: 20,
    outputLocation: videoPath,
    inputProps,
    onProgress: options.onProgress ? ({ progress }) => options.onProgress?.(progress) : undefined,
  });

  await renderStill({
    serveUrl,
    composition,
    frame: Math.floor(composition.durationInFrames * 0.3),
    output: thumbPath,
    inputProps,
  });

  const stat = await fs.stat(videoPath);
  return {
    outDir,
    videoPath,
    thumbPath,
    durationSec: composition.durationInFrames / composition.fps,
    bytes: stat.size,
    width: composition.width,
    height: composition.height,
  };
}

const MAX_BYTES = 100 * 1024 * 1024;
const MIN_SECONDS = 8;
const MAX_SECONDS = 70;

/** Validate the render output; throws on anything out of spec. */
export function validateOutput(result: RenderResult): void {
  if (result.bytes <= 0 || result.bytes > MAX_BYTES) {
    throw new Error(`video size out of range: ${result.bytes} bytes`);
  }
  if (result.width !== 1080 || result.height !== 1920) {
    throw new Error(`unexpected dimensions: ${result.width}x${result.height}`);
  }
  if (result.durationSec < MIN_SECONDS || result.durationSec > MAX_SECONDS) {
    throw new Error(`duration out of range: ${result.durationSec.toFixed(1)}s`);
  }
}
