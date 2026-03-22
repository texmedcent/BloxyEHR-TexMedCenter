"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  FileText,
  ClipboardList,
  ClipboardCheck,
  TestTube,
  Calendar,
  Inbox,
  Menu,
  ChevronLeft,
  User,
  LogOut,
  Settings,
  Star,
  MessageCircle,
  Pill,
  Shield,
  Home,
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
import { BehrLogo } from "@/components/branding/BehrLogo";
import { LiveClock } from "@/components/chart/LiveClock";
import { IdleLockOverlay } from "./IdleLockOverlay";
import { isHospitalManager, isPharmacist } from "@/lib/roles";

const navItems: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
}[] = [
  { href: "/staff-dashboard", label: "Staff Dashboard", icon: Users },
  { href: "/chart", label: "Patient Chart", icon: LayoutDashboard },
  { href: "/documentation", label: "Clinical Documentation", icon: FileText },
  { href: "/orders", label: "Order Entry", icon: ClipboardList },
  { href: "/procedures", label: "Procedures", icon: ClipboardCheck },
  { href: "/results", label: "Results", icon: TestTube },
  { href: "/schedule", label: "Scheduling", icon: Calendar },
  { href: "/inbasket", label: "In Basket", icon: Inbox },
  { href: "/chat", label: "Team Chat", icon: MessageCircle },
  { href: "/pharmacist", label: "Pharmacist", icon: Pill, roles: ["pharmacist"] },
  { href: "/admin", label: "Admin", icon: Shield, roles: ["hospital_manager"] },
];

function shouldShowNavItem(item: (typeof navItems)[0], userRole: string | undefined): boolean {
  if (item.href === "/admin") return isHospitalManager(userRole);
  if (item.href === "/pharmacist") return isPharmacist(userRole);
  if (item.href === "/staff-dashboard") return true;
  return !item.roles || (userRole != null && item.roles.includes(userRole));
}

interface HyperspaceLayoutProps {
  children: React.ReactNode;
  userEmail?: string;
  userName?: string;
  userRole?: string;
}

export function HyperspaceLayout({
  children,
  userEmail,
  userName,
  userRole,
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
    <div className="flex h-screen bg-slate-100 dark:bg-background overflow-hidden">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col bg-primary text-white transition-all duration-200 shrink-0",
          sidebarCollapsed ? "w-16" : "w-56"
        )}
      >
        <div className="flex items-center justify-between p-3 border-b border-white/20">
          {!sidebarCollapsed && (
            <Link href="/staff-dashboard" className="truncate flex items-center">
              <BehrLogo compact inverted iconOnly />
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
          {navItems
            .filter((item) => shouldShowNavItem(item, userRole))
            .map(({ href, label, icon: Icon }) => (
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
          className="h-14 bg-white dark:bg-card border-b border-slate-200 dark:border-[hsl(var(--border))] flex items-center shrink-0"
          role="banner"
        >
          <Link
            href="/staff-dashboard"
            className="hidden sm:flex shrink-0 items-center pl-3 pr-2"
            aria-label="BloxyEHR Home"
          >
            <BehrLogo compact />
          </Link>
          <div className="flex items-center gap-2 pl-2 pr-3 flex-1 min-w-0">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 h-8 rounded-lg font-medium text-slate-700 dark:text-foreground border-slate-200 dark:border-border hover:bg-primary/5 dark:hover:bg-primary/10 hover:border-primary/30 transition-colors"
            onClick={() => setChartSearchOpen(true)}
            aria-label="Open Chart Search"
          >
            <LayoutDashboard className="h-4 w-4 text-primary" />
            Chart Search
          </Button>

          {mounted ? <RecentPatientsDropdown /> : <span className="w-32" />}

          <div className="flex-1 min-w-0" />

          <div className="flex items-center gap-3 shrink-0 pl-2">
            {mounted && <LiveClock />}
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
                  <Link href="/" className="cursor-pointer">
                    <Home className="h-4 w-4 mr-2" />
                    Home
                  </Link>
                </DropdownMenuItem>
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
          </div>
          </div>
        </header>

        {/* Patient context bar when viewing a patient */}
        <PatientContextBar />

        {/* Main content */}
        <main
          className="flex-1 overflow-auto p-3 md:p-4 min-w-0 bg-slate-100 dark:bg-background"
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

      {/* Idle lock overlay (Epic-style) */}
      <IdleLockOverlay />
    </div>
  );
}
