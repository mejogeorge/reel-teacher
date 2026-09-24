import { currentUser } from "@clerk/nextjs/server";
import { SignOutButton } from "@clerk/nextjs";

import { APP_NAME } from "@wordcast/shared";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const user = await currentUser();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{APP_NAME}</h1>
        <p className="text-muted-foreground">Word-of-the-Day video pipeline · admin</p>
      </div>
      <div className="rounded-lg border p-6">
        <p className="text-sm">
          Signed in as{" "}
          <span className="font-medium">
            {user?.primaryEmailAddress?.emailAddress ?? "unknown"}
          </span>
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Dashboard pages (Today, Words, Settings) arrive in milestone M7.
        </p>
        <div className="mt-4">
          <SignOutButton>
            <Button variant="outline">Sign out</Button>
          </SignOutButton>
        </div>
      </div>
    </main>
  );
}
