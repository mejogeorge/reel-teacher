"use client";

import { useQuery } from "convex/react";
import { Shell } from "@/components/Shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/convexApi";

export default function SystemPage() {
  const status = useQuery(api.systemStatus, {});

  return (
    <Shell>
      <h1 className="text-2xl font-bold tracking-tight">System</h1>
      {status === undefined ? (
        <p className="mt-8 text-muted-foreground">Loading…</p>
      ) : (
        <div className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Render jobs</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-4 text-sm">
              {Object.entries(status.jobCounts).map(([k, v]) => (
                <span key={k}>
                  <span className="font-medium">{v}</span>{" "}
                  <span className="text-muted-foreground">{k}</span>
                </span>
              ))}
              <span className="text-muted-foreground">
                worker lease until:{" "}
                {status.latestLease ? new Date(status.latestLease).toLocaleTimeString() : "—"}
              </span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent errors</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-xs">
              {status.recentErrors.length === 0 ? (
                <p className="text-muted-foreground">No recent errors.</p>
              ) : (
                status.recentErrors.map((e) => (
                  <div key={e._id} className="flex gap-2">
                    <span className="text-muted-foreground">
                      {new Date(e.createdAt).toLocaleString()}
                    </span>
                    <span className="text-red-600">
                      {e.type}: {e.message}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </Shell>
  );
}
