/** Reputable English news + culture/science RSS feeds (richer vocabulary). */
export interface FeedConfig {
  id: string;
  name: string;
  url: string;
}

export const DEFAULT_FEEDS: FeedConfig[] = [
  { id: "bbc-news", name: "BBC News", url: "http://feeds.bbci.co.uk/news/rss.xml" },
  { id: "bbc-world", name: "BBC World", url: "http://feeds.bbci.co.uk/news/world/rss.xml" },
  { id: "guardian-world", name: "The Guardian — World", url: "https://www.theguardian.com/world/rss" },
  { id: "guardian-books", name: "The Guardian — Books", url: "https://www.theguardian.com/books/rss" },
  { id: "npr-news", name: "NPR News", url: "https://feeds.npr.org/1001/rss.xml" },
  { id: "nyt-world", name: "NYT — World", url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml" },
  { id: "nyt-arts", name: "NYT — Arts", url: "https://rss.nytimes.com/services/xml/rss/nyt/Arts.xml" },
  {
    id: "smithsonian",
    name: "Smithsonian Magazine",
    url: "https://www.smithsonianmag.com/rss/latest_articles/",
  },
];

export function feedById(id: string): FeedConfig | undefined {
  return DEFAULT_FEEDS.find((f) => f.id === id);
}
