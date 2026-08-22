"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useData } from "@/lib/data-context";
import { fmtMoney, nowISO, todayISO, uid } from "@/lib/utils";
import type { DocKind, FinDoc } from "@/lib/types";

export function computeDocTotals(d: Pick<FinDoc, "lines" | "discount" | "taxRate">) {
  const subtotal = d.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const afterDiscount = subtotal - (d.discount ?? 0);
  const tax = afterDiscount * ((d.taxRate ?? 0) / 100);
  return {
    subtotal,
    discount: d.discount ?? 0,
    tax,
    total: Math.round((afterDiscount + tax) * 100) / 100,
  };
}

const KIND_META: Record<DocKind, { title: string; partyLabel: string; partyKind: "customer" | "vendor" }> = {
  invoice: { title: "Invoice", partyLabel: "Customer", partyKind: "customer" },
  quotation: { title: "Quotation", partyLabel: "Customer", partyKind: "customer" },
  purchase: { title: "Purchase order", partyLabel: "Vendor", partyKind: "vendor" },
};

export function DocFormModal({
  open,
  onClose,
  kind,
  doc,
}: {
  open: boolean;
  onClose: () => void;
  kind: DocKind;
  doc?: FinDoc | null;
}) {
  const data = useData();
  const meta = KIND_META[kind];
  const parties = data.contacts.filter((c) => c.kind === meta.partyKind);

  const [number, setNumber] = useState("");
  const [partyId, setPartyId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState("");
  const [lines, setLines] = useState<{ id: string; itemId: string; name: string; qty: string; unitPrice: string }[]>([
    { id: uid(), itemId: "", name: "", qty: "1", unitPrice: "" },
  ]);
  const [discount, setDiscount] = useState("0");
  const [taxRate, setTaxRate] = useState("0");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (doc) {
      setNumber(doc.number);
      setPartyId(doc.partyId ?? "");
      setDate(doc.date);
      setDueDate(doc.dueDate ?? "");
      setLines(doc.lines.map((l) => ({ id: l.id, itemId: l.itemId ?? "", name: l.name, qty: String(l.qty), unitPrice: String(l.unitPrice) })));
      setDiscount(String(doc.discount ?? 0));
      setTaxRate(String(doc.taxRate ?? 0));
      setNotes(doc.notes ?? "");
    } else {
      setNumber("auto");
      setPartyId("");
      setDate(todayISO());
      setDueDate(kind === "invoice" ? addDays(todayISO(), 14) : "");
      setLines([{ id: uid(), itemId: "", name: "", qty: "1", unitPrice: "" }]);
      setDiscount("0");
      setTaxRate(kind === "purchase" ? "0" : "0");
      setNotes("");
    }
  }, [open, doc, kind]);

  const totals = useMemo(
    () =>
      computeDocTotals({
        lines: lines
          .filter((l) => l.name.trim())
          .map((l) => ({ id: l.id, name: l.name, qty: Number(l.qty) || 0, unitPrice: Number(l.unitPrice) || 0 })),
        discount: Number(discount) || 0,
        taxRate: Number(taxRate) || 0,
      }),
    [lines, discount, taxRate]
  );

  const save = async () => {
    const cleanLines = lines
      .filter((l) => l.name.trim())
      .map((l) => ({ id: l.id, itemId: l.itemId || null, name: l.name.trim(), qty: Number(l.qty) || 1, unitPrice: Number(l.unitPrice) || 0 }));
    if (!cleanLines.length) {
      toast.error("Add at least one line item");
      return;
    }
    setBusy(true);
    try {
      let finalNumber = number;
      if (!doc) {
        finalNumber = await data.repo.nextDocNumber(kind);
      }
      const saved: FinDoc = {
        id: doc?.id ?? uid(),
        kind,
        number: finalNumber,
        partyId: partyId || null,
        date,
        dueDate: dueDate || null,
        status: doc?.status ?? (kind === "purchase" ? "ordered" : "draft"),
        lines: cleanLines,
        discount: Number(discount) || 0,
        taxRate: Number(taxRate) || 0,
        notes: notes.trim(),
        paidAmount: doc?.paidAmount ?? 0,
        receivedAt: doc?.receivedAt ?? null,
        createdAt: doc?.createdAt ?? nowISO(),
      };
      await data.repo.saveDoc(saved);
      await data.refresh();
      toast.success(`${meta.title} ${saved.number} saved`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent wide>
        <DialogHeader>
          <DialogTitle>{doc ? `Edit ${meta.title} ${doc.number}` : `New ${meta.title}`}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto px-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label={meta.partyLabel}>
              <Select value={partyId || undefined} onValueChange={(v) => (v === "__none__" ? setPartyId("") : setPartyId(v))}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {parties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Date">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            {kind !== "quotation" && (
              <Field label={kind === "purchase" ? "Expected" : "Due date"}>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </Field>
            )}
            {kind === "quotation" && (
              <Field label="Valid until">
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </Field>
            )}
            <Field label={`Currency`}>
              <Input disabled value={data.settings.currency} />
            </Field>
          </div>

          {/* Lines */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Line items</p>
            <div className="space-y-2">
              {lines.map((l, idx) => (
                <div key={l.id} className="grid grid-cols-[1fr_70px_100px_36px] gap-2">
                  <div className="flex gap-1">
                    <Input
                      placeholder="Description"
                      value={l.name}
                      onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))}
                    />
                    <Select
                      value=""
                      onValueChange={(itemId) => {
                        const src = data.items.find((i) => i.id === itemId);
                        if (!src) return;
                        setLines((prev) =>
                          prev.map((x, i) =>
                            i === idx ? { ...x, itemId, name: x.name || src.name, unitPrice: x.unitPrice || String(src.purchasePrice ?? src.currentValue ?? "") } : x
                          )
                        );
                      }}
                    >
                      <SelectTrigger className="w-10 shrink-0 px-0 [&>span]:hidden justify-center"><Plus className="h-4 w-4" /></SelectTrigger>
                      <SelectContent>
                        {data.items.map((i) => (
                          <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    type="number"
                    min={1}
                    value={l.qty}
                    onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, qty: e.target.value } : x)))}
                  />
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Rate"
                    value={l.unitPrice}
                    onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, unitPrice: e.target.value } : x)))}
                  />
                  <Button variant="ghost" size="icon" onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setLines((prev) => [...prev, { id: uid(), itemId: "", name: "", qty: "1", unitPrice: "" }])}>
                <Plus className="h-3.5 w-3.5" /> Add line
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 rounded-xl border bg-slate-50/70 p-3.5">
            <Field label={`Discount (${data.settings.currency})`}>
              <Input type="number" min={0} step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </Field>
            <Field label="Tax rate (%)">
              <Input type="number" min={0} step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
            </Field>
            <div className="text-right">
              <p className="mt-5 text-xs text-muted-foreground">Subtotal {fmtMoney(totals.subtotal, data.settings.currency)}</p>
              <p className="text-lg font-bold tabular-nums">{fmtMoney(totals.total, data.settings.currency)}</p>
            </div>
          </div>

          <Field label="Notes">
            <Textarea rows={2} placeholder="Terms, thank-you note…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={busy}>{doc ? "Save changes" : `Create ${meta.title.toLowerCase()}`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
