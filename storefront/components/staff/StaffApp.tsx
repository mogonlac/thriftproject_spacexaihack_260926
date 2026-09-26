"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { gbp, sizeText } from "@/lib/format";
import type { AiLogEntry, Item, Receipt, ReceiptOutcome } from "@/lib/types";
import { Logo } from "@thrift/shared/Logo";

type Tab = "till" | "log" | "stock";
const SCANNER_URL = process.env.NEXT_PUBLIC_SCANNER_URL || "http://localhost:3001";
const PIN_KEY = "thrift-staff-pin";

export function StaffApp({ pinRequired }: { pinRequired: boolean }) {
  // PIN remembered for this browser tab; read after hydration to avoid SSR mismatch.
  const storedPin = useSyncExternalStore(
    () => () => {},
    () => sessionStorage.getItem(PIN_KEY),
    () => null,
  );
  const [pinOverride, setPin] = useState<string | null | undefined>(undefined);
  const pin = pinOverride !== undefined ? pinOverride : storedPin;
  const [tab, setTab] = useState<Tab>("till");
  const locked = pinRequired && !pin;

  const api = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      const res = await fetch(path, {
        ...init,
        headers: { "Content-Type": "application/json", ...(pin ? { "x-staff-pin": pin } : {}), ...init?.headers },
        cache: "no-store",
      });
      if (res.status === 401) {
        sessionStorage.removeItem(PIN_KEY);
        setPin(null);
        throw new Error("Wrong PIN");
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      return data as T;
    },
    [pin],
  );

  if (locked) return <PinGate onPin={(p) => { sessionStorage.setItem(PIN_KEY, p); setPin(p); }} />;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-20 shrink-0 items-center justify-between border-b border-line px-6">
        <div className="flex items-center gap-4">
          <Logo size={36} />
          <span className="label text-muted text-lg tracking-[0.2em]">Staff</span>
        </div>
        <nav className="flex h-full">
          {(
            [
              ["till", "Till"],
              ["log", "Assistant log"],
              ["stock", "Stock"],
            ] as const
          ).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`label border-b-2 px-6 text-lg tracking-[0.15em] ${tab === t ? "border-ink" : "text-muted border-transparent"}`}
            >
              {label}
            </button>
          ))}
          <a href={SCANNER_URL} className="label text-muted flex items-center border-l border-line/20 px-6 text-lg tracking-[0.15em]">
            Intake ↗
          </a>
        </nav>
      </header>
      {tab === "till" && <Till api={api} />}
      {tab === "log" && <AiLog api={api} />}
      {tab === "stock" && <Stock api={api} />}
    </div>
  );
}

type Api = <T>(path: string, init?: RequestInit) => Promise<T>;

function PinGate({ onPin }: { onPin: (p: string) => void }) {
  const [v, setV] = useState("");
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6">
      <Logo size={40} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (v) onPin(v);
        }}
        className="flex gap-2"
      >
        <input
          autoFocus
          type="password"
          inputMode="numeric"
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder="Staff PIN"
          className="label h-16 w-56 border border-line bg-card px-4 text-2xl tracking-[0.3em] outline-none"
        />
        <button className="label h-16 bg-ink px-8 text-lg tracking-[0.15em] text-paper">Open</button>
      </form>
    </main>
  );
}

/* ------------------------------------------------------------------ till */

