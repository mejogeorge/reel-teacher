"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { Shell } from "@/components/Shell";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/convexApi";

const STATUSES = [
  "",
  "candidate",
  "selected",
  "enriched",
  "safety_passed",
  "approved",
  "rendering",
  "rendered",
  "rejected",
  "failed",
];

export default function WordsPage() {
  const [status, setStatus] = useState("");
  const words = useQuery(api.listWords, status ? { status } : {});

  return (
    <Shell>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Words</h1>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border px-3 py-1.5 text-sm"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s || "all statuses"}
            </option>
          ))}
        </select>
      </div>

      {words === undefined ? (
        <p className="mt-8 text-muted-foreground">Loading…</p>
      ) : words.length === 0 ? (
        <p className="mt-8 text-muted-foreground">No words yet.</p>
      ) : (
        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2">Word</th>
              <th>Status</th>
              <th>Origin</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {words.map((w) => (
              <tr key={w._id} className="border-b">
                <td className="py-2">
                  <Link href={`/words/${w._id}`} className="font-medium hover:underline">
                    {w.word}
                  </Link>
                </td>
                <td>
                  <Badge status={w.status}>{w.status}</Badge>
                </td>
                <td className="text-muted-foreground">{w.origin}</td>
                <td className="text-muted-foreground">
                  {new Date(w.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Shell>
  );
}
