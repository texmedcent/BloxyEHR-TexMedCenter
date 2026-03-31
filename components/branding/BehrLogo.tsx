import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  BRAND_MARK_BLUE,
  BRAND_MARK_WHITE,
  POWERED_BY,
  PRODUCT_NAME,
  PRODUCT_NAME_SHORT,
} from "@/lib/branding";

interface BehrLogoProps {
  className?: string;
  compact?: boolean;
  iconOnly?: boolean;
  /** Sidebar / tight rows: text only — avoids Texas mark + "TMC" double-T and serif/sans clash */
  wordmarkOnly?: boolean;
  /** Center TMC + subtitle stack (mobile/patient headers); responsive = centered until sm */
  wordmarkAlign?: "start" | "center" | "responsive";
  inverted?: boolean;
  fullName?: boolean;
  showPoweredBy?: boolean;
  emphasizeShortName?: boolean;
}

/** Crisp text: reset Geist feature tags; grayscale AA avoids RGB fringe on primary/solid fills */
const wordmarkText =
  "antialiased [font-feature-settings:normal] [font-synthesis:none]";

function TmcMark({
  className,
  inverted,
  compact,
  fullName,
  emphasizeShortName,
}: {
  className?: string;
  inverted?: boolean;
  compact?: boolean;
  fullName?: boolean;
  emphasizeShortName?: boolean;
}) {
  const sizeClass =
    compact && fullName
      ? "h-9 w-9 min-h-9 min-w-9 sm:h-10 sm:w-10 sm:min-h-10 sm:min-w-10"
      : emphasizeShortName
        ? "h-10 w-10 sm:h-11 sm:w-11"
        : compact
          ? "h-8 w-8"
          : "h-12 w-12 sm:h-14 sm:w-14";

  return (
    <Image
      src={inverted ? BRAND_MARK_WHITE : BRAND_MARK_BLUE}
      alt=""
      width={512}
      height={512}
      unoptimized
      className={cn(
        "shrink-0 object-contain [image-rendering:auto]",
        sizeClass,
        className
      )}
      sizes={
        compact && fullName
          ? "40px"
          : emphasizeShortName
            ? "88px"
            : compact
              ? "64px"
              : "(max-width: 640px) 96px, 112px"
      }
    />
  );
}

export function BehrLogo({
  className,
  compact = false,
  iconOnly = false,
  wordmarkOnly = false,
  wordmarkAlign = "start",
  inverted = false,
  fullName = false,
  showPoweredBy = true,
  emphasizeShortName = false,
}: BehrLogoProps) {
  const showMark = !wordmarkOnly || iconOnly;
  const alignRoot =
    wordmarkOnly && wordmarkAlign === "center"
      ? "flex-col items-center justify-center gap-1 text-center"
      : wordmarkOnly && wordmarkAlign === "responsive"
        ? "flex-col items-center justify-center gap-1 text-center sm:items-start sm:text-left"
        : null;
  const textMain = inverted ? "text-white" : "text-primary";
  const textSub = inverted ? "text-white/85" : "text-primary/80";
  const primaryLabel = compact && !fullName ? PRODUCT_NAME_SHORT : PRODUCT_NAME;

  const titleClass = cn(
    wordmarkText,
    "font-bold tracking-tight",
    textMain,
    emphasizeShortName && compact && !fullName
      ? "text-xl leading-none sm:text-2xl"
      : compact && fullName
        ? "whitespace-nowrap text-sm leading-tight sm:text-base"
        : compact
          ? "text-base sm:text-lg"
          : "text-2xl font-bold sm:text-3xl lg:text-4xl"
  );

  return (
    <div
      className={cn(
        "inline-flex gap-2.5 sm:gap-3",
        alignRoot ?? "items-center",
        inverted ? "text-white brand-wordmark-invert" : "text-primary",
        className
      )}
    >
      {showMark && (
        <TmcMark
          inverted={inverted}
          compact={compact}
          fullName={fullName}
          emphasizeShortName={emphasizeShortName && !iconOnly}
        />
      )}
      {!iconOnly && (
        <div
          className={cn(
            "min-w-0 leading-tight",
            wordmarkOnly && wordmarkAlign === "center" && "text-center",
            wordmarkOnly && wordmarkAlign === "responsive" && "text-center sm:text-left"
          )}
        >
          <p className={titleClass}>{primaryLabel}</p>
          {showPoweredBy && (
            <p
              className={cn(
                wordmarkText,
                "mt-0.5 font-medium tracking-normal",
                textSub,
                compact ? "text-[10px] sm:text-xs" : "text-xs sm:text-sm"
              )}
            >
              {POWERED_BY}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
