"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Boxes, ScanLine, BellRing, BarChart3, WifiOff, QrCode, Sparkles,
  ShieldCheck, ArrowRight, PackageSearch, FileText, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { Spinner } from "@/components/ui/extras";

const features = [
  { icon: ScanLine, title: "Add in seconds", text: "Snap a photo or scan a barcode — the item is saved before you finish blinking." },
  { icon: MapPinIcon, title: "Know where everything is", text: "Hierarchical locations from Home → Kitchen → Pantry Shelf. Never dig through drawers again." },
  { icon: BellRing, title: "Never miss an expiry", text: "Batches, warranties and low stock — Stash reminds you before things go bad." },
  { icon: BarChart3, title: "Valuation & reports", text: "What is everything worth? Stock summaries by room, category and expiry — exportable." },
  { icon: WifiOff, title: "Works offline", text: "Garage, basement, spotty Wi-Fi. Full offline support with installable PWA." },
  { icon: QrCode, title: "QR labels", text: "Print labels for bins and boxes. Scan to see exactly what's inside." },
];

function MapPinIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export default function Landing() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (auth.ready && auth.user) router.replace("/dashboard");
  }, [auth.ready, auth.user, router]);

  if (!auth.ready) return <Spinner full />;

  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Boxes className="h-5 w-5" />
          </span>
          <span className="text-lg font-bold tracking-tight">Stash</span>
        </div>
        <nav className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => (window.location.href = "/login")}>
            Log in
          </Button>
          <Button size="sm" onClick={() => (window.location.href = "/signup")}>
            Get started free
          </Button>
        </nav>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(79,70,229,0.08),transparent)]" />
          <div className="mx-auto max-w-6xl px-5 pb-20 pt-16 text-center sm:pt-24">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
              <Sparkles className="h-3.5 w-3.5" /> Offline-first · PWA · Your data stays yours
            </span>
            <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
              Every thing you own,{" "}
              <span className="bg-gradient-to-r from-indigo-600 to-violet-500 bg-clip-text text-transparent">
                in your pocket.
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
              Catalog your home in minutes — snap, tag, done. Know what you have, where it is,
              what it&apos;s worth, and what needs attention before it expires.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button size="lg" onClick={() => (window.location.href = auth.configured ? "/signup" : "/login")}>
                Start cataloging free <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="lg" onClick={() => (window.location.href = "/login")}>
                Try offline demo
              </Button>
            </div>
            <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" /> No credit card. Works without an account.
            </p>

            <div className="mx-auto mt-14 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                ["5 sec", "to add an item"],
                ["0", "training videos needed"],
                ["100%", "offline capable"],
              ].map(([big, small]) => (
                <Card key={small} className="px-6 py-5">
                  <p className="text-3xl font-extrabold tracking-tight text-primary">{big}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{small}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t bg-slate-50/60 py-20">
          <div className="mx-auto max-w-6xl px-5">
            <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
              Inventory so simple, it feels like magic
            </h2>
            <p className="mx-auto mt-2 max-w-md text-center text-sm text-muted-foreground">
              Everything you need to run your home like a pro — nothing you don&apos;t.
            </p>
            <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <Card key={f.title} className="group p-6 transition-all hover:-translate-y-0.5 hover:shadow-pop">
                  <span className="mb-4 inline-flex rounded-xl bg-accent p-2.5 text-accent-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <f.icon className="h-5 w-5" />
                  </span>
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="mx-auto max-w-6xl px-5">
            <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
              <div>
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Built for homes, not warehouses</h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Business inventory tools drown households in jargon. Stash speaks human:
                  rooms instead of warehouses, warranties instead of ledgers, insurance-ready
                  exports instead of GST filings.
                </p>
                <ul className="mt-6 space-y-3 text-sm">
                  {([
                    [PackageSearch, "Powerful search across names, tags, barcodes and locations"],
                    [FileText, "Invoices & quotations when you flip a few things"],
                    [Users, "Household sharing so everyone knows where things live"],
                    [ShieldCheck, "One-click insurance claim package with photos & values"],
                  ] as [React.ComponentType<{ className?: string }>, string][]).map(([Icon, text]) => (
                    <li key={text} className="flex items-start gap-3">
                      <span className="mt-0.5 rounded-lg bg-emerald-50 p-1.5 text-emerald-600 ring-1 ring-emerald-200">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="text-foreground/80">{text}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Card className="overflow-hidden p-0 shadow-pop">
                <div className="flex items-center gap-1.5 border-b px-4 py-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  <span className="ml-2 text-xs text-muted-foreground">stash.app/dashboard</span>
                </div>
                <div className="space-y-3 p-5">
                  {[
                    ["MacBook Air M2", "Living Room › TV Unit", "₹92,000"],
                    ["Basmati Rice 5kg", "Kitchen › Pantry Shelf", "Low stock"],
                    ["Sony WH-1000XM5", "Living Room", "Warranty 165d"],
                  ].map(([name, loc, tag]) => (
                    <div key={name} className="flex items-center gap-3 rounded-xl border p-3.5">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                        <Boxes className="h-5 w-5 text-muted-foreground" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{name}</p>
                        <p className="truncate text-xs text-muted-foreground">{loc}</p>
                      </div>
                      <span
                        className={
                          tag === "Low stock"
                            ? "rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200"
                            : "rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200"
                        }
                      >
                        {tag}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </section>

        <section className="border-t bg-slate-900 py-20 text-white">
          <div className="mx-auto max-w-3xl px-5 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Don&apos;t wait. Take the first step.
            </h2>
            <p className="mt-3 text-sm text-slate-300">
              Start with one shelf tonight. Future-you will wonder how you ever managed without it.
            </p>
            <div className="mt-8">
              <Link href="/signup">
                <Button size="lg" className="bg-white text-slate-900 hover:bg-slate-200">
                  Create your free stash <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Stash · Personal inventory that respects your privacy
      </footer>
    </div>
  );
}
