"use client";

import React, { useMemo, useRef, useState } from "react";
import { Sparkles, SendHorizonal, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/extras";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useData } from "@/lib/data-context";
import { answerQuestion, searchItems } from "@/lib/qa";
import { currentQty, fmtMoney, itemValue } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  text: string;
  matches?: { id: string; name: string; qty: number; location: string }[];
}

const SUGGESTIONS = [
  "What expires in 30 days?",
  "How much is everything worth?",
  "Low stock",
  "Any warranties expiring?",
  "Unpaid invoices",
];

export default function AssistantPage() {
  const data = useData();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const ctx = useMemo(
    () => ({
      items: data.items,
      movements: data.movements,
      batches: data.batches,
      docs: data.docs,
      categories: data.categories,
      locations: data.locations,
      currency: data.settings.currency,
    }),
    [data]
  );

  const qtyOf = (id: string) => {
    const map = new Map<string, number>();
    for (const m of data.movements) map.set(m.itemId, (map.get(m.itemId) ?? 0) + m.delta);
    return map.get(id) ?? 0;
  };

  const toMessage = (q: string): Message => {
    const a = answerQuestion(q, ctx);
    return {
      role: "assistant",
      text: a.text,
      matches: a.matches.slice(0, 6).map((i) => ({
        id: i.id,
        name: i.name,
        qty: qtyOf(i.id),
        location: data.locations.find((l) => l.id === i.locationId)?.name ?? "",
      })),
    };
  };

  const askLocal = (q: string) => setMessages((prev) => [...prev, toMessage(q)]);

  const askAi = async (q: string): Promise<string | null> => {
    const key = data.settings.openAiKey;
    if (!key) return null;
    const compact = {
      items: data.items.map((i) => ({
        name: i.name,
        category: data.categories.find((c) => c.id === i.categoryId)?.name ?? null,
        location: data.locations.find((l) => l.id === i.locationId)?.name ?? null,
        quantity: qtyOf(i.id),
        unit: i.unit,
        value: itemValue(i),
        warrantyExpiry: i.warrantyExpiry,
      })),
      batches: data.batches.filter((b) => b.expDate).map((b) => ({
        item: data.items.find((i) => i.id === b.itemId)?.name,
        batchNo: b.batchNo,
        exp: b.expDate,
        qty: b.qty,
      })),
      currency: data.settings.currency,
    };
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You are Stash's inventory assistant. Answer briefly using ONLY this JSON of the user's personal inventory. If unknown, say so.",
            },
            { role: "user", content: `${JSON.stringify(compact)}\n\nQuestion: ${q}` },
          ],
          max_tokens: 300,
        }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.choices?.[0]?.message?.content ?? null;
    } catch {
      return null;
    }
  };

  const ask = async () => {
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setBusy(true);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 999999 }));
    const ai = await askAi(q);
    if (ai) {
      setMessages((prev) => [...prev, { role: "assistant", text: `✨ ${ai}` }]);
    } else {
      askLocal(q);
    }
    setBusy(false);
    setTimeout(() => scrollRef.current?.scrollTo({ top: 999999 }), 50);
  };

  const totalValue = data.items.reduce((s, i) => s + itemValue(i), 0);

  return (
    <>
      <PageHeader
        title="Assistant"
        subtitle={
          data.settings.openAiKey
            ? "Enhanced with GPT-4o-mini · falls back to instant local search"
            : "Instant answers computed locally on your device"
        }
        actions={<Badge variant={data.settings.openAiKey ? "indigo" : "default"}>{data.settings.openAiKey ? "GPT enhanced" : "Local mode"}</Badge>}
      />

      <div className="mx-auto max-w-3xl">
        <Card className="flex h-[62vh] flex-col overflow-hidden">
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
            {!messages.length && (
              <div className="flex flex-col items-center py-10 text-center">
                <span className="mb-3 rounded-2xl bg-accent p-3.5 text-accent-foreground">
                  <Sparkles className="h-6 w-6" />
                </span>
                <h3 className="text-sm font-semibold">Ask your stash anything</h3>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  You have <b>{data.items.length}</b> items worth{" "}
                  <b>{fmtMoney(totalValue, data.settings.currency)}</b>. Try one of these:
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setInput(s);
                        void ask();
                      }}
                      className="rounded-full border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "border bg-card whitespace-pre-wrap"
                  }`}
                >
                  {m.text}
                  {m.matches && m.matches.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {m.matches.map((x) => (
                        <a
                          key={x.id}
                          href={`/items/${x.id}`}
                          className="flex items-center justify-between gap-3 rounded-lg border bg-slate-50/60 px-3 py-2 text-xs hover:border-primary"
                        >
                          <span className="min-w-0 truncate font-medium">{x.name}</span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">qty {x.qty}{x.location ? ` · ${x.location}` : ""}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {busy && (
              <div className="flex justify-start">
                <div className="rounded-2xl border bg-card px-4 py-3 text-sm text-muted-foreground">Thinking…</div>
              </div>
            )}
          </div>

          <div className="border-t p-3">
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Where is my drill?"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && ask()}
              />
              <Button onClick={ask} disabled={!input.trim() || busy}>
                <SendHorizonal className="h-4 w-4" /> Ask
              </Button>
            </div>
            <p className="mt-2 flex items-center gap-1 text-center text-[10px] text-muted-foreground">
              <Search className="h-3 w-3" /> Local answers run entirely offline — no data leaves your device unless you add an OpenAI key in Settings.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}
