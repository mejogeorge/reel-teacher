"use node";

import {
  buildReelNarration,
  buildReelScriptPrompt,
  reelBeatToSegment,
  reelScriptSchema,
  type ReelBeat,
} from "@wordcast/shared";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import { convexEnv } from "./lib/env";
import { callLLMValidated } from "./lib/llm";

const EL_TIMEOUT_MS = 60_000;

interface ElevenAlignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds?: number[];
}
interface ElevenResponse {
  audio_base64?: string;
  alignment?: ElevenAlignment;
  normalized_alignment?: ElevenAlignment;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Resolve each beat's start time by locating its spoken text in the alignment.
 * Clamped to be non-decreasing so the composition's active-beat selection never
 * regresses (a missed match falls back to the previous beat's time, not 0).
 */
function deriveStartTimes(beats: ReelBeat[], align: ElevenAlignment): number[] {
  const full = align.characters.join("").toLowerCase();
  const starts = align.character_start_times_seconds;
  let cursor = 0;
  let last = 0;
  return beats.map((b) => {
    const key = b.spoken.slice(0, 14).toLowerCase();
    let at = full.indexOf(key, cursor);
    if (at < 0) at = full.indexOf(b.spoken.slice(0, 6).toLowerCase(), cursor);
    let s = at >= 0 ? (starts[at] ?? last) : last;
    if (s < last) s = last; // never go backwards → captions stay in order
    last = s;
    if (at >= 0) cursor = at + key.length; // advance past the whole match, not +1
    return s;
  });
}

/** ElevenLabs TTS (with word-timestamps), retrying transient 429/5xx/timeouts. */
async function elevenLabsTTS(voiceId: string, apiKey: string, model: string, text: string): Promise<ElevenResponse> {
  let lastErr = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    let res: Response;
    try {
      res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`, {
        method: "POST",
        headers: { "xi-api-key": apiKey, "content-type": "application/json" },
        body: JSON.stringify({
          text,
          model_id: model,
          // Lower stability → more expressive/dramatic delivery range (v3).
          voice_settings: { stability: 0.3, similarity_boost: 0.75, style: 0.6 },
        }),
        signal: AbortSignal.timeout(EL_TIMEOUT_MS),
      });
    } catch (err) {
      lastErr = `ElevenLabs request failed: ${String(err)}`;
      await sleep(1500 * (attempt + 1));
      continue;
    }
    if (res.ok) return (await res.json()) as ElevenResponse;
    lastErr = `ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`;
    if (res.status !== 429 && res.status < 500) throw new Error(lastErr); // non-transient
    await sleep(1500 * (attempt + 1));
  }
  throw new Error(lastErr);
}

/**
 * End-to-end reel builder for one word: LLM script → ElevenLabs voice (with
 * word-timestamps) → store audio in Convex → enqueue a PremiumReel render.
 * Publishing remains gated by settings.autoPublish (off = held for review).
 */
export const buildReel = internalAction({
  args: { wordId: v.id("words") },
  handler: async (
    ctx,
    { wordId },
  ): Promise<{ jobId: Id<"renderJobs">; renderVersion: number; dayIndex: number }> => {
    try {
      const env = convexEnv();
      if (!env.ELEVENLABS_API_KEY || !env.ELEVENLABS_VOICE_ID) {
        throw new Error("ElevenLabs not configured (set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID)");
      }
      const word: Doc<"words"> | null = await ctx.runQuery(internal.enrichData.getWord, { wordId });
      if (!word || !word.content) throw new Error("word has no content to script");

      // 1. Script (LLM)
      const scripted = await callLLMValidated(buildReelScriptPrompt(word.content), reelScriptSchema, {
        maxTokens: 2048,
      });
      if (!scripted.ok) throw new Error(`reel script generation failed: ${scripted.error}`);
      const beats = scripted.data.beats;

      // 2. Voice + word-timestamps (ElevenLabs, with retry)
      const payload = await elevenLabsTTS(
        env.ELEVENLABS_VOICE_ID,
        env.ELEVENLABS_API_KEY,
        env.ELEVENLABS_MODEL,
        buildReelNarration(beats),
      );
      const align = payload.alignment ?? payload.normalized_alignment;
      if (!payload.audio_base64 || !align) throw new Error("ElevenLabs returned no audio/alignment");

      // 3. Store the mp3 in Convex storage
      const audioBytes = Buffer.from(payload.audio_base64, "base64");
      const voiceStorageId = await ctx.storage.store(new Blob([audioBytes], { type: "audio/mpeg" }));

      // 4. Timings → on-screen segments
      const startTimes = deriveStartTimes(beats, align);
      const segments = beats.map((b, i) => reelBeatToSegment(b, startTimes[i] ?? 0));
      const ends = align.character_end_times_seconds ?? align.character_start_times_seconds;
      const durationSec = Number(((ends[ends.length - 1] ?? 40) + 0.6).toFixed(2));

      // 5. Enqueue the PremiumReel render
      return await ctx.runMutation(internal.reelData.enqueueReelRender, {
        wordId,
        word: word.content.word,
        durationSec,
        voiceStorageId,
        segments,
      });
    } catch (err) {
      // Never leave the word stranded: log + fall back to the classic renderer so
      // the daily run still ships a video, then surface the error in logs.
      const message = err instanceof Error ? err.message : String(err);
      await ctx.runMutation(internal.reelData.fallbackToClassic, { wordId, error: message });
      throw err;
    }
  },
});
