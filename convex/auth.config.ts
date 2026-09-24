/**
 * Clerk <-> Convex authentication.
 * Set CLERK_JWT_ISSUER_DOMAIN in the Convex dashboard to your Clerk Frontend API
 * URL (e.g. https://your-app.clerk.accounts.dev). See Convex + Clerk docs.
 */
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
};
