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
  bubbleSide: z.enum(["mom", "me"]).optional(),
  icon: z.string().optional(), // sanitized against REEL_ICONS downstream
  anim: z.string().optional(), // sanitized against REEL_ANIMS downstream
});
export type ReelBeat = z.infer<typeof reelBeatSchema>;

export const reelScriptSchema = z.object({
  beats: z.array(reelBeatSchema).min(6).max(14),
});
export type ReelScript = z.infer<typeof reelScriptSchema>;

/**
 * Prompt for the reel scriptwriter: a witty, curious, playful English-teacher
 * persona that makes an uncommon word fun and memorable in a vertical reel.
 */
export function buildReelScriptPrompt(content: WordContent): string {
  return `You are a PLAYFUL, witty, sarcastic Indian girl teaching an English word to your Instagram followers from a café. You perform a one-person mono-act: you OVER-ACT, you do dramatic character imitations (especially a sweet/emotional Indian mom vs your own firm voice), you giggle, you tease. Big drama. More than required. Make it FUN and memorable.

WORD: ${content.word}
PART OF SPEECH: ${content.partOfSpeech}
MEANING: ${content.simpleMeaning}
EXAMPLES: ${content.examples.join(" | ")}
SYNONYMS: ${content.synonyms.join(", ")}

STYLE REFERENCE — this is the exact energy and delivery I want (for a different word, "persuasion"):
[excited, leaning in] Word of the day… PERSUASION!
[sarcastic] Not "persuation," okay? [giggles] Spelling ko bhi persuade karna padega.
[confident teacher voice] Persuasion means convincing someone to do something they never planned to do.
[mischievous] Best example? Indian moms.
[imitating a sweet Indian mom] "Beta… bas ek aur roti."
[own voice, firm] "No, Mummy, I'm full."
[imitating mom, wounded and emotional] "Maine itne pyaar se banayi thi…"
[short pause] [deadpan] Four rotis later… that is persuasion.
[back to teacher tone] Use it like this: "After a lot of persuasion, my dad agreed to the Goa trip."
[whispers, conspiratorial] "A lot" means three months of begging.
[playful, smiling] Follow for more words. [short pause] I'm not persuading you… [teasing laugh] just suggesting.

Write a 30–45 second script for "${content.word}" in EXACTLY that dramatic style, as an ORDERED list of 8–12 "beats". Structure: excited hook → honest definition → a funny relatable mini-dialogue (imitate distinct characters, e.g. mom vs you) → one clean usage sentence → playful call-to-action.

Return STRICT JSON: { "beats": [ { ...beat } ] }. Each beat:
- "voice": the DRAMATIC ElevenLabs line — start with an expressive delivery tag in square brackets and use rich, over-acted cues, imitating characters where relevant. You MAY add inline cues like [giggles], [teasing laugh], [short pause], [wounded, emotional]. For dialogue, use tags like "[imitating a sweet Indian mom]" and "[own voice, firm]" so each character sounds DISTINCT. Push the drama harder than feels necessary.
- "spoken": the SAME words as "voice" but CLEAN — no square-bracket tags at all. This is shown on screen EXACTLY as the caption (what the viewer reads = what they hear), so KEEP IT SHORT: one short phrase or sentence per beat (≤ 12 words). Break longer thoughts into multiple beats. The spoken words must appear verbatim inside "voice".
- For a character/dialogue line, set "who" (e.g. "Mom" or "Me") and "bubbleSide" ("mom" or "me") so it renders as that character's bubble. (Do NOT write separate big/line captions — the caption is always the spoken words.)
- "icon": the MOST relevant icon from this list ONLY: ${REEL_ICONS.join(", ")}.
- "anim": one of: ${REEL_ANIMS.join(", ")}. "pop" for short reveals, "rise" for sentences, "fromL"/"fromR" for dialogue, "whisper" for asides, "drop" for punchlines.

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
  const isDialogue = beat.bubbleSide === "mom" || beat.bubbleSide === "me";
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
