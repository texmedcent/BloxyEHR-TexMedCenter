import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PRODUCT_NAME, PRODUCT_NAME_SHORT } from "@/lib/branding";
import { authCardClassName, authCardTitleClassName } from "@/components/auth/auth-display";

export default function Page() {
  return (
    <div className="flex flex-col gap-6">
      <Card className={authCardClassName}>
        <CardHeader className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c4a574]">
            {PRODUCT_NAME_SHORT}
          </p>
          <CardTitle className={authCardTitleClassName()}>Check your email</CardTitle>
          <CardDescription className="text-slate-600">
            Confirm your account — {PRODUCT_NAME}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed text-slate-600">
            You&apos;re almost there. We sent a confirmation link to your email. After you
            confirm, you can sign in to the patient portal or staff tools.
          </p>
          <Link
            href="/auth/login"
            className="inline-flex h-11 w-full items-center justify-center rounded-md bg-[#002868] text-sm font-semibold text-white transition hover:bg-[#003a7a]"
          >
            Go to sign in
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
