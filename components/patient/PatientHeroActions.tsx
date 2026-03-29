"use client";

import { NeedCareNowCard } from "@/components/patient/visit-navigator/NeedCareNowCard";
import { usePatientSchedule } from "@/components/patient/PatientScheduleProvider";

type PatientHeroActionsProps = {
  patientId: string | null;
  followUpProviderId: string | null;
  followUpProviderName: string | null;
};

export function PatientHeroActions({
  patientId: _patientId,
  followUpProviderId,
  followUpProviderName,
}: PatientHeroActionsProps) {
  const { openSchedule } = usePatientSchedule();

  return (
    <div className="mt-4 space-y-3">
      <NeedCareNowCard
        followUpProviderId={followUpProviderId}
        followUpProviderName={followUpProviderName}
        onOpenSchedule={openSchedule}
      />
    </div>
  );
}
