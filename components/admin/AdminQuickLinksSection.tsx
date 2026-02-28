"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link2, Plus, Pencil, Trash2 } from "lucide-react";

interface QuickLink {
  id: string;
  label: string;
  url: string;
  category: string;
  sort_order: number;
  is_active: boolean;
}

interface AdminQuickLinksSectionProps {
  links: QuickLink[];
}

const CATEGORIES = ["resources", "hr", "policy", "chat"] as const;

export function AdminQuickLinksSection({ links }: AdminQuickLinksSectionProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newCategory, setNewCategory] = useState<string>("resources");

  const startEdit = (link: QuickLink) => {
    setEditingId(link.id);
    setEditLabel(link.label);
    setEditUrl(link.url);
  };

  const saveEdit = async () => {
    if (!editingId || !editLabel.trim() || !editUrl.trim()) return;
    const supabase = createClient();
    await supabase
      .from("quick_links")
      .update({ label: editLabel.trim(), url: editUrl.trim() })
      .eq("id", editingId);
    setEditingId(null);
    router.refresh();
  };

  const addLink = async () => {
    if (!newLabel.trim() || !newUrl.trim()) return;
    const supabase = createClient();
    const maxOrder = links.length ? Math.max(...links.map((l) => l.sort_order)) : 0;
    await supabase.from("quick_links").insert({
      label: newLabel.trim(),
      url: newUrl.trim(),
      category: newCategory,
      sort_order: maxOrder + 1,
      is_active: true,
    });
    setShowAdd(false);
    setNewLabel("");
    setNewUrl("");
    router.refresh();
  };

  const deleteLink = async (id: string) => {
    const supabase = createClient();
    await supabase.from("quick_links").delete().eq("id", id);
    router.refresh();
  };

  const toggleActive = async (link: QuickLink) => {
    const supabase = createClient();
    await supabase
      .from("quick_links")
      .update({ is_active: !link.is_active })
      .eq("id", link.id);
    router.refresh();
  };

  return (
    <Card className="border-slate-200 dark:border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-700 dark:text-foreground">
          <Link2 className="h-4 w-4 text-[#1a4d8c] dark:text-primary" />
          Quick Access Links
        </CardTitle>
        <CardDescription>Manage quick links shown on the Staff Dashboard.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {links.map((link) => (
            <div
              key={link.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-border p-3"
            >
              {editingId === link.id ? (
                <>
                  <div className="flex flex-col gap-2 flex-1 mr-2">
                    <Input
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      placeholder="Label"
                    />
                    <Input
                      value={editUrl}
                      onChange={(e) => setEditUrl(e.target.value)}
                      placeholder="URL"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveEdit}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm truncate ${!link.is_active ? "line-through text-muted-foreground" : ""}`}>
                      {link.label}
                    </p>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline truncate block"
                    >
                      {link.url}
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={() => toggleActive(link)}>
                      {link.is_active ? "Hide" : "Show"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => startEdit(link)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteLink(link.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {showAdd ? (
          <div className="rounded-lg border border-dashed border-slate-200 dark:border-border p-3 space-y-2">
            <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Label" />
            <Input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="URL" />
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <Button size="sm" onClick={addLink}>Add</Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowAdd(false); setNewLabel(""); setNewUrl(""); }}>Cancel</Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add Quick Link
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
