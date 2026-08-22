"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseConfigured, getSupabase } from "@/lib/repo/supabase";

export default function AuthCallback() {
  const router = useRouter();
  const ran = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (!supabaseConfigured()) {
      router.replace("/login");
      return;
    }
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    if (!code) {
      router.replace("/dashboard");
      return;
    }
    getSupabase()
      .auth.exchangeCodeForSession(code)
      .then(({ error }) => {
        if (error) setError(error.message);
        else router.replace("/dashboard");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Auth failed"));
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-center">
      <div>
        {error ? (
          <>
            <h1 className="text-lg font-bold">Sign-in failed</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-bold">Signing you in…</h1>
            <p className="mt-2 text-sm text-muted-foreground">One moment.</p>
          </>
        )}
      </div>
    </div>
  );
}
