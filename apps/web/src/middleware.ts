import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

const isSignInPage = createRouteMatcher(["/login"]);
// Dev bypass — when set, all pages are accessible without signing in.
const BYPASS = process.env.NEXT_PUBLIC_AUTH_BYPASS === "true";

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  if (BYPASS) return;
  const authed = await convexAuth.isAuthenticated();
  if (!isSignInPage(request) && !authed) {
    return nextjsMiddlewareRedirect(request, "/login");
  }
  if (isSignInPage(request) && authed) {
    return nextjsMiddlewareRedirect(request, "/");
  }
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
