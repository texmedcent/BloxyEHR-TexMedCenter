import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";
import { format } from "date-fns";

interface FeedbackItem {
  id: string;
  user_id: string | null;
  content: { text?: string } | null;
  created_at: string;
  submitter_name?: string | null;
}

interface AdminFeedbackSectionProps {
  feedback: FeedbackItem[];
}

export function AdminFeedbackSection({ feedback }: AdminFeedbackSectionProps) {
  return (
    <Card className="border-slate-200 dark:border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-700 dark:text-foreground">
          <MessageSquare className="h-4 w-4 text-[#1a4d8c] dark:text-primary" />
          Feedback & Suggestions
        </CardTitle>
        <CardDescription>Staff suggestions and feedback submissions.</CardDescription>
      </CardHeader>
      <CardContent>
        {feedback.length === 0 ? (
          <p className="text-sm text-muted-foreground">No feedback yet.</p>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {feedback.map((f) => (
              <div
                key={f.id}
                className="rounded-lg border border-slate-200 dark:border-border p-3"
              >
                <p className="text-sm">{f.content?.text ?? "(No text)"}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {f.submitter_name ?? "Anonymous"} · {format(new Date(f.created_at), "MMM d, yyyy")}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
