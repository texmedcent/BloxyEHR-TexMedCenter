"use client";

import { CalendarPlus, Stethoscope, Video } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMemo, useState } from "react";
import { SPECIALTY_AND_SYMPTOM_OPTIONS } from "./constants";

type NeedCareNowCardProps = {
  followUpProviderName: string | null;
  followUpProviderId: string | null;
  onOpenSchedule: (opts: {
    defaultProviderId: string | null;
    visitType?: string;
    specialtyFilter?: string;
    isVirtual?: boolean;
  }) => void;
};

export function NeedCareNowCard({
  followUpProviderName,
  followUpProviderId,
  onOpenSchedule,
}: NeedCareNowCardProps) {
  const [concernQuery, setConcernQuery] = useState("");

  const filteredSpecialties = useMemo(() => {
    const q = concernQuery.trim().toLowerCase();
    if (!q) return [...SPECIALTY_AND_SYMPTOM_OPTIONS];
    return SPECIALTY_AND_SYMPTOM_OPTIONS.filter((s) => s.toLowerCase().includes(q));
  }, [concernQuery]);

  return (
    <Card className="border-primary/25 bg-gradient-to-br from-primary/5 to-transparent dark:from-primary/10">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Stethoscope className="h-5 w-5 text-primary" />
          Need care now?
        </CardTitle>
        <p className="text-xs text-slate-600 dark:text-muted-foreground">
          Choose how you’d like to schedule—follow-up, new concern, or a virtual visit.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {followUpProviderName && followUpProviderId ? (
            <Button
              className="flex-1 justify-start gap-2 sm:min-w-[200px]"
              onClick={() =>
                onOpenSchedule({
                  defaultProviderId: followUpProviderId,
                  visitType: "Follow-up",
                })
              }
            >
              <CalendarPlus className="h-4 w-4 shrink-0" />
              Schedule with {followUpProviderName}
            </Button>
          ) : (
            <Button
              variant="secondary"
              className="flex-1 justify-start gap-2 sm:min-w-[200px]"
              disabled
              title="No prior visit with an assigned provider on file"
            >
              <CalendarPlus className="h-4 w-4 shrink-0" />
              Follow-up (no provider on file)
            </Button>
          )}
          <Button
            variant="outline"
            className="flex-1 justify-start gap-2 sm:min-w-[200px]"
            onClick={() => onOpenSchedule({ defaultProviderId: null, isVirtual: true, visitType: "Virtual visit" })}
          >
            <Video className="h-4 w-4 shrink-0" />
            Virtual visit
          </Button>
        </div>
        <div className="space-y-2 rounded-lg border border-slate-200 dark:border-border bg-white/80 dark:bg-card/80 p-3">
          <Label htmlFor="concern-search" className="text-xs font-medium uppercase tracking-wide text-slate-500">
            New concern — search specialty or symptom
          </Label>
          <Input
            id="concern-search"
            value={concernQuery}
            onChange={(e) => setConcernQuery(e.target.value)}
            placeholder="e.g. Cardiology, cough, checkup…"
            className="h-9"
          />
          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
            {filteredSpecialties.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() =>
                  onOpenSchedule({
                    defaultProviderId: null,
                    visitType: "New patient",
                    specialtyFilter: s,
                  })
                }
                className="rounded-full border border-slate-200 dark:border-border bg-slate-50 dark:bg-muted px-2.5 py-1 text-xs text-slate-700 dark:text-foreground hover:border-primary/50 hover:bg-primary/5 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
