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
import { useState } from "react";
import { PRODUCT_NAME, PRODUCT_NAME_SHORT } from "@/lib/branding";
import { authCardClassName, authCardTitleClassName } from "@/components/auth/auth-display";
import {
  ensureProfileRecord,
  getRoleLandingPath,
  persistBootstrapHospitalManagerRole,
  resolveRoleWithBootstrap,
} from "@/lib/roles";

export function UpdatePasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const userId = user?.id;
      const sessionEmail = user?.email ?? null;
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
        <CardHeader className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c4a574]">
            {PRODUCT_NAME_SHORT}
          </p>
          <CardTitle className={authCardTitleClassName()}>Set new password</CardTitle>
          <CardDescription className="text-slate-600">
            Choose a new password for your {PRODUCT_NAME} account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleForgotPassword}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="New password"
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
                {isLoading ? "Saving…" : "Save new password"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
