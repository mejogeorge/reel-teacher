"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VideoPreview } from "@/components/VideoPreview";
import { api, THEME_IDS, type Asset, type WordDoc } from "@/lib/convexApi";

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
  const publishReel = useMutation(api.publishReel);
  const posts = useQuery(api.getPostTargets, { wordId: word._id });
  const renderStatus = useQuery(api.getRenderStatus, { wordId: word._id });
  const [theme, setTheme] = useState<string>(word.themeId ?? "minimal-light");

  const latestVideo = assets
    .filter((a) => a.kind === "video" && a.url)
    .sort((a, b) => b.renderVersion - a.renderVersion)[0];
  const latestFor = (platform: string) => posts?.find((p) => p.platform === platform);
  const busyPublishing = posts?.some(
    (p) => p.status === "pending" || p.status === "publishing",
  );
  const rendering =
    !!renderStatus && ["queued", "claimed", "rendering"].includes(renderStatus.status);

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
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="rounded-md border px-2 py-1 text-sm"
              >
                {THEME_IDS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                variant="outline"
                disabled={rendering}
                onClick={() => run(() => rerender({ wordId: word._id, themeId: theme }))}
              >
                Re-render
              </Button>
              {word.status === "rendered" ? (
                <Button
                  size="sm"
                  onClick={() => run(() => publishReel({ wordId: word._id }))}
                  disabled={busyPublishing || rendering}
                >
                  Publish to Instagram + Facebook
                </Button>
              ) : null}
            </div>

            {renderStatus ? (
              <p className="flex items-center gap-2 pt-1 text-xs">
                {rendering ? (
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent text-purple-600" />
                ) : null}
                <span className="text-muted-foreground">Render ({renderStatus.themeId}): </span>
                {renderStatus.status === "failed" ? (
                  <span className="text-red-600">failed — {renderStatus.error}</span>
                ) : renderStatus.status === "queued" ? (
                  <span className="text-amber-600">queued — needs the render worker running</span>
                ) : renderStatus.status === "succeeded" ? (
                  <span className="text-emerald-600">done</span>
                ) : (
                  <span className="text-purple-600">{renderStatus.status}…</span>
                )}
              </p>
            ) : null}

            <div className="space-y-0.5 pt-1 text-xs">
              {(["instagram", "facebook"] as const).map((platform) => {
                const p = latestFor(platform);
                if (!p) return null;
                return (
                  <p key={platform}>
                    <span className="text-muted-foreground capitalize">{platform}: </span>
                    {p.status === "published" ? (
                      <a
                        href={p.permalink ?? "#"}
                        className="text-emerald-600 hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        published{p.permalink ? " ↗" : ""}
                      </a>
                    ) : p.status === "failed" ? (
                      <span className="text-red-600">failed — {p.error}</span>
                    ) : (
                      <span className="text-purple-600">{p.status}…</span>
                    )}
                  </p>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {latestVideo ? (
              <>
                <div className="text-xs text-muted-foreground">
                  Rendered video ({latestVideo.themeId}, v{latestVideo.renderVersion})
                </div>
                <video
                  key={latestVideo._id}
                  controls
                  src={latestVideo.url ?? undefined}
                  style={{ width: 270, borderRadius: 12 }}
                />
              </>
            ) : word.content ? (
              <>
                <div className="text-xs text-muted-foreground">Live preview</div>
                <VideoPreview content={word.content} themeId={word.themeId} />
              </>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
