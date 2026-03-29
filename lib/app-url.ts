/**
 * Canonical public origin for auth email redirects (password reset, signup confirm, magic link).
 *
 * Optional: set NEXT_PUBLIC_SITE_URL (no trailing slash) to force a single production URL in
 * every environment. Otherwise the browser falls back to window.location (localhost in dev).
 */
export function getPublicAppOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

/**
 * Origin for Supabase redirect_to when building links on the server (e.g. password reset email).
 * Prefer NEXT_PUBLIC_SITE_URL when set; otherwise derive from the incoming request so Vercel /
 * reverse proxies report the public hostname (fixes localhost links when env was missing at
 * build time or you only set variables on the host but not in local .env).
 */
export function getPublicOriginFromRequest(request: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  if (forwardedHost) {
    const host = forwardedHost.split(",")[0].trim();
    return `${forwardedProto}://${host}`;
  }

  const originHeader = request.headers.get("origin");
  if (originHeader) {
    try {
      return new URL(originHeader).origin;
    } catch {
      /* ignore */
    }
  }

  return new URL(request.url).origin;
}
