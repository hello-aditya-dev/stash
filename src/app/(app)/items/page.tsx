"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Package, Plus, Upload, Download, LayoutGrid, List as ListIcon,
  TriangleAlert, MapPin, Search,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/ui/extras";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ItemFormModal, locationPath } from "@/components/items/ItemFormModal";
import { useData } from "@/lib/data-context";
import { currentQty, downloadFile, fmtMoney, itemValue, todayISO } from "@/lib/utils";
import { applyImport, parseImportFile, toCSV, type ImportRow } from "@/lib/csv";

function ItemsInner() {
  const data = useData();
  const router = useRouter();
  const params = useSearchParams();

  const [formOpen, setFormOpen] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [q, setQ] = useState(params.get("q") ?? "");
  const [catFilter, setCatFilter] = useState("all");
  const [locFilter, setLocFilter] = useState("all");
  const [lowOnly, setLowOnly] = useState(false);
  const [sort, setSort] = useState("updated");
  const [importOpen, setImportOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<ImportRow[] | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (params.get("new") === "1") {
      setFormOpen(true);
      router.replace("/items", { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const movementsByItem = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of data.movements) map.set(m.itemId, (map.get(m.itemId) ?? 0) + m.delta);
    return map;
  }, [data.movements]);

  const filtered = useMemo(() => {
    let list = [...data.items];
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(needle) ||
          (i.description ?? "").toLowerCase().includes(needle) ||
          i.tags.some((t) => t.includes(needle)) ||
          (i.barcode ?? "").toLowerCase().includes(needle)
      );
    }
    if (catFilter !== "all") list = list.filter((i) => i.categoryId === catFilter);
    if (locFilter !== "all") list = list.filter((i) => i.locationId === locFilter);
    if (lowOnly)
      list = list.filter((i) => i.minQuantity != null && (movementsByItem.get(i.id) ?? 0) <= i.minQuantity);
    switch (sort) {
      case "name": list.sort((a, b) => a.name.localeCompare(b.name)); break;
      case "qty": list.sort((a, b) => (movementsByItem.get(a.id) ?? 0) - (movementsByItem.get(b.id) ?? 0)); break;
      case "value": list.sort((a, b) => itemValue(b) - itemValue(a)); break;
      default: list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
    return list;
  }, [data.items, q, catFilter, locFilter, lowOnly, sort, movementsByItem]);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    for (const i of data.items) i.tags.forEach((t) => s.add(t));
    return [...s].sort();
  }, [data.items]);

  const exportCsv = () => {
    const rows = data.items.map((i) => ({
      name: i.name,
      category: data.categories.find((c) => c.id === i.categoryId)?.name ?? "",
      location: locationPath(i.locationId, data.locations),
      quantity: movementsByItem.get(i.id) ?? 0,
      unit: i.unit ?? "pcs",
      min_quantity: i.minQuantity ?? "",
      purchase_price: i.purchasePrice ?? "",
      current_value: i.currentValue ?? "",
      purchase_date: i.purchaseDate ?? "",
      warranty_expiry: i.warrantyExpiry ?? "",
      condition: i.condition ?? "",
      barcode: i.barcode ?? "",
      tags: i.tags.join(", "),
      description: i.description ?? "",
      created_at: i.createdAt,
    }));
    downloadFile(`stash-items-${todayISO()}.csv`, toCSV(rows), "text/csv");
    toast.success(`Exported ${rows.length} items`);
  };

  const onFilePicked = async (f: File | null) => {
    if (!f) return;
    try {
      const { rows } = await parseImportFile(f);
      if (!rows.length) {
        toast.error("No rows found — check the template headers");
        return;
      }
      setPendingImport(rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not parse file");
    }
  };

  const runImport = async () => {
    if (!pendingImport) return;
    setImporting(true);
    try {
      const res = await applyImport(pendingImport, {
        repo: data.repo,
        categories: [...data.categories],
        locations: [...data.locations],
      });
      await data.refresh();
      toast.success(
        `Imported ${res.itemsCreated} items (${res.categoriesCreated} new categories, ${res.locationsCreated} new locations)`
      );
      setImportOpen(false);
      setPendingImport(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Items"
        subtitle={`${data.items.length} in your stash`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => { setPendingImport(null); setImportOpen(true); }}>
              <Upload className="h-4 w-4" /> Import
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-4 w-4" /> Export
            </Button>
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" /> Add item
            </Button>
          </>
        }
      />

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search name, tag, barcode…" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {data.categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={locFilter} onValueChange={setLocFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All locations</SelectItem>
            {data.locations.map((l) => (
              <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="updated">Recently updated</SelectItem>
            <SelectItem value="name">Name A–Z</SelectItem>
            <SelectItem value="qty">Lowest qty</SelectItem>
            <SelectItem value="value">Highest value</SelectItem>
          </SelectContent>
        </Select>
        <button
          onClick={() => setLowOnly((v) => !v)}
          className={`inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm transition ${
            lowOnly ? "border-amber-300 bg-amber-50 font-medium text-amber-700" : "bg-card text-muted-foreground hover:bg-secondary"
          }`}
        >
          <TriangleAlert className="h-4 w-4" /> Low stock
        </button>
        <div className="flex rounded-lg border bg-card p-0.5">
          <button onClick={() => setView("grid")} className={`rounded-md p-2 ${view === "grid" ? "bg-secondary text-foreground" : "text-muted-foreground"}`}>
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button onClick={() => setView("list")} className={`rounded-md p-2 ${view === "list" ? "bg-secondary text-foreground" : "text-muted-foreground"}`}>
            <ListIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Package />}
          title={data.items.length ? "No matches" : "No items yet"}
          description={
            data.items.length
              ? "Try clearing filters or a different search."
              : "Add your first item — it takes about five seconds. Or import a CSV."
          }
          action={
            !data.items.length && (
              <div className="flex gap-2">
                <Button onClick={() => setFormOpen(true)}><Plus /> Add item</Button>
                <Button variant="outline" onClick={() => setImportOpen(true)}><Upload /> Import CSV</Button>
              </div>
            )
          }
        />
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((item) => {
            const qty = movementsByItem.get(item.id) ?? 0;
            const low = item.minQuantity != null && qty <= item.minQuantity;
            const photo = item.photos[0];
            return (
              <button
                key={item.id}
                onClick={() => router.push(`/items/${item.id}`)}
                className="group overflow-hidden rounded-xl border bg-card text-left shadow-card transition-all hover:-translate-y-0.5 hover:shadow-pop"
              >
                <div className="relative aspect-square bg-secondary">
                  {photo ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={photo.url ?? photo.dataUrl} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-muted-foreground/40">
                      <Package className="h-9 w-9" />
                    </span>
                  )}
                  <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${low ? "bg-rose-500 text-white" : "bg-black/60 text-white backdrop-blur"}`}>
                    {qty} {item.unit}
                  </span>
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-semibold">{item.name}</p>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {locationPath(item.locationId, data.locations) || "No location"}
                  </p>
                  {itemValue(item) > 0 && (
                    <p className="mt-1 text-xs font-medium tabular-nums text-emerald-600">
                      {fmtMoney(itemValue(item), data.settings.currency)}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-card">
          {filtered.map((item) => {
            const qty = movementsByItem.get(item.id) ?? 0;
            const low = item.minQuantity != null && qty <= item.minQuantity;
            const photo = item.photos[0];
            return (
              <button
                key={item.id}
                onClick={() => router.push(`/items/${item.id}`)}
                className="flex w-full items-center gap-3 border-b px-4 py-3 text-left last:border-0 hover:bg-secondary/50"
              >
                <span className="flex h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-secondary">
                  {photo ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={photo.url ?? photo.dataUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <Package className="m-auto h-5 w-5 text-muted-foreground/40" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{item.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {locationPath(item.locationId, data.locations) || "No location"}
                    {data.categories.find((c) => c.id === item.categoryId)?.name ? ` · ${data.categories.find((c) => c.id === item.categoryId)!.name}` : ""}
                  </span>
                </span>
                {item.tags.slice(0, 2).map((t) => (
                  <Badge key={t} variant="indigo" className="hidden sm:inline-flex">{t}</Badge>
                ))}
                <Badge variant={low ? "red" : "green"}>{qty} {item.unit}</Badge>
              </button>
            );
          })}
        </div>
      )}

      <ItemFormModal open={formOpen} onClose={() => setFormOpen(false)} />

      {/* Import dialog */}
      <Dialog open={importOpen} onOpenChange={(o) => !o && setImportOpen(false)}>
        <DialogContent wide>
          <DialogHeader>
            <DialogTitle>Import items from CSV / Excel export</DialogTitle>
          </DialogHeader>
          {!pendingImport ? (
            <div className="px-5 pb-2">
              <div className="rounded-xl border border-dashed p-6 text-center">
                <Upload className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
                <p className="text-sm font-medium">Choose a .csv file</p>
                <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                  Columns are auto-detected (name, category, location, quantity, price, tags…).
                  Missing categories and locations are created automatically.
                </p>
                <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFilePicked(e.target.files?.[0] ?? null)} />
                <Button className="mt-4" onClick={() => fileRef.current?.click()}>Select file</Button>
              </div>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Need a template?{" "}
                <button
                  className="font-medium text-primary hover:underline"
                  onClick={() =>
                    downloadFile(
                      "stash-import-template.csv",
                      toCSV([
                        { name: "Cordless Drill", category: "Tools", location: "Garage", quantity: 1, unit: "pcs", purchase_price: 8499 },
                        { name: "Olive Oil", category: "Groceries", location: "Kitchen", quantity: 2, unit: "bottle", min_quantity: 1 },
                      ])
                    )
                  }
                >
                  Download example
                </button>
              </p>
            </div>
          ) : (
            <div className="px-5 pb-2">
              <p className="text-sm">
                Found <b>{pendingImport.length}</b> row(s). Preview:
              </p>
              <div className="mt-2 max-h-56 overflow-auto rounded-xl border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-secondary">
                    <tr>
                      <th className="px-2 py-1.5 text-left">Name</th>
                      <th className="px-2 py-1.5 text-left">Category</th>
                      <th className="px-2 py-1.5 text-left">Location</th>
                      <th className="px-2 py-1.5 text-right">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingImport.slice(0, 20).map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1.5">{r.name}</td>
                        <td className="px-2 py-1.5">{r.category || "—"}</td>
                        <td className="px-2 py-1.5">{r.location || "—"}</td>
                        <td className="px-2 py-1.5 text-right">{r.quantity ?? 1}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <DialogFooter>
            {pendingImport && (
              <Button variant="secondary" onClick={() => setPendingImport(null)}>Pick another</Button>
            )}
            <Button onClick={runImport} disabled={!pendingImport} loading={importing}>
              Import {pendingImport ? `${pendingImport.length} items` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function ItemsPage() {
  return (
    <Suspense fallback={null}>
      <ItemsInner />
    </Suspense>
  );
}
