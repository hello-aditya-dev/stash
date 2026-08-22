"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowDownLeft, ArrowUpRight, ArrowRightLeft, Pencil, Trash2,
  Plus, Package, QrCode, Wrench, FileText, Upload, Download, CalendarClock, TriangleAlert,
} from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label, Field } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog, EmptyState } from "@/components/ui/extras";
import { ItemFormModal, locationPath } from "@/components/items/ItemFormModal";
import { StockOpsModal } from "@/components/items/StockOpsModal";
import { useData } from "@/lib/data-context";
import { Spinner } from "@/components/ui/extras";
import {
  CONDITION_LABELS, type Batch, type SerialStatus,
} from "@/lib/types";
import {
  currentQty, daysUntil, fmtDate, fmtDateTime, fmtMoney, itemValue,
  nowISO, printHtml, todayISO, uid,
} from "@/lib/utils";

export default function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const data = useData();
  const [editOpen, setEditOpen] = useState(false);
  const [opsOpen, setOpsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [batchModal, setBatchModal] = useState(false);
  const [serialsInput, setSerialsInput] = useState("");
  const [maintOpen, setMaintOpen] = useState(false);
  const [maintText, setMaintText] = useState("");
  const [maintCost, setMaintCost] = useState("");
  const [maintDate, setMaintDate] = useState(todayISO());

  const item = data.items.find((i) => i.id === id);
  const movements = useMemo(
    () => data.movements.filter((m) => m.itemId === id).sort((a, b) => b.date.localeCompare(a.date)),
    [data.movements, id]
  );
  const batches = useMemo(
    () => data.batches.filter((b) => b.itemId === id),
    [data.batches, id]
  );
  const serials = useMemo(
    () => data.serials.filter((s) => s.itemId === id),
    [data.serials, id]
  );
  const files = useMemo(
    () => data.attachments.filter((a) => a.itemId === id),
    [data.attachments, id]
  );
  const maintenance = useMemo(
    () =>
      data.reminders
        .filter((r) => r.type === "maintenance" && r.itemId === id)
        .sort((a, b) => (b.dueDate ?? "").localeCompare(a.dueDate ?? "")),
    [data.reminders, id]
  );

  if (data.loading) return <Spinner full />;
  if (!item)
    return (
      <EmptyState
        icon={<Package />}
        title="Item not found"
        description="It may have been deleted."
        action={<Button onClick={() => router.push("/items")}>Back to items</Button>}
      />
    );

  const qty = currentQty(movements);
  const low = item.minQuantity != null && qty <= item.minQuantity;
  const vendor = data.contacts.find((c) => c.id === item.vendorId);
  const warrantyDays = daysUntil(item.warrantyExpiry);

  const printQrLabel = async () => {
    const payload = `stash:item:${item.id}`;
    const qr = await QRCode.toDataURL(payload, { margin: 1, width: 220 });
    printHtml(
      `Label — ${item.name}`,
      `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr))">
        <div class="label-card" style="text-align:center">
          <img src="${qr}" width="150" height="150" style="margin:auto"/>
          <h1 style="font-size:14px;margin-top:8px">${escapeHtml(item.name)}</h1>
          <p class="muted">${escapeHtml(locationPath(item.locationId, data.locations))}</p>
          <p class="muted">Scan with Stash to open</p>
        </div>
      </div>`
    );
  };

  const addBatches = async () => setBatchModal(true);

  return (
    <>
      <Link href="/items" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to items
      </Link>

      {/* Hero */}
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-5 p-5 sm:flex-row">
          <div className="flex gap-2 sm:block">
            <span className="block h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-secondary sm:h-36 sm:w-36">
              {item.photos[0] ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={item.photos[0].url ?? item.photos[0].dataUrl} alt={item.name} className="h-full w-full object-cover" />
              ) : (
                <Package className="m-auto mt-11 h-10 w-10 text-muted-foreground/40 sm:mt-14" />
              )}
            </span>
            {item.photos.length > 1 && (
              <div className="flex gap-1.5 sm:hidden">
                {item.photos.slice(1, 4).map((p) => (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img key={p.id} src={p.url ?? p.dataUrl} alt="" className="h-14 w-14 rounded-lg object-cover" />
                ))}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-xl font-bold tracking-tight">{item.name}</h1>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span>{locationPath(item.locationId, data.locations) || "No location"}</span>
                  {item.categoryId && (
                    <Badge variant="indigo">
                      {data.categories.find((c) => c.id === item.categoryId)?.name ?? ""}
                    </Badge>
                  )}
                  <Badge variant={item.condition === "broken" ? "red" : item.condition === "poor" ? "amber" : "green"}>
                    {CONDITION_LABELS[item.condition ?? "good"]}
                  </Badge>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setOpsOpen(true)}>Stock ops</Button>
                <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button size="sm" variant="outline" onClick={printQrLabel}>
                  <QrCode className="h-3.5 w-3.5" /> Label
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive hover:bg-rose-50" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {item.description && <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm text-muted-foreground">{item.description}</p>}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-baseline gap-1 rounded-xl px-3.5 py-2 font-bold tabular-nums ${low ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200" : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"}`}>
                {qty}
                <span className="text-xs font-medium opacity-70">{item.unit}</span>
              </span>
              {low && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-600">
                  <TriangleAlert className="h-3.5 w-3.5" /> at/below min ({item.minQuantity})
                </span>
              )}
              {itemValue(item) > 0 && (
                <span className="text-sm text-muted-foreground">
                  Est. value <b className="text-foreground">{fmtMoney(itemValue(item), data.settings.currency)}</b>
                </span>
              )}
              {warrantyDays !== null && (
                <Badge variant={warrantyDays < 0 ? "gray" : warrantyDays <= 30 ? "amber" : "blue"}>
                  Warranty {warrantyDays < 0 ? `expired ${fmtDate(item.warrantyExpiry)}` : `${warrantyDays}d left`}
                </Badge>
              )}
              {item.tags.map((t) => (
                <Badge key={t}>#{t}</Badge>
              ))}
            </div>

            {(item.bundleItems?.length ?? 0) > 0 && (
              <BundleStatus itemId={item.id} parts={item.bundleItems ?? []} movementsByItem={movementsByItemIdMap()} />
            )}
          </div>
        </div>
      </Card>

      <Tabs defaultValue="overview" className="mt-5">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="movements">Movements ({movements.length})</TabsTrigger>
          <TabsTrigger value="batches">Batches ({batches.length})</TabsTrigger>
          <TabsTrigger value="serials">Serials ({serials.length})</TabsTrigger>
          <TabsTrigger value="files">Files ({files.length})</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card>
              <CardContent className="pt-5">
                <h3 className="mb-3 text-sm font-semibold">Purchase</h3>
                <dl className="space-y-2.5 text-sm">
                  <Row label="Price paid">{item.purchasePrice != null ? fmtMoney(item.purchasePrice, data.settings.currency) : "—"}</Row>
                  <Row label="Purchased on">{fmtDate(item.purchaseDate)}</Row>
                  <Row label="Vendor">{vendor?.name ?? "—"}</Row>
                  <Row label="Warranty until">
                    {item.warrantyExpiry ? (
                      <span className={warrantyDays !== null && warrantyDays < 0 ? "text-rose-600" : ""}>
                        {fmtDate(item.warrantyExpiry)}
                        {warrantyDays !== null && ` (${warrantyDays < 0 ? "expired" : `${warrantyDays}d left`})`}
                      </span>
                    ) : "—"}
                  </Row>
                  <Row label="Barcode">{item.barcode || "—"}</Row>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5">
                <h3 className="mb-3 text-sm font-semibold">Details</h3>
                <dl className="space-y-2.5 text-sm">
                  <Row label="Created">{fmtDateTime(item.createdAt)}</Row>
                  <Row label="Updated">{fmtDateTime(item.updatedAt)}</Row>
                  {Object.entries(item.customFields ?? {}).filter(([, v]) => v !== "" && v != null).map(([k, v]) => {
                    const def = data.categories.find((c) => c.id === item.categoryId)?.customFields?.find((f) => f.key === k);
                    return <Row key={k} label={def?.label ?? k}>{String(v)}</Row>;
                  })}
                </dl>
              </CardContent>
            </Card>

            {item.photos.length > 1 && (
              <Card className="md:col-span-2">
                <CardContent className="grid grid-cols-3 gap-2 pt-5 sm:grid-cols-6">
                  {item.photos.map((p) => (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img key={p.id} src={p.url ?? p.dataUrl} alt="" className="aspect-square w-full rounded-lg object-cover" loading="lazy" />
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Movements */}
        <TabsContent value="movements">
          <Card>
            <div className="divide-y">
              {movements.map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                  <span className={`rounded-full p-1.5 ${m.delta >= 0 ? "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200" : "bg-rose-50 text-rose-600 ring-1 ring-rose-200"}`}>
                    {m.type === "adjust" ? <ArrowRightLeft className="h-3.5 w-3.5" /> : m.delta >= 0 ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium capitalize">
                      Stock {m.type} {m.reason ? <span className="font-normal text-muted-foreground">· {m.reason}</span> : null}
                    </p>
                    <p className="text-xs text-muted-foreground">{fmtDate(m.date)} · {fmtDateTime(m.createdAt)}</p>
                  </div>
                  <span className={`text-sm font-bold tabular-nums ${m.delta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {m.delta >= 0 ? "+" : ""}{m.delta}
                  </span>
                </div>
              ))}
              {!movements.length && <p className="px-5 py-8 text-center text-sm text-muted-foreground">No movements yet.</p>}
            </div>
          </Card>
        </TabsContent>

        {/* Batches */}
        <TabsContent value="batches">
          <Card>
            <div className="border-b px-5 py-3">
              <Button size="sm" variant="outline" onClick={addBatches}><Plus className="h-3.5 w-3.5" /> Add batch</Button>
            </div>
            <div className="divide-y">
              {batches.sort(sortByExpiry).map((b) => {
                const d = daysUntil(b.expDate);
                return (
                  <div key={b.id} className="flex items-center gap-3 px-5 py-3">
                    <CalendarClock className={`h-4 w-4 shrink-0 ${d !== null && d < 7 ? "text-rose-500" : d !== null && d < 30 ? "text-amber-500" : "text-muted-foreground"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{b.batchNo} <span className="ml-1 text-xs font-normal text-muted-foreground">· {b.qty} qty</span></p>
                      <p className="text-xs text-muted-foreground">Mfg {fmtDate(b.mfgDate)} → Exp {fmtDate(b.expDate)}</p>
                    </div>
                    {d !== null && b.qty > 0 && (
                      <Badge variant={d < 0 ? "red" : d <= 30 ? "amber" : "green"}>
                        {d < 0 ? `Expired ${-d}d ago` : `${d}d left`}
                      </Badge>
                    )}
                    <button
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"
                      onClick={() => data.repo.deleteBatch(b.id).then(data.refresh)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
              {!batches.length && (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                  No batches. Track lot numbers and expiry for perishables & medicine.
                </p>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* Serials */}
        <TabsContent value="serials">
          <Card>
            <div className="border-b px-5 py-3">
              <Field label="Add serial numbers" hint="One per line — paste a list">
                <Textarea rows={3} placeholder={"SN-001\nSN-002"} value={serialsInput} onChange={(e) => setSerialsInput(e.target.value)} />
              </Field>
              <Button
                size="sm"
                className="mt-2"
                onClick={() => {
                  const nos = serialsInput.split("\n").map((s) => s.trim()).filter(Boolean);
                  if (!nos.length) return;
                  data.repo.addSerials(item.id, nos).then(() => {
                    setSerialsInput("");
                    void data.refresh();
                    toast.success(`Added ${nos.length} serial(s)`);
                  });
                }}
              >
                Add serials
              </Button>
            </div>
            <div className="divide-y">
              {serials.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-5 py-2.5">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 font-mono text-sm">{s.serialNo}</span>
                  <Select
                    value={s.status}
                    onValueChange={(v) => data.repo.updateSerial(s.id, v as SerialStatus).then(data.refresh)}
                  >
                    <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in_stock">In stock</SelectItem>
                      <SelectItem value="sold">Sold</SelectItem>
                      <SelectItem value="returned">Returned</SelectItem>
                      <SelectItem value="damaged">Damaged</SelectItem>
                    </SelectContent>
                  </Select>
                  <button className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary" onClick={() => data.repo.deleteSerial(s.id).then(data.refresh)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {!serials.length && <p className="px-5 py-8 text-center text-sm text-muted-foreground">No serial numbers tracked.</p>}
            </div>
          </Card>
        </TabsContent>

        {/* Files */}
        <TabsContent value="files">
          <Card>
            <div className="border-b px-5 py-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-sm hover:bg-secondary">
                <Upload className="h-4 w-4" /> Attach receipt / manual
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    for (const f of Array.from(e.target.files ?? [])) {
                      const isImg = f.type.startsWith("image/");
                      const dataUrl = isImg ? await import("@/lib/utils").then((u) => u.fileToCompressedDataUrl(f)) : await fileToBase64(f);
                      await data.repo.saveAttachment({
                        id: uid(),
                        itemId: item.id,
                        type: f.name.toLowerCase().includes("receipt") ? "receipt" : "manual",
                        name: f.name,
                        dataUrl,
                        createdAt: nowISO(),
                      });
                    }
                    await data.refresh();
                    toast.success("Attached");
                  }}
                />
              </label>
            </div>
            <div className="divide-y">
              {files.map((a) => (
                <div key={a.id} className="flex items-center gap-3 px-5 py-3">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm">{a.name}</span>
                  <Badge variant={a.type === "receipt" ? "green" : "blue"}>{a.type}</Badge>
                  {a.url ? (
                    <a href={a.url} target="_blank" rel="noreferrer" className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary">
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <a href={a.dataUrl} download={a.name} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary">
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <button className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary" onClick={() => data.repo.deleteAttachment(a.id).then(data.refresh)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {!files.length && <p className="px-5 py-8 text-center text-sm text-muted-foreground">No receipts or manuals attached.</p>}
            </div>
          </Card>
        </TabsContent>

        {/* Maintenance */}
        <TabsContent value="maintenance">
          <Card>
            <div className="border-b px-5 py-3">
              <Button size="sm" variant="outline" onClick={() => setMaintOpen(true)}><Wrench className="h-3.5 w-3.5" /> Schedule service</Button>
            </div>
            <div className="divide-y">
              {maintenance.map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                  <Wrench className={`h-4 w-4 shrink-0 ${r.status === "done" ? "text-emerald-500" : "text-amber-500"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.title}</p>
                    <p className="text-xs text-muted-foreground">{r.notes}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{fmtDate(r.dueDate)}</span>
                  <Badge variant={r.status === "open" ? "amber" : "green"}>{r.status === "open" ? "scheduled" : "done"}</Badge>
                  {r.status === "open" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => data.repo.saveReminder({ ...r, status: "done" }).then(data.refresh).then(() => toast.success("Marked done"))}
                    >
                      Mark done
                    </Button>
                  )}
                </div>
              ))}
              {!maintenance.length && (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                  Log services like oil changes, filter swaps and inspections here.
                </p>
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <ItemFormModal open={editOpen} onClose={() => setEditOpen(false)} item={item} />
      <StockOpsModal open={opsOpen} onClose={() => setOpsOpen(false)} item={item} movements={movements} />

      <BatchModal open={batchModal} onClose={() => setBatchModal(false)} itemId={item.id} existing={batches} />

      {/* Schedule maintenance */}
      <Dialog open={maintOpen} onOpenChange={(o) => !o && setMaintOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Schedule service</DialogTitle></DialogHeader>
          <div className="space-y-3 px-5">
            <Field label="What needs doing?">
              <Input autoFocus placeholder="e.g. Replace water filter" value={maintText} onChange={(e) => setMaintText(e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Due date"><Input type="date" value={maintDate} onChange={(e) => setMaintDate(e.target.value)} /></Field>
              <Field label="Notes"><Input placeholder="Optional" value={maintCost} onChange={(e) => setMaintCost(e.target.value)} /></Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setMaintOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!maintText.trim()) return;
                data.repo
                  .saveReminder({
                    id: uid(), title: maintText.trim(), type: "maintenance",
                    dueDate: maintDate, itemId: item.id, notes: maintCost.trim(),
                    status: "open", createdAt: nowISO(),
                  })
                  .then(data.refresh)
                  .then(() => {
                    setMaintOpen(false); setMaintText(""); setMaintCost("");
                    toast.success("Scheduled");
                  });
              }}
            >
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete item?"
        message={`“${item.name}” and its entire history will be permanently removed.`}
        onConfirm={() =>
          data.repo.deleteItem(item.id).then(() => {
            toast.success("Deleted");
            router.push("/items");
          })
        }
      />
    </>
  );

  function movementsByItemIdMap(): Map<string, number> {
    const map = new Map<string, number>();
    for (const m of data.movements) map.set(m.itemId, (map.get(m.itemId) ?? 0) + m.delta);
    return map;
  }
}