function Till({ api }: { api: Api }) {
  const [code, setCode] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [recent, setRecent] = useState<Receipt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const loadRecent = useCallback(async () => {
    try {
      setRecent((await api<{ receipts: Receipt[] }>("/api/receipts?limit=30")).receipts);
    } catch {
      /* shown via lookup errors */
    }
  }, [api]);

  useEffect(() => {
    const first = setTimeout(loadRecent, 0);
    const t = setInterval(loadRecent, 8000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [loadRecent]);

  async function lookup(raw: string) {
    const id = raw.trim().toUpperCase();
    if (!id) return;
    setError(null);
    try {
      setReceipt((await api<{ receipt: Receipt }>(`/api/receipts/${encodeURIComponent(id)}`)).receipt);
      setCode("");
    } catch (e) {
      setReceipt(null);
      setError(e instanceof Error && e.message !== "Receipt not found" ? e.message : `No receipt ${id}`);
    }
    input.current?.focus();
  }

  async function mark(itemId: string, outcome: ReceiptOutcome) {
    if (!receipt) return;
    setBusy(itemId);
    try {
      const r = await api<{ receipt: Receipt }>(`/api/receipts/${receipt.id}/items/${itemId}`, {
        method: "POST",
        body: JSON.stringify({ outcome }),
      });
      setReceipt(r.receipt);
      void loadRecent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(null);
    }
  }

  async function sellRemaining() {
    if (!receipt) return;
    for (const l of receipt.lines.filter((l) => l.outcome === "pending")) await mark(l.item_id, "sold");
  }

  const toPay = receipt ? receipt.lines.filter((l) => l.outcome !== "returned").reduce((s, l) => s + l.price_pence, 0) : 0;
  const pending = receipt?.lines.filter((l) => l.outcome === "pending").length ?? 0;

  return (
    <div className="grid flex-1 grid-cols-1 md:grid-cols-[360px_1fr]">
      <aside className="flex flex-col gap-6 border-line p-6 md:border-r">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void lookup(code);
          }}
          className="flex flex-col gap-2"
        >
          <label className="label text-muted text-sm tracking-[0.18em]" htmlFor="code">
            Scan or type receipt code
          </label>
          <div className="flex">
            <input
              id="code"
              ref={input}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="R7K4QX"
              autoCapitalize="characters"
              autoComplete="off"
              className="label h-16 min-w-0 flex-1 border border-line bg-card px-4 text-2xl tracking-[0.25em] uppercase outline-none"
            />
            <button className="label h-16 bg-ink px-6 text-base tracking-[0.15em] text-paper">Find</button>
          </div>
          {error && <p className="text-warn text-base">{error}</p>}
        </form>

        <div className="flex flex-col gap-2">
          <p className="label text-muted text-sm tracking-[0.18em]">Recent receipts</p>
          {recent.length === 0 && <p className="text-muted text-base">None yet today.</p>}
          {recent.map((r) => (
            <button
              key={r.id}
              onClick={() => lookup(r.id)}
              className={`flex h-14 items-center justify-between border px-4 text-left ${receipt?.id === r.id ? "border-ink bg-ink text-paper" : "border-line/20 bg-card"}`}
            >
              <span className="label text-lg tracking-[0.2em]">{r.id}</span>
              <span className="label text-sm">
                {r.lines.length} · {gbp(r.total_pence)} · {r.status === "open" ? "Open" : "Closed"}
              </span>
            </button>
          ))}
        </div>
      </aside>

      <section className="p-6">
        {!receipt ? (
          <div className="text-muted flex h-full items-center justify-center text-lg">Scan a receipt QR code or pick one from the list.</div>
        ) : (
          <div className="mx-auto flex max-w-4xl flex-col gap-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="label text-muted text-sm tracking-[0.18em]">
                  Receipt · {new Date(receipt.created_at).toLocaleString("en-GB")} · {receipt.status}
                </p>
                <h1 className="display text-6xl tracking-[0.08em]">{receipt.id}</h1>
              </div>
              <div className="text-right">
                <p className="label text-muted text-sm tracking-[0.18em]">To pay</p>
                <p className="display text-5xl">{gbp(toPay)}</p>
              </div>
            </div>

            <ul className="divide-y divide-line/15 border-y border-line">
              {receipt.lines.map((l) => (
                <li key={l.item_id} className="flex items-center gap-4 py-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {l.photo ? <img src={l.photo} alt="" className="h-24 w-18 shrink-0 object-cover" /> : <div className="bg-soft h-24 w-18" />}
                  <div className="min-w-0 flex-1">
                    <p className={`label truncate text-lg ${l.outcome === "returned" ? "text-muted line-through" : ""}`}>{l.title}</p>
                    <p className="label text-muted text-sm">
                      {[l.size_label, l.colour].filter(Boolean).join(" · ")} · Rack {l.rack}
                    </p>
                    <p className="label text-base">{gbp(l.price_pence)}</p>
                  </div>
                  <OutcomeButtons outcome={l.outcome} busy={busy === l.item_id} onMark={(o) => mark(l.item_id, o)} />
                </li>
              ))}
            </ul>

            {pending > 0 && (
              <button onClick={sellRemaining} className="label h-18 self-end bg-ink px-10 text-lg tracking-[0.15em] text-paper">
                Mark {pending === receipt.lines.length ? "all" : `remaining ${pending}`} sold
              </button>
            )}
            {pending === 0 && <p className="label text-accent-ink self-end text-lg tracking-[0.15em]">All done — receipt closed</p>}
          </div>
        )}
      </section>
    </div>
  );
}

function OutcomeButtons({ outcome, busy, onMark }: { outcome: ReceiptOutcome; busy: boolean; onMark: (o: ReceiptOutcome) => void }) {
  if (outcome !== "pending") {
    return (
      <div className="flex items-center gap-3">
        <span className={`label px-3 py-2 text-sm tracking-[0.15em] ${outcome === "sold" ? "bg-accent text-white" : "bg-soft"}`}>
          {outcome === "sold" ? "Sold" : "Back on rack"}
        </span>
        <button disabled={busy} onClick={() => onMark("pending")} className="label text-muted h-12 px-2 text-sm underline underline-offset-4">
          Undo
        </button>
      </div>
    );
  }
  return (
    <div className="flex gap-2">
      <button disabled={busy} onClick={() => onMark("sold")} className="label h-14 w-28 bg-ink text-base tracking-[0.12em] text-paper disabled:opacity-40">
        Sold
      </button>
      <button disabled={busy} onClick={() => onMark("returned")} className="label h-14 w-36 border border-line bg-card text-base tracking-[0.12em] disabled:opacity-40">
        Return to rack
      </button>
    </div>
  );
}

