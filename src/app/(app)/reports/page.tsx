"use client";

import React, { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileDown, Printer, ShieldCheck, Package, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, CardHeaderRow, StatCard } from "@/components/ui/extras";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useData } from "@/lib/data-context";
import { locationPath } from "@/components/items/ItemFormModal";
import { currentQty, daysUntil, downloadFile, fmtDate, fmtMoney, itemValue, printHtml, todayISO } from "@/lib/utils";
import { toCSV } from "@/lib/csv";

function ReportsInner() {
  const data = useData();
  const params = useSearchParams();
  const tab = params.get("tab") ?? "summary";
  const setTab = (t: string) => {
    window.history.replaceState(null, "", `/reports?tab=${t}`);
  };

  const movementsByItem = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of data.movements) map.set(m.itemId, (map.get(m.itemId) ?? 0) + m.delta);
    return map;
  }, [data.movements]);

  const totalValue = data.items.reduce((s, i) => s + itemValue(i), 0);

  const byCategory = useMemo(() => {
    const counts = new Map<string, number>();
    const values = new Map<string, number>();
    for (const i of data.items) {
      const name = data.categories.find((c) => c.id === i.categoryId)?.name ?? "Uncategorized";
      counts.set(name, (counts.get(name) ?? 0) + 1);
      values.set(name, (values.get(name) ?? 0) + itemValue(i));
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count, value: values.get(name) ?? 0 }))
      .sort((a, b) => b.value - a.value);
  }, [data.items, data.categories]);

  const byLocation = useMemo(() => {
    const counts = new Map<string, number>();
    const values = new Map<string, number>();
    for (const i of data.items) {
      const loc = data.locations.find((l) => l.id === i.locationId);
      const name = loc ? locationPath(loc.id, data.locations) : "Unassigned";
      counts.set(name, (counts.get(name) ?? 0) + 1);
      values.set(name, (values.get(name) ?? 0) + itemValue(i));
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count, value: values.get(name) ?? 0 }))
      .sort((a, b) => b.value - a.value);
  }, [data.items, data.locations]);

  const allBatches = useMemo(
    () =>
      [...data.batches]
        .filter((b) => b.expDate)
        .sort((a, b) => a.expDate!.localeCompare(b.expDate!)),
    [data.batches]
  );

  // Insurance builder state
  const [insLoc, setInsLoc] = useState("all");
  const [insCat, setInsCat] = useState("all");
  const [insMin, setInsMin] = useState("");
  const [insQuery, setInsQuery] = useState("");
  const insuredItems = useMemo(() => {
    let list = [...data.items];
    if (insLoc !== "all") list = list.filter((i) => i.locationId === insLoc || isDescendant(i.locationId, insLoc, data.locations));
    if (insCat !== "all") list = list.filter((i) => i.categoryId === insCat);
    if (insMin !== "") list = list.filter((i) => itemValue(i) >= Number(insMin));
    if (insQuery.trim()) {
      const q = insQuery.toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q));
    }
    return list.sort((a, b) => itemValue(b) - itemValue(a));
  }, [data.items, data.locations, insLoc, insCat, insMin, insQuery]);
  const insuredTotal = insuredItems.reduce((s, i) => s + itemValue(i), 0);

  const generateInsurancePdf = () => {
    const rows = insuredItems
      .map(
        (i) => `<tr>
          <td>${esc(i.name)}<br/><span class="muted">${esc(locationPath(i.locationId, data.locations))}</span></td>
          <td>${esc(data.categories.find((c) => c.id === i.categoryId)?.name ?? "—")}</td>
          <td>${fmtDate(i.purchaseDate)}</td>
          <td class="right">${i.purchasePrice != null ? fmtMoney(i.purchasePrice, data.settings.currency) : "—"}</td>
          <td class="right"><b>${fmtMoney(itemValue(i), data.settings.currency)}</b></td>
        </tr>`
      )
      .join("");
    printHtml(
      "Home Inventory — Insurance Package",
      `<div class="header-row">
        <div>
          <h1>Home Inventory Claim Package</h1>
          <p class="muted">Prepared ${fmtDate(todayISO())} · ${insuredItems.length} items · Total declared value ${fmtMoney(insuredTotal, data.settings.currency)}</p>
        </div>
        <h1 style="color:#4f46e5">Stash</h1>
      </div>
      <table>
        <thead><tr><th>Item &amp; location</th><th>Category</th><th>Purchased</th><th class="right">Price paid</th><th class="right">Declared value</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="muted" style="margin-top:14px">Generated by Stash — personal inventory. Values are owner estimates and receipts are available on request.</p>`
    );
  };

  const exportValuationCsv = () => {
    downloadFile(
      `stash-valuation-${todayISO()}.csv`,
      toCSV(
        data.items.map((i) => ({
          name: i.name,
          category: data.categories.find((c) => c.id === i.categoryId)?.name ?? "",
          location: locationPath(i.locationId, data.locations),
          quantity: movementsByItem.get(i.id) ?? 0,
          purchase_price: i.purchasePrice ?? "",
          current_value: i.currentValue ?? i.purchasePrice ?? "",
        }))
      ),
      "text/csv"
    );
    toast.success("Valuation exported");
  };

  return (
    <>
      <PageHeader title="Reports" subtitle="Answers about your stash — printable and exportable" />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="valuation">Valuation</TabsTrigger>
          <TabsTrigger value="expiry">Expiry</TabsTrigger>
          <TabsTrigger value="movements">Movements</TabsTrigger>
          <TabsTrigger value="insurance" className="gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Insurance</TabsTrigger>
        </TabsList>

        {/* Summary */}
        <TabsContent value="summary">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Total items" value={data.items.length} />
            <StatCard label="Locations used" value={new Set(data.items.filter((i) => i.locationId).map((i) => i.locationId)).size} />
            <StatCard label="Categories used" value={new Set(data.items.filter((i) => i.categoryId).map((i) => i.categoryId)).size} />
            <StatCard label="Movements logged" value={data.movements.length} />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card>
              <CardHeaderRow title="By category" subtitle={`${fmtMoney(totalValue, data.settings.currency)} total`} />
              <MiniTable
                rows={byCategory.map((r) => [r.name, String(r.count), fmtMoney(r.value, data.settings.currency)])}
                headers={["Category", "Items", "Value"]}
              />
            </Card>
            <Card>
              <CardHeaderRow title="By location" />
              <MiniTable
                rows={byLocation.map((r) => [r.name, String(r.count), fmtMoney(r.value, data.settings.currency)])}
                headers={["Location", "Items", "Value"]}
              />
            </Card>
          </div>
        </TabsContent>

        {/* Valuation */}
        <TabsContent value="valuation">
          <Card className="overflow-hidden">
            <CardHeaderRow
              title={`Valuation report — ${data.items.length} items`}
              subtitle={`Declared total ${fmtMoney(totalValue, data.settings.currency)}`}
              action={
                <Button size="sm" variant="outline" onClick={exportValuationCsv}>
                  <FileDown className="h-3.5 w-3.5" /> CSV
                </Button>
              }
            />
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-secondary/95 backdrop-blur">
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-2.5 font-medium">Item</th>
                    <th className="px-3 py-2.5 text-right font-medium">Qty</th>
                    <th className="px-3 py-2.5 text-right font-medium">Paid</th>
                    <th className="px-5 py-2.5 text-right font-medium">Est. value</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.items]
                    .sort((a, b) => itemValue(b) - itemValue(a))
                    .map((i) => (
                      <tr key={i.id} className="border-t hover:bg-secondary/40">
                        <td className="px-5 py-2.5">
                          <p className="font-medium">{i.name}</p>
                          <p className="text-xs text-muted-foreground">{locationPath(i.locationId, data.locations)}</p>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{movementsByItem.get(i.id) ?? 0}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                          {i.purchasePrice != null ? fmtMoney(i.purchasePrice, data.settings.currency) : "—"}
                        </td>
                        <td className="px-5 py-2.5 text-right font-semibold tabular-nums">{fmtMoney(itemValue(i), data.settings.currency)}</td>
                      </tr>
                    ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-secondary/60 font-bold">
                    <td className="px-5 py-3">Total</td>
                    <td />
                    <td />
                    <td className="px-5 py-3 text-right tabular-nums">{fmtMoney(totalValue, data.settings.currency)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Expiry */}
        <TabsContent value="expiry">
          <Card className="overflow-hidden">
            <CardHeaderRow title="Expiry report" subtitle={`${allBatches.length} batch(es) with an expiry date`} />
            <div className="divide-y">
              {allBatches.map((b) => {
                const item = data.items.find((i) => i.id === b.itemId);
                const d = daysUntil(b.expDate);
                return (
                  <a key={b.id} href={`/items/${b.itemId}`} className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/50">
                    <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item?.name ?? "?"}</p>
                      <p className="text-xs text-muted-foreground">Batch {b.batchNo} · qty {b.qty}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{fmtDate(b.expDate)}</span>
                    {d !== null && (
                      <Badge variant={d < 0 ? "red" : d <= 30 ? "amber" : d <= 90 ? "blue" : "green"}>
                        {d < 0 ? `expired ${-d}d` : `${d}d left`}
                      </Badge>
                    )}
                  </a>
                );
              })}
              {!allBatches.length && (
                <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                  No expiries tracked. Add batches to perishables & medicine to watch them here.
                </p>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* Movements */}
        <TabsContent value="movements">
          <MovementLog />
        </TabsContent>

        {/* Insurance */}
        <TabsContent value="insurance">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="p-5 lg:col-span-1">
              <h3 className="text-sm font-semibold">Claim package builder</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Pick a scope, review the preview, then generate a print-ready PDF with photos-ready tables your insurer will accept.
              </p>
              <div className="mt-4 space-y-3">
                <Select value={insLoc} onValueChange={setInsLoc}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All locations</SelectItem>
                    {data.locations.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{locationPath(l.id, data.locations)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={insCat} onValueChange={setInsCat}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {data.categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input type="number" min={0} placeholder={`Min value (${data.settings.currency})`} value={insMin} onChange={(e) => setInsMin(e.target.value)} />
                <Input placeholder="Name contains…" value={insQuery} onChange={(e) => setInsQuery(e.target.value)} />
                <Button className="w-full" onClick={generateInsurancePdf}>
                  <Printer /> Generate claim PDF
                </Button>
                <p className="rounded-lg bg-secondary px-3 py-2 text-center text-xs">
                  <b>{insuredItems.length}</b> items selected · worth{" "}
                  <b>{fmtMoney(insuredTotal, data.settings.currency)}</b>
                </p>
              </div>
            </Card>

            <Card className="overflow-hidden lg:col-span-2">
              <CardHeaderRow title="Preview" subtitle={`${insuredItems.length} items · ${fmtMoney(insuredTotal, data.settings.currency)}`} />
              <div className="max-h-[60vh] overflow-auto divide-y">
                {insuredItems.map((i) => (
                  <div key={i.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="flex h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-secondary">
                      {i.photos[0] ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={i.photos[0].url ?? i.photos[0].dataUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <TriangleAlert className="m-auto h-3.5 w-3.5 text-transparent" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{i.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{locationPath(i.locationId, data.locations)}</p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">{fmtMoney(itemValue(i), data.settings.currency)}</span>
                  </div>
                ))}
                {!insuredItems.length && (
                  <p className="px-5 py-10 text-center text-sm text-muted-foreground">No items match the filters.</p>
                )}
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );

  function isDescendant(locationId: string | null | undefined, ancestorId: string, all: { id: string; parentId?: string | null }[]): boolean {
    let cur = all.find((l) => l.id === locationId);
    while (cur?.parentId) {
      if (cur.parentId === ancestorId) return true;
      cur = all.find((l) => l.id === cur!.parentId);
    }
    return false;
  }
}

function MovementLog() {
  const data = useData();
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.movements
      .map((m) => ({ m, item: data.items.find((i) => i.id === m.itemId) }))
      .filter(
        ({ item, m }) =>
          !needle ||
          (item?.name ?? "").toLowerCase().includes(needle) ||
          (m.reason ?? "").toLowerCase().includes(needle) ||
          m.type.includes(needle)
      )
      .sort((a, b) => b.m.date.localeCompare(a.m.date) || b.m.createdAt.localeCompare(a.m.createdAt))
      .slice(0, 300);
  }, [data.movements, data.items, q]);

  return (
    <Card className="overflow-hidden">
      <CardHeaderRow
        title={`Movement history (${data.movements.length})`}
        action={
          <>
            <Input className="h-8 w-44 text-xs" placeholder="Filter…" value={q} onChange={(e) => setQ(e.target.value)} />
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                downloadFile(
                  `stash-movements-${todayISO()}.csv`,
                  toCSV(
                    data.movements.map((m) => ({
                      date: m.date,
                      item: data.items.find((i) => i.id === m.itemId)?.name ?? "",
                      type: m.type,
                      delta: m.delta,
                      reason: m.reason ?? "",
                    }))
                  ),
                  "text/csv"
                );
                toast.success("Movements exported");
              }}
            >
              <FileDown className="h-3.5 w-3.5" /> CSV
            </Button>
          </>
        }
      />
      <div className="max-h-[60vh] overflow-auto divide-y">
        {rows.map(({ m, item }) => (
          <a key={m.id} href={`/items/${m.itemId}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-secondary/40">
            <span className={`rounded-full p-1 text-xs font-bold tabular-nums ${m.delta >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
              {m.delta >= 0 ? "+" : ""}{m.delta}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item?.name ?? "Deleted item"}</p>
              <p className="truncate text-xs text-muted-foreground">{[m.type, m.reason].filter(Boolean).join(" · ")}</p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">{fmtDate(m.date)}</span>
          </a>
        ))}
      </div>
    </Card>
  );
}

function MiniTable({ rows, headers }: { rows: [string, string, string][]; headers: string[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
          {headers.map((h, i) => (
            <th key={h} className={`px-5 py-2.5 font-medium ${i > 0 ? "text-right" : ""}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(([a, b, c]) => (
          <tr key={a} className="border-b last:border-0">
            <td className="px-5 py-2 font-medium">{a}</td>
            <td className="px-5 py-2 text-right tabular-nums text-muted-foreground">{b}</td>
            <td className="px-5 py-2 text-right tabular-nums">{c}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

export default function ReportsPage() {
  return (
    <Suspense fallback={null}>
      <ReportsInner />
    </Suspense>
  );
}
