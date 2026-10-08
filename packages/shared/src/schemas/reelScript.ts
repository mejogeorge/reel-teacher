import { z } from "zod";
import type { WordContent } from "./content.js";
import type { ReelAnim, ReelSegment } from "./premiumReel.js";

/** Icon names available to the reel (must match keys in video/src/icons.tsx). */
export const REEL_ICONS = [
  "megaphone", "spell-check", "book-open", "heart", "utensils", "hand", "plane",
  "alarm-clock", "sparkles", "smile", "mountain", "sun", "moon", "star", "cloud",
  "zap", "flame", "droplet", "leaf", "music", "camera", "map-pin", "compass",
  "trophy", "crown", "gift", "coffee", "brain", "lightbulb", "rocket", "globe",
  "users", "message-circle", "thumbs-up", "quote", "eye", "clock", "calendar",
  "key", "lock", "shield", "target", "flag", "anchor", "umbrella", "snowflake",
] as const;

/** Entrance animations available per beat (must match reelAnimSchema). */
export const REEL_ANIMS = ["pop", "rise", "tilt", "drop", "whisper", "fromL", "fromR"] as const;

/**
 * One beat of the generated script (untimed — start times are added later from
 * ElevenLabs word alignment). `tag` shapes the voice delivery and is NEVER shown
 * on screen; `spoken` is voiced; the display fields are the on-screen caption.
 */
export const reelBeatSchema = z.object({
  tag: z.string().optional(), // legacy single delivery cue (fallback if no `voice`)
  voice: z.string().optional(), // dramatic ElevenLabs line: delivery tags + inline cues
  spoken: z.string().min(1), // clean words (on-screen fallback + timing alignment)
  lead: z.string().optional(), // small intro line above the headline
  big: z.string().optional(), // punchy short headline (gradient)
  line: z.string().optional(), // a full sentence
  sub: z.string().optional(), // small aside below
  who: z.string().optional(), // dialogue speaker label
  bubble: z.string().optional(), // dialogue text (shown in a colored bubble)
  bubbleSide: z.enum(["a", "b"]).optional(), // two speaker colours (A/B), nothing more
  icon: z.string().optional(), // sanitized against REEL_ICONS downstream
  anim: z.string().optional(), // sanitized against REEL_ANIMS downstream
});
export type ReelBeat = z.infer<typeof reelBeatSchema>;

export const reelScriptSchema = z.object({
  beats: z.array(reelBeatSchema).min(6).max(14),
});
export type ReelScript = z.infer<typeof reelScriptSchema>;

/** A scriptwriter character. The voice timbre stays the same (one ElevenLabs
 * voice), but the persona, energy, and example scenario change per word so reels
 * don't all feel like the same "playful girl + Indian mom" bit. */
interface Persona {
  name: string;
  style: string;
  scenario: string;
}

const DEFAULT_PERSONA: Persona = {
  name: "a quick-witted stand-up comedian",
  style: "Sharp, playful, sarcastic — setup then punchline, with great comic timing.",
  scenario: "a short stand-up bit riffing on how people use (or misuse) the word",
};

/** Rotating cast — one is chosen per word (see pickPersona). Keep clean + fun. */
export const REEL_PERSONAS: Persona[] = [
  DEFAULT_PERSONA,
  {
    name: "an over-caffeinated hype friend",
    style: "You are WAY too excited about everything — fast, loud, voice cracking with enthusiasm.",
    scenario: "wildly overreacting to a tiny everyday win",
  },
  {
    name: "a deadpan, unbothered Gen-Z teen",
    style: "Flat, dry, sarcastic, almost zero energy on purpose — the comedy is how little you care.",
    scenario: "a dry, relatable take on daily life (texting, school, chores)",
  },
  {
    name: "a grand dramatic theatre narrator",
    style: "Booming, Shakespearean, overly serious — you treat a mundane thing as an epic tragedy.",
    scenario: "narrating a tiny everyday event like an epic saga",
  },
  {
    name: "a nerdy professor who gets WAY too into it",
    style: "You start calm and academic, then spiral into obsessive excitement, talking faster and faster.",
    scenario: "geeking out over the word's origin or a fun fact",
  },
  {
    name: "a gossipy best friend spilling tea",
    style: "Conspiratorial, whispery, scandalised, leaning in close like it's a secret.",
    scenario: "framing it as juicy gossip about 'someone'",
  },
  {
    name: "a smooth, confident hype narrator",
    style: "Cool, rhythmic, street-smart swagger — effortless, like the word is the coolest thing ever.",
    scenario: "flexing the word with total swagger",
  },
  {
    name: "a wholesome grandma telling a cozy story",
    style: "Warm, slow, loving, nostalgic, with little chuckles.",
    scenario: "a gentle 'back in my day' anecdote",
  },
  {
    name: "a moody noir detective narrating a case",
    style: "Low, suspenseful, clipped sentences, smoky late-night vibe.",
    scenario: "treating the word like a mystery you're cracking",
  },
  {
    name: "an over-the-top sports commentator",
    style: "Breathless play-by-play, rising excitement, crowd-roar energy.",
    scenario: "calling the word like the winning moment of a match",
  },
];

