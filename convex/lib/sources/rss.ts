import { sourceDocSchema, type SourceDoc } from "@wordcast/shared";
import { XMLParser } from "fast-xml-parser";
import { DEFAULT_FEEDS, type FeedConfig } from "./feeds";

const TIMEOUT_MS = 10_000;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  trimValues: true,
  processEntities: true,
});

/** Coerce a parsed XML node (string | number | CDATA object) to plain text. */
function asText(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (typeof node === "object") {
    const rec = node as Record<string, unknown>;
    if (typeof rec["#text"] === "string") return rec["#text"];
    if (typeof rec["#text"] === "number") return String(rec["#text"]);
  }
  return "";
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toEpoch(raw: unknown): number | undefined {
  const s = asText(raw);
  if (!s) return undefined;
  const t = Date.parse(s);
  return Number.isNaN(t) ? undefined : t;
}

function linkOf(item: Record<string, unknown>): string {
  // RSS <link>text</link>; Atom <link href="..."/> (single or array).
  const link = item["link"];
  if (typeof link === "string") return link;
  if (Array.isArray(link)) {
    const alt = link.find((l) => (l as Record<string, unknown>)?.["@_rel"] !== "self");
    const href = (alt ?? link[0]) as Record<string, unknown> | undefined;
    if (href && typeof href["@_href"] === "string") return href["@_href"];
  }
  if (link && typeof link === "object") {
    const href = (link as Record<string, unknown>)["@_href"];
    if (typeof href === "string") return href;
  }
  return asText(item["guid"]) || "https://example.invalid";
}

function parseFeed(sourceId: string, xml: string): SourceDoc[] {
  const data = parser.parse(xml) as Record<string, unknown>;
  const rss = data["rss"] as Record<string, unknown> | undefined;
  const channel = rss?.["channel"] as Record<string, unknown> | undefined;
  const feed = data["feed"] as Record<string, unknown> | undefined; // Atom
  const rawItems = channel?.["item"] ?? feed?.["entry"] ?? [];
  const items = (Array.isArray(rawItems) ? rawItems : [rawItems]) as Record<string, unknown>[];

  const docs: SourceDoc[] = [];
  for (const item of items) {
    const title = stripHtml(asText(item["title"]));
    const summary = stripHtml(
      asText(item["description"] ?? item["summary"] ?? item["content"] ?? item["content:encoded"]),
    );
    const candidate = {
      sourceId,
      title,
      summary,
      url: linkOf(item),
      publishedAt: toEpoch(item["pubDate"] ?? item["published"] ?? item["updated"]),
    };
    const parsed = sourceDocSchema.safeParse(candidate);
    if (parsed.success && parsed.data.title.length > 0) {
      docs.push(parsed.data);
    }
  }
  return docs;
}

async function fetchFeed(feed: FeedConfig): Promise<SourceDoc[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(feed.url, {
      signal: controller.signal,
      headers: { "user-agent": "WordCast/1.0 (+https://github.com/wordcast)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${feed.id}`);
    const xml = await res.text();
    return parseFeed(feed.id, xml);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch and normalize all enabled feeds. Per-feed errors are isolated (a broken
 * feed never breaks the run). `enabledIds` empty/undefined = all default feeds.
 */
export async function fetchAllSources(
  enabledIds?: string[],
): Promise<{ docs: SourceDoc[]; errors: { feedId: string; message: string }[] }> {
  const feeds =
    enabledIds && enabledIds.length > 0
      ? DEFAULT_FEEDS.filter((f) => enabledIds.includes(f.id))
      : DEFAULT_FEEDS;

  const settled = await Promise.allSettled(feeds.map(fetchFeed));
  const docs: SourceDoc[] = [];
  const errors: { feedId: string; message: string }[] = [];
  settled.forEach((result, i) => {
    const feed = feeds[i];
    if (!feed) return;
    if (result.status === "fulfilled") {
      docs.push(...result.value);
    } else {
      errors.push({ feedId: feed.id, message: String(result.reason) });
    }
  });
  return { docs, errors };
}