function BundleStatus({
  parts,
  movementsByItem,
}: {
  itemId: string;
  parts: { itemId: string; qty: number }[];
  movementsByItem: Map<string, number>;
}) {
  const data = useData();
  const rows = parts.map((p) => ({
    name: data.items.find((i) => i.id === p.itemId)?.name ?? "?",
    need: p.qty,
    have: movementsByItem.get(p.itemId) ?? 0,
  }));
  const buildable = Math.min(...rows.map((r) => Math.floor(r.have / r.need)));
  return (
    <div className="mt-3 rounded-xl border bg-slate-50/70 p-3.5">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Kit contents · <span className="normal-case">{buildable >= 0 && rows.every((r) => r.have >= r.need) ? `${buildable} complete kit(s)` : "missing parts"}</span>
      </p>
      <ul className="space-y-1 text-xs">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-2">
            <Link href={`/items`} className="hover:underline">{r.name}</Link>
            <span className="text-muted-foreground">needs {r.need} · has {r.have}</span>
            {r.have < r.need && <Badge variant="red">short</Badge>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BatchModal({
  open, onClose, itemId, existing,
}: {
  open: boolean;
  onClose: () => void;
  itemId: string;
  existing: Batch[];
}) {
  const data = useData();
  const [no, setNo] = useState(`LOT-${new Date().getFullYear()}-`);
  const [qty, setQty] = useState("1");
  const [exp, setExp] = useState("");
  const [mfg, setMfg] = useState("");

  const save = async () => {
    if (!no.trim()) return;
    await data.repo.saveBatch({
      id: uid(), itemId, batchNo: no.trim(),
      mfgDate: mfg || null, expDate: exp || null,
      qty: Number(qty) || 0, createdAt: nowISO(),
    });
    await data.refresh();
    toast.success("Batch saved");
    setNo(`LOT-${new Date().getFullYear()}-`); setQty("1"); setExp(""); setMfg("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add batch{existing.length ? ` (${existing.length} tracked)` : ""}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 px-5">
          <Field label="Batch / lot no."><Input autoFocus value={no} onChange={(e) => setNo(e.target.value)} /></Field>
          <Field label="Quantity"><Input type="number" min={0} value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
          <Field label="Manufactured"><Input type="date" value={mfg} onChange={(e) => setMfg(e.target.value)} /></Field>
          <Field label="Expires"><Input type="date" value={exp} onChange={(e) => setExp(e.target.value)} /></Field>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>Save batch</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium">{children}</dd>
    </div>
  );
}

function sortByExpiry(a: Batch, b: Batch) {
  if (!a.expDate) return 1;
  if (!b.expDate) return -1;
  return a.expDate.localeCompare(b.expDate);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
