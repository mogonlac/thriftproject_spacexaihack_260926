"use client";

import { gbpCode, heroPhoto, sizeText } from "@/lib/format";
import { useInCart, useKiosk } from "@/lib/store";
import type { Item } from "@/lib/types";
import { Check, Plus } from "../icons";

export function ProductCard({ item, onOpen, priority }: { item: Item; onOpen: (id: string) => void; priority?: boolean }) {
  const inCart = useInCart(item.id);
  const addToCart = useKiosk((s) => s.addToCart);
  const removeFromCart = useKiosk((s) => s.removeFromCart);
  const taken = item.status !== "available" && !inCart;
  const photo = heroPhoto(item);

  return (
    <article className="group relative flex flex-col bg-card">
      <button onClick={() => onOpen(item.id)} className="relative block aspect-[3/4] w-full overflow-hidden" aria-label={item.title}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt=""
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
            className={`h-full w-full object-cover transition-opacity ${taken ? "opacity-35" : ""}`}
          />
        ) : (
          <div className="bg-soft h-full w-full" />
        )}
        {taken && (
          <span className="label absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-base tracking-[0.2em]">
            On a receipt
          </span>
        )}
      </button>

      {!taken && (
        <button
          onClick={() => (inCart ? removeFromCart(item.id) : addToCart(item))}
          aria-label={inCart ? `Remove ${item.title} from receipt` : `Add ${item.title} to receipt`}
          aria-pressed={inCart}
          className={`absolute right-3 bottom-[4.75rem] flex h-12 w-12 items-center justify-center border transition-colors ${
            inCart ? "border-ink bg-ink text-paper" : "border-line/20 bg-card/90 backdrop-blur"
          }`}
        >
          {inCart ? <Check size={22} /> : <Plus size={22} />}
        </button>
      )}

      <button onClick={() => onOpen(item.id)} className="flex h-[4.25rem] flex-col justify-center gap-1 px-3 text-left">
        <span className="label truncate text-[15px] leading-tight">{item.title}</span>
        <span className="label text-muted flex justify-between text-[14px] leading-tight">
          <span>{gbpCode(item.price_pence)}</span>
          <span>{sizeText(item)}</span>
        </span>
      </button>
    </article>
  );
}
