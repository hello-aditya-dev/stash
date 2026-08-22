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

export interface InventoryRepo {
  readonly kind: "local" | "cloud";

  getSettings(): Promise<Settings>;
  saveSettings(s: Settings): Promise<void>;

  listCategories(): Promise<Category[]>;
  saveCategory(c: Category): Promise<void>;
  deleteCategory(id: ID): Promise<void>;

  listLocations(): Promise<Location[]>;
  saveLocation(l: Location): Promise<void>;
  deleteLocation(id: ID): Promise<void>;

  listContacts(kind?: "vendor" | "customer"): Promise<Contact[]>;
  saveContact(c: Contact): Promise<void>;
  deleteContact(id: ID): Promise<void>;

  listItems(): Promise<Item[]>;
  getItem(id: ID): Promise<Item | null>;
  saveItem(i: Item): Promise<void>;
  deleteItem(id: ID): Promise<void>;

  listMovements(itemId?: ID): Promise<Movement[]>;
  addMovement(m: Movement): Promise<void>;

  listBatches(itemId?: ID): Promise<Batch[]>;
  saveBatch(b: Batch): Promise<void>;
  deleteBatch(id: ID): Promise<void>;

  listSerials(itemId?: ID): Promise<Serial[]>;
  addSerials(itemId: ID, nos: string[]): Promise<void>;
  updateSerial(id: ID, status: SerialStatus): Promise<void>;
  deleteSerial(id: ID): Promise<void>;

  listAttachments(itemId?: ID): Promise<Attachment[]>;
  saveAttachment(a: Attachment): Promise<void>;
  deleteAttachment(id: ID): Promise<void>;

  listDocs(kind?: DocKind): Promise<FinDoc[]>;
  saveDoc(d: FinDoc): Promise<void>;
  deleteDoc(id: ID): Promise<void>;
  nextDocNumber(kind: DocKind): Promise<string>;

  listExpenses(): Promise<Expense[]>;
  saveExpense(e: Expense): Promise<void>;
  deleteExpense(id: ID): Promise<void>;

  listProjects(): Promise<Project[]>;
  saveProject(p: Project): Promise<void>;
  deleteProject(id: ID): Promise<void>;

  listReminders(): Promise<Reminder[]>;
  saveReminder(r: Reminder): Promise<void>;
  deleteReminder(id: ID): Promise<void>;

  destroyAll(): Promise<void>;
}
