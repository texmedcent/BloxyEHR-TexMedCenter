/**
 * Canonical public origin for auth email redirects (password reset, signup confirm, magic link).
 *
 * In production, set NEXT_PUBLIC_SITE_URL to your real URL (e.g. https://bloxyehr.com) so
 * Supabase emails never embed localhost. Also set the same URL as Supabase Auth → Site URL
 * and add `${origin}/auth/callback` under Redirect URLs.
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
