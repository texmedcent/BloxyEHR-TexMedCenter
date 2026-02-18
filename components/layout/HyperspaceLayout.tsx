"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  FileText,
  ClipboardList,
  TestTube,
  Calendar,
  Inbox,
  Menu,
  ChevronLeft,
  User,
  LogOut,
  Settings,
  Star,
} from "lucide-react";
import { ChartSearch } from "./ChartSearch";
import { NotificationCenter } from "./NotificationCenter";
import { RecentPatientsDropdown } from "./RecentPatientsDropdown";
import { PatientContextBar } from "./PatientContextBar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/chart", label: "Patient Chart", icon: LayoutDashboard },
  { href: "/documentation", label: "Clinical Documentation", icon: FileText },
  { href: "/orders", label: "Order Entry", icon: ClipboardList },
  { href: "/results", label: "Results", icon: TestTube },
  { href: "/schedule", label: "Scheduling", icon: Calendar },
  { href: "/inbasket", label: "In Basket", icon: Inbox },
];

interface HyperspaceLayoutProps {
  children: React.ReactNode;
  userEmail?: string;
  userName?: string;
}

export function HyperspaceLayout({
  children,
  userEmail,
  userName,
}: HyperspaceLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [chartSearchOpen, setChartSearchOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col bg-[#1a4d8c] text-white transition-all duration-200 shrink-0",
          sidebarCollapsed ? "w-16" : "w-56"
        )}
      >
        <div className="flex items-center justify-between p-3 border-b border-white/20">
          {!sidebarCollapsed && (
            <Link href="/dashboard" className="font-bold text-lg truncate">
              BloxyEHR
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 shrink-0"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            {sidebarCollapsed ? (
              <Menu className="h-5 w-5" />
            ) : (
              <ChevronLeft className="h-5 w-5" />
            )}
          </Button>
        </div>
        <nav
          className="flex-1 overflow-y-auto py-2"
          aria-label="Main navigation"
        >
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 hover:bg-white/10 transition-colors rounded mx-1",
                sidebarCollapsed && "justify-center px-2"
              )}
              title={sidebarCollapsed ? label : undefined}
              aria-label={label}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!sidebarCollapsed && (
                <span className="text-sm font-medium truncate">{label}</span>
              )}
            </Link>
          ))}
        </nav>
        {!sidebarCollapsed && (
          <div className="border-t border-white/20 p-2">
            <Link
              href="/chart"
              className="flex items-center gap-3 px-3 py-2 hover:bg-white/10 rounded transition-colors"
            >
              <Star className="h-4 w-4 shrink-0" />
              <span className="text-xs font-medium">Favorites / Recents</span>
            </Link>
          </div>
        )}
      </aside>

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Toolbar */}
        <header
          className="h-14 bg-white border-b border-slate-200 flex items-center gap-3 px-3 shrink-0"
          role="banner"
        >
          <Link
            href="/dashboard"
            className="font-bold text-lg text-[#1a4d8c] shrink-0 hidden sm:block"
            aria-label="BloxyEHR Home"
          >
            BloxyEHR
          </Link>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 h-8"
            onClick={() => setChartSearchOpen(true)}
            aria-label="Open Chart Search"
          >
            <LayoutDashboard className="h-4 w-4" />
            Chart Search
          </Button>

          {mounted ? <RecentPatientsDropdown /> : <span className="w-32" />}

          <div className="flex-1" />

          {mounted ? (
            <NotificationCenter />
          ) : (
            <div className="flex items-center gap-2">
              <span className="h-9 w-9" />
              <span className="h-9 w-28" />
            </div>
          )}

          {mounted ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline truncate max-w-[150px]">
                    {userName || userEmail || "User"}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="cursor-pointer">
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="ghost" size="sm" className="gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline truncate max-w-[150px]">
                {userName || userEmail || "User"}
              </span>
            </Button>
          )}
        </header>

        {/* Patient context bar when viewing a patient */}
        <PatientContextBar />

        {/* Main content */}
        <main
          className="flex-1 overflow-auto p-3 md:p-4 min-w-0"
          role="main"
          id="main-content"
        >
          {children}
        </main>
      </div>

      {/* Chart Search modal/panel */}
      <ChartSearch
        open={chartSearchOpen}
        onClose={() => setChartSearchOpen(false)}
      />
    </div>
  );
}
