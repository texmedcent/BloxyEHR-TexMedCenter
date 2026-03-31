"use client";

import { getPublicAppOrigin } from "@/lib/app-url";
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

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    if (password !== repeatPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${getPublicAppOrigin()}/auth/callback`,
          data: { role: "patient" },
        },
      });
      if (error) throw error;

      // If email confirmation is enabled, Supabase may return no active session yet.
      // In that case user must confirm before logging in.
      if (!data.session) {
        setSuccess(
          "Account created. Check your email to confirm your account before logging in."
        );
        return;
      }

      const userId = data.user?.id;
      let profileRole: string | null = "patient";
      if (userId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .maybeSingle();
        profileRole = profile?.role ?? "patient";
        if (!profile) {
          const bootstrapRole = resolveRoleWithBootstrap(email.trim(), null) ?? "patient";
          await ensureProfileRecord(supabase, userId, email.trim(), email.trim().split("@")[0] ?? null, bootstrapRole);
          profileRole = bootstrapRole;
        }
        await persistBootstrapHospitalManagerRole(supabase, userId, email.trim(), profileRole);
      }
      const role = resolveRoleWithBootstrap(email.trim(), profileRole);
      window.location.assign(getRoleLandingPath(role));
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
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
          <CardTitle className={authCardTitleClassName()}>Create account</CardTitle>
          <CardDescription className="text-slate-600">
            Join {PRODUCT_NAME} — patient and staff. {POWERED_BY}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp}>
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
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="repeat-password">Repeat Password</Label>
                </div>
                <Input
                  id="repeat-password"
                  type="password"
                  required
                  value={repeatPassword}
                  onChange={(e) => setRepeatPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              {success && <p className="text-sm text-emerald-700">{success}</p>}
              <Button
                type="submit"
                className="w-full bg-[#002868] font-semibold text-white hover:bg-[#003a7a]"
                disabled={isLoading}
              >
                {isLoading ? "Creating account…" : "Create account"}
              </Button>
            </div>
            <div className="mt-4 text-center text-sm">
              Already have an account?{" "}
              <Link
                href="/auth/login"
                className="font-medium text-[#002868] underline underline-offset-4 hover:text-[#003a7a]"
              >
                Sign in
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
