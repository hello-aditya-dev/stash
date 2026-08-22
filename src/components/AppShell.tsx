"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Package, ScanLine, MapPin, FolderTree, BarChart3,
  Bell, Sparkles, ReceiptText, FileText, ClipboardList, Wallet, KanbanSquare,
  Users, Settings as SettingsIcon, Plus, Search, Boxes, LogOut, Menu, X,
  CloudOff, Cloud, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useData } from "@/lib/data-context";
import { useAuth } from "@/lib/auth-context";
import { computeAlerts } from "@/lib/alerts";
import { Spinner } from "@/components/ui/extras";
import { Button } from "@/components/ui/button";
import { currentQty } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const data = useData();
  const auth = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");

  const alertCount = useMemo(
    () =>
      computeAlerts({
        items: data.items,
        movementsByItem: groupMovements(data.movements),
        batches: data.batches,
        docs: data.docs,
        reminders: data.reminders,
      }).length,
    [data.items, data.movements, data.batches, data.docs, data.reminders]
  );

  if (!auth.ready || !auth.user) return <Spinner full />;

  const mainNav: NavItem[] = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Items", href: "/items", icon: Package },
    { label: "Scan", href: "/scan", icon: ScanLine },
    { label: "Locations", href: "/locations", icon: MapPin },
    { label: "Categories", href: "/categories", icon: FolderTree },
    { label: "Reports", href: "/reports", icon: BarChart3 },
    { label: "Reminders", href: "/reminders", icon: Bell, badge: alertCount },
    { label: "Assistant", href: "/assistant", icon: Sparkles },
  ];
  const docNav: NavItem[] = [
    { label: "Invoices", href: "/documents?tab=invoices", icon: ReceiptText },
    { label: "Quotations", href: "/documents?tab=quotations", icon: FileText },
    { label: "Purchase Orders", href: "/documents?tab=purchases", icon: ClipboardList },
    { label: "Expenses", href: "/documents?tab=expenses", icon: Wallet },
    { label: "Projects", href: "/documents?tab=projects", icon: KanbanSquare },
  ];
  const peopleNav: NavItem[] = [{ label: "Vendors & Customers", href: "/people", icon: Users }];

  const isActive = (href: string) => {
    const base = href.split("?")[0];
    if (base === "/dashboard") return pathname === base;
    return pathname.startsWith(base);
  };

  const runSearch = () => {
    if (query.trim()) router.push(`/items?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r bg-card lg:flex">
        <Brand />
        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          <NavSection items={mainNav} isActive={isActive} onNavigate={() => {}} />
          <SectionTitle>Documents</SectionTitle>
          <NavSection items={docNav} isActive={isActive} onNavigate={() => {}} />
          <SectionTitle>People</SectionTitle>
          <NavSection items={peopleNav} isActive={isActive} onNavigate={() => {}} />
        </nav>
        <UserFooter />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-card shadow-pop animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between pr-3">
              <Brand />
              <button className="rounded-lg p-2 text-muted-foreground hover:bg-secondary" onClick={() => setMobileOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 pb-4">
              <NavSection items={mainNav} isActive={isActive} onNavigate={() => setMobileOpen(false)} />
              <SectionTitle>Documents</SectionTitle>
              <NavSection items={docNav} isActive={isActive} onNavigate={() => setMobileOpen(false)} />
              <SectionTitle>People</SectionTitle>
              <NavSection items={peopleNav} isActive={isActive} onNavigate={() => setMobileOpen(false)} />
            </nav>
            <UserFooter />
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="lg:pl-60 flex min-h-screen flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 border-b bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/75">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            <button className="rounded-lg p-2 text-muted-foreground hover:bg-secondary lg:hidden" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <div className="relative max-w-md flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
                placeholder="Search items, tags, barcodes…"
                className="h-9.5 w-full rounded-full border border-input bg-secondary/60 pl-9 pr-4 text-sm outline-none transition focus:border-primary focus:bg-card focus:ring-2 focus:ring-ring/25"
              />
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <span className={cn(
                "hidden sm:inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
                data.repo.kind === "cloud" ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
              )}>
                {data.repo.kind === "cloud" ? <Cloud className="h-3 w-3" /> : <CloudOff className="h-3 w-3" />}
                {data.repo.kind === "cloud" ? "Supabase sync" : "Offline mode"}
              </span>
              <Link href="/reminders" className="relative rounded-lg p-2 text-muted-foreground hover:bg-secondary">
                <Bell className="h-5 w-5" />
                {alertCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                    {alertCount > 9 ? "9+" : alertCount}
                  </span>
                )}
              </Link>
              <Button size="sm" className="hidden sm:inline-flex" onClick={() => router.push("/items?new=1")}>
                <Plus className="h-4 w-4" /> Add item
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:pb-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur lg:hidden">
        <div className="grid grid-cols-5 h-16">
          <BottomItem icon={Package} label="Items" href="/items" active={pathname.startsWith("/items")} />
          <BottomItem icon={ScanLine} label="Scan" href="/scan" active={pathname === "/scan"} />
          <button onClick={() => router.push("/items?new=1")} className="flex flex-col items-center justify-center">
            <span className="-mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30">
              <Plus className="h-6 w-6" />
            </span>
            <span className="text-[10px] font-medium mt-0.5">Add</span>
          </button>
          <BottomItem icon={Bell} label="Alerts" href="/reminders" active={pathname === "/reminders"} badge={alertCount} />
          <BottomItem icon={LayoutDashboard} label="More" href="/dashboard" active={false} />
        </div>
      </nav>
    </div>
  );

  function BottomItem({ icon: Icon, label, href, active, badge }: { icon: React.ComponentType<{ className?: string }>; label: string; href: string; active: boolean; badge?: number }) {
    return (
      <Link href={href} className={cn("relative flex flex-col items-center justify-center gap-0.5", active ? "text-primary" : "text-muted-foreground")}>
        <Icon className="h-5 w-5" />
        <span className="text-[10px] font-medium">{label}</span>
        {badge ? (
          <span className="absolute right-4 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {badge > 9 ? "9+" : badge}
          </span>
        ) : null}
      </Link>
    );
  }
}

function groupMovements(movements: import("@/lib/types").Movement[]) {
  const map = new Map<string, import("@/lib/types").Movement[]>();
  for (const m of movements) {
    const list = map.get(m.itemId) ?? [];
    list.push(m);
    map.set(m.itemId, list);
  }
  return map;
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-5 py-4">
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/40">
        <Boxes className="h-4.5 w-4.5 h-5 w-5" />
      </span>
      <div>
        <p className="text-sm font-bold leading-none tracking-tight">Stash</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">Personal inventory</p>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 mt-5 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">{children}</p>;
}

function NavSection({ items, isActive, onNavigate }: { items: NavItem[]; isActive: (href: string) => boolean; onNavigate: () => void }) {
  return (
    <div className="space-y-0.5">
      {items.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.label + item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            <item.icon className={cn("h-4.5 w-4.5 h-[18px] w-[18px]", active ? "" : "opacity-70")} />
            {item.label}
            {item.badge ? (
              <span className="ml-auto rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">{item.badge}</span>
            ) : (
              <ChevronRight className={cn("ml-auto h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-50", active && "opacity-40")} />
            )}
          </Link>
        );
      })}
    </div>
  );
}

function UserFooter() {
  const auth = useAuth();
  const data = useData();
  const email = auth.user?.email ?? "";
  return (
    <div className="border-t p-3">
      <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
          {email.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">{email}</p>
          <p className="text-[10px] text-muted-foreground">
            {data.repo.kind === "cloud" ? "Cloud synced" : `${data.items.length} items · local`}
          </p>
        </div>
        <button
          title="Sign out"
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          onClick={() => auth.signOut().then(() => window.location.assign("/"))}
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
