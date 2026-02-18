import { createClient } from "@/lib/supabase/server";
import { InBasketList } from "@/components/inbasket/InBasketList";

export default async function InBasketPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const items = user
    ? (
        await supabase
          .from("in_basket_items")
          .select("*")
          .eq("recipient_id", user.id)
          .order("created_at", { ascending: false })
      ).data ?? []
    : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">In Basket</h1>
      <InBasketList items={items} />
    </div>
  );
}
