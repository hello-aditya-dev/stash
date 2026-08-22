"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  BellRing, Plus, TriangleAlert, Package, CalendarClock,
  ShieldAlert, ReceiptText, CheckCircle2, X,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, CardHeaderRow, EmptyState } from "@/components/ui/extras";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useData } from "@/lib/data-context";
import { computeAlerts } from "@/lib/alerts";
import { fmtDate, nowISO, todayISO, uid } from "@/lib/utils";
import type { ReminderType } from "@/lib/types";

const TYPE_META: Record<ReminderType, { label: string }> = {
  custom: { label: "Custom" },
  maintenance: { label: "Maintenance" },
  warranty: { label: "Warranty" },
  expiry: { label: "Expiry" },
  low_stock: { label: "Low stock" },
};

export default function RemindersPage() {
  const data = useData();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ReminderType>("custom");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  const movementsByItem = useMemo(() => {
    const map = new Map<string, typeof data.movements>();
    for (const m of data.movements) {
      const list = map.get(m.itemId) ?? [];
      list.push(m);
      map.set(m.itemId, list);
    }
    return map;
  }, [data.movements]);

  const smart = useMemo(
    () =>
      computeAlerts({
        items: data.items,
        movementsByItem,
        batches: data.batches,
        docs: data.docs,
        reminders: [],
      }),
    [data.items, movementsByItem, data.batches, data.docs]
  );

  const scheduled = useMemo(
    () =>
      [...data.reminders].sort((a, b) => {
        if (a.status !== b.status) return a.status === "open" ? -1 : 1;
        return (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
      }),
    [data.reminders]
  );

  const openCount = scheduled.filter((r) => r.status === "open").length;

  const createReminder = async () => {
    if (!title.trim()) {
      toast.error("Give it a title");
      return;
    }
    await data.repo.saveReminder({
      id: uid(),
      title: title.trim(),
      type,
      dueDate: dueDate || null,
      itemId: null,
      notes: notes.trim(),
      status: "open",
      createdAt: nowISO(),
    });
    await data.refresh();
    setOpen(false);
    setTitle("");
    setDueDate("");
    setNotes("");
    toast.success("Reminder scheduled");
  };

  const smartIcon = (id: string) => {
    if (id.startsWith("low-")) return <Package className="h-4 w-4" />;
    if (id.startsWith("exp-")) return <CalendarClock className="h-4 w-4" />;
    if (id.startsWith("wty-")) return <ShieldAlert className="h-4 w-4" />;
    if (id.startsWith("inv-")) return <ReceiptText className="h-4 w-4" />;
    return <TriangleAlert className="h-4 w-4" />;
  };

  return (
    <>
      <PageHeader
        title="Reminders"
        subtitle={`${smart.length} smart alert(s) · ${openCount} scheduled`}
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New reminder
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Smart alerts */}
        <Card>
          <CardHeaderRow
            title="Smart alerts"
            subtitle="Computed live from your inventory"
            action={<BellRing className="h-4 w-4 text-muted-foreground" />}
          />
          <div className="max-h-[420px] overflow-y-auto p-2">
            {!smart.length ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                All clear — nothing needs attention. ✨
              </p>
            ) : (
              smart.map((a) => (
                <Link key={a.id} href={a.href} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-secondary transition-colors">
                  <span
                    className={`rounded-lg p-1.5 ${
                      a.severity === "danger"
                        ? "bg-rose-50 text-rose-600 ring-1 ring-rose-200"
                        : a.severity === "warning"
                        ? "bg-amber-50 text-amber-600 ring-1 ring-amber-200"
                        : "bg-sky-50 text-sky-600 ring-1 ring-sky-200"
                    }`}
                  >
                    {smartIcon(a.id)}
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

        {/* Scheduled reminders */}
        <Card>
          <CardHeaderRow title="Scheduled" subtitle={`${openCount} open`} />
          <div className="max-h-[420px] overflow-y-auto divide-y">
            {!scheduled.length ? (
              <EmptyState
                icon={<CalendarClock />}
                title="Nothing scheduled"
                description="Maintenance, renewals, anything you don't want to forget."
                action={<Button size="sm" onClick={() => setOpen(true)}><Plus /> Schedule one</Button>}
              />
            ) : (
              scheduled.map((r) => {
                const overdue = r.status === "open" && r.dueDate && r.dueDate < todayISO();
                return (
                  <div key={r.id} className={`group flex items-center gap-3 px-5 py-3 ${r.status !== "open" ? "opacity-55" : ""}`}>
                    <button
                      title={r.status === "open" ? "Mark done" : "Reopen"}
                      onClick={() =>
                        void data.repo
                          .saveReminder({ ...r, status: r.status === "open" ? "done" : "open" })
                          .then(data.refresh)
                      }
                      className={`rounded-full p-1 transition ${
                        r.status === "done"
                          ? "bg-emerald-100 text-emerald-600"
                          : "border border-gray-300 text-transparent hover:border-emerald-400 hover:text-emerald-400"
                      }`}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm font-medium ${r.status === "done" ? "line-through" : ""}`}>{r.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {TYPE_META[r.type]?.label}
                        {r.notes ? ` · ${r.notes}` : ""}
                        {r.dueDate ? ` · due ${fmtDate(r.dueDate)}` : ""}
                      </p>
                    </div>
                    {overdue && <Badge variant="red">overdue</Badge>}
                    {r.itemId && (
                      <Link href={`/items/${r.itemId}`} className="text-xs font-medium text-primary hover:underline">
                        item
                      </Link>
                    )}
                    <button
                      className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-secondary"
                      title="Dismiss"
                      onClick={() => void data.repo.deleteReminder(r.id).then(data.refresh)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      {/* Add reminder */}
      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>New reminder</DialogTitle></DialogHeader>
          <div className="space-y-3 px-5">
            <Field label="What should we remind you about? *">
              <Input autoFocus placeholder="e.g. Replace fridge water filter" value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type">
                <Select value={type} onValueChange={(v) => setType(v as ReminderType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_META).map(([k, m]) => (
                      <SelectItem key={k} value={k}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Due date"><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
            </div>
            <Field label="Notes"><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={createReminder}>Schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
