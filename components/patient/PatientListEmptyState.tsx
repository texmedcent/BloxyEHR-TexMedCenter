"use client";

import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

type PatientListEmptyStateProps = {
  title: string;
  description: string;
  onBook?: () => void;
};

export function PatientListEmptyState({ title, description, onBook }: PatientListEmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 dark:border-border bg-slate-50/50 dark:bg-muted/20 p-6 text-center">
      <div className="mx-auto mb-4 max-w-[200px] opacity-40" aria-hidden>
        <svg viewBox="0 0 200 120" className="w-full text-slate-400">
          <rect x="8" y="12" width="184" height="20" rx="4" fill="currentColor" />
          <rect x="8" y="40" width="140" height="14" rx="3" fill="currentColor" opacity="0.6" />
          <rect x="8" y="60" width="184" height="14" rx="3" fill="currentColor" opacity="0.45" />
          <rect x="8" y="80" width="120" height="14" rx="3" fill="currentColor" opacity="0.35" />
          <rect x="8" y="100" width="160" height="14" rx="3" fill="currentColor" opacity="0.3" />
        </svg>
      </div>
      <p className="text-sm font-medium text-slate-800 dark:text-foreground">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
      {onBook && (
        <Button type="button" size="sm" className="mt-4" onClick={onBook}>
          <CalendarPlus className="mr-2 h-4 w-4" />
          Book your first visit
        </Button>
      )}
    </div>
  );
}
