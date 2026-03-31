import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Suspense } from "react";
import Link from "next/link";
import { PRODUCT_NAME, PRODUCT_NAME_SHORT } from "@/lib/branding";
import { authCardClassName, authCardTitleClassName } from "@/components/auth/auth-display";

async function ErrorContent({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>;
}) {
  const params = await searchParams;

  return (
    <>
      {params?.error ? (
        <p className="text-sm leading-relaxed text-slate-600">
          Code: <span className="font-mono text-slate-800">{params.error}</span>
        </p>
      ) : (
        <p className="text-sm text-slate-600">An unspecified error occurred.</p>
      )}
    </>
  );
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Card className={authCardClassName}>
        <CardHeader className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c4a574]">
            {PRODUCT_NAME_SHORT}
          </p>
          <CardTitle className={authCardTitleClassName()}>Something went wrong</CardTitle>
          <p className="text-sm text-slate-600">
            {PRODUCT_NAME} could not complete sign-in. Try again or contact support.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Suspense>
            <ErrorContent searchParams={searchParams} />
          </Suspense>
          <Link
            href="/auth/login"
            className="inline-flex h-11 w-full items-center justify-center rounded-md bg-[#002868] text-sm font-semibold text-white transition hover:bg-[#003a7a]"
          >
            Back to sign in
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
