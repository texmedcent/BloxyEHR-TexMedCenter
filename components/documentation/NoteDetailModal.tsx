"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { X } from "lucide-react";

interface Note {
  id: string;
  type: string;
  content: string;
  signed_at: string | null;
  created_at: string;
}

interface NoteDetailModalProps {
  note: Note;
  onClose: () => void;
  onSaved: () => void;
}

function splitNoteContent(content: string, signedAt: string | null) {
  if (!signedAt) {
    return { body: content, signature: "" };
  }

  const lines = content.replace(/\r\n/g, "\n").split("\n");
  let lastNonEmpty = -1;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i].trim()) {
      lastNonEmpty = i;
      break;
    }
  }

  if (lastNonEmpty === -1) {
    return { body: "", signature: "" };
  }

  const signature = lines[lastNonEmpty].trim();
  const body = lines.slice(0, lastNonEmpty).join("\n").trimEnd();
  return { body, signature };
}

export function NoteDetailModal({ note, onClose, onSaved }: NoteDetailModalProps) {
  const parsed = useMemo(
    () => splitNoteContent(note.content, note.signed_at),
    [note.content, note.signed_at]
  );
  const [content, setContent] = useState(parsed.body);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();

    const nextContent =
      note.signed_at && parsed.signature
        ? `${content.trimEnd()}\n\n${parsed.signature}`
        : content;

    const { error } = await supabase
      .from("clinical_notes")
      .update({
        content: nextContent,
      })
      .eq("id", note.id);

    setSaving(false);
    if (error) {
      return;
    }

    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <Card className="w-full max-w-3xl max-h-[90vh] flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between shrink-0">
          <CardTitle>Edit Clinical Note</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 overflow-hidden">
          <div>
            <Label>Content</Label>
            <Textarea
              className="mt-1 min-h-[260px] resize-y"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          {note.signed_at && parsed.signature && (
            <div>
              <Label>Signature</Label>
              <p className="mt-1 whitespace-pre-wrap rounded border bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {parsed.signature}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Signature is shown on a separate line below the note text.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 shrink-0">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
