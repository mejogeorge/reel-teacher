/**
 * Convex Auth — the deployment issues and verifies its own JWTs (no third party).
 * CONVEX_SITE_URL is provided automatically by Convex.
 */
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
