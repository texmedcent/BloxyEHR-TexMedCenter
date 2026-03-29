function isLocalhostOrigin(origin: string): boolean {
  try {
    const normalized = origin.includes("://") ? origin : `https://${origin}`;
    const u = new URL(normalized);
    return u.hostname === "localhost" || u.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

/**
 * Canonical public origin for auth email redirects (password reset, signup confirm, magic link).
 *
 * Optional: set NEXT_PUBLIC_SITE_URL (no trailing slash). Do not set this to localhost on
 * Vercel — use your real https URL or leave unset so the request/browser origin wins.
 */
export function getPublicAppOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) {
    const normalized = fromEnv.replace(/\/$/, "");
    if (
      isLocalhostOrigin(normalized) &&
      typeof window !== "undefined" &&
      !isLocalhostOrigin(window.location.origin)
    ) {
      return window.location.origin;
    }
    return normalized;
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
 * Prefer NEXT_PUBLIC_SITE_URL when it is a real production URL; otherwise derive from the
 * incoming request. If NEXT_PUBLIC_SITE_URL is localhost on Vercel, it is ignored (common
 * misconfiguration that would otherwise force localhost into every reset email).
 */
export function getPublicOriginFromRequest(request: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) {
    const normalized = fromEnv.replace(/\/$/, "");
    if (!(isLocalhostOrigin(normalized) && process.env.VERCEL)) {
      return normalized;
    }
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
