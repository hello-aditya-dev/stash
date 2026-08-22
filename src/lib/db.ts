import Dexie, { type Table } from "dexie";
import type {
  Attachment,
  Batch,
  Category,
  Contact,
  Expense,
  FinDoc,
  Item,
  Location,
  Movement,
  Project,
  Reminder,
  Serial,
  Settings,
} from "./types";

export class StashDB extends Dexie {
  categories!: Table<Category, string>;
  locations!: Table<Location, string>;
  items!: Table<Item, string>;
  movements!: Table<Movement, string>;
  batches!: Table<Batch, string>;
  serials!: Table<Serial, string>;
  attachments!: Table<Attachment, string>;
  contacts!: Table<Contact, string>;
  docs!: Table<FinDoc, string>;
  expenses!: Table<Expense, string>;
  projects!: Table<Project, string>;
  reminders!: Table<Reminder, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super("stash-db");
    this.version(1).stores({
      categories: "id, name, parentId",
      locations: "id, name, parentId",
      items: "id, name, categoryId, locationId, barcode, *tags",
      movements: "id, itemId, date, type",
      batches: "id, itemId, expDate",
      serials: "id, itemId, serialNo",
      attachments: "id, itemId, type",
      contacts: "id, kind, name",
      docs: "id, kind, number, partyId, date",
      expenses: "id, date, category",
      projects: "id, name, status",
      reminders: "id, status, dueDate, itemId",
      settings: "id",
    });
  }
}

let _db: StashDB | null = null;

export function getDB(): StashDB {
  if (!_db) _db = new StashDB();
  return _db;
}
