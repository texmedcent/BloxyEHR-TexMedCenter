"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Inbox, Check } from "lucide-react";
import { format } from "date-fns";

interface InBasketItem {
  id: string;
  type: string;
  priority: string;
  read_at: string | null;
  created_at: string;
}

interface InBasketListProps {
  items: InBasketItem[];
}

export function InBasketList({ items }: InBasketListProps) {
  const router = useRouter();

  const markAsRead = async (id: string) => {
    const supabase = createClient();
    await supabase
      .from("in_basket_items")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Inbox className="h-5 w-5" />
          Tasks & Notifications
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-gray-600">No items in your In Basket</p>
        ) : (
          <ul className="divide-y">
            {items.map((item) => (
              <li
                key={item.id}
                className={`py-3 flex justify-between items-center gap-4 ${
                  !item.read_at ? "font-medium" : "text-gray-600"
                }`}
              >
                <span>
                  {item.type} — {item.priority}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm text-gray-500">
                    {format(new Date(item.created_at), "MM/dd/yyyy HH:mm")}
                  </span>
                  {!item.read_at && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markAsRead(item.id)}
                      title="Mark as read"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
