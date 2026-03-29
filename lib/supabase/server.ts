import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Especially important if using Fluid compute: Don't put this client in a
 * global variable. Always create a new client within each function when using
 * it.
 */
/**
 * Auth for Server Components. Prefer getUser() (validated server-side); if it returns null
 * (common in local dev / transient Auth errors), fall back to getSession() so cookie sessions still work.
 */
export async function getSessionAndUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    return { supabase, user, userId: user.id };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const sessionUser = session?.user ?? null;
  return {
    supabase,
    user: sessionUser,
    userId: sessionUser?.id ?? null,
  };
}

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have proxy refreshing
            // user sessions.
          }
        },
      },
    },
  );
}
