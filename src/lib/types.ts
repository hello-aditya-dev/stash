export type ID = string;

export interface CustomFieldDef {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select";
  options?: string[];
}

export interface Category {
  id: ID;
  name: string;
  parentId?: ID | null;
  color?: string;
  customFields?: CustomFieldDef[];
  createdAt: string;
}

export interface Location {
  id: ID;
  name: string;
  parentId?: ID | null;
  description?: string;
  createdAt: string;
}

export interface PhotoRef {
  id: ID;
  url?: string;
  dataUrl?: string;
}

export type Condition = "new" | "good" | "fair" | "poor" | "broken";

export interface BundlePart {
  itemId: ID;
  qty: number;
}

export interface Item {
  id: ID;
  name: string;
  description?: string;
  categoryId?: ID | null;
  locationId?: ID | null;
  unit?: string;
  minQuantity?: number | null;
  barcode?: string;
  tags: string[];
  photos: PhotoRef[];
  purchasePrice?: number | null;
  currentValue?: number | null;
  purchaseDate?: string | null;
  vendorId?: ID | null;
  warrantyExpiry?: string | null;
  condition?: Condition;
  customFields?: Record<string, unknown>;
  bundleItems?: BundlePart[];
  archived?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type MovementType = "in" | "out" | "adjust";

export interface Movement {
  id: ID;
  itemId: ID;
  type: MovementType;
  delta: number;
  reason?: string;
  date: string;
  createdAt: string;
}

export interface Batch {
  id: ID;
  itemId: ID;
  batchNo: string;
  mfgDate?: string | null;
  expDate?: string | null;
  qty: number;
  createdAt: string;
}

export type SerialStatus = "in_stock" | "sold" | "damaged" | "returned";

export interface Serial {
  id: ID;
  itemId: ID;
  serialNo: string;
  status: SerialStatus;
  createdAt: string;
}

export type AttachmentType = "receipt" | "manual" | "doc";

export interface Attachment {
  id: ID;
  itemId?: ID | null;
  type: AttachmentType;
  name: string;
  url?: string;
  dataUrl?: string;
  createdAt: string;
}

export interface Contact {
  id: ID;
  kind: "vendor" | "customer";
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  createdAt: string;
}

export interface DocLine {
  id: ID;
  itemId?: ID | null;
  name: string;
  qty: number;
  unitPrice: number;
}

export type DocKind = "invoice" | "quotation" | "purchase";

export interface FinDoc {
  id: ID;
  kind: DocKind;
  number: string;
  partyId?: ID | null;
  date: string;
  dueDate?: string | null;
  status: string;
  lines: DocLine[];
  discount?: number;
  taxRate?: number;
  notes?: string;
  paidAmount?: number;
  receivedAt?: string | null;
  createdAt: string;
}

export interface Expense {
  id: ID;
  date: string;
  category: string;
  amount: number;
  note?: string;
  vendorId?: ID | null;
  createdAt: string;
}

export interface Project {
  id: ID;
  name: string;
  description?: string;
  status: "planned" | "active" | "done";
  itemIds: ID[];
  budget?: number | null;
  createdAt: string;
}

export type ReminderType = "custom" | "maintenance" | "warranty" | "expiry" | "low_stock";

export interface Reminder {
  id: ID;
  title: string;
  type: ReminderType;
  dueDate?: string | null;
  itemId?: ID | null;
  notes?: string;
  status: "open" | "done" | "dismissed";
  createdAt: string;
}

export interface Settings {
  id: "app";
  currency: string;
  orgName: string;
  orgAddress?: string;
  orgPhone?: string;
  orgEmail?: string;
  invoicePrefix: string;
  quotePrefix: string;
  purchasePrefix: string;
  docSeq: Record<string, number>;
  openAiKey?: string;
}

export const DEFAULT_SETTINGS: Settings = {
  id: "app",
  currency: "INR",
  orgName: "My Household",
  invoicePrefix: "INV-",
  quotePrefix: "QT-",
  purchasePrefix: "PO-",
  docSeq: {},
};

export const CONDITION_LABELS: Record<Condition, string> = {
  new: "New",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
  broken: "Broken",
};

export const UNITS = ["pcs", "kg", "g", "L", "ml", "m", "box", "pack", "set", "pair"];
