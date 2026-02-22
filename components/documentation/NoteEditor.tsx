"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { addProviderToCareTeam } from "@/lib/care_team";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { X, FileText, AlertTriangle } from "lucide-react";

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
  triage: `Triage Note

Chief Complaint:
Vital Signs: BP / HR / RR / SpO2 / Temp / Pain
Allergies:
Medications:
Brief HPI:
Acuity Level:
`,
  sample_opqrst: `SAMPLE / OPQRST

SAMPLE:
- Signs/Symptoms:
- Allergies:
- Medications:
- Past history:
- Last oral intake:
- Events leading to presentation:

OPQRST:
- Onset:
- Provocation/Palliation:
- Quality:
- Region/Radiation:
- Severity:
- Timing:
`,
  trauma: `Trauma Note

Mechanism of Injury:
GCS:
Primary Survey (ABCDE):
- Airway:
- Breathing:
- Circulation:
- Disability:
- Exposure:

Injuries Identified:
Interventions:
Disposition:
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
  triage: "Triage Note",
  sample_opqrst: "SAMPLE / OPQRST",
  trauma: "Trauma Note",
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
  patientId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function NoteEditor({ encounterId, patientId, onClose, onSaved }: NoteEditorProps) {
  const [type, setType] = useState<NoteTemplateKey>("progress");
  const [content, setContent] = useState(NOTE_TEMPLATES.progress);
  const [soapSubjective, setSoapSubjective] = useState("");
  const [soapObjective, setSoapObjective] = useState("");
  const [soapAssessment, setSoapAssessment] = useState("");
  const [soapPlan, setSoapPlan] = useState("");
  const [sign, setSign] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signature, setSignature] = useState<string>("Clinician");
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);

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
    if (error) {
      console.error(error);
      setSaving(false);
      return;
    }
    await addProviderToCareTeam(supabase, patientId, "documentation");
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col border-slate-200 dark:border-border">
        <CardHeader className="flex flex-row items-center justify-between shrink-0 border-b border-slate-200 dark:border-border">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-[#1a4d8c] dark:text-primary" />
            Add Clinical Note
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-col gap-5 overflow-y-auto pt-5">
          <div className="rounded-lg border border-slate-200 dark:border-border bg-slate-50/50 dark:bg-muted/30 p-4">
            <Label className="text-sm font-medium">Template</Label>
            <p className="text-xs text-slate-500 dark:text-muted-foreground mt-0.5 mb-3">
              Choose a note structure. You can change it anytime.
            </p>
            <div className="flex flex-wrap gap-2">
              <select
                value={type}
                onChange={(e) => applyTemplate(e.target.value as NoteTemplateKey)}
                className="h-9 flex-1 min-w-[200px] rounded-lg border border-slate-300 dark:border-input bg-white dark:bg-background px-3 text-sm"
              >
                {Object.keys(NOTE_TEMPLATES).map((key) => (
                  <option key={key} value={key}>
                    {TEMPLATE_LABELS[key as NoteTemplateKey]}
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyTemplate(type)}
                className="shrink-0"
              >
                Reset template
              </Button>
            </div>
          </div>

          <div className="flex-1 min-h-0 space-y-3">
            {type === "soap" ? (
              <div className="space-y-4">
                <p className="text-xs text-slate-500 dark:text-muted-foreground">
                  SOAP encourages complete documentation: Subjective, Objective, Assessment, Plan.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-sm">Subjective</Label>
                    <Textarea
                      className="mt-1.5 min-h-[90px] rounded-lg"
                      value={soapSubjective}
                      onChange={(e) => setSoapSubjective(e.target.value)}
                      placeholder="What the patient reports"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Objective</Label>
                    <Textarea
                      className="mt-1.5 min-h-[90px] rounded-lg"
                      value={soapObjective}
                      onChange={(e) => setSoapObjective(e.target.value)}
                      placeholder="Exam findings, vitals, tests"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-sm">Assessment</Label>
                  <Textarea
                    className="mt-1.5 min-h-[70px] rounded-lg"
                    value={soapAssessment}
                    onChange={(e) => setSoapAssessment(e.target.value)}
                    placeholder="Clinical impression / diagnosis"
                  />
                </div>
                <div>
                  <Label className="text-sm">Plan</Label>
                  <Textarea
                    className="mt-1.5 min-h-[90px] rounded-lg"
                    value={soapPlan}
                    onChange={(e) => setSoapPlan(e.target.value)}
                    placeholder="Treatment and follow-up plan"
                  />
                </div>
              </div>
            ) : (
              <div>
                <Label className="text-sm font-medium">Content</Label>
                <Textarea
                  ref={contentTextareaRef}
                  className="mt-1.5 min-h-[240px] resize-y rounded-lg"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter note content…"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSign((s) => !s)}
              className={cn(
                "transition-colors",
                sign && "ring-2 ring-red-500 ring-offset-2 dark:ring-offset-background"
              )}
            >
              Sign note on save
            </Button>
            {sign && (
              <>
                <p className="text-xs text-slate-500 dark:text-muted-foreground">
                  Signature: {signature}
                </p>
                <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Note will be locked upon save. Signed notes cannot be edited.
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end gap-2 shrink-0 pt-2 border-t border-slate-200 dark:border-border">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[#1a4d8c] hover:bg-[#1a4d8c]/90">
              {saving ? "Saving…" : "Save Note"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
