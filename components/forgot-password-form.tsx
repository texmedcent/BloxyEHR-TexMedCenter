"use client";

import { cn } from "@/lib/utils";
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
import { PRODUCT_NAME, PRODUCT_NAME_SHORT } from "@/lib/branding";
import { authCardClassName, authCardTitleClassName } from "@/components/auth/auth-display";

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setSuccess(true);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      {success ? (
        <Card className={authCardClassName}>
          <CardHeader className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c4a574]">
              {PRODUCT_NAME_SHORT}
            </p>
            <CardTitle className={authCardTitleClassName()}>Check your email</CardTitle>
            <CardDescription className="text-slate-600">
              Password reset link sent · {PRODUCT_NAME}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-slate-600">
              If you have an account with {PRODUCT_NAME}, you&apos;ll receive an email with
              instructions to reset your password.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className={authCardClassName}>
          <CardHeader className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c4a574]">
              {PRODUCT_NAME_SHORT}
            </p>
            <CardTitle className={authCardTitleClassName()}>Reset password</CardTitle>
            <CardDescription className="text-slate-600">
              Enter your email and we&apos;ll send a secure link · {PRODUCT_NAME}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleForgotPassword}>
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
                {error && <p className="text-sm text-red-500">{error}</p>}
                <Button
                  type="submit"
                  className="w-full bg-[#002868] font-semibold text-white hover:bg-[#003a7a]"
                  disabled={isLoading}
                >
                  {isLoading ? "Sending…" : "Send reset email"}
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
      )}
    </div>
  );
}
