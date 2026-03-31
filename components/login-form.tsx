"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useState } from "react";
import {
  ensureProfileRecord,
  getRoleLandingPath,
  persistBootstrapHospitalManagerRole,
  resolveRoleWithBootstrap,
} from "@/lib/roles";
import { POWERED_BY, PRODUCT_NAME, PRODUCT_NAME_SHORT } from "@/lib/branding";
import { authCardClassName, authCardTitleClassName } from "@/components/auth/auth-display";

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      const userId = data.user?.id;
      const sessionEmail = data.user?.email ?? email.trim();
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
          await ensureProfileRecord(supabase, userId, sessionEmail, sessionEmail.split("@")[0] ?? null, bootstrapRole);
          profileRole = bootstrapRole;
        }
        await persistBootstrapHospitalManagerRole(supabase, userId, sessionEmail, profileRole);
      }
      const role = resolveRoleWithBootstrap(sessionEmail, profileRole);
      // Full navigation so the proxy + RSC tree see the new session cookies (router.push alone often leaves a stale client shell).
      window.location.assign(getRoleLandingPath(role));
    } catch (error: unknown) {
      const rawMessage = error instanceof Error ? error.message : "An error occurred";
      if (rawMessage.toLowerCase().includes("invalid login credentials")) {
        setError(
          "Invalid login credentials. If you just signed up, confirm your email first, then try again."
        );
      } else {
        setError(rawMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className={authCardClassName}>
        <CardHeader className="space-y-2 pb-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c4a574]">
            {PRODUCT_NAME_SHORT}
          </p>
          <CardTitle className={authCardTitleClassName()}>Sign in</CardTitle>
          <CardDescription className="text-slate-600">
            Staff and providers — {PRODUCT_NAME}. {POWERED_BY}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/auth/forgot-password"
                    className="ml-auto inline-block text-sm font-medium text-[#002868] underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button
                type="submit"
                className="w-full bg-[#002868] font-semibold text-white hover:bg-[#003a7a]"
                disabled={isLoading}
              >
                {isLoading ? "Signing in…" : "Sign in"}
              </Button>
            </div>
            <div className="mt-4 text-center text-sm">
              Don&apos;t have an account?{" "}
              <Link
                href="/auth/sign-up"
                className="font-medium text-[#002868] underline underline-offset-4 hover:text-[#003a7a]"
              >
                Create account
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
