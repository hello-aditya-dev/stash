import { getDB } from "../db";
import { DEFAULT_SETTINGS } from "../types";
import { nowISO, todayISO, uid } from "../utils";
import type {
  Attachment,
  Batch,
  Category,
  Contact,
  DocKind,
  Expense,
  FinDoc,
  ID,
  Item,
  Location,
  Movement,
  MovementType,
  Project,
  Reminder,
  Serial,
  SerialStatus,
  Settings,
} from "../types";
import type { InventoryRepo } from "./types";

export class LocalRepo implements InventoryRepo {
  readonly kind = "local" as const;
  private db = getDB();

  async getSettings(): Promise<Settings> {
    const s = await this.db.settings.get("app");
    return s ?? { ...DEFAULT_SETTINGS };
  }
  async saveSettings(s: Settings): Promise<void> {
    await this.db.settings.put({ ...s, id: "app" });
  }

  listCategories() {
    return this.db.categories.toArray();
  }
  async saveCategory(c: Category) {
    await this.db.categories.put(c);
  }
  async deleteCategory(id: ID) {
    const children = await this.db.categories.where("parentId").equals(id).toArray();
    for (const ch of children) await this.db.categories.update(ch.id, { parentId: null });
    await this.db.categories.delete(id);
  }

  listLocations() {
    return this.db.locations.toArray();
  }
  async saveLocation(l: Location) {
    await this.db.locations.put(l);
  }
  async deleteLocation(id: ID) {
    const children = await this.db.locations.where("parentId").equals(id).toArray();
    for (const ch of children) await this.db.locations.update(ch.id, { parentId: null });
    await this.db.locations.delete(id);
  }

  async listContacts(kind?: "vendor" | "customer") {
    const all = await this.db.contacts.toArray();
    return kind ? all.filter((c) => c.kind === kind) : all;
  }
  async saveContact(c: Contact) {
    await this.db.contacts.put(c);
  }
  async deleteContact(id: ID) {
    await this.db.contacts.delete(id);
  }

  listItems() {
    return this.db.items.toArray();
  }
  async getItem(id: ID) {
    return (await this.db.items.get(id)) ?? null;
  }
  async saveItem(i: Item) {
    await this.db.items.put(i);
  }
  async deleteItem(id: ID) {
    await this.db.transaction(
      "rw",
      [this.db.items, this.db.movements, this.db.batches, this.db.serials, this.db.attachments],
      async () => {
        await this.db.items.delete(id);
        await this.db.movements.where("itemId").equals(id).delete();
        await this.db.batches.where("itemId").equals(id).delete();
        await this.db.serials.where("itemId").equals(id).delete();
        await this.db.attachments.where("itemId").equals(id).delete();
      }
    );
  }

  async listMovements(itemId?: ID) {
    const all = itemId
      ? await this.db.movements.where("itemId").equals(itemId).toArray()
      : await this.db.movements.toArray();
    return all.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }
  async addMovement(m: Movement) {
    await this.db.movements.put(m);
  }

  async listBatches(itemId?: ID) {
    if (itemId) return this.db.batches.where("itemId").equals(itemId).toArray();
    return this.db.batches.toArray();
  }
  async saveBatch(b: Batch) {
    await this.db.batches.put(b);
  }
  async deleteBatch(id: ID) {
    await this.db.batches.delete(id);
  }

  async listSerials(itemId?: ID) {
    if (itemId) return this.db.serials.where("itemId").equals(itemId).toArray();
    return this.db.serials.toArray();
  }
  async addSerials(itemId: ID, nos: string[]) {
    const rows: Serial[] = nos
      .map((n) => n.trim())
      .filter(Boolean)
      .map((n) => ({ id: uid(), itemId, serialNo: n, status: "in_stock" as SerialStatus, createdAt: nowISO() }));
    await this.db.serials.bulkPut(rows);
  }
  async updateSerial(id: ID, status: SerialStatus) {
    await this.db.serials.update(id, { status });
  }
  async deleteSerial(id: ID) {
    await this.db.serials.delete(id);
  }

  async listAttachments(itemId?: ID) {
    if (itemId) return this.db.attachments.where("itemId").equals(itemId).toArray();
    return this.db.attachments.toArray();
  }
  async saveAttachment(a: Attachment) {
    await this.db.attachments.put(a);
  }
  async deleteAttachment(id: ID) {
    await this.db.attachments.delete(id);
  }

  async listDocs(kind?: DocKind) {
    const all = kind
      ? await this.db.docs.where("kind").equals(kind).toArray()
      : await this.db.docs.toArray();
    return all.sort((a, b) => b.date.localeCompare(a.date));
  }
  async saveDoc(d: FinDoc) {
    await this.db.docs.put(d);
  }
  async deleteDoc(id: ID) {
    await this.db.docs.delete(id);
  }
  async nextDocNumber(kind: DocKind): Promise<string> {
    const s = await this.getSettings();
    const prefix =
      kind === "invoice" ? s.invoicePrefix : kind === "quotation" ? s.quotePrefix : s.purchasePrefix;
    const n = (s.docSeq?.[kind] ?? 0) + 1;
    await this.saveSettings({ ...s, docSeq: { ...s.docSeq, [kind]: n } });
    return `${prefix}${String(n).padStart(4, "0")}`;
  }

  listExpenses() {
    return this.db.expenses.toArray();
  }
  async saveExpense(e: Expense) {
    await this.db.expenses.put(e);
  }
  async deleteExpense(id: ID) {
    await this.db.expenses.delete(id);
  }

  listProjects() {
    return this.db.projects.toArray();
  }
  async saveProject(p: Project) {
    await this.db.projects.put(p);
  }
  async deleteProject(id: ID) {
    await this.db.projects.delete(id);
  }

  listReminders() {
    return this.db.reminders.toArray();
  }
  async saveReminder(r: Reminder) {
    await this.db.reminders.put(r);
  }
  async deleteReminder(id: ID) {
    await this.db.reminders.delete(id);
  }

  async destroyAll() {
    await Promise.all([
      this.db.categories.clear(),
      this.db.locations.clear(),
      this.db.items.clear(),
      this.db.movements.clear(),
      this.db.batches.clear(),
      this.db.serials.clear(),
      this.db.attachments.clear(),
      this.db.contacts.clear(),
      this.db.docs.clear(),
      this.db.expenses.clear(),
      this.db.projects.clear(),
      this.db.reminders.clear(),
      this.db.settings.clear(),
    ]);
  }
}

export function emptyItem(): Item {
  return {
    id: uid(),
    name: "",
    tags: [],
    photos: [],
    customFields: {},
    bundleItems: [],
    condition: "good",
    unit: "pcs",
    minQuantity: null,
    purchasePrice: null,
    currentValue: null,
    purchaseDate: null,
    warrantyExpiry: null,
    categoryId: null,
    locationId: null,
    vendorId: null,
    barcode: "",
    archived: false,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
}

export function todayOr(date?: string | null) {
  return date ?? todayISO();
}
