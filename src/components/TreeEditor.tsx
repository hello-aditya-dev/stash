"use client";

import React, { useMemo, useState } from "react";
import {
  ChevronDown, ChevronRight, FolderTree, MapPin, Plus, Pencil, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog, EmptyState } from "@/components/ui/extras";
import { nowISO, uid } from "@/lib/utils";

export interface TreeRow {
  id: string;
  name: string;
  parentId?: string | null;
  description?: string;
}

export function TreeEditor({
  kind,
  nodes,
  counts,
  icon,
  emptyText,
  onCreate,
  onUpdate,
  onDelete,
  renderExtra,
}: {
  kind: string;
  nodes: TreeRow[];
  counts: Map<string, number>;
  icon?: "pin" | "tree";
  emptyText: string;
  onCreate: (draft: { name: string; description?: string; parentId: string | null }) => Promise<void>;
  onUpdate: (row: TreeRow) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  renderExtra?: (
    mode: "create" | "edit",
    draft: Record<string, unknown>,
    setDraft: (patch: Record<string, unknown>) => void
  ) => React.ReactNode;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(nodes.map((n) => n.id)));
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TreeRow | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [draft, setDraftState] = useState<Record<string, unknown>>({});
  const [deleteTarget, setDeleteTarget] = useState<TreeRow | null>(null);

  const setDraft = (patch: Record<string, unknown>) => setDraftState((prev) => ({ ...prev, ...patch }));

  const byParent = useMemo(() => {
    const map = new Map<string | null, TreeRow[]>();
    for (const n of nodes) {
      const key = n.parentId ?? null;
      map.set(key, [...(map.get(key) ?? []), n]);
    }
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [nodes]);

  const openCreate = (parent: string | null) => {
    setEditing(null);
    setParentId(parent);
    setDraft({ name: "", description: "" });
    setModalOpen(true);
  };

  const openEdit = (row: TreeRow) => {
    setEditing(row);
    setParentId(row.parentId ?? null);
    setDraft({ ...row });
    setModalOpen(true);
  };

  const submit = async () => {
    const name = String(draft.name ?? "").trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    if (editing) {
      await onUpdate({ ...(editing as TreeRow), ...(draft as Partial<TreeRow>), name });
      toast.success("Updated");
    } else {
      await onCreate({
        name,
        description: String(draft.description ?? ""),
        parentId,
      });
      toast.success(`Created ${kind}`);
    }
    setModalOpen(false);
  };

  const Icon = icon === "pin" ? MapPin : FolderTree;

  const renderNode = (row: TreeRow, depth: number): React.ReactNode => {
    const children = byParent.get(row.id) ?? [];
    const isOpen = expanded.has(row.id);
    return (
      <div key={row.id}>
        <div
          className="group flex items-center gap-1 border-b px-3 py-2.5 last:border-0 hover:bg-secondary/50"
          style={{ paddingLeft: `${12 + depth * 22}px` }}
        >
          <button
            className={`rounded p-0.5 text-muted-foreground transition ${children.length ? "hover:bg-secondary" : "invisible"}`}
            onClick={() =>
              setExpanded((prev) => {
                const next = new Set(prev);
                if (next.has(row.id)) next.delete(row.id);
                else next.add(row.id);
                return next;
              })
            }
          >
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          <Icon className="h-4 w-4 shrink-0 text-primary/70" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{row.name}</span>
          {(counts.get(row.id) ?? 0) > 0 && (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
              {counts.get(row.id)}
            </span>
          )}
          <span className="flex opacity-0 transition-opacity group-hover:opacity-100">
            <button title={`Add ${kind} inside`} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary" onClick={() => openCreate(row.id)}>
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button title="Edit" className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary" onClick={() => openEdit(row)}>
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button title="Delete" className="rounded-lg p-1.5 text-muted-foreground hover:bg-rose-50 hover:text-rose-600" onClick={() => setDeleteTarget(row)}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </span>
        </div>
        {isOpen && children.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  };

  const roots = byParent.get(null) ?? [];

  return (
    <>
      <Card className="overflow-hidden">
        <div className="border-b px-3 py-2.5">
          <Button size="sm" variant="outline" onClick={() => openCreate(null)}>
            <Plus className="h-3.5 w-3.5" /> New top-level {kind}
          </Button>
        </div>
        {roots.length === 0 ? (
          <EmptyState
            icon={<Icon />}
            title={`No ${kind}s yet`}
            description={emptyText}
            action={
              <Button onClick={() => openCreate(null)}>
                <Plus /> Create first {kind}
              </Button>
            }
          />
        ) : (
          roots.map((r) => renderNode(r, 0))
        )}
      </Card>

      <Dialog open={modalOpen} onOpenChange={(o) => !o && setModalOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${kind}` : `New ${kind}`}{!editing && parentId ? ` inside “${nodes.find((n) => n.id === parentId)?.name}”` : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 px-5">
            <Field label="Name">
              <Input autoFocus value={String(draft.name ?? "")} onChange={(e) => setDraft({ name: e.target.value })} placeholder={kind === "location" ? "e.g. Kitchen › Pantry Shelf" : "e.g. Electronics"} />
            </Field>
            {renderExtra?.(editing ? "edit" : "create", draft, setDraft)}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={submit}>{editing ? "Save changes" : `Create ${kind}`}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={`Delete ${kind}?`}
        message={
          deleteTarget && (byParent.get(deleteTarget.id)?.length ?? 0) > 0
            ? `“${deleteTarget.name}” has nested children — they will move to the top level. Items keep their assignment.`
            : `“${deleteTarget?.name}” will be removed. Items assigned to it are kept but become unassigned.`
        }
        onConfirm={() => {
          if (deleteTarget) void onDelete(deleteTarget.id).then(() => toast.success("Deleted"));
        }}
      />
    </>
  );
}

export function makeTreeRow(name: string, parentId: string | null, description?: string): TreeRow & { createdAt: string } {
  return { id: uid(), name, parentId, description, createdAt: nowISO() };
}
