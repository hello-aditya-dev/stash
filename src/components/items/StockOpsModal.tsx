"use client";

import React, { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, Field } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useData } from "@/lib/data-context";
import { currentQty, nowISO, todayISO, uid } from "@/lib/utils";
import type { Item, MovementType } from "@/lib/types";

export function StockOpsModal({
  open,
  onClose,
  item,
  movements,
}: {
  open: boolean;
  onClose: () => void;
  item: Item | null;
  movements: import("@/lib/types").Movement[];
}) {
  const data = useData();
  const [type, setType] = useState<MovementType>("in");
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(todayISO());
  const [busy, setBusy] = useState(false);

  const current = item && movements ? currentQty(movements.filter((m) => m.itemId === item.id)) : 0;

  useEffect(() => {
    if (open) {
      setType("in");
      setQty("1");
      setReason("");
      setDate(todayISO());
    }
  }, [open]);

  if (!item) return null;

  const submit = async () => {
    const n = Number(qty);
    if (isNaN(n)) return;
    let delta: number;
    if (type === "in") delta = Math.abs(n);
    else if (type === "out") delta = -Math.abs(n);
    else delta = n - current;
    if (delta === 0) {
      toast.info("No change in quantity");
      return;
    }
    setBusy(true);
    try {
      await data.repo.addMovement({
        id: uid(),
        itemId: item.id,
        type,
        delta,
        reason: reason.trim() || undefined,
        date: date || todayISO(),
        createdAt: nowISO(),
      });
      await data.refresh();
      toast.success(
        type === "adjust"
          ? `Adjusted to ${n} ${item.unit ?? ""}`
          : `${Math.abs(delta)} ${item.unit ?? ""} ${type === "in" ? "added" : "removed"}`
      );
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const types: { key: MovementType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "in", label: "Stock in", icon: ArrowDownLeft },
    { key: "out", label: "Stock out", icon: ArrowUpRight },
    { key: "adjust", label: "Set exact", icon: ArrowRightLeft },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 px-5">
          <div className="grid grid-cols-3 gap-2">
            {types.map((t) => (
              <button
                key={t.key}
                onClick={() => setType(t.key)}
                className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-medium transition ${
                  type === t.key
                    ? "border-primary bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-secondary"
                }`}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </button>
            ))}
          </div>

          <p className="rounded-lg bg-secondary px-3 py-2 text-center text-sm">
            Current quantity: <span className="font-bold">{current}</span> {item.unit ?? ""}
          </p>

          <Field label={type === "adjust" ? "New total quantity" : "Quantity"}>
            <Input type="number" autoFocus value={qty} onChange={(e) => setQty(e.target.value)} min={type === "out" ? undefined : 0} />
          </Field>

          <Field label="Reason" hint="Optional — e.g. bought new, used up, gifted">
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>

          <Field label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={busy}>Save movement</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MovementBadgeLabel({ type }: { type: string }) {
  return <Label>{type}</Label>;
}