/* ------------------------------------------------------------ AI log */

function AiLog({ api }: { api: Api }) {
  const [logs, setLogs] = useState<AiLogEntry[] | null>(null);
  const [items, setItems] = useState<Map<string, Item>>(new Map());

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [l, i] = await Promise.all([api<{ logs: AiLogEntry[] }>("/api/ai-log"), api<{ items: Item[] }>("/api/staff/items")]);
        if (!alive) return;
        setLogs(l.logs);
        setItems(new Map(i.items.map((x) => [x.id, x])));
      } catch {
        if (alive) setLogs([]);
      }
    };
    void load();
    const t = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [api]);

  if (!logs) return <p className="text-muted p-6">Loading…</p>;
  if (logs.length === 0) return <p className="text-muted p-6 text-lg">No assistant conversations yet.</p>;

  const title = (id: string) => items.get(id)?.title ?? id.slice(0, 8);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 p-6">
      <p className="text-muted text-base">
        Every question to the assistant, the searches it ran against live stock, and exactly which items it showed. It can only show items those searches returned.
      </p>
      {logs.map((log) => (
        <article key={log.id} className="space-y-3 border border-line bg-card p-5">
          <header className="flex items-baseline justify-between gap-4">
            <p className="text-lg font-medium">“{log.user_message}”</p>
            <p className="label text-muted shrink-0 text-sm">
              {new Date(log.created_at).toLocaleTimeString("en-GB")} · {(log.latency_ms / 1000).toFixed(1)}s · {log.model}
            </p>
          </header>
          <ol className="space-y-1.5 font-mono text-[13px]">
            {log.tool_calls.map((c, i) => (
              <li key={i} className="flex gap-3">
                <span className={`shrink-0 font-semibold ${c.name === "error" ? "text-warn" : ""}`}>{c.name}</span>
                <span className="text-muted min-w-0 break-words">{JSON.stringify(c.args).replace(/"[0-9a-f]{8}-[0-9a-f-]{27}"/g, (m) => m.slice(-5))}</span>
                {c.result_ids && <span className="shrink-0">→ {c.result_ids.length}</span>}
              </li>
            ))}
          </ol>
          <p className="text-base">
            <span className="label text-muted mr-2 text-sm tracking-[0.15em]">Replied</span>
            {log.reply || "—"}
          </p>
          {log.item_ids.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {log.item_ids.map((id) => (
                <span key={id} className="label border border-line/30 px-2 py-1 text-sm">
                  {title(id)} · Rack {items.get(id)?.rack ?? "?"}
                </span>
              ))}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- stock */

function Stock({ api }: { api: Api }) {
  const [items, setItems] = useState<Item[] | null>(null);
  useEffect(() => {
    api<{ items: Item[] }>("/api/staff/items")
      .then((d) => setItems(d.items))
      .catch(() => setItems([]));
  }, [api]);

  const counts = useMemo(() => {
    const c = { available: 0, on_receipt: 0, sold: 0 };
    items?.forEach((i) => c[i.status]++);
    return c;
  }, [items]);

  if (!items) return <p className="text-muted p-6">Loading…</p>;

  return (
    <div className="space-y-4 p-6">
      <p className="label text-base tracking-[0.12em]">
        {items.length} items · {counts.available} available · {counts.on_receipt} on a receipt · {counts.sold} sold
      </p>
      <table className="w-full border-collapse text-left text-base">
        <thead className="label text-muted text-sm tracking-[0.12em]">
          <tr className="border-b border-line">
            <th className="py-2" />
            <th>Item</th>
            <th>Tag</th>
            <th>Size</th>
            <th>Rack</th>
            <th>Price</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id} className="border-b border-line/10">
              <td className="py-1.5 pr-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {i.photos[0] && <img src={i.photos[0]} alt="" className="h-14 w-11 object-cover" />}
              </td>
              <td>{i.title}</td>
              <td className="text-muted">{i.sku}</td>
              <td>{sizeText(i)}</td>
              <td className="font-semibold">{i.rack}</td>
              <td>{gbp(i.price_pence)}</td>
              <td>
                <span className={`label px-2 py-1 text-xs tracking-[0.12em] ${i.status === "available" ? "bg-accent/15" : i.status === "sold" ? "bg-soft" : "bg-ink text-paper"}`}>
                  {i.status.replace("_", " ")}
                  {i.receipt_id ? ` · ${i.receipt_id}` : ""}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
