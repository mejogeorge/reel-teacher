import type { PremiumReelProps } from "@wordcast/shared";

/**
 * Sample props for the PremiumReel composition — the PERSUASION script voiced by
 * ElevenLabs (Diana). `startSec` values are estimated for now; once ElevenLabs
 * word-timestamps are wired they come straight from the alignment payload.
 */
export const reelSampleProps: PremiumReelProps = {
  word: "PERSUASION",
  audioSrc: "voice.mp3",
  durationSec: 46.41,
  brandHandle: "@wordcast",
  segments: [
    { startSec: 0.2, lead: "Word of the day…", big: "PERSUASION", icon: "megaphone", anim: "pop" },
    {
      startSec: 3.72,
      line: "Not “persuation,” okay?",
      sub: "Spelling ko bhi persuade karna padega.",
      icon: "spell-check",
      anim: "tilt",
    },
    {
      startSec: 9.23,
      line: "Persuasion — convincing someone to do something they never planned to do.",
      icon: "book-open",
      anim: "rise",
    },
    { startSec: 14.53, lead: "Best example?", big: "Indian moms", icon: "heart", anim: "pop" },
    { startSec: 18.36, who: "Mom", bubbleSide: "a", bubble: "Beta… bas ek aur roti.", icon: "utensils", anim: "fromL" },
    { startSec: 21.32, who: "Me", bubbleSide: "b", bubble: "No, Mummy, I’m full.", icon: "hand", anim: "fromR" },
    {
      startSec: 24.04,
      who: "Mom",
      bubbleSide: "a",
      bubble: "Maine itne pyaar se banayi thi…",
      icon: "heart",
      anim: "fromL",
    },
    { startSec: 27.17, lead: "Four rotis later…", big: "that is persuasion.", icon: "megaphone", anim: "drop" },
    {
      startSec: 31.26,
      line: "“After a lot of persuasion, my dad agreed to the Goa trip.”",
      icon: "plane",
      anim: "rise",
    },
    { startSec: 37.28, line: "“A lot” = three months of begging.", icon: "alarm-clock", anim: "whisper" },
    { startSec: 41.42, big: "Follow for more words", icon: "sparkles", anim: "pop" },
    { startSec: 43.36, line: "I’m not persuading you… just suggesting.", icon: "smile", anim: "tilt" },
  ],
};
