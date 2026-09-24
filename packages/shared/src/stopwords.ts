/**
 * A small curated stop-word list — common function words plus a handful of
 * ultra-frequent news/content words. This is NOT a frequency table: it only
 * removes obvious noise so the LLM word-pick step (which judges rarity) isn't
 * flooded with "the/and/said/people". Rarity filtering itself is the LLM's job.
 */
export const STOPWORDS: ReadonlySet<string> = new Set([
  // articles / determiners
  "the", "a", "an", "this", "that", "these", "those", "some", "any", "each",
  "every", "all", "both", "either", "neither", "such", "same", "other", "another",
  // pronouns
  "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them",
  "my", "your", "his", "its", "our", "their", "mine", "yours", "hers", "ours",
  "theirs", "who", "whom", "whose", "which", "what", "myself", "yourself",
  "himself", "herself", "itself", "ourselves", "themselves",
  // prepositions / conjunctions
  "of", "to", "in", "on", "at", "by", "for", "with", "about", "against", "between",
  "into", "through", "during", "before", "after", "above", "below", "from", "up",
  "down", "over", "under", "again", "further", "then", "once", "here", "there",
  "when", "where", "why", "how", "and", "but", "or", "nor", "so", "than", "too",
  "very", "because", "while", "although", "though", "whether", "unless", "until",
  "upon", "amid", "among", "within", "without", "toward", "towards", "onto",
  // auxiliaries / common verbs
  "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
  "having", "do", "does", "did", "doing", "will", "would", "shall", "should",
  "can", "could", "may", "might", "must", "ought", "need", "make", "makes",
  "made", "making", "get", "gets", "got", "take", "takes", "took", "come",
  "comes", "came", "give", "gives", "gave", "goes", "went", "gone", "know",
  "knows", "knew", "want", "wants", "like", "likes", "used", "using", "also",
  // common adverbs / misc
  "not", "only", "just", "more", "most", "much", "many", "even", "still", "well",
  "back", "much", "such", "into", "onto", "off", "out", "now", "ever", "never",
  "always", "often", "sometimes", "usually", "really", "quite", "rather",
  // ultra-frequent news/content words
  "said", "says", "say", "told", "according", "report", "reports", "reported",
  "news", "new", "first", "last", "next", "year", "years", "day", "days", "time",
  "times", "week", "weeks", "month", "months", "people", "world", "way", "ways",
  "thing", "things", "part", "parts", "case", "point", "group", "number", "since",
  "state", "states", "today", "week", "including", "amid", "over",
]);
