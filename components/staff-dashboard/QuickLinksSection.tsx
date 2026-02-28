"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, MessageCircle } from "lucide-react";

interface QuickLink {
  id: string;
  label: string;
  url: string;
  category: string;
  sort_order: number;
}

interface QuickLinksSectionProps {
  links: QuickLink[];
}

const CATEGORY_LABELS: Record<string, string> = {
  chat: "Chat & Collaboration",
  hr: "HR",
  policy: "Policy",
  resources: "Resources",
};

export function QuickLinksSection({ links }: QuickLinksSectionProps) {
  const byCategory = links.reduce<Record<string, QuickLink[]>>((acc, link) => {
    const cat = link.category || "resources";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(link);
    return acc;
  }, {});

  const sortedCategories = Object.keys(byCategory).sort(
    (a, b) => (byCategory[a][0]?.sort_order ?? 0) - (byCategory[b][0]?.sort_order ?? 0)
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Access</CardTitle>
        <CardDescription>HR portal, policy documents, and internal resources.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedCategories.map((category) => (
            <div key={category}>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                {CATEGORY_LABELS[category] || category}
              </h4>
              <div className="flex flex-wrap gap-2">
                {byCategory[category]
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((link) => {
                    const isInternal = link.url.startsWith("/");
                    const Icon = link.category === "chat" ? MessageCircle : ExternalLink;
                    return (
                      <Button
                        key={link.id}
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        asChild
                      >
                        <Link
                          href={link.url}
                          target={isInternal ? undefined : "_blank"}
                          rel={isInternal ? undefined : "noopener noreferrer"}
                        >
                          <Icon className="h-4 w-4" />
                          {link.label}
                        </Link>
                      </Button>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
