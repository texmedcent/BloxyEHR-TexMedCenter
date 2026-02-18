import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getRoleLandingPath } from "@/lib/roles";

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
      const { data } = await supabase.auth.getClaims();
      const userId = (data?.claims as { sub?: string } | undefined)?.sub;
      let role: string | null = null;
      if (userId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .single();
        role = profile?.role ?? null;
      }
      return NextResponse.redirect(`${origin}${getRoleLandingPath(role)}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`);
}
