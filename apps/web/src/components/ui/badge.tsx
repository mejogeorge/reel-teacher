import * as React from "react";
import { cn } from "@/lib/utils";

const STATUS_CLASSES: Record<string, string> = {
  candidate: "bg-slate-100 text-slate-700",
  selected: "bg-blue-100 text-blue-700",
  enriched: "bg-indigo-100 text-indigo-700",
  safety_passed: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-700",
  voiced: "bg-teal-100 text-teal-700",
  rendering: "bg-purple-100 text-purple-700",
  rendered: "bg-green-100 text-green-800",
  rejected: "bg-rose-100 text-rose-700",
  failed: "bg-red-100 text-red-700",
};

export function Badge({
  className,
  status,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { status?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        status ? (STATUS_CLASSES[status] ?? "bg-slate-100 text-slate-700") : "border",
        className,
      )}
      {...props}
    />
  );
}
