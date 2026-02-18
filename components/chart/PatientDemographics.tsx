import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold tracking-normal">Demographics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="grid grid-cols-[110px_1fr] gap-2">
          <span className="text-slate-500">Name</span>
          <span>
            {patient.last_name}, {patient.first_name}
          </span>
          <span className="text-slate-500">MRN</span>
          <span>{patient.mrn}</span>
          <span className="text-slate-500">DOB</span>
          <span>
            {patient.dob
              ? format(new Date(patient.dob), "MM/dd/yyyy")
              : "—"}
          </span>
          <span className="text-slate-500">Gender</span>
          <span>{patient.gender || "—"}</span>
          {contact.phone && (
            <>
              <span className="text-slate-500">Phone</span>
              <span>{contact.phone}</span>
            </>
          )}
          {contact.email && (
            <>
              <span className="text-slate-500">Email</span>
              <span>{contact.email}</span>
            </>
          )}
          {contact.address && (
            <>
              <span className="text-slate-500">Address</span>
              <span>{contact.address}</span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
