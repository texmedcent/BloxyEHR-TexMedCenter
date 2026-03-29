import { updateSession } from "@/lib/supabase/proxy";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  // If Supabase falls back to Site URL (e.g. /auth/update-password not allowlisted), the
  // recovery link lands on /?code=... where nothing exchanges the code. Forward to callback.
  const url = request.nextUrl;
  if (url.pathname === "/" && url.searchParams.has("code")) {
    const redirectUrl = new URL("/auth/callback", request.url);
    redirectUrl.searchParams.set("code", url.searchParams.get("code")!);
    redirectUrl.searchParams.set("next", "/auth/update-password");
    return NextResponse.redirect(redirectUrl);
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
