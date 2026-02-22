import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User } from "lucide-react";

interface Patient {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
  dob: string;
  gender: string | null;
  contact_info?: Record<string, string> | null;
}

interface PatientDemographicsProps {
  patient: Patient;
}

export function PatientDemographics({ patient }: PatientDemographicsProps) {
  const contact = (patient.contact_info || {}) as Record<string, string>;

  return (
    <Card className="border-slate-200 dark:border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold tracking-normal flex items-center gap-2">
          <User className="h-4 w-4 text-slate-500 dark:text-muted-foreground" />
          Demographics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="grid grid-cols-[110px_1fr] gap-x-4 gap-y-1.5">
          <span className="text-slate-500 dark:text-muted-foreground">Name</span>
          <span className="font-medium text-slate-900 dark:text-foreground">
            {patient.last_name}, {patient.first_name}
          </span>
          <span className="text-slate-500 dark:text-muted-foreground">MRN</span>
          <span>{patient.mrn}</span>
          <span className="text-slate-500 dark:text-muted-foreground">DOB</span>
          <span>
            {patient.dob ? format(new Date(patient.dob), "MM/dd/yyyy") : "—"}
          </span>
          <span className="text-slate-500 dark:text-muted-foreground">Gender</span>
          <span>{patient.gender || "—"}</span>
          {contact.phone && (
            <>
              <span className="text-slate-500 dark:text-muted-foreground">Phone</span>
              <span>{contact.phone}</span>
            </>
          )}
          {contact.email && (
            <>
              <span className="text-slate-500 dark:text-muted-foreground">Email</span>
              <span>{contact.email}</span>
            </>
          )}
          {contact.address && (
            <>
              <span className="text-slate-500 dark:text-muted-foreground">Address</span>
              <span>{contact.address}</span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
