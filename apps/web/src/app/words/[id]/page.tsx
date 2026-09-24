"use client";

import type { WordContent } from "@wordcast/shared";
import { useMutation, useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Shell } from "@/components/Shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/convexApi";

async function run(action: () => Promise<unknown>) {
  try {
    await action();
  } catch (err) {
    alert(err instanceof Error ? err.message : String(err));
  }
}

export default function WordDetailPage() {
  const params = useParams<{ id: string }>();
  const wordId = params.id;
  const detail = useQuery(api.getWordDetail, { wordId });
  const editContent = useMutation(api.editContent);
  const regenerate = useMutation(api.regenerate);
  const rerender = useMutation(api.rerender);
  const retryFailed = useMutation(api.retryFailed);
  const reject = useMutation(api.reject);
  const [draft, setDraft] = useState<string | null>(null);

  if (detail === undefined) {
    return (
      <Shell>
        <p className="text-muted-foreground">Loading…</p>
      </Shell>
    );
  }
  if (detail === null) {
    return (
      <Shell>
        <p className="text-muted-foreground">Word not found.</p>
      </Shell>
    );
  }

  const { word, assets, events } = detail;
  const contentText = draft ?? (word.content ? JSON.stringify(word.content, null, 2) : "");

  return (
    <Shell>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{word.word}</h1>
        <Badge status={word.status}>{word.status}</Badge>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => run(() => regenerate({ wordId }))}>
          Regenerate
        </Button>
        <Button size="sm" variant="outline" onClick={() => run(() => rerender({ wordId }))}>
          Re-render
        </Button>
        {word.status === "failed" ? (
          <Button size="sm" variant="outline" onClick={() => run(() => retryFailed({ wordId }))}>
            Retry
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="outline"
          onClick={() => run(() => reject({ wordId, reason: "Rejected from detail" }))}
        >
          Reject
        </Button>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Content (editable JSON)</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              value={contentText}
              onChange={(e) => setDraft(e.target.value)}
              rows={18}
              className="w-full rounded-md border p-3 font-mono text-xs"
            />
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                onClick={() =>
                  run(async () => {
                    const parsed = JSON.parse(contentText) as WordContent;
                    await editContent({ wordId, content: parsed });
                    setDraft(null);
                  })
                }
              >
                Save content
              </Button>
              {draft !== null ? (
                <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
                  Reset
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Assets</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {assets.length === 0 ? (
                <p className="text-muted-foreground">No assets yet.</p>
              ) : (
                assets.map((a) => (
                  <div key={a._id} className="flex items-center justify-between">
                    <span>
                      {a.kind} · v{a.renderVersion} · {Math.round(a.bytes / 1024)}KB
                    </span>
                    {a.url ? (
                      <a href={a.url} className="text-blue-600 hover:underline" download>
                        download
                      </a>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Events</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-xs">
              {events.map((e) => (
                <div key={e._id} className="flex gap-2">
                  <span className="text-muted-foreground">
                    {new Date(e.createdAt).toLocaleTimeString()}
                  </span>
                  <span
                    className={
                      e.level === "error"
                        ? "text-red-600"
                        : e.level === "warn"
                          ? "text-amber-600"
                          : ""
                    }
                  >
                    {e.type}: {e.message}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
