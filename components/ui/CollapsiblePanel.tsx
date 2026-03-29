import { ChevronDown } from "lucide-react";

type CollapsiblePanelProps = {
  id?: string;
  title: string;
  description?: string;
  defaultOpen?: boolean;
  summaryRight?: React.ReactNode;
  children: React.ReactNode;
};

export function CollapsiblePanel({
  id,
  title,
  description,
  defaultOpen = false,
  summaryRight,
  children,
}: CollapsiblePanelProps) {
  return (
    <details
      id={id}
      open={defaultOpen}
      className="group overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-border dark:bg-card"
    >
      <summary className="list-none cursor-pointer select-none p-4 sm:p-5 [&::-webkit-details-marker]:hidden">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-900 dark:text-foreground">{title}</h3>
            {description ? (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {summaryRight}
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </div>
        </div>
      </summary>
      <div className="border-t border-slate-200 p-4 sm:p-5 dark:border-border">{children}</div>
    </details>
  );
}
