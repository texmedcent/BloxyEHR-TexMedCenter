/**
 * Password-recovery sessions include an `amr` JWT claim with method "recovery".
 * Supabase may drop custom query params (e.g. ?next=/auth/update-password) on redirect,
 * so the callback should detect recovery and still send users to update-password.
 */
function base64UrlToUtf8(segment: string): string {
  const b64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  return atob(b64 + pad);
}

export function isRecoveryAccessToken(accessToken: string): boolean {
  try {
    const parts = accessToken.split(".");
    if (parts.length < 2) return false;
    const payloadJson = base64UrlToUtf8(parts[1]);
    const payload = JSON.parse(payloadJson) as {
      amr?: Array<{ method?: string } | string>;
    };
    const amr = payload.amr;
    if (!Array.isArray(amr)) return false;
    return amr.some((entry) =>
      typeof entry === "string"
        ? entry === "recovery"
        : entry?.method === "recovery",
    );
  } catch {
    return false;
  }
}
