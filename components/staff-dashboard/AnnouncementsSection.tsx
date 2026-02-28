"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Plus } from "lucide-react";
import { format } from "date-fns";
import { isHospitalManager } from "@/lib/roles";

interface Announcement {
  id: string;
  title: string;
  body: string;
  scope: string;
  department_key: string | null;
  priority: string;
  created_at: string;
  created_by_id: string | null;
  expires_at: string | null;
}

interface AnnouncementsSectionProps {
  announcements: Announcement[];
  currentUserRole: string | null;
  currentUserDepartment: string | null;
}

export function AnnouncementsSection({
  announcements,
  currentUserRole,
  currentUserDepartment,
}: AnnouncementsSectionProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [scope, setScope] = useState<"hospital" | "department">("hospital");
  const [priority, setPriority] = useState<"normal" | "urgent">("normal");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCreate = isHospitalManager(currentUserRole);
  const now = new Date().toISOString();

  const visible = announcements.filter((a) => {
    if (a.expires_at && a.expires_at < now) return false;
    if (a.scope === "department" && a.department_key !== currentUserDepartment) return false;
    return true;
  });

  const createAnnouncement = async () => {
    if (!title.trim() || !body.trim()) {
      setError("Title and body are required.");
      return;
    }
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = user
      ? await supabase.from("profiles").select("full_name").eq("id", user.id).single()
      : { data: null };

    const { error: err } = await supabase.from("announcements").insert({
      title: title.trim(),
      body: body.trim(),
      scope,
      department_key: scope === "department" ? currentUserDepartment : null,
      priority,
      created_by_id: user?.id ?? null,
    });

    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setTitle("");
    setBody("");
    setShowForm(false);
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-primary" />
              Announcements
            </CardTitle>
            <CardDescription>Hospital-wide and department bulletins.</CardDescription>
          </div>
          {canCreate && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowForm(!showForm)}
              className="gap-1"
            >
              <Plus className="h-4 w-4" />
              New
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && canCreate && (
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <Input
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Textarea
              placeholder="Body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
            />
            <div className="flex flex-wrap gap-2">
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as "hospital" | "department")}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="hospital">Hospital-wide</option>
                <option value="department">Department only</option>
              </select>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as "normal" | "urgent")}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button onClick={createAnnouncement} disabled={saving} size="sm">
                {saving ? "Posting..." : "Post"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">No announcements.</p>
          ) : (
            visible.map((a) => (
              <div
                key={a.id}
                className="rounded-lg border border-border p-3 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{a.title}</span>
                      {a.priority === "urgent" && (
                        <Badge variant="destructive" className="text-xs">
                          Urgent
                        </Badge>
                      )}
                      {a.scope === "department" && a.department_key && (
                        <Badge variant="secondary" className="text-xs">
                          {a.department_key}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-muted-foreground whitespace-pre-wrap">
                      {a.body}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {format(new Date(a.created_at), "MMM d, yyyy h:mm a")}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
