"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageCircle, Users } from "lucide-react";
import { formatRoleLabel } from "@/lib/roles";

interface StaffMember {
  id: string;
  full_name: string | null;
  role: string | null;
  department: string | null;
  email: string | null;
}

interface StaffDirectorySectionProps {
  staff: StaffMember[];
}

const ROLE_GROUPS: Record<string, string[]> = {
  all: [],
  nurses: ["registered_nurse", "nurse", "licensed_practical_nurse"],
  physicians: [
    "chief_medical_officer",
    "attending_physician",
    "medical_doctor",
    "resident_physician",
    "nurse_practitioner",
    "physician_assistant",
  ],
  admins: ["hospital_manager", "unit_clerk", "admin_staff"],
  allied: [
    "radiologist",
    "pharmacist",
    "lab_technician",
    "respiratory_therapist",
    "physical_therapist",
  ],
};

export function StaffDirectorySection({ staff }: StaffDirectorySectionProps) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const filteredStaff = useMemo(() => {
    let list = staff;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (s) =>
          (s.full_name ?? "").toLowerCase().includes(q) ||
          (s.email ?? "").toLowerCase().includes(q) ||
          (s.department ?? "").toLowerCase().includes(q) ||
          (s.role ?? "").toLowerCase().includes(q)
      );
    }
    if (roleFilter && roleFilter !== "all") {
      const roles = ROLE_GROUPS[roleFilter];
      if (roles?.length) {
        list = list.filter((s) => s.role && roles.includes(s.role));
      }
    }
    return list.sort((a, b) =>
      (a.full_name ?? "zzz").localeCompare(b.full_name ?? "zzz")
    );
  }, [staff, search, roleFilter]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Staff Directory
        </CardTitle>
        <CardDescription>Find colleagues by name, role, or department. Quick start a chat.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Search by name, email, department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
            aria-label="Search staff"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Filter by role"
          >
            <option value="all">All Roles</option>
            <option value="nurses">Nurses</option>
            <option value="physicians">Physicians</option>
            <option value="admins">Admins</option>
            <option value="allied">Allied Health</option>
          </select>
        </div>
        <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Name</th>
                <th className="text-left px-4 py-2.5 font-medium">Role</th>
                <th className="text-left px-4 py-2.5 font-medium">Department</th>
                <th className="text-left px-4 py-2.5 font-medium w-24">Contact</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.map((s) => (
                <tr key={s.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">{s.full_name || "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {formatRoleLabel(s.role)}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{s.department || "—"}</td>
                  <td className="px-4 py-2.5">
                    <Button variant="ghost" size="sm" className="h-7 gap-1" asChild>
                      <Link href={`/chat?openDm=${s.id}`}>
                        <MessageCircle className="h-3.5 w-3.5" />
                        Message
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
              {filteredStaff.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    No staff found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
