import { SignIn } from "@clerk/nextjs";

import { APP_NAME } from "@wordcast/shared";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">{APP_NAME}</h1>
        <p className="text-sm text-muted-foreground">Admin sign in</p>
      </div>
      <SignIn />
    </main>
  );
}
