"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import type { Item } from "@/lib/types";

const POLL_MS = 10_000;

/**
 * Keeps the shop's item list current: Supabase Realtime when configured
 * (new stock from the scanner appears instantly, items flip to "on a receipt"),
 * otherwise a light poll of /api/items.
 */
export function useLiveItems(initial: Item[]) {
  const [items, setItems] = useState<Item[]>(initial);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/items", { cache: "no-store" });
      if (res.ok) setItems(((await res.json()) as { items: Item[] }).items);
    } catch {
      /* offline blip — keep what we have */
    }
  }, []);

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) {
      const t = setInterval(refresh, POLL_MS);
      return () => clearInterval(t);
    }
    const channel = sb
      .channel("items-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "items" }, (payload) => {
        setItems((prev) => {
          if (payload.eventType === "DELETE") return prev.filter((i) => i.id !== (payload.old as Item).id);
          const row = payload.new as Item;
          const rest = prev.filter((i) => i.id !== row.id);
          if (row.status === "sold") return rest;
          const idx = prev.findIndex((i) => i.id === row.id);
          if (idx === -1) return [row, ...prev];
          const next = [...prev];
          next[idx] = row;
          return next;
        });
      })
      .subscribe();
    return () => {
      void sb.removeChannel(channel);
    };
  }, [refresh]);

  return { items, refresh };
}
