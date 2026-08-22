"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { InventoryRepo } from "./repo/types";
import { LocalRepo } from "./repo/local";
import { SupabaseRepo, supabaseConfigured } from "./repo/supabase";
import { useAuth } from "./auth-context";
import { DEFAULT_SETTINGS, type Attachment, type Batch, type Category, type Contact, type Expense, type FinDoc, type Item, type Location, type Movement, type Project, type Reminder, type Serial, type Settings } from "./types";

export interface StashData {
  items: Item[];
  movements: Movement[];
  batches: Batch[];
  serials: Serial[];
  categories: Category[];
  locations: Location[];
  contacts: Contact[];
  docs: FinDoc[];
  expenses: Expense[];
  projects: Project[];
  reminders: Reminder[];
  attachments: Attachment[];
  settings: Settings;
  loading: boolean;
}

interface DataContextValue extends StashData {
  repo: InventoryRepo;
  refresh: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

const EMPTY: StashData = {
  items: [], movements: [], batches: [], serials: [], categories: [],
  locations: [], contacts: [], docs: [], expenses: [], projects: [],
  reminders: [], attachments: [], settings: DEFAULT_SETTINGS, loading: true,
};

export function DataProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const repo = useMemo<InventoryRepo>(() => {
    if (supabaseConfigured() && auth.mode === "cloud" && auth.user) {
      return new SupabaseRepo(auth.user.id);
    }
    return new LocalRepo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.mode, auth.user?.id]);

  const [data, setData] = useState<StashData>(EMPTY);
  const [tick, setTick] = useState(0);
  const mountedRef = useRef(true);

  const load = React.useCallback(async () => {
    try {
      const [
        items, movements, batches, serials, categories,
        locations, contacts, docs, expenses, projects, reminders, attachments, settings,
      ] = await Promise.all([
        repo.listItems(), repo.listMovements(), repo.listBatches(), repo.listSerials(),
        repo.listCategories(), repo.listLocations(), repo.listContacts(), repo.listDocs(),
        repo.listExpenses(), repo.listProjects(), repo.listReminders(), repo.listAttachments(),
        repo.getSettings(),
      ]);
      if (!mountedRef.current) return;
      setData({
        items, movements, batches, serials, categories,
        locations, contacts, docs, expenses, projects, reminders, attachments,
        settings: settings ?? DEFAULT_SETTINGS,
        loading: false,
      });
    } catch (e) {
      console.error("data load failed", e);
      if (!mountedRef.current) return;
      setData((prev) => ({ ...prev, loading: false }));
    }
  }, [repo]);

  useEffect(() => {
    mountedRef.current = true;
    if (!auth.ready) return;
    void load();
    return () => {
      mountedRef.current = false;
    };
  }, [load, tick, auth.ready]);

  const value = useMemo<DataContextValue>(
    () => ({
      ...data,
      repo,
      refresh: async () => {
        setTick((t) => t + 1);
        await load();
      },
    }),
    [data, repo, load]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const v = useContext(DataContext);
  if (!v) throw new Error("useData must be used inside DataProvider");
  return v;
}
