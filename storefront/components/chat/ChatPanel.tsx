"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { gbpCode, heroPhoto, sizeText } from "@/lib/format";
import { useInCart, useKiosk, type ChatMessage } from "@/lib/store";
import type { Item } from "@/lib/types";
import { Check, Close, Plus, Send } from "../icons";

const EXAMPLES = ["A warm coat under £20", "Something for a wedding", "Jeans with a 32 waist"];

export function ChatPanel({ onClose, onOpenItem }: { onClose: () => void; onOpenItem: (id: string) => void }) {
  const chat = useKiosk((s) => s.chat);
  const pushChat = useKiosk((s) => s.pushChat);
  const profile = useKiosk((s) => s.profile);
  const sessionId = useKiosk((s) => s.sessionId);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [chat.length, busy]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", text: q };
    pushChat(userMsg);
    setDraft("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          profile: { department: profile.department, size: profile.size, waist: profile.waist },
          messages: [...chat, userMsg].filter((m) => !m.error).map((m) => ({ role: m.role, text: m.text })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 503) {
        pushChat({ id: crypto.randomUUID(), role: "assistant", error: true, text: "The assistant isn't switched on yet — but you can search and filter using the bar below." });
      } else if (!res.ok) {
        pushChat({ id: crypto.randomUUID(), role: "assistant", error: true, text: "Sorry, I couldn't search just now. Please try again in a moment." });
      } else {
        pushChat({ id: crypto.randomUUID(), role: "assistant", text: data.reply, items: data.items as Item[] });
      }
    } catch {
      pushChat({ id: crypto.randomUUID(), role: "assistant", error: true, text: "Sorry, I couldn't connect. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.section
      className="fixed bottom-[5.75rem] left-3 z-40 flex h-[min(680px,calc(100dvh-7.5rem))] w-[min(460px,calc(100vw-1.5rem))] flex-col border border-line bg-paper shadow-[0_12px_40px_rgba(0,0,0,0.12)]"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      aria-label="Shopping assistant"
    >
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-line pl-5">
        <h2 className="label text-lg tracking-[0.18em]">Ask the assistant</h2>
        <button onClick={onClose} className="flex h-16 w-16 items-center justify-center" aria-label="Close assistant">
          <Close size={24} />
        </button>
      </header>

      <div ref={listRef} className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
        {chat.length === 0 && (
          <div className="space-y-4">
            <p className="text-base leading-relaxed">
              Tell me what you&apos;re after and I&apos;ll look through what&apos;s on the rails today.
            </p>
            <div className="flex flex-col items-start gap-2">
              {EXAMPLES.map((e) => (
                <button key={e} onClick={() => send(e)} className="h-12 border border-line bg-card px-4 text-left text-base">
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}

        {chat.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <p className="max-w-[85%] bg-ink px-4 py-3 text-base text-paper">{m.text}</p>
            </div>
          ) : (
            <div key={m.id} className="space-y-3">
              <p className={`max-w-[95%] text-base leading-relaxed ${m.error ? "text-muted" : ""}`}>{m.text}</p>
              {m.items && m.items.length > 0 && <Carousel items={m.items} onOpen={onOpenItem} />}
            </div>
          ),
        )}

        {busy && (
          <p className="text-muted flex items-center gap-2 text-base" role="status">
            Looking through the rails
            <span className="inline-flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-muted"
                  animate={{ opacity: [0.2, 1, 0.2] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </span>
          </p>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
          inputRef.current?.blur();
        }}
        className="flex h-18 shrink-0 items-center gap-2 border-t border-line pl-5"
      >
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="e.g. a cosy jumper in green"
          className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
          enterKeyHint="send"
          maxLength={300}
          aria-label="Your question"
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="flex h-18 w-18 items-center justify-center bg-ink text-paper disabled:opacity-30"
          aria-label="Send"
        >
          <Send size={26} />
        </button>
      </form>
    </motion.section>
  );
}

function Carousel({ items, onOpen }: { items: Item[]; onOpen: (id: string) => void }) {
  return (
    <div className="no-scrollbar -mx-5 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-1">
      {items.map((item) => (
        <CarouselCard key={item.id} item={item} onOpen={onOpen} />
      ))}
    </div>
  );
}

function CarouselCard({ item, onOpen }: { item: Item; onOpen: (id: string) => void }) {
  const inCart = useInCart(item.id);
  const addToCart = useKiosk((s) => s.addToCart);
  const removeFromCart = useKiosk((s) => s.removeFromCart);
  const photo = heroPhoto(item);
  return (
    <div className="flex w-44 shrink-0 snap-start flex-col border border-line bg-card">
      <button onClick={() => onOpen(item.id)} className="aspect-[3/4] w-full overflow-hidden" aria-label={`View ${item.title}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {photo && <img src={photo} alt="" className="h-full w-full object-cover" />}
      </button>
      <div className="space-y-0.5 px-2.5 pt-2 pb-2">
        <p className="label truncate text-[14px]">{item.title}</p>
        <p className="label text-muted flex justify-between text-[13px]">
          <span>{gbpCode(item.price_pence)}</span>
          <span>{sizeText(item)}</span>
        </p>
        <p className="label text-accent-ink text-[13px] font-semibold">Rack {item.rack}</p>
      </div>
      <button
        onClick={() => (inCart ? removeFromCart(item.id) : addToCart(item))}
        aria-pressed={inCart}
        className={`label flex h-12 items-center justify-center gap-2 border-t border-line text-sm tracking-[0.12em] ${
          inCart ? "bg-ink text-paper" : ""
        }`}
      >
        {inCart ? (
          <>
            <Check size={16} /> Added
          </>
        ) : (
          <>
            <Plus size={16} /> Add
          </>
        )}
      </button>
    </div>
  );
}