/** Deterministically pick a persona from the word (FNV-1a → even spread, reproducible). */
export function pickPersona(word: string): Persona {
  let h = 2166136261;
  const w = word.toLowerCase();
  for (let i = 0; i < w.length; i++) {
    h ^= w.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return REEL_PERSONAS[(h >>> 0) % REEL_PERSONAS.length] ?? DEFAULT_PERSONA;
}

/**
 * Prompt for the reel scriptwriter. A persona is chosen per word so every reel
 * has a distinct character, energy, and example scenario (not always the
 * mom/child bit) — while keeping the dramatic, over-acted delivery.
 */
export function buildReelScriptPrompt(content: WordContent): string {
  const persona = pickPersona(content.word);
  return `You are ${persona.name}, making a dramatic, funny "Word of the Day" reel for Instagram/Facebook. ${persona.style} OVER-ACT — more drama than necessary — and make it FUN and memorable. Commit FULLY to this persona; it is specific to this word.

WORD: ${content.word}
PART OF SPEECH: ${content.partOfSpeech}
MEANING: ${content.simpleMeaning}
EXAMPLES: ${content.examples.join(" | ")}
SYNONYMS: ${content.synonyms.join(", ")}

Write a 30–45 second script as an ORDERED list of 8–12 "beats". Structure: a punchy hook that reveals the word → an honest one-line definition → a FUNNY example in your persona's style (${persona.scenario}; a short 2–4 line character exchange works great) → one clean usage sentence → a playful call-to-action to follow.

IMPORTANT — VARIETY: Do NOT use a mother-and-child / parent / family-dinner / "beta, one more roti" scene. That bit is overused and banned. Invent a FRESH scenario and FRESH characters that fit THIS persona and word every time (e.g. a coach and player, a barista and customer, a detective and suspect, two coworkers, a game-show host). Make each reel feel different from the last.

Return STRICT JSON: { "beats": [ { ...beat } ] }. Each beat:
- "voice": the DRAMATIC ElevenLabs line — start with an expressive delivery tag in square brackets that fits THIS persona, plus rich inline cues like [giggles], [gasps], [whispers], [short pause], [imitating <a character>]. For any two-person exchange, give each speaker a DISTINCT delivery so they sound different. Push the drama hard.
- "spoken": the SAME words as "voice" but CLEAN — no square-bracket tags. Shown on screen EXACTLY as the caption (what you read = what you hear), so KEEP IT SHORT: one short phrase or sentence per beat (≤ 12 words). The spoken words must appear verbatim inside "voice".
- For a two-person exchange, set "who" to the speaker's name that FITS THIS SCENARIO (e.g. Coach, Barista, Critic, Detective, Rival) and "bubbleSide" to "a" or "b" (just two bubble colours — alternate the speakers). Never use Mom/parent/child characters.
- "icon": the MOST relevant icon from this list ONLY: ${REEL_ICONS.join(", ")}.
- "anim": one of: ${REEL_ANIMS.join(", ")}. "pop" short reveals, "rise" sentences, "fromL"/"fromR" dialogue, "whisper" asides, "drop" punchlines.

Keep it clean (no profanity, politics, slurs). Output ONLY the JSON.`;
}

const ICON_SET: ReadonlySet<string> = new Set(REEL_ICONS);
const ANIM_SET: ReadonlySet<string> = new Set(REEL_ANIMS);

/** Clamp an LLM-chosen icon to one we actually bundle. */
export function sanitizeIcon(name: string | undefined): string {
  return name && ICON_SET.has(name) ? name : "sparkles";
}

/** Clamp an LLM-chosen animation to a supported one. */
export function sanitizeAnim(name: string | undefined): ReelAnim {
  return (name && ANIM_SET.has(name) ? name : "rise") as ReelAnim;
}

/** The narration string sent to ElevenLabs — the dramatic `voice` line per beat. */
export function buildReelNarration(beats: ReelBeat[]): string {
  return beats.map((b) => (b.voice ?? `${b.tag ?? ""} ${b.spoken}`).trim()).join("\n");
}

/**
 * Turn a script beat + its start time into an on-screen segment. The caption is
 * ALWAYS the spoken words (stick text to voice — what you read = what you hear).
 * Short lines render as a big headline; longer ones as a sentence; character
 * lines render in a bubble.
 */
export function reelBeatToSegment(beat: ReelBeat, startSec: number): ReelSegment {
  const text = beat.spoken.trim();
  const isDialogue = beat.bubbleSide === "a" || beat.bubbleSide === "b";
  const short = text.split(/\s+/).filter(Boolean).length <= 3;
  return {
    startSec: Number(startSec.toFixed(3)),
    big: !isDialogue && short ? text : undefined,
    line: !isDialogue && !short ? text : undefined,
    who: isDialogue ? beat.who : undefined,
    bubble: isDialogue ? text : undefined,
    bubbleSide: isDialogue ? beat.bubbleSide : undefined,
    icon: sanitizeIcon(beat.icon),
    anim: sanitizeAnim(beat.anim),
  };
}
