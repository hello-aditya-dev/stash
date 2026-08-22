import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_SETTINGS } from "../types";
import { nowISO, uid } from "../utils";
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
  Project,
  Reminder,
  Serial,
  SerialStatus,
  Settings,
} from "../types";
import type { InventoryRepo } from "./types";

export function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _client;
}

export async function uploadDataUrl(dataUrl: string, path: string): Promise<string> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const { error } = await getSupabase().storage.from("attachments").upload(path, blob, {
    upsert: true,
    contentType: "image/jpeg",
  });
  if (error) throw error;
  return getSupabase().storage.from("attachments").getPublicUrl(path).data.publicUrl;
}

type Row = Record<string, unknown>;

export class SupabaseRepo implements InventoryRepo {
  readonly kind = "cloud" as const;
  constructor(private userId: ID) {}

  private get sb() {
    return getSupabase();
  }

  private async all(table: string): Promise<Row[]> {
    const { data, error } = await this.sb.from(table).select("*").eq("user_id", this.userId);
    if (error) throw error;
    return (data ?? []) as Row[];
  }

  private async upsert(table: string, row: Row) {
    const { error } = await this.sb
      .from(table)
      .upsert({ ...row, user_id: this.userId });
    if (error) throw error;
  }

  private async remove(table: string, id: ID) {
    const { error } = await this.sb.from(table).delete().eq("id", id).eq("user_id", this.userId);
    if (error) throw error;
  }

  async getSettings(): Promise<Settings> {
    const rows = await this.all("app_settings");
    const r = rows[0];
    if (!r) return { ...DEFAULT_SETTINGS };
    return {
      id: "app",
      currency: (r.currency as string) ?? DEFAULT_SETTINGS.currency,
      orgName: (r.org_name as string) ?? DEFAULT_SETTINGS.orgName,
      orgAddress: (r.org_address as string) ?? "",
      orgPhone: (r.org_phone as string) ?? "",
      orgEmail: (r.org_email as string) ?? "",
      invoicePrefix: (r.invoice_prefix as string) ?? DEFAULT_SETTINGS.invoicePrefix,
      quotePrefix: (r.quote_prefix as string) ?? DEFAULT_SETTINGS.quotePrefix,
      purchasePrefix: (r.purchase_prefix as string) ?? DEFAULT_SETTINGS.purchasePrefix,
      docSeq: (r.doc_seq as Record<string, number>) ?? {},
      openAiKey: undefined,
    };
  }
  async saveSettings(s: Settings) {
    await this.upsert("app_settings", {
      currency: s.currency,
      org_name: s.orgName,
      org_address: s.orgAddress ?? null,
      org_phone: s.orgPhone ?? null,
      org_email: s.orgEmail ?? null,
      invoice_prefix: s.invoicePrefix,
      quote_prefix: s.quotePrefix,
      purchase_prefix: s.purchasePrefix,
      doc_seq: s.docSeq,
    });
  }

