-- ============================================================
--  Stash — Personal Inventory · Supabase schema
--  Run this once in your Supabase project (SQL Editor).
--  Every table is protected by Row Level Security so users
--  only ever see their own rows.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- helper: set updated_at automatically ----------
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ================ CATEGORIES =================
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  parent_id uuid references public.categories(id) on delete set null,
  color text,
  custom_fields jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- ================ LOCATIONS ==================
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  parent_id uuid references public.locations(id) on delete set null,
  description text,
  created_at timestamptz not null default now()
);

-- ================ CONTACTS ===================
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  kind text not null check (kind in ('vendor','customer')),
  name text not null,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);

-- ================ ITEMS ======================
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  description text,
  category_id uuid references public.categories(id) on delete set null,
  location_id uuid references public.locations(id) on delete set null,
  unit text default 'pcs',
  min_quantity numeric(12,3),
  barcode text,
  tags jsonb not null default '[]'::jsonb,
  photos jsonb not null default '[]'::jsonb,
  purchase_price numeric(14,2),
  current_value numeric(14,2),
  purchase_date date,
  vendor_id uuid references public.contacts(id) on delete set null,
  warranty_expiry date,
  condition text default 'good',
  custom_fields jsonb not null default '{}'::jsonb,
  bundle_items jsonb not null default '[]'::jsonb,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists items_touch on public.items;
create trigger items_touch before update on public.items
for each row execute function public.touch_updated_at();

-- ================ STOCK MOVEMENTS ============
create table if not exists public.movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  item_id uuid not null references public.items(id) on delete cascade,
  type text not null check (type in ('in','out','adjust')),
  delta numeric(12,3) not null,
  reason text,
  date date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists movements_item_idx on public.movements(item_id);

-- ================ BATCHES ====================
create table if not exists public.batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  item_id uuid not null references public.items(id) on delete cascade,
  batch_no text not null,
  mfg_date date,
  exp_date date,
  qty numeric(12,3) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists batches_item_idx on public.batches(item_id);
create index if not exists batches_exp_idx on public.batches(exp_date);

-- ================ SERIALS ====================
create table if not exists public.serials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  item_id uuid not null references public.items(id) on delete cascade,
  serial_no text not null,
  status text not null default 'in_stock' check (status in ('in_stock','sold','damaged','returned')),
  created_at timestamptz not null default now()
);
create index if not exists serials_item_idx on public.serials(item_id);

-- ================ ATTACHMENTS (metadata only — files live in Storage bucket "attachments") ===
create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  item_id uuid references public.items(id) on delete cascade,
  type text not null check (type in ('receipt','manual','doc')),
  name text not null,
  url text,
  created_at timestamptz not null default now()
);

-- ================ FINANCIAL DOCUMENTS ========
create table if not exists public.fin_docs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  kind text not null check (kind in ('invoice','quotation','purchase')),
  number text not null,
  party_id uuid references public.contacts(id) on delete set null,
  date date not null default current_date,
  due_date date,
  status text not null default 'draft',
  lines jsonb not null default '[]'::jsonb,
  discount numeric(14,2) default 0,
  tax_rate numeric(5,2) default 0,
  notes text,
  paid_amount numeric(14,2) default 0,
  received_at date,
  created_at timestamptz not null default now()
);
create index if not exists fin_docs_kind_idx on public.fin_docs(kind);

-- ================ EXPENSES ===================
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  date date not null default current_date,
  category text not null default 'General',
  amount numeric(14,2) not null,
  note text,
  vendor_id uuid references public.contacts(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ================ PROJECTS ===================
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  description text,
  status text not null default 'active' check (status in ('planned','active','done')),
  item_ids jsonb not null default '[]'::jsonb,
  budget numeric(14,2),
  created_at timestamptz not null default now()
);

-- ================ REMINDERS ==================
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  title text not null,
  type text not null default 'custom',
  due_date date,
  item_id uuid references public.items(id) on delete cascade,
  notes text,
  status text not null default 'open' check (status in ('open','done','dismissed')),
  created_at timestamptz not null default now()
);

-- ================ APP SETTINGS (one row per user) ==========
create table if not exists public.app_settings (
  user_id uuid primary key default auth.uid(),
  currency text not null default 'INR',
  org_name text not null default 'My Household',
  org_address text,
  org_phone text,
  org_email text,
  invoice_prefix text not null default 'INV-',
  quote_prefix text not null default 'QT-',
  purchase_prefix text not null default 'PO-',
  doc_seq jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
drop trigger if exists app_settings_touch on public.app_settings;
create trigger app_settings_touch before update on public.app_settings
for each row execute function public.touch_updated_at();

-- ============================================================
--  ROW LEVEL SECURITY — every table locked to its owner.
--  (Household sharing later = add a space_members policy.)
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'categories','locations','contacts','items','movements','batches',
    'serials','attachments','fin_docs','expenses','projects','reminders'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I_owner on public.%I;', t, t);
    execute format($f$
      create policy %I_owner on public.%I
      for all using (user_id = auth.uid()) with check (user_id = auth.uid());
    $f$, t, t);
  end loop;
end $$;

alter table public.app_settings enable row level security;
drop policy if exists app_settings_owner on public.app_settings;
create policy app_settings_owner on public.app_settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================
--  STORAGE — bucket for photos / receipts / manuals
-- ============================================================
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

drop policy if exists "attachments_read" on storage.objects;
create policy "attachments_read" on storage.objects
  for select using (bucket_id = 'attachments');

drop policy if exists "attachments_write" on storage.objects;
create policy "attachments_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "attachments_update" on storage.objects;
create policy "attachments_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "attachments_delete" on storage.objects;
create policy "attachments_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

-- Done! Set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.
