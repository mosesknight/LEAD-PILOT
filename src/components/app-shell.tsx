"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  KanbanSquare,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Radar,
  Settings,
  Users,
  X,
} from "lucide-react";

import { Brand } from "@/components/brand";
import { SetupNotice } from "@/components/setup-notice";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/components/auth-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { LEADS_CHANGED_EVENT, notifyLeadsChanged } from "@/lib/events";
import { startOfToday } from "@/lib/format";
import { DEFAULT_DAILY_QUOTA } from "@/lib/constants";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/discover", label: "Discover", icon: Radar, exact: false },
  { href: "/dashboard/leads", label: "Leads", icon: Users, exact: false },
  { href: "/dashboard/pipeline", label: "Pipeline", icon: KanbanSquare, exact: false },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, exact: false },
];

function useTodayCount(userId: string | undefined, refreshKey: number) {
  const [count, setCount] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!userId) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let active = true;

    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", startOfToday().toISOString())
      .then(({ count: today }) => {
        if (active) setCount(today ?? 0);
      });

    return () => {
      active = false;
    };
  }, [userId, refreshKey]);

  return count;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading, configured, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const todayCount = useTodayCount(user?.id, refreshKey);

  React.useEffect(() => {
    if (!loading && configured && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, configured, user, router, pathname]);

  React.useEffect(() => {
    const handler = () => setRefreshKey((key) => key + 1);
    window.addEventListener(LEADS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(LEADS_CHANGED_EVENT, handler);
  }, []);

  if (!configured) return <SetupNotice />;

  if (loading || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex size-11 items-center justify-center rounded-xl border border-primary/25 bg-primary/10">
            <span className="absolute inset-0 animate-ping rounded-xl bg-primary/10" />
            <span className="size-2 rounded-full bg-primary" />
          </div>
          <p className="text-xs text-muted-foreground">Loading your workspace…</p>
        </div>
      </div>
    );
  }

  const quota = profile?.daily_quota ?? DEFAULT_DAILY_QUOTA;
  const used = todayCount ?? 0;
  const activeItem =
    navItems.find((item) =>
      item.exact ? pathname === item.href : pathname.startsWith(item.href),
    ) ?? navItems[0];

  const sidebar = (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="flex items-center justify-between">
        <Brand href="/dashboard" />
        <Button
          variant="ghost"
          size="icon-sm"
          className="lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X />
        </Button>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <item.icon className="size-4" />
              <span className="font-medium">{item.label}</span>
              {active ? (
                <span className="ml-auto size-1.5 rounded-full bg-primary shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 rounded-xl border border-border/80 bg-card/60 p-3">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-medium text-muted-foreground">Daily quota</span>
          <span className="font-mono text-foreground">
            {used}
            <span className="text-muted-foreground">/{quota}</span>
          </span>
        </div>
        <Progress value={quota ? (used / quota) * 100 : 0} />
        <p className="text-[10px] leading-relaxed text-muted-foreground/80">
          {used >= quota
            ? "Quota reached. Focus on outreach and follow-ups."
            : `${quota - used} leads left to hit today's target.`}
        </p>
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          onClick={() => {
            setMobileOpen(false);
            notifyLeadsChanged();
            router.push("/dashboard/leads?new=1");
          }}
        >
          <Plus />
          Add lead
        </Button>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-card/60 p-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-300 to-teal-600 text-[11px] font-semibold text-emerald-950">
          {(profile?.full_name || user.email || "U").slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-foreground">
            {profile?.full_name || "Your account"}
          </p>
          <p className="truncate text-[10px] text-muted-foreground">{user.email}</p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => void signOut()}
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] border-r border-border/70 bg-card/30 lg:block">
        {sidebar}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-[280px] animate-slide-up border-r border-border bg-background shadow-2xl">
            {sidebar}
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/70 bg-background/85 px-4 backdrop-blur-md sm:px-6">
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu />
          </Button>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{activeItem.label}</p>
            <p className="hidden text-[10px] text-muted-foreground sm:block">
              Built for focused, high-volume outreach
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full border border-border/80 bg-card/60 px-3 py-1 text-[11px] text-muted-foreground sm:flex">
              <span className="size-1.5 rounded-full bg-primary" />
              {used}/{quota} today
            </div>
            <Button size="sm" asChild>
              <Link href="/dashboard/leads?new=1">
                <Plus />
                <span className="hidden sm:inline">New lead</span>
              </Link>
            </Button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
