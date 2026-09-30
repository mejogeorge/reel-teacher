// Standalone local render of the PremiumReel composition → MP4 (no Convex, no upload).
// Usage: node apps/renderer/scripts/renderReel.mjs [outputPath]
import { createRequire } from "node:module";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { ensureBrowser, renderMedia, selectComposition } from "@remotion/renderer";

const require = createRequire(import.meta.url);
const pkgJson = require.resolve("@wordcast/video/package.json");
const entryPoint = path.join(path.dirname(pkgJson), "src", "entry.ts");
const out = process.argv[2] ?? path.resolve(process.cwd(), "persuasion-demo/reel.mp4");

console.log("ensuring browser…");
await ensureBrowser();

console.log("bundling video package…");
const serveUrl = await bundle({ entryPoint });

console.log("selecting composition PremiumReel…");
const composition = await selectComposition({ serveUrl, id: "PremiumReel" });
console.log(`  ${composition.width}x${composition.height} @ ${composition.fps}fps, ${composition.durationInFrames} frames`);

console.log("rendering…");
await renderMedia({
  serveUrl,
  composition,
  codec: "h264",
  crf: 20,
  outputLocation: out,
  onProgress: ({ progress }) => process.stdout.write(`\r  ${(progress * 100).toFixed(0)}%   `),
});

console.log(`\n✓ wrote ${out}`);
