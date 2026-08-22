"use client";

import React, { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus, Printer, Pencil, Trash2, Wallet, ClipboardList,
  FileText, ReceiptText, KanbanSquare, CheckCircle2, ArrowRightLeft,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, CardHeaderRow, EmptyState, ConfirmDialog } from "@/components/ui/extras";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Field } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DocFormModal, computeDocTotals } from "@/components/docs/DocFormModal";
import { printDoc } from "@/components/docs/doc-print";
import { useData } from "@/lib/data-context";
import { daysUntil, fmtDate, fmtMoney, nowISO, todayISO, uid } from "@/lib/utils";
import type { DocKind, FinDoc, Project } from "@/lib/types";

function DocumentsInner() {
  const data = useData();
  const params = useSearchParams();
  const tab = params.get("tab") ?? "invoices";
  const setTab = (t: string) => window.history.replaceState(null, "", `/documents?tab=${t}`);

  const [formKind, setFormKind] = useState<DocKind | null>(null);
  const [editDoc, setEditDoc] = useState<FinDoc | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<FinDoc | null>(null);
  const [payDoc, setPayDoc] = useState<FinDoc | null>(null);
  const [payAmount, setPayAmount] = useState("");

  const partyName = (id: string | null | undefined) =>
    data.contacts.find((c) => c.id === id)?.name ?? "";

  const invoiceStatus = (d: FinDoc): { label: string; variant: "green" | "amber" | "red" | "gray" | "blue" } => {
    if (d.status === "void") return { label: "Void", variant: "gray" };
    const t = computeDocTotals(d).total;
    const paid = d.paidAmount ?? 0;
    if (paid >= t && t > 0) return { label: "Paid", variant: "green" };
    if (paid > 0) return { label: `Partial ${fmtMoney(paid, data.settings.currency)}`, variant: "amber" };
    const due = daysUntil(d.dueDate);
    if (due !== null && due < 0 && d.dueDate) return { label: "Overdue", variant: "red" };
    return { label: "Unpaid", variant: "blue" };
  };

  const convertQuoteToInvoice = async (q: FinDoc) => {
    const number = await data.repo.nextDocNumber("invoice");
    const inv: FinDoc = {
      ...q,
      id: uid(),
      kind: "invoice",
      number,
      status: "sent",
      date: todayISO(),
      dueDate: addDays(todayISO(), 14),
      paidAmount: 0,
      receivedAt: null,
      createdAt: nowISO(),
    };
    await data.repo.saveDoc(inv);
    await data.repo.saveDoc({ ...q, status: "accepted" });
    await data.refresh();
    toast.success(`Created invoice ${number}`);
    setTab("invoices");
  };

  const receivePurchase = async (po: FinDoc) => {
    for (const line of po.lines) {
      if (line.itemId) {
        await data.repo.addMovement({
          id: uid(),
          itemId: line.itemId,
          type: "in",
          delta: line.qty,
          reason: `PO ${po.number}`,
          date: todayISO(),
          createdAt: nowISO(),
        });
      }
    }
    await data.repo.saveDoc({ ...po, status: "received", receivedAt: todayISO() });
    await data.refresh();
    toast.success("Stock received into inventory");
  };

  return (
    <>
      <PageHeader
        title="Documents"
        subtitle="Invoices, quotations, purchase orders, expenses & projects"
        actions={
          formKind === null && (
            <Button size="sm" onClick={() => setFormKind(tab === "quotations" ? "quotation" : tab === "purchases" ? "purchase" : "invoice")}>
              <Plus className="h-4 w-4" /> New{" "}
              {tab === "quotations" ? "quotation" : tab === "purchases" ? "purchase order" : tab === "invoices" ? "invoice" : ""}
            </Button>
          )
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="quotations">Quotations</TabsTrigger>
          <TabsTrigger value="purchases">Purchases</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
        </TabsList>

        {/* Invoices */}
        <TabsContent value="invoices">
          <DocTable
            kind="invoice"
            onEdit={(d) => { setEditDoc(d); setFormKind("invoice"); }}
            onDelete={setDeleteDoc}
            renderRow={(d) => {
              const st = invoiceStatus(d);
              const t = computeDocTotals(d).total;
              return (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{d.number} <span className="ml-1 font-normal text-muted-foreground">· {partyName(d.partyId)}</span></p>
                    <p className="text-xs text-muted-foreground">{fmtDate(d.date)}{d.dueDate ? ` → due ${fmtDate(d.dueDate)}` : ""}</p>
                  </div>
                  <Badge variant={st.variant}>{st.label}</Badge>
                  <span className="w-24 shrink-0 text-right text-sm font-bold tabular-nums">{fmtMoney(t, data.settings.currency)}</span>
                </>
              );
            }}
            extraActions={(d) => (
              <>
                {(d.paidAmount ?? 0) < computeDocTotals(d).total && d.status !== "void" && (
                  <button
                    title="Record payment"
                    className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50"
                    onClick={() => {
                      setPayDoc(d);
                      setPayAmount(String(Math.max(0, Math.round((computeDocTotals(d).total - (d.paidAmount ?? 0)) * 100) / 100)));
                    }}
                  >
                    <Wallet className="h-3.5 w-3.5" />
                  </button>
                )}
                <button title="Print / PDF" className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary" onClick={() => printDoc(d, data.settings, data.contacts.find((c) => c.id === d.partyId))}>
                  <Printer className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          />
        </TabsContent>

        {/* Quotations */}
        <TabsContent value="quotations">
          <DocTable
            kind="quotation"
            onEdit={(d) => { setEditDoc(d); setFormKind("quotation"); }}
            onDelete={setDeleteDoc}
            renderRow={(d) => (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{d.number} <span className="ml-1 font-normal text-muted-foreground">· {partyName(d.partyId)}</span></p>
                  <p className="text-xs text-muted-foreground">{fmtDate(d.date)} · {d.lines.length} line(s)</p>
                </div>
                <Badge variant={d.status === "accepted" ? "green" : d.status === "rejected" ? "red" : d.status === "sent" ? "blue" : "gray"}>
                  {d.status}
                </Badge>
                <span className="w-24 shrink-0 text-right text-sm font-bold tabular-nums">{fmtMoney(computeDocTotals(d).total, data.settings.currency)}</span>
              </>
            )}
            extraActions={(d) => (
              <>
                {d.status !== "accepted" && (
                  <button
                    title="Convert to invoice"
                    className="rounded-lg p-1.5 text-primary hover:bg-accent"
                    onClick={() => convertQuoteToInvoice(d)}
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                  </button>
                )}
                <button title="Print / PDF" className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary" onClick={() => printDoc(d, data.settings, data.contacts.find((c) => c.id === d.partyId))}>
                  <Printer className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          />
        </TabsContent>

        {/* Purchases */}
        <TabsContent value="purchases">
          <DocTable
            kind="purchase"
            onEdit={(d) => { setEditDoc(d); setFormKind("purchase"); }}
            onDelete={setDeleteDoc}
            renderRow={(d) => (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{d.number} <span className="ml-1 font-normal text-muted-foreground">· {partyName(d.partyId)}</span></p>
                  <p className="text-xs text-muted-foreground">
                    {fmtDate(d.date)} · {d.lines.reduce((s, l) => s + l.qty, 0)} unit(s)
                    {d.receivedAt ? ` · received ${fmtDate(d.receivedAt)}` : ""}
                  </p>
                </div>
                <Badge variant={d.status === "received" ? "green" : d.status === "cancelled" ? "red" : "amber"}>{d.status}</Badge>
                <span className="w-24 shrink-0 text-right text-sm font-bold tabular-nums">{fmtMoney(computeDocTotals(d).total, data.settings.currency)}</span>
              </>
            )}
            extraActions={(d) => (
              <>
                {d.status !== "received" && (
                  <button
                    title="Receive stock"
                    className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50"
                    onClick={() => receivePurchase(d)}
                  >
                    <ClipboardList className="h-3.5 w-3.5" />
                  </button>
                )}
                <button title="Print / PDF" className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary" onClick={() => printDoc(d, data.settings, data.contacts.find((c) => c.id === d.partyId))}>
                  <Printer className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          />
        </TabsContent>

        {/* Expenses */}
        <TabsContent value="expenses">
          <ExpensesTab />
        </TabsContent>

        {/* Projects */}
        <TabsContent value="projects">
          <ProjectsTab />
        </TabsContent>
      </Tabs>

      {formKind && (
        <DocFormModal open={!!formKind} onClose={() => { setFormKind(null); setEditDoc(null); }} kind={formKind} doc={editDoc} />
      )}

      {/* Record payment */}
      <Dialog open={!!payDoc} onOpenChange={(o) => !o && setPayDoc(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record payment — {payDoc?.number}</DialogTitle></DialogHeader>
          <div className="px-5">
            <Field label={`Amount (${data.settings.currency})`}>
              <Input autoFocus type="number" min={0} step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setPayDoc(null)}>Cancel</Button>
            <Button
              variant="success"
              onClick={async () => {
                if (!payDoc) return;
                const amt = Number(payAmount) || 0;
                await data.repo.saveDoc({ ...payDoc, paidAmount: (payDoc.paidAmount ?? 0) + amt });
                await data.refresh();
                setPayDoc(null);
                toast.success(`Recorded ${fmtMoney(amt, data.settings.currency)}`);
              }}
            >
              <CheckCircle2 className="h-4 w-4" /> Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteDoc}
        onClose={() => setDeleteDoc(null)}
        title="Delete document?"
        message={`${deleteDoc?.number ?? ""} will be permanently removed.`}
        onConfirm={() => {
          if (deleteDoc) void data.repo.deleteDoc(deleteDoc.id).then(data.refresh).then(() => toast.success("Deleted"));
        }}
      />
    </>
  );

  function DocTable({
    kind,
    renderRow,
    extraActions,
    onEdit,
    onDelete,
  }: {
    kind: DocKind;
    renderRow: (d: FinDoc) => React.ReactNode;
    extraActions?: (d: FinDoc) => React.ReactNode;
    onEdit: (d: FinDoc) => void;
    onDelete: (d: FinDoc) => void;
  }) {
    const docs = useMemo(() => data.docs.filter((x) => x.kind === kind), [data.docs, kind]);
    if (!docs.length)
      return (
        <EmptyState
          icon={kind === "purchase" ? <ClipboardList /> : kind === "quotation" ? <FileText /> : <ReceiptText />}
          title={`No ${kind}s yet`}
          description={
            kind === "invoice"
              ? "Bill for items you sell or lend out — payments tracked automatically."
              : kind === "quotation"
              ? "Send estimates and convert accepted ones to invoices in one click."
              : "Track incoming stock with purchase orders and receive it into inventory."
          }
          action={<Button onClick={() => setFormKind(kind)}><Plus /> Create</Button>}
        />
      );
    return (
      <Card className="overflow-hidden">
        <div className="divide-y">
          {docs.map((d) => (
            <div key={d.id} className="group flex items-center gap-3 px-5 py-3 hover:bg-secondary/40">
              {renderRow(d)}
              <div className="flex opacity-60 transition group-hover:opacity-100">
                {extraActions?.(d)}
                <button title="Edit" className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary" onClick={() => onEdit(d)}>
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button title="Delete" className="rounded-lg p-1.5 text-muted-foreground hover:bg-rose-50 hover:text-rose-600" onClick={() => onDelete(d)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }
}

function ExpensesTab() {
  const data = useData();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [category, setCategory] = useState("General");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [filterCat, setFilterCat] = useState("all");

  const expenses = useMemo(
    () => [...data.expenses].sort((a, b) => b.date.localeCompare(a.date)),
    [data.expenses]
  );
  const filtered = filterCat === "all" ? expenses : expenses.filter((e) => e.category === filterCat);
  const cats = [...new Set(expenses.map((e) => e.category))];
  const monthTotal = expenses
    .filter((e) => e.date.slice(0, 7) === todayISO().slice(0, 7))
    .reduce((s, e) => s + e.amount, 0);

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-md">
        <StatMini label="This month" value={fmtMoney(monthTotal, data.settings.currency)} />
        <StatMini label="All time" value={fmtMoney(expenses.reduce((s, e) => s + e.amount, 0), data.settings.currency)} />
      </div>
      <div className="mb-3 flex gap-2">
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {cats.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" className="ml-auto" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Add expense
        </Button>
      </div>

      <Card className="overflow-hidden">
        {!filtered.length ? (
          <EmptyState icon={<Wallet />} title="No expenses logged" description="Keep an eye on household spending." action={<Button onClick={() => setOpen(true)}><Plus /> Add first expense</Button>} />
        ) : (
          <div className="divide-y">
            {filtered.map((e) => {
              const vendor = data.contacts.find((c) => c.id === e.vendorId);
              return (
                <div key={e.id} className="group flex items-center gap-3 px-5 py-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-50 text-xs font-bold text-rose-600 ring-1 ring-rose-200">
                    −
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{e.note || e.category}</p>
                    <p className="text-xs text-muted-foreground">{e.category}{vendor ? ` · ${vendor.name}` : ""} · {fmtDate(e.date)}</p>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-rose-600">−{fmtMoney(e.amount, data.settings.currency)}</span>
                  <button
                    className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-600"
                    onClick={() => void data.repo.deleteExpense(e.id).then(data.refresh)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add expense</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 px-5">
            <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Category"><Input placeholder="Groceries…" value={category} onChange={(e) => setCategory(e.target.value)} /></Field>
            <Field label={`Amount (${data.settings.currency})`}><Input type="number" min={0} step="0.01" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
            <Field label="Note"><Input placeholder="Optional" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                const amt = Number(amount);
                if (!amt || amt <= 0) {
                  toast.error("Enter a valid amount");
                  return;
                }
                await data.repo.saveExpense({ id: uid(), date, category: category.trim() || "General", amount: amt, note: note.trim(), createdAt: nowISO() });
                await data.refresh();
                setOpen(false);
                setAmount("");
                setNote("");
                toast.success("Expense saved");
              }}
            >
              Save expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ProjectsTab() {
  const data = useData();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const [status, setStatus] = useState<Project["status"]>("active");

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New project</Button>
      </div>
      {!data.projects.length ? (
        <EmptyState
          icon={<KanbanSquare />}
          title="No projects yet"
          description="Group items under renovations, events or hobbies to see their cost together."
          action={<Button onClick={() => setOpen(true)}><Plus /> Create project</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.projects.map((p) => {
            const linked = data.items.filter((i) => p.itemIds.includes(i.id));
            const value = linked.reduce((s, i) => s + (i.currentValue ?? i.purchasePrice ?? 0), 0);
            return (
              <Card key={p.id} className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold">{p.name}</h3>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{p.description || "—"}</p>
                  </div>
                  <Select
                    value={p.status}
                    onValueChange={(v) => void data.repo.saveProject({ ...p, status: v as Project["status"] }).then(data.refresh)}
                  >
                    <SelectTrigger className="h-7 w-[100px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planned">Planned</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                  <span><b className="text-foreground">{linked.length}</b> items</span>
                  <span>value <b className="text-foreground">{fmtMoney(value, data.settings.currency)}</b></span>
                  {p.budget != null && <span>budget <b className="text-foreground">{fmtMoney(p.budget, data.settings.currency)}</b></span>}
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-rose-50 hover:text-rose-600"
                    title="Delete project"
                    onClick={() => void data.repo.deleteProject(p.id).then(data.refresh).then(() => toast.success("Project deleted"))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New project</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 px-5">
            <Field label="Name"><Input autoFocus placeholder="Home office setup" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label={`Budget (${data.settings.currency})`}><Input type="number" min={0} value={budget} onChange={(e) => setBudget(e.target.value)} /></Field>
            <Field label="Status">
              <Select value={status} onValueChange={(v) => setStatus(v as Project["status"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!name.trim()) {
                  toast.error("Give the project a name");
                  return;
                }
                await data.repo.saveProject({
                  id: uid(),
                  name: name.trim(),
                  status,
                  itemIds: [],
                  budget: budget === "" ? null : Number(budget),
                  createdAt: nowISO(),
                });
                await data.refresh();
                setOpen(false);
                setName("");
                setBudget("");
                toast.success("Project created");
              }}
            >
              Create project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatMini({ label, value }: { label: string; value: string }) {
  return (
    <Card className="px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums">{value}</p>
    </Card>
  );
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function DocumentsPage() {
  return (
    <Suspense fallback={null}>
      <DocumentsInner />
    </Suspense>
  );
}