  async listCategories(): Promise<Category[]> {
    return (await this.all("categories")).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      parentId: (r.parent_id as string) ?? null,
      color: (r.color as string) ?? undefined,
      customFields: (r.custom_fields as Category["customFields"]) ?? [],
      createdAt: r.created_at as string,
    }));
  }
  async saveCategory(c: Category) {
    await this.upsert("categories", {
      id: c.id,
      name: c.name,
      parent_id: c.parentId ?? null,
      color: c.color ?? null,
      custom_fields: c.customFields ?? [],
      created_at: c.createdAt,
    });
  }
  async deleteCategory(id: ID) {
    await this.remove("categories", id);
  }

  async listLocations(): Promise<Location[]> {
    return (await this.all("locations")).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      parentId: (r.parent_id as string) ?? null,
      description: (r.description as string) ?? undefined,
      createdAt: r.created_at as string,
    }));
  }
  async saveLocation(l: Location) {
    await this.upsert("locations", {
      id: l.id,
      name: l.name,
      parent_id: l.parentId ?? null,
      description: l.description ?? null,
      created_at: l.createdAt,
    });
  }
  async deleteLocation(id: ID) {
    await this.remove("locations", id);
  }

  async listContacts(kind?: "vendor" | "customer"): Promise<Contact[]> {
    let rows = await this.all("contacts");
    if (kind) rows = rows.filter((r) => r.kind === kind);
    return rows.map((r) => ({
      id: r.id as string,
      kind: r.kind as Contact["kind"],
      name: r.name as string,
      phone: (r.phone as string) ?? "",
      email: (r.email as string) ?? "",
      address: (r.address as string) ?? "",
      notes: (r.notes as string) ?? "",
      createdAt: r.created_at as string,
    }));
  }
  async saveContact(c: Contact) {
    await this.upsert("contacts", {
      id: c.id,
      kind: c.kind,
      name: c.name,
      phone: c.phone ?? null,
      email: c.email ?? null,
      address: c.address ?? null,
      notes: c.notes ?? null,
      created_at: c.createdAt,
    });
  }
  async deleteContact(id: ID) {
    await this.remove("contacts", id);
  }

  async listItems(): Promise<Item[]> {
    return (await this.all("items")).map(mapItemRow);
  }
  async getItem(id: ID): Promise<Item | null> {
    const { data, error } = await this.sb
      .from("items")
      .select("*")
      .eq("id", id)
      .eq("user_id", this.userId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapItemRow(data as Row) : null;
  }
  async saveItem(i: Item) {
    await this.upsert("items", {
      id: i.id,
      name: i.name,
      description: i.description ?? null,
      category_id: i.categoryId ?? null,
      location_id: i.locationId ?? null,
      unit: i.unit ?? "pcs",
      min_quantity: i.minQuantity ?? null,
      barcode: i.barcode || null,
      tags: i.tags,
      photos: i.photos,
      purchase_price: i.purchasePrice ?? null,
      current_value: i.currentValue ?? null,
      purchase_date: i.purchaseDate ?? null,
      vendor_id: i.vendorId ?? null,
      warranty_expiry: i.warrantyExpiry ?? null,
      condition: i.condition ?? "good",
      custom_fields: i.customFields ?? {},
      bundle_items: i.bundleItems ?? [],
      archived: i.archived ?? false,
      created_at: i.createdAt,
      updated_at: nowISO(),
    });
  }
  async deleteItem(id: ID) {
    for (const t of ["movements", "batches", "serials"]) {
      await this.sb.from(t).delete().eq("item_id", id).eq("user_id", this.userId);
    }
    await this.remove("items", id);
  }

  async listMovements(itemId?: ID): Promise<Movement[]> {
    let rows = await this.all("movements");
    if (itemId) rows = rows.filter((r) => r.item_id === itemId);
    return rows
      .map((r) => ({
        id: r.id as string,
        itemId: r.item_id as string,
        type: r.type as Movement["type"],
        delta: Number(r.delta),
        reason: (r.reason as string) ?? undefined,
        date: r.date as string,
        createdAt: r.created_at as string,
      }))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }
  async addMovement(m: Movement) {
    await this.upsert("movements", {
      id: m.id,
      item_id: m.itemId,
      type: m.type,
      delta: m.delta,
      reason: m.reason ?? null,
      date: m.date,
      created_at: m.createdAt,
    });
  }

  async listBatches(itemId?: ID): Promise<Batch[]> {
    let rows = await this.all("batches");
    if (itemId) rows = rows.filter((r) => r.item_id === itemId);
    return rows.map((r) => ({
      id: r.id as string,
      itemId: r.item_id as string,
      batchNo: r.batch_no as string,
      mfgDate: (r.mfg_date as string) ?? null,
      expDate: (r.exp_date as string) ?? null,
      qty: Number(r.qty),
      createdAt: r.created_at as string,
    }));
  }
  async saveBatch(b: Batch) {
    await this.upsert("batches", {
      id: b.id,
      item_id: b.itemId,
      batch_no: b.batchNo,
      mfg_date: b.mfgDate ?? null,
      exp_date: b.expDate ?? null,
      qty: b.qty,
      created_at: b.createdAt,
    });
  }
  async deleteBatch(id: ID) {
    await this.remove("batches", id);
  }

  async listSerials(itemId?: ID): Promise<Serial[]> {
    let rows = await this.all("serials");
    if (itemId) rows = rows.filter((r) => r.item_id === itemId);
    return rows.map(mapSerialRow);
  }
  async addSerials(itemId: ID, nos: string[]) {
    const rows = nos
      .map((n) => n.trim())
      .filter(Boolean)
      .map((n) => ({
        id: uid(),
        item_id: itemId,
        serial_no: n,
        status: "in_stock",
        user_id: this.userId,
        created_at: nowISO(),
      }));
    if (rows.length) {
      const { error } = await this.sb.from("serials").upsert(rows);
      if (error) throw error;
    }
  }
  async updateSerial(id: ID, status: SerialStatus) {
    const { error } = await this.sb.from("serials").update({ status }).eq("id", id).eq("user_id", this.userId);
    if (error) throw error;
  }
  async deleteSerial(id: ID) {
    await this.remove("serials", id);
  }

  async listAttachments(itemId?: ID): Promise<Attachment[]> {
    let rows = await this.all("attachments");
    if (itemId) rows = rows.filter((r) => r.item_id === itemId);
    return rows.map((r) => ({
      id: r.id as string,
      itemId: (r.item_id as string) ?? null,
      type: r.type as Attachment["type"],
      name: r.name as string,
      url: (r.url as string) ?? undefined,
      dataUrl: undefined,
      createdAt: r.created_at as string,
    }));
  }
  async saveAttachment(a: Attachment) {
    let url = a.url;
    if (a.dataUrl && !url) {
      const res = await fetch(a.dataUrl);
      const blob = await res.blob();
      const path = `${this.userId}/${a.id}-${a.name.replace(/[^\w.\-]+/g, "_")}`;
      const { error } = await this.sb.storage.from("attachments").upload(path, blob, { upsert: true });
      if (error) throw error;
      const { data } = this.sb.storage.from("attachments").getPublicUrl(path);
      url = data.publicUrl;
    }
    await this.upsert("attachments", {
      id: a.id,
      item_id: a.itemId ?? null,
      type: a.type,
      name: a.name,
      url: url ?? null,
      created_at: a.createdAt,
    });
  }
  async deleteAttachment(id: ID) {
    await this.remove("attachments", id);
  }

  async listDocs(kind?: DocKind): Promise<FinDoc[]> {
    let rows = await this.all("fin_docs");
    if (kind) rows = rows.filter((r) => r.kind === kind);
    return rows
      .map(mapDocRow)
      .sort((a, b) => b.date.localeCompare(a.date));
  }
  async saveDoc(d: FinDoc) {
    await this.upsert("fin_docs", {
      id: d.id,
      kind: d.kind,
      number: d.number,
      party_id: d.partyId ?? null,
      date: d.date,
      due_date: d.dueDate ?? null,
      status: d.status,
      lines: d.lines,
      discount: d.discount ?? 0,
      tax_rate: d.taxRate ?? 0,
      notes: d.notes ?? null,
      paid_amount: d.paidAmount ?? 0,
      received_at: d.receivedAt ?? null,
      created_at: d.createdAt,
    });
  }
  async deleteDoc(id: ID) {
    await this.remove("fin_docs", id);
  }
  async nextDocNumber(kind: DocKind): Promise<string> {
    const s = await this.getSettings();
    const prefix =
      kind === "invoice" ? s.invoicePrefix : kind === "quotation" ? s.quotePrefix : s.purchasePrefix;
    const n = (s.docSeq?.[kind] ?? 0) + 1;
    await this.saveSettings({ ...s, docSeq: { ...s.docSeq, [kind]: n } });
    return `${prefix}${String(n).padStart(4, "0")}`;
  }

  async listExpenses(): Promise<Expense[]> {
    return (await this.all("expenses")).map((r) => ({
      id: r.id as string,
      date: r.date as string,
      category: r.category as string,
      amount: Number(r.amount),
      note: (r.note as string) ?? "",
      vendorId: (r.vendor_id as string) ?? null,
      createdAt: r.created_at as string,
    }));
  }
  async saveExpense(e: Expense) {
    await this.upsert("expenses", {
      id: e.id,
      date: e.date,
      category: e.category,
      amount: e.amount,
      note: e.note ?? null,
      vendor_id: e.vendorId ?? null,
      created_at: e.createdAt,
    });
  }
  async deleteExpense(id: ID) {
    await this.remove("expenses", id);
  }

  async listProjects(): Promise<Project[]> {
    return (await this.all("projects")).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      description: (r.description as string) ?? "",
      status: r.status as Project["status"],
      itemIds: (r.item_ids as string[]) ?? [],
      budget: (r.budget as number) ?? null,
      createdAt: r.created_at as string,
    }));
  }
  async saveProject(p: Project) {
    await this.upsert("projects", {
      id: p.id,
      name: p.name,
      description: p.description ?? null,
      status: p.status,
      item_ids: p.itemIds,
      budget: p.budget ?? null,
      created_at: p.createdAt,
    });
  }
  async deleteProject(id: ID) {
    await this.remove("projects", id);
  }

  async listReminders(): Promise<Reminder[]> {
    return (await this.all("reminders")).map((r) => ({
      id: r.id as string,
      title: r.title as string,
      type: r.type as Reminder["type"],
      dueDate: (r.due_date as string) ?? null,
      itemId: (r.item_id as string) ?? null,
      notes: (r.notes as string) ?? "",
      status: r.status as Reminder["status"],
      createdAt: r.created_at as string,
    }));
  }
  async saveReminder(r: Reminder) {
    await this.upsert("reminders", {
      id: r.id,
      title: r.title,
      type: r.type,
      due_date: r.dueDate ?? null,
      item_id: r.itemId ?? null,
      notes: r.notes ?? null,
      status: r.status,
      created_at: r.createdAt,
    });
  }
  async deleteReminder(id: ID) {
    await this.remove("reminders", id);
  }

  async destroyAll() {
    const tables = [
      "movements",
      "batches",
      "serials",
      "attachments",
      "fin_docs",
      "expenses",
      "projects",
      "reminders",
      "items",
      "contacts",
      "categories",
      "locations",
    ];
    for (const t of tables) {
      const { error } = await this.sb.from(t).delete().eq("user_id", this.userId);
      if (error) throw error;
    }
    await this.sb.from("app_settings").delete().eq("user_id", this.userId);
  }
}

