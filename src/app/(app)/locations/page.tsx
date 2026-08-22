"use client";

import React, { useMemo } from "react";
import { PageHeader } from "@/components/ui/extras";
import { TreeEditor } from "@/components/TreeEditor";
import { Field } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useData } from "@/lib/data-context";
import { nowISO, uid } from "@/lib/utils";
import { QrCode } from "lucide-react";
import QRCode from "qrcode";
import { printHtml } from "@/lib/utils";

export default function LocationsPage() {
  const data = useData();

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of data.items) {
      if (i.locationId) map.set(i.locationId, (map.get(i.locationId) ?? 0) + 1);
    }
    return map;
  }, [data.items]);

  const printLocationLabel = async (name: string, id: string) => {
    const qr = await QRCode.toDataURL(`stash:loc:${id}`, { margin: 1, width: 220 });
    printHtml(
      `Bin label — ${name}`,
      `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr))">
        <div class="label-card" style="text-align:center">
          <img src="${qr}" width="150" height="150" style="margin:auto"/>
          <h1 style="font-size:14px;margin-top:8px">${name}</h1>
          <p class="muted">Scan with Stash to see contents</p>
        </div>
      </div>`
    );
  };

  return (
    <>
      <PageHeader
        title="Locations"
        subtitle="Model your space hierarchically — Home › Kitchen › Pantry Shelf. Print bin labels to scan from anywhere."
      />
      <TreeEditor
        kind="location"
        icon="pin"
        nodes={data.locations}
        counts={counts}
        emptyText="Start with big rooms, then nest shelves and boxes inside them."
        onCreate={async (d) => {
          await data.repo.saveLocation({
            id: uid(),
            name: d.name,
            parentId: d.parentId,
            description: d.description,
            createdAt: nowISO(),
          });
          await data.refresh();
        }}
        onUpdate={async (row) => {
          await data.repo.saveLocation({
            id: row.id,
            name: row.name,
            parentId: row.parentId ?? null,
            description: (row as { description?: string }).description ?? "",
            createdAt: nowISO(),
          });
          await data.refresh();
        }}
        onDelete={async (id) => {
          await data.repo.deleteLocation(id);
          await data.refresh();
        }}
        renderExtra={(mode, draft, setDraft) => (
          <>
            <Field label="Description (optional)">
              <Textarea rows={2} value={String(draft.description ?? "")} onChange={(e) => setDraft({ description: e.target.value })} placeholder="What lives here?" />
            </Field>
            {mode === "edit" && draft.id && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void printLocationLabel(String(draft.name), String(draft.id))}
              >
                <QrCode className="h-3.5 w-3.5" /> Print bin label
              </Button>
            )}
          </>
        )}
      />
    </>
  );
}
