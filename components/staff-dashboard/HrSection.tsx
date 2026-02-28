"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Plus, FileText } from "lucide-react";
import { format } from "date-fns";

interface LoaRequest {
  id: string;
  start_date: string;
  end_date: string;
  type: string;
  status: string;
  created_at: string;
}

interface HrSectionProps {
  timeOffRequests: LoaRequest[];
  currentUserId: string;
}

const TYPE_LABELS: Record<string, string> = {
  pto: "PTO",
  sick: "Sick",
  other: "Other",
};

export function HrSection({ timeOffRequests, currentUserId }: HrSectionProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [type, setType] = useState<"pto" | "sick" | "other">("pto");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const myRequests = timeOffRequests.filter((r) => r.status !== "cancelled");

  const submitLoaRequest = async () => {
    if (!startDate || !endDate) {
      setError("Start and end dates are required.");
      return;
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      setError("End date must be on or after start date.");
      return;
    }
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.from("time_off_requests").insert({
      user_id: currentUserId,
      start_date: startDate,
      end_date: endDate,
      type,
    });
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setStartDate("");
    setEndDate("");
    setShowForm(false);
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-primary" />
          HR / Internal Tools
        </CardTitle>
        <CardDescription>Leave of absence requests, benefits, and training.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium">Leave of Absence Requests</h4>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowForm(!showForm)}
              className="gap-1"
            >
              <Plus className="h-4 w-4" />
              Request
            </Button>
          </div>
          {showForm && (
            <div className="rounded-lg border border-border p-3 space-y-2 mb-3">
              <div className="flex gap-2 flex-wrap">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="max-w-[140px]"
                />
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="max-w-[140px]"
                />
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as "pto" | "sick" | "other")}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="pto">PTO</option>
                  <option value="sick">Sick</option>
                  <option value="other">Other</option>
                </select>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button size="sm" onClick={submitLoaRequest} disabled={saving}>
                {saving ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          )}
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {myRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No leave of absence requests.</p>
            ) : (
              myRequests.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-lg border border-border p-2 text-sm"
                >
                  <div>
                    <span className="font-medium">{TYPE_LABELS[r.type] || r.type}</span>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(r.start_date), "MMM d")} – {format(new Date(r.end_date), "MMM d")}
                    </p>
                  </div>
                  <Badge
                    variant={
                      r.status === "approved"
                        ? "default"
                        : r.status === "denied"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {r.status}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
            <FileText className="h-4 w-4" />
            Resources
          </h4>
          <p className="text-sm text-muted-foreground">
            Benefits info and payroll are available via Quick Access links above.
            Training modules can be accessed from the HR portal.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
