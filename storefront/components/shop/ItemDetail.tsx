"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { gbpCode, metaLine } from "@/lib/format";
import { useInCart, useKiosk } from "@/lib/store";
import { CATEGORY_LABELS, CONDITION_LABELS, type Item } from "@/lib/types";
import { ArrowLeft, Check, Pin } from "../icons";

export function ItemDetail({ item, onClose }: { item: Item; onClose: () => void }) {
  const inCart = useInCart(item.id);
  const addToCart = useKiosk((s) => s.addToCart);
  const removeFromCart = useKiosk((s) => s.removeFromCart);
  const [photoIdx, setPhotoIdx] = useState(0);
  const taken = item.status !== "available" && !inCart;

  return (
    <motion.div
      className="fixed inset-x-0 top-0 bottom-20 z-30 overflow-y-auto bg-paper"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      role="dialog"
      aria-label={item.title}
    >
      <button onClick={onClose} className="fixed top-5 left-5 z-10 flex h-16 w-16 items-center justify-center" aria-label="Back to shop">
        <ArrowLeft size={44} />
      </button>

      <div className="mx-auto grid min-h-full max-w-6xl grid-cols-1 gap-10 px-8 pt-6 pb-10 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:pl-28">
        <div className="flex flex-col gap-3">
          <div className="aspect-[3/4] w-full overflow-hidden bg-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.photos[photoIdx] ?? item.photos[0]} alt={item.title} className="h-full w-full object-cover" />
          </div>
          {item.photos.length > 1 && (
            <div className="flex gap-2">
              {item.photos.map((p, i) => (
                <button
                  key={p}
                  onClick={() => setPhotoIdx(i)}
                  className={`h-24 w-18 overflow-hidden border ${i === photoIdx ? "border-ink" : "border-transparent"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6 md:pt-20">
          <div>
            <h1 className="label text-3xl leading-tight font-semibold">{item.title}</h1>
            <p className="label mt-3 text-xl">{gbpCode(item.price_pence)}</p>
          </div>

          <div className="border-t border-line pt-4">
            <p className="label text-lg tracking-[0.06em]">{metaLine(item)}</p>
          </div>

          <div className="flex items-center gap-4 border border-line bg-card px-5 py-4">
            <Pin size={28} className="text-accent-ink shrink-0" />
            <div className="flex-1">
              <p className="label text-muted text-sm tracking-[0.18em]">Find it on</p>
              <p className="display text-4xl">Rack {item.rack}</p>
            </div>
          </div>

          {taken ? (
            <div className="label flex h-18 items-center justify-center border border-line/30 text-muted text-lg tracking-[0.15em]">
              Someone has this on their receipt
            </div>
          ) : (
            <button
              onClick={() => (inCart ? removeFromCart(item.id) : addToCart(item))}
              className={`label flex h-18 items-center justify-center gap-3 border text-lg tracking-[0.18em] transition-colors ${
                inCart ? "border-ink bg-ink text-paper" : "border-line bg-card active:bg-ink active:text-paper"
              }`}
            >
              {inCart ? (
                <>
                  <Check size={22} /> On your receipt — tap to remove
                </>
              ) : (
                "Add to receipt"
              )}
            </button>
          )}

          {item.description && <p className="text-base leading-relaxed">{item.description}</p>}

          <dl className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-2 text-base">
            <Row k="Category" v={CATEGORY_LABELS[item.category]} />
            {item.brand && <Row k="Brand" v={item.brand} />}
            {item.material && <Row k="Material" v={item.material} />}
            <Row k="Condition" v={CONDITION_LABELS[item.condition]} />
            {item.waist_in && <Row k="Waist" v={`${item.waist_in}″`} />}
            {item.sku && <Row k="Tag" v={item.sku} />}
          </dl>

          <p className="text-muted text-sm leading-relaxed">
            One of a kind — once it&apos;s gone, it&apos;s gone. Every purchase supports Oxfam&apos;s work.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="label text-muted tracking-[0.12em]">{k}</dt>
      <dd>{v}</dd>
    </>
  );
}
