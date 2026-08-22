export interface Alert {
  id: string;
  severity: "danger" | "warning" | "info";
  title: string;
  detail: string;
  href: string;
}

export function computeAlerts(data: {
  items: Item[];
  movementsByItem: Map<string, Movement[]>;
  batches: Batch[];
  docs: FinDoc[];
  reminders: Reminder[];
}): Alert[] {
  const alerts: Alert[] = [];
  const { items, movementsByItem, batches, docs, reminders } = data;

  for (const item of items) {
    if (item.minQuantity == null) continue;
    const qty = currentQty(movementsByItem.get(item.id) ?? []);
    if (qty <= item.minQuantity) {
      alerts.push({
        id: `low-${item.id}`,
        severity: qty === 0 ? "danger" : "warning",
        title: item.name,
        detail: `Low stock — ${qty} ${item.unit ?? ""} left (min ${item.minQuantity})`,
        href: `/items/${item.id}`,
      });
    }
  }

  for (const b of batches) {
    if (!b.expDate) continue;
    const d = daysUntil(b.expDate);
    if (d !== null && d <= 30 && b.qty > 0) {
      const item = items.find((i) => i.id === b.itemId);
      alerts.push({
        id: `exp-${b.id}`,
        severity: d < 0 ? "danger" : d <= 7 ? "warning" : "info",
        title: item?.name ?? "Batch",
        detail:
          d < 0
            ? `Batch ${b.batchNo} expired ${-d} day(s) ago`
            : `Batch ${b.batchNo} expires in ${d} day(s)`,
        href: `/items/${b.itemId}`,
      });
    }
  }

  for (const item of items) {
    if (!item.warrantyExpiry) continue;
    const d = daysUntil(item.warrantyExpiry);
    if (d !== null && d <= 30) {
      alerts.push({
        id: `wty-${item.id}`,
        severity: d < 0 ? "info" : "warning",
        title: item.name,
        detail: d < 0 ? "Warranty expired" : `Warranty expires in ${d} day(s)`,
        href: `/items/${item.id}`,
      });
    }
  }

  for (const doc of docs) {
    if (doc.kind !== "invoice") continue;
    const total = docTotal(doc);
    const paid = doc.paidAmount ?? 0;
    if (paid >= total) continue;
    if (doc.status === "void") continue;
    const d = daysUntil(doc.dueDate);
    if (d !== null && d < 0) {
      alerts.push({
        id: `inv-${doc.id}`,
        severity: "warning",
        title: `Invoice ${doc.number} overdue`,
        detail: `Due ${fmtDate(doc.dueDate)} · outstanding ${total - paid}`,
        href: `/documents?tab=invoices&open=${doc.id}`,
      });
    }
  }

  for (const r of reminders) {
    if (r.status !== "open" || !r.dueDate) continue;
    const d = daysUntil(r.dueDate);
    if (d !== null && d <= 3) {
      alerts.push({
        id: `rem-${r.id}`,
        severity: d < 0 ? "danger" : "info",
        title: r.title,
        detail: d < 0 ? `Overdue by ${-d} day(s)` : d === 0 ? "Due today" : `Due in ${d} day(s)`,
        href: "/reminders",
      });
    }
  }

  const order = { danger: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]).slice(0, 30);
}

import type { Batch, FinDoc, Item, Movement, Reminder } from "./types";
import { currentQty, daysUntil, fmtDate } from "./utils";

export function docTotal(d: FinDoc): number {
  const subtotal = d.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const afterDiscount = subtotal - (d.discount ?? 0);
  const tax = afterDiscount * ((d.taxRate ?? 0) / 100);
  return Math.round((afterDiscount + tax) * 100) / 100;
}
