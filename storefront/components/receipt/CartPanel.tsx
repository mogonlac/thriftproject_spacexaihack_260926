"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { gbp, gbpCode, heroPhoto, sizeText } from "@/lib/format";
import { useKiosk } from "@/lib/store";
import type { Item, Receipt } from "@/lib/types";
import { Close } from "../icons";
import { PrintView } from "./PrintView";

type Phase = { kind: "review" } | { kind: "submitting" } | { kind: "printed"; receipt: Receipt };

export function CartPanel({
  liveItems,
  onClose,
  onPrinted,
  onNewSession,
}: {
  /** Current shop items, so we can flag anything another shopper just claimed. */
  liveItems: Item[];
  onClose: () => void;
  onPrinted: () => void;
  onNewSession: () => void;
}) {
  const cart = useKiosk((s) => s.cart);
  const removeFromCart = useKiosk((s) => s.removeFromCart);
  const clearCart = useKiosk((s) => s.clearCart);
  const [phase, setPhase] = useState<Phase>({ kind: "review" });
  const [notice, setNotice] = useState<string | null>(null);

  const live = new Map(liveItems.map((i) => [i.id, i]));
  const isGone = (id: string) => {
    const l = live.get(id);
    return !l || l.status !== "available";
  };
  const ready = cart.filter((i) => !isGone(i.id));
  const total = ready.reduce((s, i) => s + i.price_pence, 0);

  async function print() {
    if (ready.length === 0) return;
    setPhase({ kind: "submitting" });
    setNotice(null);
    try {
      const res = await fetch("/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds: ready.map((i) => i.id) }),
      });
      const data = await res.json();
      if (res.status === 409) {
        const gone = cart.filter((i) => (data.unavailable as string[]).includes(i.id));
        gone.forEach((i) => removeFromCart(i.id));
        setNotice(
          `Sorry — ${gone.map((i) => i.title).join(", ")} ${gone.length === 1 ? "was" : "were"} just taken by another shopper, so we've taken ${gone.length === 1 ? "it" : "them"} off your list.`,
        );
        setPhase({ kind: "review" });
        onPrinted();
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      clearCart();
      setPhase({ kind: "printed", receipt: data.receipt as Receipt });
      onPrinted();
    } catch {
      setNotice("We couldn't print just now. Please try again, or ask a volunteer.");
      setPhase({ kind: "review" });
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col bg-paper"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      role="dialog"
      aria-label="Your receipt"
    >
      {phase.kind === "printed" ? (
        <PrintView receipt={phase.receipt} onKeepBrowsing={onClose} onDone={onNewSession} />
      ) : (
        <>
          <header className="flex h-24 shrink-0 items-center justify-between px-6">
            <button onClick={onClose} className="flex h-16 w-16 items-center justify-center" aria-label="Close receipt">
              <Close size={48} />
            </button>
            <h2 className="label text-xl tracking-[0.2em]">
              Your receipt <span className="text-muted">[{cart.length}]</span>
            </h2>
            <div className="w-16" />
          </header>

          {notice && (
            <div className="border-warn text-warn mx-6 mb-2 border px-5 py-4 text-base" role="status">
              {notice}
            </div>
          )}

          {cart.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
              <p className="display text-5xl">Your receipt is empty</p>
              <p className="text-muted max-w-md text-lg">
                Tap <span className="label border border-line px-2">+</span> on anything you like. We&apos;ll print a list of your picks and which rack each one is on.
              </p>
              <button onClick={onClose} className="label h-16 bg-ink px-10 text-lg tracking-[0.15em] text-paper">
                Keep browsing
              </button>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              <ul className="mx-auto grid max-w-5xl grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
                {cart.map((item) => {
                  const gone = isGone(item.id);
                  const photo = heroPhoto(item);
                  return (
                    <li key={item.id} className="flex flex-col">
                      <div className="relative aspect-[3/4] overflow-hidden bg-card">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {photo && <img src={photo} alt="" className={`h-full w-full object-cover ${gone ? "opacity-30" : ""}`} />}
                        {gone && (
                          <span className="label absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm tracking-[0.15em]">
                            No longer available
                          </span>
                        )}
                      </div>
                      <p className="label mt-3 truncate text-base">{item.title}</p>
                      <p className="label text-muted text-sm">
                        {sizeText(item)} &nbsp;|&nbsp; {item.colour}
                      </p>
                      <p className="label text-sm">{gbpCode(item.price_pence)}</p>
                      <p className="label text-accent-ink mt-1 text-base font-semibold tracking-[0.1em]">Rack {item.rack}</p>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="label mt-1 h-11 self-start text-sm tracking-[0.15em] underline underline-offset-4"
                      >
                        Remove
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {cart.length > 0 && (
            <footer className="grid shrink-0 grid-cols-1 items-end gap-6 border-t border-line px-8 py-6 md:grid-cols-[1fr_auto_auto]">
              <p className="text-muted max-w-md text-base leading-relaxed">
                Printing reserves these for you. Find them on the racks shown, try them on, then pay at the till. Nothing to pay here.
              </p>
              <dl className="label grid grid-cols-[auto_auto] gap-x-10 gap-y-1 text-base">
                <dt className="text-right">
                  {ready.length} {ready.length === 1 ? "item" : "items"}
                </dt>
                <dd className="text-right">{gbpCode(total)}</dd>
                <dt className="text-right text-xl">Total</dt>
                <dd className="text-right text-xl">{gbp(total)}</dd>
              </dl>
              <button
                onClick={print}
                disabled={phase.kind === "submitting" || ready.length === 0}
                className="label h-20 min-w-72 bg-ink px-10 text-xl tracking-[0.18em] text-paper disabled:opacity-50"
              >
                {phase.kind === "submitting" ? "Printing…" : "Print receipt"}
              </button>
            </footer>
          )}
        </>
      )}
    </motion.div>
  );
}
