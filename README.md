# 📦 Stash — Personal Inventory

> **Every thing you own, in your pocket.** Fast, offline-first personal inventory — snap, tag, done.

Stash answers three questions instantly: **what do I own**, **where is it**, and **what needs attention** (expiries, warranties, low stock). Inspired by the simplicity-first DNA of getswipe.in — but built for homes instead of GST billing.

---

## ✨ Features

| Area | What you get |
|---|---|
| **Catalog** | Items with photos (compressed on-device), categories, tags, custom fields per category, condition, barcode/SKU |
| **Locations** | Hierarchical spaces — `Home › Kitchen › Pantry Shelf` — with printable QR bin labels |
| **Stock** | Append-only movement ledger (`in / out / set exact`) with reasons → auditable history, derived quantities |
| **Batches & expiry** | Lot numbers, mfg/expiry dates, per-batch qty; expiring-soon alerts everywhere |
| **Serials** | Bulk-paste serial numbers with status tracking |
| **Valuation & reports** | Purchase price + estimated value; summary / valuation / expiry / movements reports — all exportable CSV |
| **Insurance package** | Filter items by location/category/value → one-click print-ready claim PDF |
| **Documents** | Invoices (payments tracked), quotations (→ convert to invoice), purchase orders (→ receive stock into inventory), expenses, projects |
| **People** | Vendors & customers linked to purchases, warranties and invoices |
| **Reminders** | Smart computed alerts (low stock, expiry ≤30d, warranty, overdue invoices) + your own scheduled reminders |
| **Assistant** | Ask *"What expires in 30 days?"*, *"Where is my drill?"*, *"How much is everything worth?"* — instant local answers, optional GPT-4o-mini boost |
| **Scan** | Camera barcode/QR scanning via ZXing → jumps straight to the item (or offers to create it) |
| **Offline & PWA** | Installable, works fully offline (IndexedDB), camera capture, service worker |
| **Data freedom** | CSV import (auto column mapping), CSV exports per report, full JSON backup + restore |

## 🚀 Quick start

```bash
npm install
npm run dev        # → http://localhost:3000
```

No account needed to try it: click **"Continue offline"** — everything is stored locally in IndexedDB.
Tip: load a full demo household from **Settings → Try a demo household**.

## ☁️ Connect Supabase (accounts + sync)

1. Create a free project at [supabase.com](https://supabase.com)
2. Open the SQL Editor and run [`supabase/schema.sql`](supabase/schema.sql) — creates all tables, RLS policies and the `attachments` storage bucket
3. Copy `.env.example` → `.env.local` and fill in:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```
4. Restart. Sign up / log in (email or Google OAuth — enable Google in Supabase Auth settings if desired).

Every table is protected by **Row Level Security** — users only ever see their own rows. Photos upload to the storage bucket automatically when running in cloud mode.

## 🧱 Tech stack

- **Next.js 14** (App Router) · React 18 · TypeScript
- **Tailwind CSS + shadcn/ui-style components** (Radix primitives, CVA, tailwind-merge)
- **Dexie (IndexedDB)** local-first store · repository pattern with swappable backends
- **Supabase** (Postgres + Auth + Storage + RLS) for cloud mode
- **ZXing** barcode scanning · **qrcode** label generation · **PapaParse** CSV
- **Sonner** toasts · lucide icons

## 🗂 Project structure

```
src/
├─ app/
│  ├─ page.tsx              # marketing landing
│  ├─ login/ signup/ auth/callback/
│  └─ (app)/                # authenticated shell (sidebar + bottom nav)
│     ├─ dashboard/         # insights, alerts, activity feed
│     ├─ items/[id]/        # catalog + detail w/ movements, batches, serials, files, maintenance
│     ├─ locations/ categories/   # hierarchical tree editors (+custom field builder)
│     ├─ scan/              # barcode / QR scanner
│     ├─ reports/           # summary · valuation · expiry · movements · insurance package
│     ├─ documents/         # invoices · quotations · purchases · expenses · projects
│     ├─ people/            # vendors & customers
│     ├─ reminders/         # smart alerts + scheduled reminders
│     ├─ assistant/         # natural-language Q&A over your inventory
│     └─ settings/          # profile, org, currency, AI key, backups, danger zone
├─ components/              # ui/ primitives (shadcn-style), AppShell, modals, charts
└─ lib/
   ├─ repo/                 # InventoryRepo interface ← LocalRepo (Dexie) | SupabaseRepo
   ├─ types.ts db.ts csv.ts qa.ts alerts.ts demo-data.ts utils.ts
```

## 🔑 Design decisions

- **Quantity lives only in `stock_movements`** — current stock is always derived, so history can never lie.
- **Repository pattern** — every feature works identically offline or against Supabase; the app picks the backend at runtime based on env vars + auth state.
- **Capture beats completeness** — add-item is one screen; photo + name = done.
- **Never paywall your own data** — import/export are first-class, not an upsell.

## 📄 License

MIT — use it, fork it, ship it.
