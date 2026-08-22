"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export default function LoginPage() {
  const auth = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await auth.signIn(email, password);
      router.replace("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md p-8 shadow-pop">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Boxes className="h-6 w-6" />
          </span>
          <h1 className="mt-4 text-lg font-bold">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">Log in to your stash</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required minLength={6} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" loading={busy}>
            Log in
          </Button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
        </div>

        {auth.configured ? (
          <>
            <Button variant="outline" className="w-full" onClick={() => auth.signInWithGoogle().catch((e) => toast.error(e.message))}>
              Continue with Google
            </Button>
            <Button variant="ghost" className="mt-2 w-full text-sm" onClick={() => auth.continueOffline()}>
              Use this device offline
            </Button>
          </>
        ) : (
          <div className="rounded-xl border border-dashed bg-secondary/50 p-4 text-center">
            <p className="text-xs text-muted-foreground">
              Supabase not connected — running in offline mode. Your data lives on this device only.
            </p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => auth.continueOffline()}>
              Continue offline
            </Button>
          </div>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </Card>
    </div>
  );
}
