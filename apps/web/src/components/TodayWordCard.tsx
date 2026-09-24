"use client";

import { useMutation, useQuery } from "convex/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VideoPreview } from "@/components/VideoPreview";
import { api, type Asset, type WordDoc } from "@/lib/convexApi";

async function run(action: () => Promise<unknown>) {
  try {
    await action();
  } catch (err) {
    alert(err instanceof Error ? err.message : String(err));
  }
}

export function TodayWordCard({ word, assets }: { word: WordDoc; assets: Asset[] }) {
  const approveNow = useMutation(api.approveNow);
  const changeWord = useMutation(api.changeWord);
  const reject = useMutation(api.reject);
  const regenerate = useMutation(api.regenerate);
  const rerender = useMutation(api.rerender);
  const publishToInstagram = useMutation(api.publishToInstagram);
  const posts = useQuery(api.getPostTargets, { wordId: word._id });

  const videos = assets.filter((a) => a.kind === "video" && a.url);
  const latestPost = posts?.[0];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <CardTitle className="text-xl">{word.word}</CardTitle>
          <Badge status={word.status}>{word.status}</Badge>
          <span className="text-xs text-muted-foreground">{word.origin}</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-6 md:flex-row">
          <div className="flex-1 space-y-2 text-sm">
            {word.content ? (
              <>
                <p>
                  <span className="text-muted-foreground">Meaning: </span>
                  {word.content.simpleMeaning}
                </p>
                <ul className="list-disc pl-5 text-muted-foreground">
                  {word.content.examples.map((ex) => (
                    <li key={ex}>{ex}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-muted-foreground">Content not generated yet.</p>
            )}
            {word.rejectedReason ? (
              <p className="text-rose-600">Rejected: {word.rejectedReason}</p>
            ) : null}
            {word.error ? (
              <p className="text-red-600">
                Failed at {word.error.step}: {word.error.message}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2 pt-3">
              <Button size="sm" onClick={() => run(() => approveNow({ wordId: word._id }))}>
                Approve now
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => run(() => changeWord({ wordId: word._id }))}
              >
                Change word
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => run(() => reject({ wordId: word._id, reason: "Rejected from dashboard" }))}
              >
                Reject
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => run(() => regenerate({ wordId: word._id }))}
              >
                Regenerate
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => run(() => rerender({ wordId: word._id }))}
              >
                Re-render
              </Button>
              {word.status === "rendered" ? (
                <Button
                  size="sm"
                  onClick={() => run(() => publishToInstagram({ wordId: word._id }))}
                  disabled={latestPost?.status === "publishing" || latestPost?.status === "pending"}
                >
                  Publish to Instagram
                </Button>
              ) : null}
            </div>

            {latestPost ? (
              <p className="pt-1 text-xs">
                <span className="text-muted-foreground">Instagram: </span>
                {latestPost.status === "published" ? (
                  <a
                    href={latestPost.permalink ?? "#"}
                    className="text-emerald-600 hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    published{latestPost.permalink ? " ↗" : ""}
                  </a>
                ) : latestPost.status === "failed" ? (
                  <span className="text-red-600">failed — {latestPost.error}</span>
                ) : (
                  <span className="text-purple-600">{latestPost.status}…</span>
                )}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-4">
            {word.content ? <VideoPreview content={word.content} themeId={word.themeId} /> : null}
            {videos.map((a) => (
              <video
                key={a._id}
                controls
                src={a.url ?? undefined}
                style={{ width: 270, borderRadius: 12 }}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
