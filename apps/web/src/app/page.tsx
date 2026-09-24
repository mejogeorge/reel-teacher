"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Shell } from "@/components/Shell";
import { TodayWordCard } from "@/components/TodayWordCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/convexApi";

const PIPELINE_STEPS = [
  "candidate",
  "selected",
  "enriched",
  "safety_passed",
  "approved",
  "voiced",
  "rendering",
  "rendered",
] as const;

async function run(action: () => Promise<unknown>) {
  try {
    await action();
  } catch (err) {
    alert(err instanceof Error ? err.message : String(err));
  }
}

export default function TodayPage() {
  const today = useQuery(api.getToday, {});
  const addWord = useMutation(api.addWordManually);
  const bootstrap = useMutation(api.bootstrap);
  const [newWord, setNewWord] = useState("");
  const word = today?.word ?? null;

  return (
    <Shell>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Today</h1>
        <div className="flex gap-2">
          <input
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            placeholder="Add a word manually"
            className="rounded-md border px-3 py-1.5 text-sm"
          />
          <Button
            variant="outline"
            onClick={() =>
              run(async () => {
                await addWord({ word: newWord });
                setNewWord("");
              })
            }
          >
            Add
          </Button>
          <Button variant="ghost" onClick={() => run(() => bootstrap({}))}>
            Seed
          </Button>
        </div>
      </div>

      {today === undefined ? (
        <p className="mt-8 text-muted-foreground">Connecting to Convex…</p>
      ) : (
        <div className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Run · {today.runDate}</CardTitle>
            </CardHeader>
            <CardContent>
              {today.run ? (
                <p className="text-sm">
                  Status: <span className="font-medium">{today.run.status}</span>
                  {today.run.error ? <span className="text-red-600"> — {today.run.error}</span> : null}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No run yet today. It starts automatically at the scheduled time, or add a word
                  above.
                </p>
              )}
              {word ? (
                <div className="mt-4 flex flex-wrap gap-1">
                  {PIPELINE_STEPS.map((step) => {
                    const reached =
                      PIPELINE_STEPS.indexOf(step) <=
                      PIPELINE_STEPS.indexOf(word.status as (typeof PIPELINE_STEPS)[number]);
                    return (
                      <span
                        key={step}
                        className={`rounded px-2 py-0.5 text-xs ${
                          reached ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        {step}
                      </span>
                    );
                  })}
                </div>
              ) : null}
            </CardContent>
          </Card>

          {word ? (
            <TodayWordCard word={word} assets={today.assets} />
          ) : today.run ? (
            <Card>
              <CardContent className="flex items-center gap-3 py-8 text-muted-foreground">
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Finding and selecting a word…
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </Shell>
  );
}
