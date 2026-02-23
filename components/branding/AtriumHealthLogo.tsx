import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface AtriumHealthLogoProps {
  className?: string;
  compact?: boolean;
  iconOnly?: boolean;
  /** Use white logo for dark backgrounds (e.g. nav bar) */
  variant?: "default" | "white";
  /** When true, render span instead of Link (use when already inside a link) */
  noLink?: boolean;
}

export function AtriumHealthLogo({
  className,
  compact = false,
  iconOnly = false,
  variant = "default",
  noLink = false,
}: AtriumHealthLogoProps) {
  const logoSrc = variant === "white" ? "/atrium-health-logo-white.svg" : "/atrium-health-logo.svg";

  const content = (
    <Image
        src={logoSrc}
        alt="Atrium Health"
        width={compact ? 140 : 200}
        height={compact ? 30 : 43}
        className={cn("h-auto", compact ? "w-[140px]" : "w-[200px]")}
        priority
      />
  );

  return iconOnly || noLink ? (
    <span className={cn("inline-flex items-center", className)}>{content}</span>
  ) : (
    <Link href="/" className={cn("inline-flex items-center", className)}>
      {content}
    </Link>
  );
}
