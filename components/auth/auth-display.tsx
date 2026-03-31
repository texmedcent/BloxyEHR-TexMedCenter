import { Playfair_Display } from "next/font/google";
import { cn } from "@/lib/utils";

/** Display font for auth card titles — matches landing page */
export const authDisplay = Playfair_Display({ subsets: ["latin"] });

export const authCardClassName =
  "border border-[#002868]/15 bg-white/98 shadow-2xl backdrop-blur-sm rounded-xl";

export function authCardTitleClassName(extra?: string) {
  return cn(
    authDisplay.className,
    "text-2xl font-bold tracking-tight text-[#002868]",
    extra
  );
}
