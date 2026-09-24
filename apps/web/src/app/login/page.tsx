"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { APP_NAME } from "@wordcast/shared";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">{APP_NAME}</h1>
        <p className="text-sm text-muted-foreground">Admin sign in</p>
      </div>
      <form
        className="flex w-full max-w-sm flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setSubmitting(true);
          setError(null);
          const formData = new FormData(e.currentTarget);
          formData.set("flow", flow);
          try {
            await signIn("password", formData);
            router.push("/");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Sign in failed");
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          className="rounded-md border px-3 py-2 text-sm"
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          required
          className="rounded-md border px-3 py-2 text-sm"
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button type="submit" disabled={submitting}>
          {submitting ? "…" : flow === "signIn" ? "Sign in" : "Create account"}
        </Button>
        <button
          type="button"
          className="text-xs text-muted-foreground underline"
          onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
        >
          {flow === "signIn" ? "Need an account? Sign up" : "Have an account? Sign in"}
        </button>
      </form>
      <p className="max-w-sm text-center text-xs text-muted-foreground">
        Sign up with an email listed in ADMIN_EMAILS to get admin access.
      </p>
    </main>
  );
}
