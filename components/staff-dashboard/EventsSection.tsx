"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Plus } from "lucide-react";
import { format } from "date-fns";
import { isHospitalManager } from "@/lib/roles";

interface StaffEvent {
  id: string;
  title: string;
  description: string | null;
  department_key: string | null;
  start_at: string;
  end_at: string;
  location: string | null;
  rsvp_required: boolean;
}

interface Rsvp {
  event_id: string;
  user_id: string;
  status: string;
}

interface EventsSectionProps {
  events: StaffEvent[];
  myRsvps: Rsvp[];
  currentUserId: string;
  currentUserRole: string | null;
  currentUserDepartment: string | null;
}

export function EventsSection({
  events,
  myRsvps,
  currentUserId,
  currentUserRole,
  currentUserDepartment,
}: EventsSectionProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [location, setLocation] = useState("");
  const [departmentKey, setDepartmentKey] = useState("");
  const [rsvpRequired, setRsvpRequired] = useState(false);
  const [saving, setSaving] = useState(false);
  const isManager = isHospitalManager(currentUserRole);

  const now = new Date().toISOString();
  const upcomingEvents = events
    .filter((e) => e.end_at >= now)
    .filter(
      (e) =>
        !e.department_key || e.department_key === currentUserDepartment
    )
    .sort((a, b) => a.start_at.localeCompare(b.start_at))
    .slice(0, 10);

  const createEvent = async () => {
    if (!title.trim() || !startAt || !endAt) return;
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from("staff_events").insert({
      title: title.trim(),
      description: description.trim() || null,
      department_key: departmentKey.trim() || null,
      start_at: startAt,
      end_at: endAt,
      location: location.trim() || null,
      rsvp_required: rsvpRequired,
      created_by_id: user?.id,
    });
    setTitle("");
    setDescription("");
    setStartAt("");
    setEndAt("");
    setLocation("");
    setDepartmentKey("");
    setShowForm(false);
    setSaving(false);
    router.refresh();
  };

  const rsvp = async (eventId: string, status: "yes" | "no" | "maybe") => {
    const supabase = createClient();
    await supabase
      .from("staff_event_rsvps")
      .delete()
      .eq("event_id", eventId)
      .eq("user_id", currentUserId);
    await supabase.from("staff_event_rsvps").insert({
      event_id: eventId,
      user_id: currentUserId,
      status,
    });
    router.refresh();
  };

  const getMyRsvp = (eventId: string) =>
    myRsvps.find((r) => r.event_id === eventId)?.status;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Events & Meetings
            </CardTitle>
            <CardDescription>Department meetings and staff events.</CardDescription>
          </div>
          {isManager && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowForm(!showForm)}
              className="gap-1"
            >
              <Plus className="h-4 w-4" />
              New Event
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && isManager && (
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <Input
              placeholder="Event title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Textarea
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
            <div className="flex flex-wrap gap-2">
              <Input
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="max-w-[200px]"
              />
              <Input
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                className="max-w-[200px]"
              />
            </div>
            <Input
              placeholder="Location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
            <Input
              placeholder="Department (optional)"
              value={departmentKey}
              onChange={(e) => setDepartmentKey(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={rsvpRequired}
                onChange={(e) => setRsvpRequired(e.target.checked)}
              />
              RSVP required
            </label>
            <Button size="sm" onClick={createEvent} disabled={saving}>
              Create Event
            </Button>
          </div>
        )}

        <div className="space-y-2 max-h-48 overflow-y-auto">
          {upcomingEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming events.</p>
          ) : (
            upcomingEvents.map((e) => {
              const myStatus = getMyRsvp(e.id);
              return (
                <div
                  key={e.id}
                  className="rounded-lg border border-border p-3 text-sm"
                >
                  <div className="font-medium">{e.title}</div>
                  {e.description && (
                    <p className="text-muted-foreground text-xs mt-0.5">
                      {e.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                    {format(new Date(e.start_at), "EEE, MMM d, h:mm a")}
                    {e.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {e.location}
                      </span>
                    )}
                  </p>
                  {e.department_key && (
                    <Badge variant="secondary" className="text-xs mt-1">
                      {e.department_key}
                    </Badge>
                  )}
                  {e.rsvp_required && (
                    <div className="flex gap-1 mt-2">
                      {(["yes", "no", "maybe"] as const).map((status) => (
                        <Button
                          key={status}
                          variant={myStatus === status ? "default" : "outline"}
                          size="sm"
                          className="h-7 text-xs capitalize"
                          onClick={() => rsvp(e.id, status)}
                        >
                          {status}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