function mapItemRow(r: Row): Item {
  return {
    id: r.id as string,
    name: r.name as string,
    description: (r.description as string) ?? "",
    categoryId: (r.category_id as string) ?? null,
    locationId: (r.location_id as string) ?? null,
    unit: (r.unit as string) ?? "pcs",
    minQuantity: (r.min_quantity as number) ?? null,
    barcode: (r.barcode as string) ?? "",
    tags: (r.tags as string[]) ?? [],
    photos: (r.photos as Item["photos"]) ?? [],
    purchasePrice: (r.purchase_price as number) ?? null,
    currentValue: (r.current_value as number) ?? null,
    purchaseDate: (r.purchase_date as string) ?? null,
    vendorId: (r.vendor_id as string) ?? null,
    warrantyExpiry: (r.warranty_expiry as string) ?? null,
    condition: (r.condition as Item["condition"]) ?? "good",
    customFields: (r.custom_fields as Record<string, unknown>) ?? {},
    bundleItems: (r.bundle_items as Item["bundleItems"]) ?? [],
    archived: Boolean(r.archived),
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function mapSerialRow(r: Row): Serial {
  return {
    id: r.id as string,
    itemId: r.item_id as string,
    serialNo: r.serial_no as string,
    status: r.status as Serial["status"],
    createdAt: r.created_at as string,
  };
}

function mapDocRow(r: Row): FinDoc {
  return {
    id: r.id as string,
    kind: r.kind as DocKind,
    number: r.number as string,
    partyId: (r.party_id as string) ?? null,
    date: r.date as string,
    dueDate: (r.due_date as string) ?? null,
    status: r.status as string,
    lines: (r.lines as FinDoc["lines"]) ?? [],
    discount: Number(r.discount ?? 0),
    taxRate: Number(r.tax_rate ?? 0),
    notes: (r.notes as string) ?? "",
    paidAmount: Number(r.paid_amount ?? 0),
    receivedAt: (r.received_at as string) ?? null,
    createdAt: r.created_at as string,
  };
}
