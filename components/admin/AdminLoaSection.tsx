"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Check, X } from "lucide-react";
import { format } from "date-fns";

interface LoaRequestWithUser {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  type: string;
  status: string;
  created_at: string;
  requester_name?: string | null;
}

interface AdminLoaSectionProps {
  pendingLoas: LoaRequestWithUser[];
}

const TYPE_LABELS: Record<string, string> = {
  pto: "PTO",
  sick: "Sick",
  other: "Other",
};

export function AdminLoaSection({ pendingLoas }: AdminLoaSectionProps) {
  const router = useRouter();

  const handleReview = async (id: string, status: "approved" | "denied") => {
    const supabase = createClient();
    const { data } = await supabase.auth.getClaims();
    const userId = (data?.claims as { sub?: string } | undefined)?.sub;
    if (!userId) return;
    await supabase
      .from("time_off_requests")
      .update({
        status,
        reviewed_by_id: userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);
    router.refresh();
  };

  return (
    <Card className="border-slate-200 dark:border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-700 dark:text-foreground">
          <Calendar className="h-4 w-4 text-[#1a4d8c] dark:text-primary" />
          Leave of Absence Requests
        </CardTitle>
        <CardDescription>Approve or deny pending LOA requests.</CardDescription>
      </CardHeader>
      <CardContent>
        {pendingLoas.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending requests.</p>
        ) : (
          <div className="space-y-3">
            {pendingLoas.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-border p-3"
              >
                <div>
                  <p className="font-medium text-sm">{r.requester_name ?? "Unknown"}</p>
                  <p className="text-xs text-muted-foreground">
                    {TYPE_LABELS[r.type] ?? r.type} · {format(new Date(r.start_date), "MMM d, yyyy")} – {format(new Date(r.end_date), "MMM d, yyyy")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="default" onClick={() => handleReview(r.id, "approved")}>
                    <Check className="h-4 w-4 mr-1" /> Approve
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleReview(r.id, "denied")}>
                    <X className="h-4 w-4 mr-1" /> Deny
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
