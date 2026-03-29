import { isRecoveryAccessToken } from "@/lib/auth-recovery";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import {
  ensureProfileRecord,
  getRoleLandingPath,
  persistBootstrapHospitalManagerRole,
  resolveRoleWithBootstrap,
} from "@/lib/roles";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (next) {
        return NextResponse.redirect(`${origin}${next}`);
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token && isRecoveryAccessToken(session.access_token)) {
        return NextResponse.redirect(`${origin}/auth/update-password`);
      }
      const { data } = await supabase.auth.getClaims();
      const userId = (data?.claims as { sub?: string; email?: string } | undefined)?.sub;
      const claimEmail = (data?.claims as { email?: string } | undefined)?.email;
      const { data: userData } = await supabase.auth.getUser();
      const sessionEmail = userData.user?.email ?? claimEmail ?? null;

      let profileRole: string | null = null;
      if (userId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .maybeSingle();
        profileRole = profile?.role ?? null;
        if (!profile) {
          const bootstrapRole = resolveRoleWithBootstrap(sessionEmail, null) ?? "patient";
          await ensureProfileRecord(
            supabase,
            userId,
            sessionEmail,
            sessionEmail?.split("@")[0] ?? null,
            bootstrapRole,
          );
          profileRole = bootstrapRole;
        }
        await persistBootstrapHospitalManagerRole(supabase, userId, sessionEmail, profileRole);
      }
      const role = resolveRoleWithBootstrap(sessionEmail, profileRole);
      return NextResponse.redirect(`${origin}${getRoleLandingPath(role)}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`);
}
