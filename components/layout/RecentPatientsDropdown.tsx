"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Clock, Pin } from "lucide-react";
import { format } from "date-fns";

interface RecentPatient {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
  viewed_at: string;
  is_pinned: boolean;
}

export function RecentPatientsDropdown() {
  const [patients, setPatients] = useState<RecentPatient[]>([]);
  const router = useRouter();

  useEffect(() => {
    const fetchRecent = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: recents } = await supabase
        .from("recent_patients")
        .select("patient_id, viewed_at, is_pinned")
        .eq("user_id", user.id)
        .order("is_pinned", { ascending: false })
        .order("viewed_at", { ascending: false })
        .limit(10);

      if (!recents?.length) return;

      const ids = recents.map((r) => r.patient_id);
      const { data: patientList } = await supabase
        .from("patients")
        .select("id, mrn, first_name, last_name")
        .in("id", ids);

      const patientMap = new Map((patientList || []).map((p) => [p.id, p]));
      const mapped: RecentPatient[] = recents
        .map((r) => {
          const p = patientMap.get(r.patient_id);
          return p ? { ...p, viewed_at: r.viewed_at, is_pinned: r.is_pinned } : null;
        })
        .filter((x): x is RecentPatient => x !== null);
      setPatients(mapped);
    };

    fetchRecent();
  }, []);

  const openPatient = (patientId: string) => {
    router.push(`/chart/${patientId}`);
  };

  const togglePin = async (e: React.MouseEvent, patientId: string) => {
    e.stopPropagation();
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const current = patients.find((p) => p.id === patientId);
    if (!current) return;

    await supabase
      .from("recent_patients")
      .upsert(
        {
          user_id: user.id,
          patient_id: patientId,
          is_pinned: !current.is_pinned,
          viewed_at: current.viewed_at,
        },
        { onConflict: "user_id,patient_id" }
      );
    setPatients((prev) =>
      prev.map((p) =>
        p.id === patientId ? { ...p, is_pinned: !p.is_pinned } : p
      )
    );
  };

  if (patients.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Clock className="h-4 w-4" />
          Recent Patients
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        {patients.map((p) => (
          <DropdownMenuItem
            key={p.id}
            onClick={() => openPatient(p.id)}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="min-w-0">
              <p className="font-medium truncate">
                {p.last_name}, {p.first_name}
              </p>
              <p className="text-xs text-gray-500">
                MRN: {p.mrn} · {format(new Date(p.viewed_at), "MM/dd")}
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => togglePin(e, p.id)}
              className="shrink-0 p-1 rounded hover:bg-gray-200"
              title={p.is_pinned ? "Unpin" : "Pin"}
            >
              <Pin
                className={`h-4 w-4 ${p.is_pinned ? "fill-[#1a4d8c] text-[#1a4d8c]" : "text-gray-400"}`}
              />
            </button>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
