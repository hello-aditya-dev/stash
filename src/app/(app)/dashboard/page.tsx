"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Package, TriangleAlert, CalendarClock, Wallet, BellRing,
  ArrowDownLeft, ArrowUpRight, ArrowRightLeft, Sparkles, Database, ScanLine, Plus, FileDown,
} from "lucide-react";
import { PageHeader, StatCard, CardHeaderRow, EmptyState } from "@/components/ui/extras";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarList } from "@/components/charts";
import { useData } from "@/lib/data-context";
import { computeAlerts } from "@/lib/alerts";
import { currentQty, fmtDate, fmtDateTime, fmtMoney, itemValue } from "@/lib/utils";

export default function DashboardPage() {
  const data = useData();
  const { items, movements, batches, docs, reminders, categories, settings } = data;

  const movementsByItem = useMemo(() => {
    const map = new Map<string, typeof movements>();
    for (const m of movements) {
      const list = map.get(m.itemId) ?? [];
      list.push(m);
      map.set(m.itemId, list);
    }
    return map;
  }, [movements]);

  const alerts = useMemo(
    () => computeAlerts({ items, movementsByItem, batches, docs, reminders }),
    [items, movementsByItem, batches, docs, reminders]
  );

  const totalValue = items.reduce((s, i) => s + itemValue(i), 0);
  const lowStock = alerts.filter((a) => a.id.startsWith("low-")).length;
  const expiring = alerts.filter((a) => a.id.startsWith("exp-")).length;
  const openReminders = reminders.filter((r) => r.status === "open").length;

  const byCategory = useMemo(() => {
    const totals = new Map<string, number>();
    for (const item of items) {
      const name = categories.find((c) => c.id === item.categoryId)?.name ?? "Uncategorized";
      totals.set(name, (totals.get(name) ?? 0) + itemValue(item));
    }
    return [...totals.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [items, categories]);

  const recentMovements = useMemo(() => movements.slice(0, 8), [movements]);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  if (!data.loading && items.length === 0 && movements.length === 0) {
    return (
      <EmptyState
        icon={<Package />}
        title="Welcome to your Stash"
        description="Add your first item in seconds, import a CSV, or load a demo household to explore every feature."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => (window.location.href = "/items?new=1")}>
              <Plus /> Add first item
            </Button>
            <Button variant="outline" onClick={() => (window.location.href = "/settings")}>
              <Database /> Import / demo data
            </Button>
          </div>
        }
      />
    );
  }

  return (
    <>
      <PageHeader
        title={`${greeting} 👋`}
        subtitle="Here's what's happening across your stash"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => (window.location.href = "/scan")}>
              <ScanLine className="h-4 w-4" /> Scan
            </Button>
            <Button size="sm" onClick={() => (window.location.href = "/items?new=1")}>
              <Plus className="h-4 w-4" /> Add item
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Items" value={items.length} sub={`${new Set(items.map((i) => i.categoryId)).size} categories`} />
        <StatCard label="Est. value" value={fmtMoney(totalValue, settings.currency)} sub="purchase + estimates" tone="success" />
        <StatCard label="Low stock" value={lowStock} sub="at or below minimum" tone={lowStock ? "warning" : "default"} onClick={() => (window.location.href = "/reports?tab=valuation")} />
        <StatCard label="Expiring ≤30d" value={expiring} sub="batches to watch" tone={expiring ? "danger" : "default"} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeaderRow
            title="Needs attention"
            subtitle={`${alerts.length} alert(s)`}
            action={<Badge variant={alerts.length ? "red" : "green"}>{alerts.length ? "Action needed" : "All clear"}</Badge>}
          />
          <div className="max-h-80 overflow-y-auto p-2">
            {alerts.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Nothing needs attention right now. 🎉
              </p>
            ) : (
              alerts.map((a) => (
                <Link
                  key={a.id}
                  href={a.href}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-secondary transition-colors"
                >
                  <span className={`rounded-lg p-1.5 ${a.severity === "danger" ? "bg-rose-50 text-rose-600 ring-1 ring-rose-200" : a.severity === "warning" ? "bg-amber-50 text-amber-600 ring-1 ring-amber-200" : "bg-sky-50 text-sky-600 ring-1 ring-sky-200"}`}>
                    <TriangleAlert className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{a.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{a.detail}</span>
                  </span>
                </Link>
              ))
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeaderRow title="Value by category" action={<Wallet className="h-4 w-4 text-muted-foreground" />} />
            <div className="p-5">
              {byCategory.length ? (
                <BarList data={byCategory} formatValue={(v) => fmtMoney(v, settings.currency)} />
              ) : (
                <p className="text-sm text-muted-foreground">No valuations yet.</p>
              )}
            </div>
          </Card>

          <Link href="/assistant" className="block rounded-xl border border-dashed border-primary/40 bg-accent/40 p-5 transition hover:border-primary">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-semibold text-accent-foreground">Ask your stash anything</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  &ldquo;What expires in 30 days?&rdquo; · &ldquo;Where is the drill?&rdquo; · &ldquo;How much is everything worth?&rdquo;
                </p>
              </div>
            </div>
          </Link>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeaderRow
            title="Recent activity"
            subtitle="Latest stock movements"
            action={
              <Link href="/reports?tab=movements" className="text-xs font-medium text-primary hover:underline">
                View all
              </Link>
            }
          />
          <div className="divide-y">
            {recentMovements.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">No movements recorded yet.</p>
            )}
            {recentMovements.map((m) => {
              const item = items.find((i) => i.id === m.itemId);
              return (
                <Link key={m.id} href={`/items/${m.itemId}`} className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/60 transition-colors">
                  <span className={`rounded-full p-1.5 ${m.delta >= 0 ? "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200" : "bg-rose-50 text-rose-600 ring-1 ring-rose-200"}`}>
                    {m.type === "adjust" ? <ArrowRightLeft className="h-3.5 w-3.5" /> : m.delta >= 0 ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item?.name ?? "Deleted item"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {m.reason || m.type} · {fmtDate(m.date)}
                    </p>
                  </div>
                  <span className={`shrink-0 text-sm font-bold tabular-nums ${m.delta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {m.delta >= 0 ? "+" : ""}{m.delta}
                  </span>
                </Link>
              );
            })}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeaderRow title="Open reminders" action={<BellRing className="h-4 w-4 text-muted-foreground" />} />
            <div className="p-2">
              {openReminders === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">Nothing scheduled.</p>
              ) : (
                reminders
                  .filter((r) => r.status === "open")
                  .slice(0, 5)
                  .map((r) => (
                    <Link key={r.id} href="/reminders" className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-secondary transition-colors">
                      <span className="min-w-0 flex-1 truncate text-sm">{r.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{r.dueDate ? fmtDate(r.dueDate) : "—"}</span>
                    </Link>
                  ))
              )}
            </div>
          </Card>
          <Card>
            <CardHeaderRow title="Quick tools" />
            <div className="grid grid-cols-2 gap-2 p-4">
              <Button variant="outline" size="sm" className="justify-start" onClick={() => (window.location.href = "/reports")}>
                <FileDown className="h-4 w-4" /> Reports
              </Button>
              <Button variant="outline" size="sm" className="justify-start" onClick={() => (window.location.href = "/settings")}>
                <Database className="h-4 w-4" /> Backup
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
