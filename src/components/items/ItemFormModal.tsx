"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Camera, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label, Field } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useData } from "@/lib/data-context";
import { useAuth } from "@/lib/auth-context";
import { uploadDataUrl } from "@/lib/repo/supabase";
import { fileToCompressedDataUrl, nowISO, todayISO, uid } from "@/lib/utils";
import { CONDITION_LABELS, UNITS, type Item, type PhotoRef } from "@/lib/types";

export function ItemFormModal({
  open,
  onClose,
  item,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  item?: Item | null;
  onSaved?: (id: string) => void;
}) {
  const data = useData();
  const auth = useAuth();
  const isNew = !item;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [locationId, setLocationId] = useState<string>("");
  const [initialQty, setInitialQty] = useState("1");
  const [unit, setUnit] = useState("pcs");
  const [minQuantity, setMinQuantity] = useState("");
  const [barcode, setBarcode] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [photos, setPhotos] = useState<PhotoRef[]>([]);
  const [purchasePrice, setPurchasePrice] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [warrantyExpiry, setWarrantyExpiry] = useState("");
  const [condition, setCondition] = useState<Item["condition"]>("good");
  const [vendorId, setVendorId] = useState<string>("");
  const [customValues, setCustomValues] = useState<Record<string, unknown>>({});
  const [bundle, setBundle] = useState<{ itemId: string; qty: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(item?.name ?? "");
    setDescription(item?.description ?? "");
    setCategoryId(item?.categoryId ?? "");
    setLocationId(item?.locationId ?? "");
    setInitialQty("1");
    setUnit(item?.unit ?? "pcs");
    setMinQuantity(item?.minQuantity != null ? String(item.minQuantity) : "");
    setBarcode(item?.barcode ?? "");
    setTags(item?.tags ?? []);
    setTagsInput("");
    setPhotos(item?.photos ?? []);
    setPurchasePrice(item?.purchasePrice != null ? String(item.purchasePrice) : "");
    setCurrentValue(item?.currentValue != null ? String(item.currentValue) : "");
    setPurchaseDate(item?.purchaseDate ?? "");
    setWarrantyExpiry(item?.warrantyExpiry ?? "");
    setCondition(item?.condition ?? "good");
    setVendorId(item?.vendorId ?? "");
    setCustomValues((item?.customFields as Record<string, unknown>) ?? {});
    setBundle((item?.bundleItems ?? []).map((b) => ({ itemId: b.itemId, qty: String(b.qty) })));
    setShowAdvanced(false);
  }, [open, item]);

  const activeCategory = useMemo(
    () => data.categories.find((c) => c.id === categoryId),
    [data.categories, categoryId]
  );
  const customFields = activeCategory?.customFields ?? [];

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files).slice(0, 6)) {
      try {
        const dataUrl = await fileToCompressedDataUrl(f);
        setPhotos((prev) => [...prev, { id: uid(), dataUrl }]);
      } catch {
        toast.error(`Could not read ${f.name}`);
      }
    }
  };

  const save = async () => {
    if (!name.trim()) {
      toast.error("Give your item a name");
      return;
    }
    setBusy(true);
    try {
      let finalPhotos = photos;
      if (data.repo.kind === "cloud" && auth.user) {
        finalPhotos = await Promise.all(
          photos.map(async (p) =>
            p.dataUrl && !p.url
              ? { id: p.id, url: await uploadDataUrl(p.dataUrl, `${auth.user!.id}/${p.id}.jpg`) }
              : p
          )
        );
      }
      const saved: Item = {
        id: item?.id ?? uid(),
        name: name.trim(),
        description: description.trim(),
        categoryId: categoryId || null,
        locationId: locationId || null,
        unit: unit || "pcs",
        minQuantity: minQuantity === "" ? null : Number(minQuantity),
        barcode: barcode.trim(),
        tags,
        photos: finalPhotos,
        purchasePrice: purchasePrice === "" ? null : Number(purchasePrice),
        currentValue: currentValue === "" ? null : Number(currentValue),
        purchaseDate: purchaseDate || null,
        warrantyExpiry: warrantyExpiry || null,
        condition,
        vendorId: vendorId || null,
        customFields: customValues,
        bundleItems: bundle
          .filter((b) => b.itemId && Number(b.qty) > 0)
          .map((b) => ({ itemId: b.itemId, qty: Number(b.qty) })),
        archived: item?.archived ?? false,
        createdAt: item?.createdAt ?? nowISO(),
        updatedAt: nowISO(),
      };
      await data.repo.saveItem(saved);
      if (isNew && Number(initialQty) !== 0) {
        await data.repo.addMovement({
          id: uid(),
          itemId: saved.id,
          type: "in",
          delta: Number(initialQty),
          reason: "Initial stock",
          date: todayISO(),
          createdAt: nowISO(),
        });
      }
      await data.refresh();
      toast.success(isNew ? `Added “${saved.name}”` : "Item updated");
      onSaved?.(saved.id);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save item");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent wide className="max-h-[92vh]">
        <DialogHeader>
          <DialogTitle>{isNew ? "Add item" : "Edit item"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto px-5 pb-2">
          {/* Photos */}
          <div>
            <Label>Photos</Label>
            <div className="flex flex-wrap gap-2">
              {photos.map((p) => (
                <div key={p.id} className="group relative h-20 w-20 overflow-hidden rounded-lg border bg-secondary">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url ?? p.dataUrl} alt="" className="h-full w-full object-cover" />
                  <button
                    onClick={() => setPhotos((prev) => prev.filter((x) => x.id !== p.id))}
                    className="absolute right-1 top-1 rounded-md bg-black/60 p-0.5 text-white opacity-0 transition group-hover:opacity-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-muted-foreground transition hover:border-primary hover:text-primary">
                <Camera className="h-5 w-5" />
                <span className="text-[10px] font-medium">Add</span>
                <input type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={(e) => addPhotos(e.target.files)} />
              </label>
            </div>
          </div>

          <Field label="Name *">
            <Input autoFocus placeholder="e.g. Cordless Drill" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <Select value={categoryId || undefined} onValueChange={(v) => setCategoryId(v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {data.categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Location">
              <Select value={locationId || undefined} onValueChange={(v) => setLocationId(v)}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {data.locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {locationPath(l.id, data.locations)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {customFields.length > 0 && (
            <div className="rounded-xl border bg-slate-50/70 p-3.5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {activeCategory?.name} details
              </p>
              <div className="grid grid-cols-2 gap-3">
                {customFields.map((f) => (
                  <Field key={f.key} label={f.label}>
                    {f.type === "select" ? (
                      <Select
                        value={(customValues[f.key] as string) ?? ""}
                        onValueChange={(v) => setCustomValues((prev) => ({ ...prev, [f.key]: v }))}
                      >
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {(f.options ?? []).map((o) => (
                            <SelectItem key={o} value={o}>{o}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                        value={(customValues[f.key] as string) ?? ""}
                        onChange={(e) => setCustomValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      />
                    )}
                  </Field>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            {isNew && (
              <Field label="Quantity">
                <Input type="number" min={0} value={initialQty} onChange={(e) => setInitialQty(e.target.value)} />
              </Field>
            )}
            <Field label="Unit">
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Alert below">
              <Input type="number" min={0} placeholder="—" value={minQuantity} onChange={(e) => setMinQuantity(e.target.value)} />
            </Field>
          </div>

          <Field label="Tags" hint="Press Enter to add">
            <div className="flex flex-wrap gap-1.5 rounded-lg border border-input bg-card p-2 shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/30">
              {tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                  {t}
                  <button onClick={() => setTags((prev) => prev.filter((x) => x !== t))}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const t = tagsInput.trim().toLowerCase();
                    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
                    setTagsInput("");
                  }
                }}
                placeholder={tags.length ? "" : "tools, diy…"}
                className="min-w-[80px] flex-1 bg-transparent text-sm outline-none"
              />
            </div>
          </Field>

          <Field label="Notes / description">
            <Textarea rows={2} placeholder="Serials, model numbers, anything useful…" value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>

          <button type="button" onClick={() => setShowAdvanced((s) => !s)} className="text-xs font-medium text-primary hover:underline">
            {showAdvanced ? "Hide purchase & extras ▲" : "Show purchase & extras ▼"}
          </button>

          {showAdvanced && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label={`Purchase price (${data.settings.currency})`}>
                  <Input type="number" min={0} step="0.01" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} />
                </Field>
                <Field label={`Current est. value (${data.settings.currency})`}>
                  <Input type="number" min={0} step="0.01" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} />
                </Field>
                <Field label="Purchased on">
                  <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
                </Field>
                <Field label="Warranty until">
                  <Input type="date" value={warrantyExpiry} onChange={(e) => setWarrantyExpiry(e.target.value)} />
                </Field>
                <Field label="Vendor">
                  <Select value={vendorId || undefined} onValueChange={setVendorId}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {data.contacts.filter((c) => c.kind === "vendor").map((v) => (
                        <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Condition">
                  <Select value={condition} onValueChange={(v) => setCondition(v as Item["condition"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CONDITION_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Field label="Barcode / SKU">
                <Input placeholder="Scan or type" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
              </Field>

              <div>
                <Label>Bundle contents (kit)</Label>
                <div className="space-y-2">
                  {bundle.map((b, idx) => (
                    <div key={idx} className="flex gap-2">
                      <Select
                        value={b.itemId}
                        onValueChange={(v) => setBundle((prev) => prev.map((x, i) => (i === idx ? { ...x, itemId: v } : x)))}
                      >
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Choose item" /></SelectTrigger>
                        <SelectContent>
                          {data.items.filter((i) => i.id !== item?.id).map((i) => (
                            <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min={1}
                        className="w-24"
                        value={b.qty}
                        onChange={(e) => setBundle((prev) => prev.map((x, i) => (i === idx ? { ...x, qty: e.target.value } : x)))}
                      />
                      <Button variant="ghost" size="icon" onClick={() => setBundle((prev) => prev.filter((_, i) => i !== idx))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => setBundle((prev) => [...prev, { itemId: "", qty: "1" }])}>
                    <Plus className="h-3.5 w-3.5" /> Add part
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={busy}>{isNew ? "Save item" : "Update"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function locationPath(id: string | null | undefined, locations: { id: string; name: string; parentId?: string | null }[]): string {
  if (!id) return "";
  let cur = locations.find((l) => l.id === id);
  if (!cur) return "";
  const parts = [cur.name];
  while (cur?.parentId) {
    cur = locations.find((l) => l.id === cur!.parentId);
    if (cur) parts.unshift(cur.name);
  }
  return parts.join(" › ");
}
