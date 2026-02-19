"use client";

import { useEffect, useState } from "react";
import { Inbox, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

interface InBasketItem {
  id: string;
  type: string;
  priority: string;
  read_at: string | null;
  created_at: string;
  related_entity_id?: string | null;
  label?: string;
}

export function NotificationCenter() {
  const [items, setItems] = useState<InBasketItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    const fetchItems = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("in_basket_items")
        .select("id, type, priority, read_at, created_at, related_entity_id")
        .eq("recipient_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      const rows = data || [];
      const resultIds = rows
        .filter((i) => i.type === "result" && i.related_entity_id)
        .map((i) => i.related_entity_id as string);

      const { data: results } =
        resultIds.length > 0
          ? await supabase
              .from("results")
              .select("id, type, status")
              .in("id", resultIds)
          : { data: [] };
      const resultMap = new Map((results || []).map((r) => [r.id, r]));

      const mapped = rows.map((item) => {
        if (item.type !== "result" || !item.related_entity_id) {
          return { ...item, label: `${item.type} - ${item.priority}` };
        }
        const result = resultMap.get(item.related_entity_id);
        return {
          ...item,
          label: result
            ? `${result.status.toUpperCase()} ${result.type.toUpperCase()} result`
            : "Result notification",
        };
      });

      setItems(mapped);
      setUnreadCount(mapped.filter((i) => !i.read_at).length);
    };
    fetchItems();
  }, []);

  const clearAll = async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("in_basket_items").delete().eq("recipient_id", user.id);
    setItems([]);
    setUnreadCount(0);
  };

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Inbox className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge
                className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-1 text-xs"
                variant="destructive"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <div className="flex items-center justify-between px-2 py-1.5">
            <div className="text-sm font-semibold">In Basket</div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={clearAll}
              disabled={items.length === 0}
            >
              Clear
            </Button>
          </div>
          {items.length === 0 ? (
            <div className="px-2 py-4 text-sm text-gray-500">
              No items
            </div>
          ) : (
            items.map((item) => (
              <DropdownMenuItem key={item.id} asChild>
                <Link
                  href="/inbasket"
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Inbox className="h-4 w-4 shrink-0" />
                  <span
                    className={
                      !item.read_at ? "font-medium" : "text-gray-600"
                    }
                  >
                    {item.label || `${item.type} - ${item.priority}`}
                  </span>
                </Link>
              </DropdownMenuItem>
            ))
          )}
          <div className="border-t mt-1 pt-1">
            <DropdownMenuItem asChild>
              <Link href="/inbasket" className="cursor-pointer">
                View all
              </Link>
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button asChild variant="ghost" size="icon" title="Open Team Chat">
        <Link href="/chat" aria-label="Open Team Chat">
          <MessageCircle className="h-5 w-5" />
        </Link>
      </Button>
    </div>
  );
}
