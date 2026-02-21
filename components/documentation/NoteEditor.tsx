"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";

const NOTE_TEMPLATES = {
  progress: `Chief Complaint:
History of Present Illness:
Review of Systems:
Physical Exam:
Assessment/Plan:
`,
  soap: `Subjective:
Objective:
Assessment:
Plan:
`,
  operative_note: `Operative Note

Preoperative Diagnosis:
Postoperative Diagnosis:
Procedure Performed:
Indications:

Description of Procedure (Narrative):

Findings:
Estimated Blood Loss:
Complications:
Disposition:
`,
  procedure_note_non_or: `Procedure Note (Non-OR)

Indication:
Consent:
Technique:
Complications:
Outcome:
`,
  lab_interpretation: `Lab Interpretation Note

Labs Reviewed:
- 

Abnormal Findings:
- 

Clinical Impression:

Plan:
`,
  emergency_department_note: `Emergency Department Note

Triage Note:
Chief Complaint:
HPI:
Vitals:
Physical Exam:
Medical Decision Making:
Disposition:
`,
  discharge_summary: `Discharge Summary

Admission Diagnosis:
Hospital Course:
Procedures Performed:
Final Diagnosis:
Medications at Discharge:
Follow-Up Instructions:
`,
  consultation_note: `Consultation Note

Reason for Consult:
Findings:
Recommendations:
`,
  end_of_visit: `End of Visit Summary

Visit Date/Time:
Encounter Type:
Primary Diagnosis:
Secondary Diagnoses:

Summary of Visit:
- Presenting concern:
- Key findings:
- Workup completed:
- Procedures/interventions:

Treatments Given Today:
- Medications administered:
- IV fluids / therapies:

Discharge Medications:
- New prescriptions:
- Continue home medications:
- Stop medications:

Follow-Up Plan:
- Follow-up with:
- Timeline:
- Pending labs/imaging:

Return Precautions:
- Return immediately for:

Condition at Discharge:
- Stable / Improved / Other:
`,
};

type NoteTemplateKey = keyof typeof NOTE_TEMPLATES;

const TEMPLATE_LABELS: Record<NoteTemplateKey, string> = {
  progress: "Progress Note",
  soap: "SOAP Note",
  operative_note: "Operative Note",
  procedure_note_non_or: "Procedure Note (Non-OR)",
  lab_interpretation: "Lab Interpretation Note",
  emergency_department_note: "Emergency Department Note",
  discharge_summary: "Discharge Summary",
  consultation_note: "Consultation Note",
  end_of_visit: "End of Visit Summary",
};

interface NoteEditorProps {
  encounterId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function NoteEditor({ encounterId, onClose, onSaved }: NoteEditorProps) {
  const [type, setType] = useState<NoteTemplateKey>("progress");
  const [content, setContent] = useState(NOTE_TEMPLATES.progress);
  const [soapSubjective, setSoapSubjective] = useState("");
  const [soapObjective, setSoapObjective] = useState("");
  const [soapAssessment, setSoapAssessment] = useState("");
  const [soapPlan, setSoapPlan] = useState("");
  const [sign, setSign] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signature, setSignature] = useState<string>("Clinician");

  useEffect(() => {
    const loadSignature = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("signature, full_name")
        .eq("id", user.id)
        .maybeSingle();

      const fallback = user.email || "Clinician";
      const preferred = profile?.signature?.trim();
      const fullName = profile?.full_name?.trim();
      setSignature(preferred || fullName || fallback);
    };

    void loadSignature();
  }, []);

  const applyTemplate = (t: NoteTemplateKey) => {
    setType(t);
    setContent(NOTE_TEMPLATES[t]);
    if (t === "soap") {
      setSoapSubjective("");
      setSoapObjective("");
      setSoapAssessment("");
      setSoapPlan("");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }
    const computedContent =
      type === "soap"
        ? `Subjective:\n${soapSubjective}\n\nObjective:\n${soapObjective}\n\nAssessment:\n${soapAssessment}\n\nPlan:\n${soapPlan}`
        : content;

    const signatureLine = signature.trim();
    const contentTrimmed = computedContent.trimEnd();
    const signedContent =
      sign && signatureLine
        ? contentTrimmed.endsWith(signatureLine)
          ? contentTrimmed
          : `${contentTrimmed}\n\n${signatureLine}`
        : computedContent;

    const { error } = await supabase.from("clinical_notes").insert({
      encounter_id: encounterId,
      author_id: user.id,
      type,
      content: signedContent,
      signed_at: sign ? new Date().toISOString() : null,
    });
    setSaving(false);
    if (error) {
      console.error(error);
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between shrink-0">
          <CardTitle>Add Clinical Note</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          <div>
            <Label>Template</Label>
            <div className="mt-1 grid gap-2 md:grid-cols-[1fr_auto]">
              <select
                value={type}
                onChange={(e) => applyTemplate(e.target.value as NoteTemplateKey)}
                className="h-9 rounded border border-slate-300 dark:border-input bg-white dark:bg-background px-2 text-sm"
              >
                {Object.keys(NOTE_TEMPLATES).map((key) => (
                  <option key={key} value={key}>
                    {TEMPLATE_LABELS[key as NoteTemplateKey]}
                  </option>
                ))}
              </select>
              <Button variant="outline" size="sm" onClick={() => applyTemplate(type)}>
                Apply Suggested Template
              </Button>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            {type === "soap" ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-500 dark:text-muted-foreground">
                  SOAP template encourages complete clinical documentation.
                </p>
                <div>
                  <Label>Subjective</Label>
                  <Textarea
                    className="mt-1 min-h-[80px]"
                    value={soapSubjective}
                    onChange={(e) => setSoapSubjective(e.target.value)}
                    placeholder="What the patient reports"
                  />
                </div>
                <div>
                  <Label>Objective</Label>
                  <Textarea
                    className="mt-1 min-h-[80px]"
                    value={soapObjective}
                    onChange={(e) => setSoapObjective(e.target.value)}
                    placeholder="Exam findings, vitals, tests"
                  />
                </div>
                <div>
                  <Label>Assessment</Label>
                  <Textarea
                    className="mt-1 min-h-[80px]"
                    value={soapAssessment}
                    onChange={(e) => setSoapAssessment(e.target.value)}
                    placeholder="Clinical impression / diagnosis"
                  />
                </div>
                <div>
                  <Label>Plan</Label>
                  <Textarea
                    className="mt-1 min-h-[80px]"
                    value={soapPlan}
                    onChange={(e) => setSoapPlan(e.target.value)}
                    placeholder="Treatment and follow-up plan"
                  />
                </div>
              </div>
            ) : (
              <>
                <Label>Content</Label>
                <Textarea
                  className="mt-1 min-h-[200px] resize-y"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter note content..."
                />
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="sign"
              checked={sign}
              onChange={(e) => setSign(e.target.checked)}
            />
            <Label htmlFor="sign">Sign note on save</Label>
            {sign && (
              <span className="text-xs text-slate-500 dark:text-muted-foreground">
                Signature: {signature}
              </span>
            )}
          </div>
          <div className="flex justify-end gap-2 shrink-0">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Note"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
