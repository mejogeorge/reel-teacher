declare module "naughty-words" {
  /** Language code → list of profane/slur terms. */
  const words: Record<string, string[]>;
  export default words;
}
