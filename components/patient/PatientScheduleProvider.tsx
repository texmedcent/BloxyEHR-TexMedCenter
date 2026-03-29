"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { VisitNavigatorModal, type VisitNavigatorOpenOptions } from "@/components/patient/visit-navigator/VisitNavigatorModal";

type ProviderOption = {
  id: string;
  full_name: string | null;
  department: string | null;
  role: string | null;
};

type Ctx = {
  openSchedule: (opts?: VisitNavigatorOpenOptions) => void;
};

const ScheduleContext = createContext<Ctx | null>(null);

export function usePatientSchedule() {
  const v = useContext(ScheduleContext);
  if (!v) throw new Error("usePatientSchedule must be used within PatientScheduleProvider");
  return v;
}

export function PatientScheduleProvider({
  children,
  patientId,
  providers,
}: {
  children: React.ReactNode;
  patientId: string | null;
  providers: ProviderOption[];
}) {
  const [open, setOpen] = useState(false);
  const [initialOptions, setInitialOptions] = useState<VisitNavigatorOpenOptions | null>(null);

  const openSchedule = useCallback(
    (opts?: VisitNavigatorOpenOptions) => {
      setInitialOptions(opts ?? { defaultProviderId: providers[0]?.id ?? null });
      setOpen(true);
    },
    [providers]
  );

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) setInitialOptions(null);
  }, []);

  const value = useMemo(() => ({ openSchedule }), [openSchedule]);

  return (
    <ScheduleContext.Provider value={value}>
      {children}
      <VisitNavigatorModal
        open={open}
        onOpenChange={handleOpenChange}
        patientId={patientId}
        providers={providers}
        initialOptions={initialOptions}
      />
    </ScheduleContext.Provider>
  );
}
