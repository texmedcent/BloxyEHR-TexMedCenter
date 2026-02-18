import { cn } from "@/lib/utils";

interface BehrLogoProps {
  className?: string;
  compact?: boolean;
  iconOnly?: boolean;
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

export function BehrLogo({ className, compact = false, iconOnly = false }: BehrLogoProps) {
  return (
    <div className={cn("inline-flex items-center gap-3 text-[#1a4d8c]", className)}>
      <HexMark compact={compact} />
      {!iconOnly && (
        <div className="leading-none">
          <p
            className={cn(
              "font-black tracking-tight text-[#1a4d8c]",
              compact ? "text-xl" : "text-4xl sm:text-5xl"
            )}
          >
            BLOXY
          </p>
          <p
            className={cn(
              "font-extrabold tracking-tight text-[#1a4d8c]",
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
