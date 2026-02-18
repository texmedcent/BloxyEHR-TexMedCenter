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
        .select("id, type, priority, read_at, created_at")
        .eq("recipient_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      setItems(data || []);
      setUnreadCount((data || []).filter((i) => !i.read_at).length);
    };
    fetchItems();
  }, []);

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
          <div className="px-2 py-1.5 text-sm font-semibold">In Basket</div>
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
                    {item.type} - {item.priority}
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
      <Button variant="ghost" size="icon" title="Secure Chat (placeholder)">
        <MessageCircle className="h-5 w-5" />
      </Button>
    </div>
  );
}
