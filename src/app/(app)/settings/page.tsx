"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  User, Building2, Coins, Sparkles, Database, Cloud,
  CloudOff, Download, Upload, Trash2, FlaskConical, Info,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/extras";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/extras";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useData } from "@/lib/data-context";
import { useAuth } from "@/lib/auth-context";
import { supabaseConfigured } from "@/lib/repo/supabase";
import { seedDemoData } from "@/lib/demo-data";
import { applyImport, parseImportFile, toCSV } from "@/lib/csv";
import { currentQty, downloadFile, todayISO } from "@/lib/utils";

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AUD", "CAD", "AED", "SGD"];

export default function SettingsPage() {
  const data = useData();
  const auth = useAuth();
  const [org, setOrg] = useState(data.settings);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const restoreRef = useRef<HTMLInputElement>(null);

  useEffect(() => setOrg(data.settings), [data.settings]);

  const saveOrg = async () => {
    await data.repo.saveSettings(org);
    await data.refresh();
    toast.success("Settings saved");
  };

  const exportItemsCsv = () => {
    const qtyMap = new Map<string, number>();
    for (const m of data.movements) qtyMap.set(m.itemId, (qtyMap.get(m.itemId) ?? 0) + m.delta);
    downloadFile(
      `stash-items-${todayISO()}.csv`,
      toCSV(
        data.items.map((i) => ({
          name: i.name,
          category: data.categories.find((c) => c.id === i.categoryId)?.name ?? "",
          location: data.locations.find((l) => l.id === i.locationId)?.name ?? "",
          quantity: qtyMap.get(i.id) ?? 0,
          unit: i.unit ?? "pcs",
          min_quantity: i.minQuantity ?? "",
          purchase_price: i.purchasePrice ?? "",
          current_value: i.currentValue ?? "",
          purchase_date: i.purchaseDate ?? "",
          warranty_expiry: i.warrantyExpiry ?? "",
          barcode: i.barcode ?? "",
          tags: i.tags.join(", "),
          condition: i.condition ?? "",
          description: i.description ?? "",
        }))
      ),
      "text/csv"
    );
    toast.success("Items exported");
  };

  const exportFullBackup = () => {
    const bundle = {
      version: 1,
      exportedAt: new Date().toISOString(),
      items: data.items,
      movements: data.movements,
      batches: data.batches,
      serials: data.serials,
      categories: data.categories,
      locations: data.locations,
      contacts: data.contacts,
      docs: data.docs,
      expenses: data.expenses,
      projects: data.projects,
      reminders: data.reminders,
      attachments: data.attachments.filter((a) => !a.dataUrl),
      settings: data.settings,
    };
    downloadFile(`stash-backup-${todayISO()}.json`, JSON.stringify(bundle, null, 2), "application/json");
    toast.success("Full backup downloaded");
  };

  const restoreBackup = async (file: File | null) => {
    if (!file) return;
    try {
      const bundle = JSON.parse(await file.text());
      if (!bundle.items || !Array.isArray(bundle.items)) throw new Error("Not a Stash backup file");
      for (const c of bundle.categories ?? []) await data.repo.saveCategory(c);
      for (const l of bundle.locations ?? []) await data.repo.saveLocation(l);
      for (const c of bundle.contacts ?? []) await data.repo.saveContact(c);
      for (const i of bundle.items ?? []) await data.repo.saveItem(i);
      for (const m of bundle.movements ?? []) await data.repo.addMovement(m);
      for (const b of bundle.batches ?? []) await data.repo.saveBatch(b);
      for (const s of bundle.serials ?? []) await data.repo.addSerials(s.itemId, [s.serialNo]);
      for (const d of bundle.docs ?? []) await data.repo.saveDoc(d);
      for (const e of bundle.expenses ?? []) await data.repo.saveExpense(e);
      for (const p of bundle.projects ?? []) await data.repo.saveProject(p);
      for (const r of bundle.reminders ?? []) await data.repo.saveReminder(r);
      if (bundle.settings) await data.repo.saveSettings(bundle.settings);
      await data.refresh();
      toast.success("Backup restored");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Restore failed");
    }
  };

  const importCsv = async (file: File | null) => {
    if (!file) return;
    try {
      const { rows } = await parseImportFile(file);
      if (!rows.length) throw new Error("No rows found");
      const res = await applyImport(rows, { repo: data.repo, categories: [...data.categories], locations: [...data.locations] });
      await data.refresh();
      toast.success(`Imported ${res.itemsCreated} items`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    }
  };

  const runDemo = async () => {
    setDemoBusy(true);
    try {
      await seedDemoData(data.repo);
      await data.refresh();
      toast.success("Demo household loaded");
    } finally {
      setDemoBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Settings" subtitle="Account, preferences and your data" />

      <div className="mx-auto grid max-w-4xl grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Profile */}
        <Card>
          <CardContent className="pt-5">
            <SectionTitle icon={<User className="h-4 w-4" />} title="Profile" />
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Signed in as</span>
                <b>{auth.user?.email}</b>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Storage</span>
                {data.repo.kind === "cloud" ? (
                  <Badge variant="green"><Cloud className="mr-1 h-3 w-3" /> Supabase cloud sync</Badge>
                ) : (
                  <Badge variant="amber"><CloudOff className="mr-1 h-3 w-3" /> This device only</Badge>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => auth.signOut().then(() => window.location.assign("/"))}>
                Sign out
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Supabase */}
        <Card>
          <CardContent className="pt-5">
            <SectionTitle icon={supabaseConfigured() ? <Cloud className="h-4 w-4" /> : <CloudOff className="h-4 w-4" />} title="Supabase connection" />
            {supabaseConfigured() ? (
              <p className="text-sm text-muted-foreground">
                Connected. Auth and all data sync through your Supabase project.
                Run <code className="rounded bg-secondary px-1">supabase/schema.sql</code> there once — done already? You&apos;re set.
              </p>
            ) : (
              <div className="text-sm text-muted-foreground">
                <p>
                  Not configured — the app runs fully offline on this device. To enable accounts &amp; sync:
                </p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs">
                  <li>Create a free project at supabase.com</li>
                  <li>Run <code className="rounded bg-secondary px-1">supabase/schema.sql</code> from this repo in the SQL editor</li>
                  <li>Add <code className="rounded bg-secondary px-1">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="rounded bg-secondary px-1">KEY</code> to <code className="rounded bg-secondary px-1">.env.local</code></li>
                  <li>Restart the app — log in and your data syncs everywhere</li>
                </ol>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Organization */}
        <Card>
          <CardContent className="pt-5">
            <SectionTitle icon={<Building2 className="h-4 w-4" />} title="Organization" subtitle="Shown on invoices & quotations" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Name"><Input value={org.orgName} onChange={(e) => setOrg({ ...org, orgName: e.target.value })} /></Field>
              <Field label="Phone"><Input value={org.orgPhone ?? ""} onChange={(e) => setOrg({ ...org, orgPhone: e.target.value })} /></Field>
              <Field label="Email"><Input value={org.orgEmail ?? ""} onChange={(e) => setOrg({ ...org, orgEmail: e.target.value })} /></Field>
              <Field label="Address"><Input value={org.orgAddress ?? ""} onChange={(e) => setOrg({ ...org, orgAddress: e.target.value })} /></Field>
              <Field label="Invoice prefix"><Input value={org.invoicePrefix} onChange={(e) => setOrg({ ...org, invoicePrefix: e.target.value })} /></Field>
              <Field label="Quotation prefix"><Input value={org.quotePrefix} onChange={(e) => setOrg({ ...org, quotePrefix: e.target.value })} /></Field>
              <Field label="Purchase prefix"><Input value={org.purchasePrefix} onChange={(e) => setOrg({ ...org, purchasePrefix: e.target.value })} /></Field>
            </div>
            <Button size="sm" className="mt-4" onClick={saveOrg}>Save changes</Button>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card>
          <CardContent className="pt-5">
            <SectionTitle icon={<Coins className="h-4 w-4" />} title="Preferences" />
            <Field label="Currency" className="max-w-[200px]">
              <Select value={org.currency} onValueChange={(v) => setOrg({ ...org, currency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Button size="sm" className="mt-4" onClick={saveOrg}>Save changes</Button>
          </CardContent>
        </Card>

        {/* AI */}
        <Card>
          <CardContent className="pt-5">
            <SectionTitle icon={<Sparkles className="h-4 w-4" />} title="AI assistant" subtitle="Optional GPT boost for the Assistant page" />
            <Field
              label="OpenAI API key"
              hint="Stored only in your account settings — never sent anywhere except api.openai.com when you ask a question."
            >
              <Input type="password" placeholder="sk-…" value={org.openAiKey ?? ""} onChange={(e) => setOrg({ ...org, openAiKey: e.target.value })} />
            </Field>
            <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Without a key the Assistant still answers expiry, value, location and stock questions instantly using on-device search.
            </p>
            <Button size="sm" className="mt-3" onClick={saveOrg}>Save key</Button>
          </CardContent>
        </Card>

        {/* Data */}
        <Card>
          <CardContent className="pt-5">
            <SectionTitle icon={<Database className="h-4 w-4" />} title="Your data" subtitle={`${data.items.length} items · ${data.movements.length} movements`} />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={exportItemsCsv}><Download className="h-3.5 w-3.5" /> Items CSV</Button>
              <Button variant="outline" size="sm" onClick={exportFullBackup}><Download className="h-3.5 w-3.5" /> Full backup (JSON)</Button>
              <Button variant="outline" size="sm" onClick={() => restoreRef.current?.click()}><Upload className="h-3.5 w-3.5" /> Restore backup</Button>
              <input ref={restoreRef} type="file" accept=".json" className="hidden" onChange={(e) => void restoreBackup(e.target.files?.[0] ?? null)} />
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-input bg-card px-3 py-2 text-xs font-medium shadow-sm hover:bg-secondary">
                <Upload className="h-3.5 w-3.5" /> Import CSV
                <input type="file" accept=".csv" className="hidden" onChange={(e) => void importCsv(e.target.files?.[0] ?? null)} />
              </label>
            </div>

            <div className="mt-5 rounded-xl border border-dashed p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <FlaskConical className="h-3.5 w-3.5" /> Try a demo household
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Loads ~14 sample items with batches, invoices and more so you can explore every feature.
                Replaces current data!
              </p>
              <Button variant="secondary" size="sm" className="mt-2" loading={demoBusy} onClick={runDemo}>
                Load demo data
              </Button>
            </div>

            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50/50 p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-rose-600">
                <Trash2 className="h-3.5 w-3.5" /> Danger zone
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Erase every item, document and setting permanently.</p>
              <Button variant="destructive" size="sm" className="mt-2" onClick={() => setWipeOpen(true)}>
                Delete everything
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={wipeOpen}
        onClose={() => setWipeOpen(false)}
        title="Delete ALL data?"
        message="Every item, movement, document and setting will be gone forever. Consider downloading a full backup first."
        confirmLabel="Yes, delete everything"
        onConfirm={() =>
          void data.repo
            .destroyAll()
            .then(data.refresh)
            .then(() => toast.success("All data erased"))
        }
      />
    </>
  );
}

function SectionTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <span className="rounded-lg bg-accent p-1.5 text-accent-foreground">{icon}</span>
        <h3 className="text-sm font-bold">{title}</h3>
      </div>
      {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
