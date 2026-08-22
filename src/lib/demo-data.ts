import { nowISO, todayISO, uid } from "./utils";
import type {
  Batch, Category, Contact, Expense, FinDoc, Item, Location, Movement, Project, Reminder,
} from "./types";
import type { InventoryRepo } from "./repo/types";

function d(daysFromNow: number): string {
  const t = new Date();
  t.setDate(t.getDate() + daysFromNow);
  return t.toISOString().slice(0, 10);
}

export async function seedDemoData(repo: InventoryRepo) {
  await repo.destroyAll();

  const catDefs: Array<[string, string | null]> = [
    ["Electronics", null], ["Kitchen", null], ["Tools", null],
    ["Groceries", null], ["Books", null], ["Appliances", "Electronics"],
  ];
  const categories = new Map<string, Category>();
  for (const [name, parent] of catDefs) {
    const c: Category = { id: uid(), name, parentId: parent ? categories.get(parent)?.id ?? null : null, createdAt: nowISO() };
    await repo.saveCategory(c);
    categories.set(name, c);
  }

  const locDefs: Array<[string, string | null]> = [
    ["Home", null], ["Kitchen", "Home"], ["Living Room", "Home"], ["Garage", "Home"],
    ["Pantry Shelf", "Kitchen"], ["Tool Wall", "Garage"], ["TV Unit", "Living Room"],
  ];
  const locations = new Map<string, Location>();
  for (const [name, parent] of locDefs) {
    const l: Location = { id: uid(), name, parentId: parent ? locations.get(parent)?.id ?? null : null, createdAt: nowISO() };
    await repo.saveLocation(l);
    locations.set(name, l);
  }

  const vendor: Contact = { id: uid(), kind: "vendor", name: "Croma Electronics", phone: "+91 98200 12345", email: "orders@croma.example", address: "MG Road, Bengaluru", createdAt: nowISO() };
  const customer: Contact = { id: uid(), kind: "customer", name: "Priya Sharma", phone: "+91 90000 98765", email: "priya@example.com", createdAt: nowISO() };
  await repo.saveContact(vendor);
  await repo.saveContact(customer);

  interface SeedItem {
    name: string; category: string; location: string; qty: number; unit?: string;
    min?: number; price?: number; value?: number; bought?: string; warrantyDays?: number;
    condition?: Item["condition"]; tags?: string[]; barcode?: string;
    batches?: Array<{ no: string; exp: number; qty: number; mfg?: number }>;
  }
  const seeds: SeedItem[] = [
    { name: "MacBook Air M2", category: "Electronics", location: "TV Unit", qty: 1, price: 114900, value: 92000, bought: d(-400), warrantyDays: -35, tags: ["work", "laptop"], barcode: "1942501234567" },
    { name: "Sony WH-1000XM5", category: "Electronics", location: "Living Room", qty: 1, price: 29990, value: 22000, bought: d(-200), warrantyDays: 165, tags: ["audio"] },
    { name: "Cordless Drill", category: "Tools", location: "Tool Wall", qty: 1, price: 8499, value: 6000, bought: d(-700), condition: "fair", tags: ["diy"] },
    { name: "Screwdriver Set", category: "Tools", location: "Tool Wall", qty: 3, unit: "set", min: 1, price: 1299, tags: ["diy"] },
    { name: "Basmati Rice 5kg", category: "Groceries", location: "Pantry Shelf", qty: 4, unit: "pack", min: 2, price: 650, batches: [{ no: "BR-2401", exp: 12, qty: 2, mfg: -180 }, { no: "BR-2312", exp: -3, qty: 2, mfg: -300 }] },
    { name: "Olive Oil 1L", category: "Groceries", location: "Pantry Shelf", qty: 2, unit: "bottle", min: 1, price: 899, batches: [{ no: "OO-8842", exp: 45, qty: 2 }] },
    { name: "Paracetamol", category: "Groceries", location: "Pantry Shelf", qty: 1, unit: "strip", min: 1, batches: [{ no: "PCM-2231", exp: 6, qty: 1 }] },
    { name: "Pressure Cooker 5L", category: "Appliances", location: "Kitchen", qty: 1, price: 3499, value: 2500, bought: d(-900), tags: ["cooking"] },
    { name: "Air Fryer", category: "Appliances", location: "Kitchen", qty: 1, price: 9999, value: 7500, bought: d(-150), warrantyDays: 215, tags: ["cooking"] },
    { name: "Atomic Habits", category: "Books", location: "Living Room", qty: 1, price: 499, tags: ["reading"] },
    { name: "Skee Ball (Board Game)", category: "Books", location: "Living Room", qty: 1, condition: "good" },
    { name: "Extension Cord 10m", category: "Electronics", location: "Garage", qty: 2, min: 1, price: 749 },
    { name: "LED Bulbs Pack of 4", category: "Electronics", location: "Garage", qty: 1, unit: "box", min: 1, price: 399 },
    { name: "Yoga Mat", category: "Books", location: "Living Room", qty: 2, min: 1, price: 999 },
  ];

  for (const s of seeds) {
    const item: Item = {
      id: uid(),
      name: s.name,
      description: "",
      categoryId: categories.get(s.category)?.id ?? null,
      locationId: locations.get(s.location)?.id ?? null,
      unit: s.unit ?? "pcs",
      minQuantity: s.min ?? null,
      barcode: s.barcode ?? "",
      tags: s.tags ?? [],
      photos: [],
      purchasePrice: s.price ?? null,
      currentValue: s.value ?? s.price ?? null,
      purchaseDate: s.bought ?? null,
      warrantyExpiry: s.warrantyDays !== undefined ? d(s.warrantyDays) : null,
      vendorId: s.category === "Electronics" ? vendor.id : null,
      condition: s.condition ?? "new",
      customFields: {},
      bundleItems: [],
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
    await repo.saveItem(item);
    await repo.addMovement({ id: uid(), itemId: item.id, type: "in", delta: s.qty, reason: "Initial stock", date: s.bought ?? d(-30), createdAt: nowISO() });
    if (s.batches) {
      for (const b of s.batches) {
        await repo.saveBatch({ id: uid(), itemId: item.id, batchNo: b.no, mfgDate: b.mfg !== undefined ? d(b.mfg) : null, expDate: d(b.exp), qty: b.qty, createdAt: nowISO() });
      }
    }
  }

  const invNo = await repo.nextDocNumber("invoice");
  const quoteNo = await repo.nextDocNumber("quotation");
  const poNo = await repo.nextDocNumber("purchase");

  const invoice: FinDoc = {
    id: uid(), kind: "invoice", number: invNo, partyId: customer.id, date: d(-14), dueDate: d(16),
    status: "sent",
    lines: [
      { id: uid(), itemId: null, name: "Yoga Mat — premium TPE", qty: 1, unitPrice: 1499 },
      { id: uid(), itemId: null, name: "Screwdriver Set", qty: 1, unitPrice: 1299 },
    ],
    discount: 100, taxRate: 18, notes: "Thanks for your business!", paidAmount: 0, createdAt: nowISO(),
  };
  await repo.saveDoc(invoice);

  const quote: FinDoc = {
    id: uid(), kind: "quotation", number: quoteNo, partyId: customer.id, date: d(-2), status: "sent",
    lines: [{ id: uid(), itemId: null, name: "Air Fryer (open box)", qty: 1, unitPrice: 7499 }],
    taxRate: 18, notes: "Quote valid for 14 days.", createdAt: nowISO(),
  };
  await repo.saveDoc(quote);

  const po: FinDoc = {
    id: uid(), kind: "purchase", number: poNo, partyId: vendor.id, date: d(-7), status: "received",
    lines: [{ id: uid(), itemId: null, name: "LED Bulbs Pack of 4", qty: 2, unitPrice: 379 }],
    receivedAt: d(-6), notes: "", createdAt: nowISO(),
  };
  await repo.saveDoc(po);

  await repo.saveExpense({ id: uid(), date: d(-10), category: "Maintenance", amount: 1200, note: "AC servicing", createdAt: nowISO() });
  await repo.saveExpense({ id: uid(), date: d(-25), category: "Groceries", amount: 3450, note: "Monthly stock-up", createdAt: nowISO() });

  await repo.saveProject({ id: uid(), name: "Home Office Setup", description: "Desk, chair, lighting refresh", status: "active", itemIds: [], budget: 25000, createdAt: nowISO() });

  await repo.saveReminder({ id: uid(), title: "Service air fryer filter", type: "maintenance", dueDate: d(10), status: "open", notes: "", createdAt: nowISO() });
  await repo.saveReminder({ id: uid(), title: "Renew laptop insurance", type: "custom", dueDate: d(-2), status: "open", notes: "", createdAt: nowISO() });
}
