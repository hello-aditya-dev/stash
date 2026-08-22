"use client";

import React, { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Trash2, Pencil, Users, Phone, Mail } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyState, ConfirmDialog } from "@/components/ui/extras";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useData } from "@/lib/data-context";
import { nowISO, uid } from "@/lib/utils";
import type { Contact } from "@/lib/types";

function PeopleInner() {
  const data = useData();
  const params = useSearchParams();
  const tab = params.get("tab") ?? "vendors";
  const setTab = (t: string) => window.history.replaceState(null, "", `/people?tab=${t}`);
  const kind: Contact["kind"] = tab === "customers" ? "customer" : "vendor";

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [draft, setDraft] = useState<Partial<Contact>>({});

  const list = useMemo(() => data.contacts.filter((c) => c.kind === kind), [data.contacts, kind]);

  const openCreate = () => {
    setEditing(null);
    setDraft({ kind, name: "" });
    setOpen(true);
  };
  const openEdit = (c: Contact) => {
    setEditing(c);
    setDraft(c);
    setOpen(true);
  };

  const save = async () => {
    if (!String(draft.name ?? "").trim()) {
      toast.error("Name is required");
      return;
    }
    await data.repo.saveContact({
      id: editing?.id ?? uid(),
      kind,
      name: String(draft.name).trim(),
      phone: draft.phone ?? "",
      email: draft.email ?? "",
      address: draft.address ?? "",
      notes: draft.notes ?? "",
      createdAt: editing?.createdAt ?? nowISO(),
    });
    await data.refresh();
    toast.success(`${kind === "vendor" ? "Vendor" : "Customer"} saved`);
    setOpen(false);
  };

  return (
    <>
      <PageHeader
        title="People"
        subtitle="Vendors you buy from and customers you sell to"
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add {kind}
          </Button>
        }
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="vendors">Vendors</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
        </TabsList>
        {[["vendors", "vendor"], ["customers", "customer"]].map(([key, k]) => (
          <TabsContent key={key} value={key}>
            {!list.length && kind === k ? (
              <EmptyState
                icon={<Users />}
                title={`No ${key} yet`}
                description={
                  k === "vendor"
                    ? "Link vendors to purchases and item records for warranty claims."
                    : "Customers appear on invoices and quotations."
                }
                action={<Button onClick={openCreate}><Plus /> Add first {k}</Button>}
              />
            ) : kind === k ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((c) => (
                  <Card key={c.id} className="group p-4">
                    <div className="flex items-start justify-between">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                        {c.name.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="flex opacity-0 transition group-hover:opacity-100">
                        <button title="Edit" className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary" onClick={() => openEdit(c)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button title="Delete" className="rounded-lg p-1.5 text-muted-foreground hover:bg-rose-50 hover:text-rose-600" onClick={() => setDeleteTarget(c)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </div>
                    <p className="mt-2 truncate text-sm font-semibold">{c.name}</p>
                    <p className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                      {c.phone && (
                        // eslint-disable-next-line jsx-a11y/anchor-is-valid
                        <a href={`tel:${c.phone}`} className="flex items-center gap-1.5 hover:text-foreground"><Phone className="h-3 w-3" />{c.phone}</a>
                      )}
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 hover:text-foreground"><Mail className="h-3 w-3" />{c.email}</a>
                      )}
                      {c.address && <p className="truncate">{c.address}</p>}
                    </p>
                  </Card>
                ))}
              </div>
            ) : null}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${kind}` : `Add ${kind}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 px-5">
            <Field label="Name *">
              <Input autoFocus placeholder={kind === "vendor" ? "Croma Electronics" : "Priya Sharma"} value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone"><Input placeholder="+91 …" value={draft.phone ?? ""} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} /></Field>
              <Field label="Email"><Input type="email" value={draft.email ?? ""} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></Field>
            </div>
            <Field label="Address"><Input value={draft.address ?? ""} onChange={(e) => setDraft({ ...draft, address: e.target.value })} /></Field>
            <Field label="Notes"><Textarea rows={2} value={draft.notes ?? ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></Field>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? "Save changes" : `Add ${kind}`}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete contact?"
        message={`${deleteTarget?.name} will be removed. Documents keep their history.`}
        onConfirm={() => {
          if (deleteTarget) void data.repo.deleteContact(deleteTarget.id).then(data.refresh).then(() => toast.success("Deleted"));
        }}
      />
    </>
  );
}

export default function PeoplePage() {
  return (
    <Suspense fallback={null}>
      <PeopleInner />
    </Suspense>
  );
}
