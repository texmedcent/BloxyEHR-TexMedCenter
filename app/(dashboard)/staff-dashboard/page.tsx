import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { QuickLinksSection } from "@/components/staff-dashboard/QuickLinksSection";
import { StaffDirectorySection } from "@/components/staff-dashboard/StaffDirectorySection";
import { AnnouncementsSection } from "@/components/staff-dashboard/AnnouncementsSection";
import { StaffTasksSection } from "@/components/staff-dashboard/StaffTasksSection";
import { ShiftManagementSection } from "@/components/staff-dashboard/ShiftManagementSection";
import { HrSection } from "@/components/staff-dashboard/HrSection";
import { EventsSection } from "@/components/staff-dashboard/EventsSection";
import { FeedbackSection } from "@/components/staff-dashboard/FeedbackSection";
import { StaffDashboardTabs } from "@/components/staff-dashboard/StaffDashboardTabs";
import { StaffDashboardOverview } from "@/components/staff-dashboard/StaffDashboardOverview";
import { STAFF_ROLES } from "@/lib/roles";
import { isHospitalManager } from "@/lib/roles";

export default async function StaffDashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as { sub?: string } | undefined;
  const userId = claims?.sub;

  if (!userId) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, department")
    .eq("id", userId)
    .single();

  if (!profile?.role || profile.role === "patient") {
    redirect("/patient");
  }

  const now = new Date().toISOString();
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // Staff directory (exclude self, patients)
  const { data: staff } = await supabase
    .from("profiles")
    .select("id, full_name, role, department, email")
    .in("role", STAFF_ROLES)
    .neq("id", userId)
    .order("full_name");

  // Quick links
  const { data: quickLinks } = await supabase
    .from("quick_links")
    .select("id, label, url, category, sort_order")
    .eq("is_active", true)
    .order("sort_order");

  // Announcements
  const { data: announcements } = await supabase
    .from("announcements")
    .select("id, title, body, scope, department_key, priority, created_at, created_by_id, expires_at")
    .order("created_at", { ascending: false })
    .limit(50);

  // Personal tasks (in_basket_tasks, non-patient)
  const { data: personalTasks } = await supabase
    .from("in_basket_tasks")
    .select("id, title, details, due_at, priority, status")
    .eq("owner_id", userId)
    .is("patient_id", null)
    .order("created_at", { ascending: false })
    .limit(50);

  // Department tasks
  const { data: departmentTasks } = profile?.department
    ? await supabase
        .from("department_tasks")
        .select("id, department, title, details, due_at, priority, status, assignee_id")
        .eq("department", profile.department)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] };

  // Upcoming shifts (next 7 days)
  const { data: upcomingShifts } = await supabase
    .from("staff_shifts")
    .select("id, user_id, department, shift_type, scheduled_start, scheduled_end, status")
    .gte("scheduled_start", now)
    .lte("scheduled_start", sevenDaysFromNow)
    .eq("status", "scheduled")
    .order("scheduled_start")
    .limit(100);

  // Shift swap requests (for managers)
  type SwapRequestRow = {
    id: string;
    original_shift_id: string;
    requested_by_id: string;
    status: string;
    original_shift?: { id: string; scheduled_start: string; shift_type: string } | null;
    requested_by_name?: string | null;
  };
  let swapRequests: SwapRequestRow[] = [];
  if (isHospitalManager(profile?.role)) {
    const { data: swaps } = await supabase
      .from("shift_swap_requests")
      .select("id, original_shift_id, requested_by_id, status")
      .eq("status", "pending");
    if (swaps?.length) {
      const shiftIds = swaps.map((s) => s.original_shift_id);
      const { data: shifts } = await supabase
        .from("staff_shifts")
        .select("*")
        .in("id", shiftIds);
      const reqIds = swaps.map((s) => s.requested_by_id);
      const { data: reqProfiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", reqIds);
      const shiftMap = new Map((shifts || []).map((s) => [s.id, s]));
      const nameMap = new Map((reqProfiles || []).map((p) => [p.id, p.full_name]));
      swapRequests = (swaps || []).map((s) => ({
        ...s,
        original_shift: shiftMap.get(s.original_shift_id),
        requested_by_name: nameMap.get(s.requested_by_id),
      }));
    }
  }

  // Latest time entry (for clock-in/out)
  const { data: latestTimeEntry } = await supabase
    .from("staff_time_entries")
    .select("id, clock_in_at, clock_out_at")
    .eq("user_id", userId)
    .order("clock_in_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Time-off requests
  const { data: timeOffRequests } = await supabase
    .from("time_off_requests")
    .select("id, start_date, end_date, type, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  // Staff events (upcoming)
  const { data: staffEvents } = await supabase
    .from("staff_events")
    .select("id, title, description, department_key, start_at, end_at, location, rsvp_required")
    .gte("end_at", now)
    .order("start_at")
    .limit(30);

  // My RSVPs
  const { data: myRsvps } = await supabase
    .from("staff_event_rsvps")
    .select("event_id, user_id, status")
    .eq("user_id", userId);

  // Active polls
  const { data: activePolls } = await supabase
    .from("staff_polls")
    .select("id, title, options, department_key, expires_at")
    .or(`expires_at.is.null,expires_at.gte.${now}`)
    .limit(20);

  // Polls user has already responded to (to hide them)
  const { data: myPollResponses } = await supabase
    .from("staff_feedback")
    .select("poll_id")
    .eq("user_id", userId)
    .eq("type", "poll_response")
    .not("poll_id", "is", null);
  const votedPollIds = new Set(
    (myPollResponses || []).map((r) => r.poll_id).filter(Boolean)
  );

  const myShifts = (upcomingShifts || []).filter((s) => s.user_id === userId);
  const nextShift = myShifts[0]
    ? {
        shift_type: myShifts[0].shift_type,
        scheduled_start: myShifts[0].scheduled_start,
        scheduled_end: myShifts[0].scheduled_end,
      }
    : null;
  const latestLoa = (timeOffRequests || [])[0];
  const loaStatus = latestLoa?.status ?? null;
  const loaDates =
    latestLoa && latestLoa.status !== "cancelled"
      ? `${new Date(latestLoa.start_date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })} – ${new Date(latestLoa.end_date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })}`
      : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <LayoutGrid className="h-6 w-6 text-primary shrink-0" />
          Staff Dashboard
        </h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Quick access to your work, tasks, and team.
        </p>
      </div>

      <StaffDashboardTabs
        overviewContent={
          <div className="space-y-6">
            <StaffDashboardOverview
              currentUserId={userId}
              latestTimeEntry={latestTimeEntry}
              nextShift={nextShift}
              loaStatus={loaStatus}
              loaDates={loaDates}
            />
            <QuickLinksSection links={quickLinks || []} />
          </div>
        }
        tasksContent={
          <div className="space-y-6">
            <StaffTasksSection
              personalTasks={personalTasks || []}
              departmentTasks={departmentTasks || []}
              currentUserId={userId}
              currentUserDepartment={profile?.department ?? null}
              isManager={isHospitalManager(profile?.role)}
            />
            <ShiftManagementSection
              upcomingShifts={upcomingShifts || []}
              swapRequests={swapRequests}
              latestTimeEntry={latestTimeEntry}
              currentUserId={userId}
              currentUserRole={profile?.role ?? null}
            />
            <HrSection
              timeOffRequests={timeOffRequests || []}
              currentUserId={userId}
            />
          </div>
        }
        communicationsContent={
          <div className="space-y-6">
            <AnnouncementsSection
              announcements={announcements || []}
              currentUserRole={profile?.role ?? null}
              currentUserDepartment={profile?.department ?? null}
            />
            <EventsSection
              events={staffEvents || []}
              myRsvps={myRsvps || []}
              currentUserId={userId}
              currentUserRole={profile?.role ?? null}
              currentUserDepartment={profile?.department ?? null}
            />
            <FeedbackSection
              activePolls={(activePolls || []).filter((p) => !votedPollIds.has(p.id))}
              currentUserId={userId}
              currentUserRole={profile?.role ?? null}
              currentUserDepartment={profile?.department ?? null}
            />
          </div>
        }
        directoryContent={
          <StaffDirectorySection staff={staff || []} />
        }
      />
    </div>
  );
}
