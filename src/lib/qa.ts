import { currentQty, daysUntil, fmtDate, fmtMoney, itemValue } from "./utils";
import { docTotal } from "./alerts";
import type { Batch, Category, FinDoc, Item, Location, Movement } from "./types";

export interface QaContext {
  items: Item[];
  movements: Movement[];
  batches: Batch[];
  docs: FinDoc[];
  categories: Category[];
  locations: Location[];
  currency: string;
}

export function answerQuestion(qRaw: string, ctx: QaContext): { text: string; matches: Item[] } {
  const q = qRaw.toLowerCase().trim();
  const { items, movementsByItem, batches, currency } = wrap(ctx);

  const term = q
    .replace(/where is|where's|where are|find|search for|show me|how many|what is|whats|what's|do i have any|any/g, "")
    .replace(/[?]/g, "")
    .trim();

  if (/(expir|expire|expiring|expiry|rot)/.test(q)) {
    const daysMatch = q.match(/(\d+)\s*days?/);
    const windowDays = daysMatch ? parseInt(daysMatch[1], 10) : 30;
    const soon = batches
      .filter((b) => b.expDate && b.qty > 0)
      .map((b) => ({ b, d: daysUntil(b.expDate)! }))
      .filter((x) => x.d !== null && x.d <= windowDays)
      .sort((a, b2) => a.d - b2.d);
    if (!soon.length) return { text: `Nothing expires in the next ${windowDays} days.`, matches: [] };
    const lines = soon.slice(0, 12).map(({ b, d }) => {
      const item = ctx.items.find((i) => i.id === b.itemId);
      const when = d < 0 ? `expired ${-d}d ago` : d === 0 ? "expires today" : `in ${d}d`;
      return `• ${item?.name ?? "?"} — batch ${b.batchNo} (${b.qty} ${item?.unit ?? ""}) ${when}`;
    });
    return { text: `${soon.length} batch(es) expiring within ${windowDays} days:\n${lines.join("\n")}`, matches: [] };
  }

  if (/(worth|total value|valuation|estimated value)/.test(q)) {
    const total = items.reduce((s, i) => s + itemValue(i), 0);
    const byCat = new Map<string, number>();
    for (const i of items) {
      const cat = ctx.categories.find((c) => c.id === i.categoryId)?.name ?? "Uncategorized";
      byCat.set(cat, (byCat.get(cat) ?? 0) + itemValue(i));
    }
    const top = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const lines = top.map(([c, v]) => `• ${c}: ${fmtMoney(v, currency)}`);
    return {
      text: `Estimated total value: ${fmtMoney(total, currency)} across ${items.length} items.\nTop categories:\n${lines.join("\n")}`,
      matches: [],
    };
  }

  if (/low stock|running out|need to buy/.test(q)) {
    const low = items.filter((i) => {
      if (i.minQuantity == null) return false;
      return currentQty(movementsByItem.get(i.id) ?? []) <= i.minQuantity;
    });
    if (!low.length) return { text: "No low-stock alerts. You're well stocked.", matches: [] };
    const lines = low.map((i) => `• ${i.name} — ${currentQty(movementsByItem.get(i.id) ?? [])} left (min ${i.minQuantity})`);
    return { text: `${low.length} item(s) at or below minimum:\n${lines.join("\n")}`, matches: low };
  }

  if (/(warrant)/.test(q)) {
    const w = items.filter((i) => i.warrantyExpiry).sort((a, b) => (a.warrantyExpiry! < b.warrantyExpiry! ? -1 : 1));
    if (!w.length) return { text: "No warranties recorded.", matches: [] };
    const lines = w.slice(0, 8).map((i) => {
      const d = daysUntil(i.warrantyExpiry);
      const state = d !== null && d < 0 ? "EXPIRED" : `${d}d left`;
      return `• ${i.name} — ${fmtDate(i.warrantyExpiry)} (${state})`;
    });
    return { text: `Warranties:\n${lines.join("\n")}`, matches: w };
  }

  if (/(invoice|unpaid|outstanding|owed)/.test(q)) {
    const unpaid = ctx.docs.filter(
      (doc) => doc.kind === "invoice" && doc.status !== "void" && docTotal(doc) > (doc.paidAmount ?? 0)
    );
    const outstanding = unpaid.reduce((s, d2) => s + (docTotal(d2) - (d2.paidAmount ?? 0)), 0);
    const lines = unpaid.map((d2) => `• ${d2.number} — ${fmtMoney(docTotal(d2) - (d2.paidAmount ?? 0), currency)} due`);
    return {
      text: unpaid.length
        ? `${unpaid.length} unpaid invoice(s), total ${fmtMoney(outstanding, currency)}:\n${lines.join("\n")}`
        : "All invoices are settled.",
      matches: [],
    };
  }

  if (term.length >= 2) {
    const matches = searchItems(term, ctx.items);
    if (matches.length) {
      const lines = matches.slice(0, 8).map((i) => {
        const loc = ctx.locations.find((l) => l.id === i.locationId);
        const path = locPath(loc, ctx.locations);
        const qty = currentQty(movementsByItem.get(i.id) ?? []);
        return `• ${i.name} — qty ${qty}${path ? `, in ${path}` : ""}`;
      });
      const multi = matches.some((m, idx) => idx > 0 && m.locationId !== matches[0].locationId && matches.length > 1);
      return {
        text: multi || /where/.test(q)
          ? `Found ${matches.length} match(es):\n${lines.join("\n")}`
          : `Found ${matches.length} match(es):\n${lines.join("\n")}`,
        matches,
      };
    }
  }

  return {
    text:
      'Try asking:\n• "Where is the drill?"\n• "What expires in 30 days?"\n• "How much is everything worth?"\n• "Low stock"\n• "Any warranties expiring?"',
    matches: [],
  };
}

export function searchItems(term: string, items: Item[]): Item[] {
  const t = term.toLowerCase();
  return items.filter(
    (i) =>
      i.name.toLowerCase().includes(t) ||
      (i.description ?? "").toLowerCase().includes(t) ||
      i.tags.some((tag) => tag.toLowerCase().includes(t)) ||
      (i.barcode ?? "").toLowerCase().includes(t)
  );
}

function locPath(loc: Location | undefined, all: Location[]): string {
  if (!loc) return "";
  const parts = [loc.name];
  let cur = loc;
  while (cur.parentId) {
    const p = all.find((l) => l.id === cur.parentId);
    if (!p) break;
    parts.unshift(p.name);
    cur = p;
  }
  return parts.join(" › ");
}

function wrap(ctx: QaContext) {
  const movementsByItem = new Map<string, Movement[]>();
  for (const m of ctx.movements) {
    const list = movementsByItem.get(m.itemId) ?? [];
    list.push(m);
    movementsByItem.set(m.itemId, list);
  }
  return { ...ctx, movementsByItem };
}
