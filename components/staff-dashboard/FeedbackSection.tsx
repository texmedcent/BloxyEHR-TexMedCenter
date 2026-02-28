"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, BarChart3 } from "lucide-react";
import { isHospitalManager } from "@/lib/roles";

interface Poll {
  id: string;
  title: string;
  options: string[];
  department_key: string | null;
  expires_at: string | null;
}

interface FeedbackSectionProps {
  activePolls: Poll[];
  currentUserId: string;
  currentUserRole: string | null;
  currentUserDepartment: string | null;
}

export function FeedbackSection({
  activePolls,
  currentUserId,
  currentUserRole,
  currentUserDepartment,
}: FeedbackSectionProps) {
  const router = useRouter();
  const [feedbackText, setFeedbackText] = useState("");
  const [anonymous, setAnonymous] = useState(true);
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [savingPoll, setSavingPoll] = useState<string | null>(null);
  const isManager = isHospitalManager(currentUserRole);

  const now = new Date().toISOString();
  const visiblePolls = activePolls.filter(
    (p) => !p.expires_at || p.expires_at >= now
  ).filter(
    (p) => !p.department_key || p.department_key === currentUserDepartment
  );

  const submitFeedback = async () => {
    if (!feedbackText.trim()) return;
    setSavingFeedback(true);
    const supabase = createClient();
    await supabase.from("staff_feedback").insert({
      user_id: anonymous ? null : currentUserId,
      type: "feedback",
      content: { text: feedbackText.trim() },
    });
    setFeedbackText("");
    setSavingFeedback(false);
    router.refresh();
  };

  const submitPollResponse = async (
    pollId: string,
    optionIndex: number,
    optionText: string
  ) => {
    setSavingPoll(pollId);
    const supabase = createClient();
    await supabase.from("staff_feedback").insert({
      user_id: currentUserId,
      type: "poll_response",
      poll_id: pollId,
      content: { optionIndex, option: optionText },
    });
    setSavingPoll(null);
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          Feedback & Suggestions
        </CardTitle>
        <CardDescription>Anonymous feedback and staff polls.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h4 className="text-sm font-medium mb-2">Submit Feedback</h4>
          <Textarea
            placeholder="Share feedback or suggestions (anonymous by default)"
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            rows={3}
            className="mb-2"
          />
          <label className="flex items-center gap-2 text-sm mb-2">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
            />
            Submit anonymously
          </label>
          <Button
            size="sm"
            onClick={submitFeedback}
            disabled={savingFeedback || !feedbackText.trim()}
          >
            Submit
          </Button>
        </div>

        {visiblePolls.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
              <BarChart3 className="h-4 w-4" />
              Active Polls
            </h4>
            <div className="space-y-3">
              {visiblePolls.map((poll) => {
                const options = Array.isArray(poll.options)
                  ? poll.options
                  : [];
                return (
                  <div
                    key={poll.id}
                    className="rounded-lg border border-border p-3 text-sm"
                  >
                    <div className="font-medium mb-2">{poll.title}</div>
                    <div className="flex flex-wrap gap-2">
                      {options.map((opt, i) => {
                        const optionText =
                          typeof opt === "string" ? opt : String(opt);
                        return (
                          <Button
                            key={i}
                            variant="outline"
                            size="sm"
                            disabled={!!savingPoll}
                            onClick={() =>
                              submitPollResponse(poll.id, i, optionText)
                            }
                          >
                            {optionText}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {visiblePolls.length === 0 && !feedbackText && (
          <p className="text-sm text-muted-foreground">No active polls.</p>
        )}
      </CardContent>
    </Card>
  );
}
