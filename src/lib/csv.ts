import Papa from "papaparse";
import { nowISO, todayISO, uid } from "./utils";
import type { Category, Item, Location } from "./types";

export function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  return Papa.unparse(rows);
}

export interface ImportRow {
  name: string;
  description?: string;
  category?: string;
  location?: string;
  quantity?: number | null;
  unit?: string;
  minQuantity?: number | null;
  purchasePrice?: number | null;
  currentValue?: number | null;
  purchaseDate?: string | null;
  warrantyExpiry?: string | null;
  barcode?: string;
  tags?: string[];
  condition?: Item["condition"];
}

const FIELD_ALIASES: Record<keyof ImportRow, string[]> = {
  name: ["name", "item", "item name", "product", "title"],
  description: ["description", "notes", "note", "details"],
  category: ["category", "type", "group"],
  location: ["location", "room", "place", "where", "warehouse"],
  quantity: ["quantity", "qty", "count", "amount"],
  unit: ["unit", "units"],
  minQuantity: ["min quantity", "minquantity", "min", "reorder level", "low stock at"],
  purchasePrice: ["purchase price", "price", "cost", "bought for", "purchase_price"],
  currentValue: ["current value", "value", "estimated value", "worth", "current_value"],
  purchaseDate: ["purchase date", "bought on", "date purchased", "purchase_date"],
  warrantyExpiry: ["warranty expiry", "warranty", "warranty until", "warranty_expiry"],
  barcode: ["barcode", "upc", "ean", "sku"],
  tags: ["tags", "labels"],
  condition: ["condition", "state"],
};

export function mapHeaders(headers: string[]): Partial<Record<keyof ImportRow, number>> {
  const map: Partial<Record<keyof ImportRow, number>> = {};
  const norm = (s: string) => s.trim().toLowerCase().replace(/[_-]+/g, " ");
  headers.forEach((h, i) => {
    const nh = norm(h);
    for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [keyof ImportRow, string[]][]) {
      if (map[field] === undefined && aliases.includes(nh)) {
        map[field] = i;
        break;
      }
    }
  });
  return map;
}

export async function parseImportFile(file: File): Promise<{ rows: ImportRow[]; headers: string[]; mapped: Partial<Record<keyof ImportRow, number>> }> {
  const text = await file.text();
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
  const rawRows = parsed.data.filter((r) => r.length > 0);
  if (!rawRows.length) return { rows: [], headers: [], mapped: {} };
  const headers = rawRows[0].map((h) => String(h));
  const mapped = mapHeaders(headers);
  const rows: ImportRow[] = [];
  for (let r = 1; r < rawRows.length; r++) {
    const cells = rawRows[r];
    const get = (f: keyof ImportRow): string | undefined => {
      const idx = mapped[f];
      return idx !== undefined ? (cells[idx]?.trim() || undefined) : undefined;
    };
    const name = get("name");
    if (!name) continue;
    rows.push({
      name,
      description: get("description"),
      category: get("category"),
      location: get("location"),
      quantity: num(get("quantity")) ?? 1,
      unit: get("unit") ?? "pcs",
      minQuantity: num(get("minQuantity")),
      purchasePrice: num(get("purchasePrice")),
      currentValue: num(get("currentValue")),
      purchaseDate: dateOrNull(get("purchaseDate")),
      warrantyExpiry: dateOrNull(get("warrantyExpiry")),
      barcode: get("barcode"),
      tags: get("tags") ? get("tags")!.split(/[,;|]/).map((t) => t.trim()).filter(Boolean) : [],
      condition: normalizeCondition(get("condition")),
    });
  }
  return { rows, headers, mapped };
}

function num(v?: string): number | null {
  if (!v) return null;
  const n = parseFloat(v.replace(/[^\d.\-]/g, ""));
  return isNaN(n) ? null : n;
}

function dateOrNull(v?: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function normalizeCondition(v?: string): Item["condition"] | undefined {
  if (!v) return undefined;
  const s = v.toLowerCase();
  if (["new"].includes(s)) return "new";
  if (["good", "fine"].includes(s)) return "good";
  if (["fair", "used"].includes(s)) return "fair";
  if (["poor", "worn"].includes(s)) return "poor";
  if (["broken", "damaged"].includes(s)) return "broken";
  return undefined;
}

export interface ApplyResult {
  itemsCreated: number;
  categoriesCreated: number;
  locationsCreated: number;
}

export async function applyImport(
  rows: ImportRow[],
  ctx: {
    repo: import("./repo/types").InventoryRepo;
    categories: Category[];
    locations: Location[];
  }
): Promise<ApplyResult> {
  const { repo, categories, locations } = ctx;
  let itemsCreated = 0,
    categoriesCreated = 0,
    locationsCreated = 0;

  for (const row of rows) {
    let categoryId: string | null = null;
    if (row.category) {
      const existing = categories.find((c) => c.name.toLowerCase() === row.category!.toLowerCase());
      if (existing) categoryId = existing.id;
      else {
        const c: Category = { id: uid(), name: row.category, parentId: null, createdAt: nowISO() };
        await repo.saveCategory(c);
        categories.push(c);
        categoryId = c.id;
        categoriesCreated++;
      }
    }
    let locationId: string | null = null;
    if (row.location) {
      const existing = locations.find((l) => l.name.toLowerCase() === row.location!.toLowerCase());
      if (existing) locationId = existing.id;
      else {
        const l: Location = { id: uid(), name: row.location, parentId: null, createdAt: nowISO() };
        await repo.saveLocation(l);
        locations.push(l);
        locationId = l.id;
        locationsCreated++;
      }
    }
    const item: Item = {
      id: uid(),
      name: row.name,
      description: row.description ?? "",
      categoryId,
      locationId,
      unit: row.unit ?? "pcs",
      minQuantity: row.minQuantity ?? null,
      barcode: row.barcode ?? "",
      tags: row.tags ?? [],
      photos: [],
      purchasePrice: row.purchasePrice ?? null,
      currentValue: row.currentValue ?? row.purchasePrice ?? null,
      purchaseDate: row.purchaseDate ?? null,
      warrantyExpiry: row.warrantyExpiry ?? null,
      condition: row.condition ?? "good",
      customFields: {},
      bundleItems: [],
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
    await repo.saveItem(item);
    const qty = row.quantity ?? 1;
    if (qty !== 0) {
      await repo.addMovement({
        id: uid(),
        itemId: item.id,
        type: "in",
        delta: qty,
        reason: "Initial stock",
        date: todayISO(),
        createdAt: nowISO(),
      });
    }
    itemsCreated++;
  }
  return { itemsCreated, categoriesCreated, locationsCreated };
}
