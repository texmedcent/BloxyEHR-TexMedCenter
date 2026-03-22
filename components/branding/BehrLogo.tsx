import { cn } from "@/lib/utils";

interface BehrLogoProps {
  className?: string;
  compact?: boolean;
  iconOnly?: boolean;
  /** Use white/light styling when logo is on a dark background (e.g. sidebar) */
  inverted?: boolean;
}

function HexMark({ compact }: { compact?: boolean }) {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-label="BEHR logo mark"
      className={cn(compact ? "h-8 w-8" : "h-14 w-14")}
      role="img"
    >
      <polygon points="50,6 88,28 88,72 50,94 12,72 12,28" fill="currentColor" />
    </svg>
  );
}

export function BehrLogo({
  className,
  compact = false,
  iconOnly = false,
  inverted = false,
}: BehrLogoProps) {
  const textColor = inverted ? "text-white" : "text-primary";
  return (
    <div className={cn("inline-flex items-center gap-3", inverted ? "text-white" : "text-primary", className)}>
      <HexMark compact={compact} />
      {!iconOnly && (
        <div className={cn("leading-none", textColor)}>
          <p
            className={cn(
              "font-black tracking-tight",
              textColor,
              compact ? "text-xl" : "text-4xl sm:text-5xl"
            )}
          >
            BLOXY
          </p>
          <p
            className={cn(
              "font-extrabold tracking-tight",
              textColor,
              compact ? "text-sm" : "text-2xl sm:text-3xl"
            )}
          >
            EHR SYSTEM
          </p>
        </div>
      )}
    </div>
  );
}
