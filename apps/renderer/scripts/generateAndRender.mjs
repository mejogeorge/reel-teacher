// Local end-to-end: ElevenLabs voice (with word-timestamps) -> auto-synced
// captions -> Remotion render -> MP4. No Convex, no upload.
//
// Run:
//   ELEVENLABS_API_KEY=sk_... ELEVENLABS_VOICE_ID=... \
//     node apps/renderer/scripts/generateAndRender.mjs
import { promises as fs } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { ensureBrowser, renderMedia, selectComposition } from "@remotion/renderer";

const KEY = process.env.ELEVENLABS_API_KEY;
const VOICE = process.env.ELEVENLABS_VOICE_ID;
const MODEL = process.env.ELEVENLABS_MODEL ?? "eleven_v3";
if (!KEY || !VOICE) throw new Error("set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID");

// Each beat: `tag` shapes the ElevenLabs delivery (never shown); `spoken` is
// voiced; the display fields (lead/big/line/sub/bubble) are the on-screen text.
const WORD = "PERSUASION";
const BEATS = [
  { tag: "[excited]", spoken: "Word of the day… PERSUASION!", lead: "Word of the day…", big: "PERSUASION", icon: "megaphone", anim: "pop" },
  { tag: "[sarcastic]", spoken: "Not persuation, okay? Spelling ko bhi persuade karna padega.", line: "Not “persuation,” okay?", sub: "Spelling ko bhi persuade karna padega.", icon: "spell-check", anim: "tilt" },
  { tag: "[confident]", spoken: "Persuasion means convincing someone to do something they never planned to do.", line: "Persuasion — convincing someone to do something they never planned to do.", icon: "book-open", anim: "rise" },
  { tag: "[mischievous]", spoken: "Best example? Indian moms.", lead: "Best example?", big: "Indian moms", icon: "heart", anim: "pop" },
  { tag: "[sweet, imitating an Indian mom]", spoken: "Beta… bas ek aur roti.", who: "Mom", bubbleSide: "mom", bubble: "Beta… bas ek aur roti.", icon: "utensils", anim: "fromL" },
  { tag: "[firm]", spoken: "No, Mummy, I’m full.", who: "Me", bubbleSide: "me", bubble: "No, Mummy, I’m full.", icon: "hand", anim: "fromR" },
  { tag: "[wounded, emotional]", spoken: "Maine itne pyaar se banayi thi…", who: "Mom", bubbleSide: "mom", bubble: "Maine itne pyaar se banayi thi…", icon: "heart", anim: "fromL" },
  { tag: "[deadpan]", spoken: "Four rotis later… that is persuasion.", lead: "Four rotis later…", big: "that is persuasion.", icon: "megaphone", anim: "drop" },
  { tag: "[teacher tone]", spoken: "Use it like this: After a lot of persuasion, my dad agreed to the Goa trip.", line: "“After a lot of persuasion, my dad agreed to the Goa trip.”", icon: "plane", anim: "rise" },
  { tag: "[whispering]", spoken: "A lot means three months of begging.", line: "“A lot” = three months of begging.", icon: "alarm-clock", anim: "whisper" },
  { tag: "[playful]", spoken: "Follow for more words.", big: "Follow for more words", icon: "sparkles", anim: "pop" },
  { tag: "[teasing]", spoken: "I’m not persuading you… just suggesting.", line: "I’m not persuading you… just suggesting.", icon: "smile", anim: "tilt" },
];

// Build the narration string sent to ElevenLabs (tags + spoken, in order).
const narration = BEATS.map((b) => `${b.tag} ${b.spoken}`).join("\n");

console.log(`generating voice via ${MODEL}…`);
const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}/with-timestamps`, {
  method: "POST",
  headers: { "xi-api-key": KEY, "Content-Type": "application/json" },
  body: JSON.stringify({
    text: narration,
    model_id: MODEL,
    voice_settings: { stability: 0.5, similarity_boost: 0.75 },
  }),
});
if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);
const payload = await res.json();
const align = payload.alignment ?? payload.normalized_alignment;
if (!payload.audio_base64 || !align) throw new Error("no audio/alignment in response");

// Write the mp3 into the video package's public dir so staticFile("voice.mp3") resolves.
const require = createRequire(import.meta.url);
const videoRoot = path.dirname(require.resolve("@wordcast/video/package.json"));
const publicMp3 = path.join(videoRoot, "public", "voice.mp3");
await fs.writeFile(publicMp3, Buffer.from(payload.audio_base64, "base64"));
console.log(`wrote ${publicMp3}`);

// Derive per-beat start times by locating each beat's spoken text in the
// character-timed alignment (search forward from a running cursor; robust to
// the tag characters that precede each spoken line).
const chars = align.characters;
const starts = align.character_start_times_seconds;
const ends = align.character_end_times_seconds ?? starts;
const full = chars.join("");
const fullLower = full.toLowerCase();
let cursor = 0;
const segments = BEATS.map((b, i) => {
  const key = b.spoken.slice(0, 14).toLowerCase();
  let at = fullLower.indexOf(key, cursor);
  if (at < 0) at = fullLower.indexOf(b.spoken.slice(0, 6).toLowerCase(), cursor);
  const startSec = at >= 0 ? starts[at] : (starts[cursor] ?? 0);
  if (at >= 0) cursor = at + 1;
  const { tag, spoken, ...display } = b;
  return { startSec: Number(startSec.toFixed(3)), ...display };
});
const durationSec = Number((ends[ends.length - 1] ?? 39).toFixed(2));

console.log("derived caption timings (s):", segments.map((s) => s.startSec).join(", "));
console.log(`audio duration: ${durationSec}s`);

const inputProps = { word: WORD, audioSrc: "voice.mp3", durationSec, brandHandle: "@wordcast", segments };

console.log("ensuring browser + bundling…");
await ensureBrowser();
const serveUrl = await bundle({ entryPoint: path.join(videoRoot, "src", "entry.ts") });
const composition = await selectComposition({ serveUrl, id: "PremiumReel", inputProps });
console.log(`rendering ${composition.durationInFrames} frames…`);
const out = path.resolve(process.cwd(), "persuasion-demo/reel-eleven.mp4");
await renderMedia({
  serveUrl,
  composition,
  codec: "h264",
  crf: 20,
  outputLocation: out,
  inputProps,
  onProgress: ({ progress }) => process.stdout.write(`\r  ${(progress * 100).toFixed(0)}%   `),
});
console.log(`\n✓ wrote ${out}`);
