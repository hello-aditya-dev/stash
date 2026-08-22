"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ScanLine, CameraOff, Keyboard, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/ui/extras";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useData } from "@/lib/data-context";

type Reader = import("@zxing/browser").BrowserMultiFormatReader;
type Controls = { stop: () => void };

export default function ScanPage() {
  const data = useData();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<Reader | null>(null);
  const controlsRef = useRef<Controls | null>(null);
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState("");
  const [lastCode, setLastCode] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      controlsRef.current?.stop();
      controlsRef.current = null;
      readerRef.current = null;
    };
  }, []);

  const handleCode = (code: string) => {
    setLastCode(code);

    if (code.startsWith("stash:item:")) {
      router.push(`/items/${code.slice("stash:item:".length)}`);
      return;
    }
    if (code.startsWith("stash:loc:")) {
      router.push("/locations");
      toast.info("Location label scanned");
      return;
    }

    const match = data.items.find((i) => (i.barcode ?? "").toLowerCase() === code.toLowerCase());
    if (match) {
      toast.success(`Found: ${match.name}`);
      router.push(`/items/${match.id}`);
    } else {
      toast.info(`No item with barcode ${code} — create one?`, {
        action: {
          label: "Create",
          onClick: () => router.push(`/items?new=1&barcode=${encodeURIComponent(code)}`),
        },
        duration: 8000,
      });
    }
  };

  const start = async () => {
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;
      const controls = (await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current!,
        (result) => {
          if (result) {
            const text = result.getText();
            if (text !== lastCode) handleCode(text);
          }
        }
      )) as unknown as Controls;
      controlsRef.current = controls;
      setScanning(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Camera unavailable");
    }
  };

  const stop = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScanning(false);
  };

  const manualLookup = () => {
    if (!manual.trim()) return;
    handleCode(manual.trim());
    setManual("");
  };

  return (
    <>
      <PageHeader title="Scan" subtitle="Point at any barcode or a Stash QR label" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="relative aspect-video w-full bg-slate-900">
            <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
            {!scanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900/95 text-slate-300">
                <ScanLine className="h-9 w-9 opacity-60" />
                <p className="text-sm">Camera is off</p>
                <Button onClick={start}>Start camera</Button>
              </div>
            )}
            {scanning && (
              <>
                <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-red-500/80 shadow-[0_0_12px_rgba(239,68,68,0.9)]" />
                <Button size="sm" variant="secondary" className="absolute right-3 top-3" onClick={stop}>
                  Stop
                </Button>
              </>
            )}
          </div>
          <p className="border-t px-4 py-3 text-xs text-muted-foreground">
            Supports EAN/UPC product barcodes, QR codes and Stash bin labels.
            On the first run your browser will ask for camera permission.
          </p>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Keyboard className="h-4 w-4 text-muted-foreground" /> Type a code instead
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="Barcode / QR payload…"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && manualLookup()}
              />
              <Button variant="outline" onClick={manualLookup}>
                Look up <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </Card>

          <Card className="p-5">
            <p className="mb-3 text-sm font-semibold">Items with barcodes ({data.items.filter((i) => i.barcode).length})</p>
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {data.items
                .filter((i) => i.barcode)
                .slice(0, 20)
                .map((i) => (
                  <Link key={i.id} href={`/items/${i.id}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-secondary">
                    <span className="truncate text-sm">{i.name}</span>
                    <Badge>{i.barcode}</Badge>
                  </Link>
                ))}
              {data.items.filter((i) => i.barcode).length === 0 && (
                <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                  <CameraOff className="h-4 w-4" /> Add barcodes on items to look them up instantly.
                </p>
              )}
            </div>
          </Card>

          {lastCode && (
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Last scanned</p>
              <p className="mt-1 break-all font-mono text-sm font-medium">{lastCode}</p>
            </Card>
          )}
        </div>
      </div>

      {!data.loading && data.items.length === 0 && (
        <EmptyState icon={<ScanLine />} title="Nothing to find yet" description="Add items first — then scanning barcodes jumps straight to them." />
      )}
    </>
  );
}
