"use client";

import React, { useMemo } from "react";
import { PageHeader } from "@/components/ui/extras";
import { TreeEditor } from "@/components/TreeEditor";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { useData } from "@/lib/data-context";
import { toast } from "sonner";
import { nowISO, uid } from "@/lib/utils";
import type { CustomFieldDef } from "@/lib/types";

export default function CategoriesPage() {
  const data = useData();

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of data.items) {
      if (i.categoryId) map.set(i.categoryId, (map.get(i.categoryId) ?? 0) + 1);
    }
    return map;
  }, [data.items]);

  return (
    <>
      <PageHeader
        title="Categories"
        subtitle="Group your things your way. Categories can define custom fields shown on every item inside them."
      />
      <TreeEditor
        kind="category"
        icon="tree"
        nodes={data.categories}
        counts={counts}
        emptyText="Categories keep your catalog tidy — Electronics, Kitchen, Tools…"
        onCreate={async (d) => {
          const fields = ((d as { fields?: CustomFieldDef[] }).fields) ?? [];
          await data.repo.saveCategory({
            id: uid(),
            name: d.name,
            parentId: d.parentId,
            createdAt: nowISO(),
            customFields: fields.filter((f) => f.label.trim()),
          });
          await data.refresh();
          if (fields.some((f) => f.label.trim())) toast.success("Category with custom fields created");
        }}
        onUpdate={async (row) => {
          await data.repo.saveCategory({
            id: row.id,
            name: row.name,
            parentId: row.parentId ?? null,
            createdAt: nowISO(),
            customFields: ((row as { fields?: CustomFieldDef[] }).fields ?? []).filter((f) => f.label.trim()),
          });
          await data.refresh();
        }}
        onDelete={async (id) => {
          await data.repo.deleteCategory(id);
          await data.refresh();
        }}
        renderExtra={(mode, draft, setDraft) => (
          <CustomFieldsEditor
            initial={
              mode === "edit"
                ? ((draft.fields as CustomFieldDef[] | undefined) ??
                  data.categories.find((c) => c.id === draft.id)?.customFields ??
                  [])
                : []
            }
            onChange={(fields) => setDraft({ fields })}
          />
        )}
      />
    </>
  );
}

function CustomFieldsEditor({
  initial,
  onChange,
}: {
  initial: CustomFieldDef[];
  onChange: (fields: CustomFieldDef[]) => void;
}) {
  const [fields, setFields] = React.useState<CustomFieldDef[]>(initial);

  const update = (next: CustomFieldDef[]) => {
    setFields(next);
    onChange(next);
  };

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Custom fields (optional)
      </p>
      <div className="space-y-2">
        {fields.map((f, idx) => (
          <div key={idx} className="flex gap-2">
            <Input
              placeholder="Label e.g. Size"
              value={f.label}
              onChange={(e) => update(fields.map((x, i) => (i === idx ? { ...f, label: e.target.value, key: slug(e.target.value) } : x)))}
            />
            <Select value={f.type} onValueChange={(v) => update(fields.map((x, i) => (i === idx ? { ...f, type: v as CustomFieldDef["type"] } : x)))}>
              <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="select">Choice</SelectItem>
              </SelectContent>
            </Select>
            {f.type === "select" && (
              <Input
                placeholder="A,B,C"
                className="w-[120px]"
                value={(f.options ?? []).join(",")}
                onChange={(e) =>
                  update(fields.map((x, i) => (i === idx ? { ...f, options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } : x)))
                }
              />
            )}
            <Button variant="ghost" size="icon" onClick={() => update(fields.filter((_, i) => i !== idx))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => update([...fields, { key: `f${Date.now()}`, label: "", type: "text" }])}
        >
          <Plus className="h-3.5 w-3.5" /> Add field
        </Button>
      </div>
    </div>
  );
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || `f${Date.now()}`;
}
