"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, X } from "lucide-react";

type AllergyRow = {
  allergen: string;
  reaction: string;
};

interface PatientShape {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
  dob: string;
  gender: string | null;
  contact_info?: Record<string, string> | null;
  allergies?: unknown;
}

function normalizeAllergies(allergies: unknown): AllergyRow[] {
  if (!Array.isArray(allergies)) return [];
  return allergies
    .map((a) => {
      if (!a || typeof a !== "object") return null;
      const row = a as { allergen?: string; reaction?: string };
      return {
        allergen: row.allergen ?? "",
        reaction: row.reaction ?? "",
      };
    })
    .filter((x): x is AllergyRow => x !== null);
}

export function EditDemographicsButton({ patient }: { patient: PatientShape }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contact = useMemo(
    () => (patient.contact_info || {}) as Record<string, string>,
    [patient.contact_info]
  );

  const [mrn, setMrn] = useState(patient.mrn || "");
  const [firstName, setFirstName] = useState(patient.first_name || "");
  const [lastName, setLastName] = useState(patient.last_name || "");
  const [dob, setDob] = useState(patient.dob || "");
  const [gender, setGender] = useState(patient.gender || "");
  const [phone, setPhone] = useState(contact.phone || "");
  const [email, setEmail] = useState(contact.email || "");
  const [address, setAddress] = useState(contact.address || "");
  const [allergies, setAllergies] = useState<AllergyRow[]>(
    normalizeAllergies(patient.allergies)
  );

  const addAllergy = () =>
    setAllergies((prev) => [...prev, { allergen: "", reaction: "" }]);

  const removeAllergy = (index: number) =>
    setAllergies((prev) => prev.filter((_, i) => i !== index));

  const updateAllergy = (
    index: number,
    key: keyof AllergyRow,
    value: string
  ) =>
    setAllergies((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [key]: value } : row))
    );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim() || !lastName.trim() || !dob || !mrn.trim()) {
      setError("First name, last name, MRN, and DOB are required.");
      return;
    }

    setSaving(true);
    const supabase = createClient();

    const cleanedAllergies = allergies
      .map((a) => ({
        allergen: a.allergen.trim(),
        reaction: a.reaction.trim(),
      }))
      .filter((a) => a.allergen.length > 0);

    const { error: updateError } = await supabase
      .from("patients")
      .update({
        mrn: mrn.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        dob,
        gender: gender || null,
        contact_info: {
          phone: phone.trim() || null,
          email: email.trim() || null,
          address: address.trim() || null,
        },
        allergies: cleanedAllergies,
      })
      .eq("id", patient.id);

    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }

    setOpen(false);
    router.refresh();
  };

  return (
    <>
      <Button size="sm" variant="outline" className="h-8" onClick={() => setOpen(true)}>
        Edit Demographics
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Edit Patient Demographics</CardTitle>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label>MRN</Label>
                    <Input value={mrn} onChange={(e) => setMrn(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label>Date of Birth</Label>
                    <Input
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>First Name</Label>
                    <Input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Last Name</Label>
                    <Input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Gender</Label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="mt-1 h-9 w-full rounded border border-slate-300 bg-white px-3 text-sm"
                    >
                      <option value="">Not specified</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Address</Label>
                    <Input
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="rounded border border-slate-200 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-800">Allergies</h3>
                    <Button type="button" size="sm" variant="outline" onClick={addAllergy}>
                      <Plus className="mr-1 h-4 w-4" />
                      Add Allergy
                    </Button>
                  </div>

                  {allergies.length === 0 ? (
                    <p className="text-sm text-slate-500">No allergies recorded.</p>
                  ) : (
                    <div className="space-y-2">
                      {allergies.map((row, index) => (
                        <div key={index} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                          <Input
                            placeholder="Allergen (e.g. Penicillin)"
                            value={row.allergen}
                            onChange={(e) =>
                              updateAllergy(index, "allergen", e.target.value)
                            }
                          />
                          <Input
                            placeholder="Reaction (e.g. Rash)"
                            value={row.reaction}
                            onChange={(e) =>
                              updateAllergy(index, "reaction", e.target.value)
                            }
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => removeAllergy(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
