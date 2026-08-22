"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabaseConfigured, getSupabase } from "./repo/supabase";
import type { User } from "@supabase/supabase-js";

export type AuthMode = "cloud" | "local";

export interface LocalUser {
  id: string;
  email: string;
}

interface AuthContextValue {
  ready: boolean;
  mode: AuthMode;
  configured: boolean;
  user: User | LocalUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signInWithGoogle: () => Promise<void>;
  continueOffline: () => void;
  signOut: () => Promise<void>;
}

const LOCAL_KEY = "stash.local.user";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const cloud = supabaseConfigured();
  const [ready, setReady] = useState(!cloud);
  const [mode, setMode] = useState<AuthMode>(cloud ? "cloud" : "local");
  const [user, setUser] = useState<User | LocalUser | null>(
    !cloud ? readLocal() : null
  );

  useEffect(() => {
    if (!cloud) {
      setReady(true);
      return;
    }
    const sb = getSupabase();
    sb.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setReady(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      setMode("cloud");
      setUser(session?.user ?? null);
      if (!session) {
        const local = readLocal();
        if (local) {
          setMode("local");
          setUser(local);
        }
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [cloud]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      mode,
      configured: cloud,
      user,
      async signIn(email, password) {
        const { error } = await getSupabase().auth.signInWithPassword({ email, password });
        if (error) throw error;
        localStorage.removeItem(LOCAL_KEY);
        setMode("cloud");
      },
      async signUp(email, password) {
        const { data, error } = await getSupabase().auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
        return data.session ? null : "Check your inbox to confirm your email, then log in.";
      },
      async signInWithGoogle() {
        const { error } = await getSupabase().auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
      },
      continueOffline() {
        const u: LocalUser = { id: "local-user", email: "you@local.device" };
        localStorage.setItem(LOCAL_KEY, JSON.stringify(u));
        setMode("local");
        setUser(u);
      },
      async signOut() {
        if (cloud) {
          await getSupabase().auth.signOut();
        }
        localStorage.removeItem(LOCAL_KEY);
        setMode(cloud ? "cloud" : "local");
        setUser(null);
      },
    }),
    [ready, mode, cloud, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function readLocal(): LocalUser | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as LocalUser) : null;
  } catch {
    return null;
  }
}

export function useAuth(): AuthContextValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
