"use client";

import { AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useHydrated } from "@/hooks/useHydrated";
import { useIdleReset } from "@/hooks/useIdleReset";
import { useLiveItems } from "@/hooks/useLiveItems";
import { searchItems } from "@/lib/search";
import { useKiosk } from "@/lib/store";
import { CATEGORIES, CATEGORY_LABELS, type Item } from "@/lib/types";
import { Close, Filters as FiltersIcon } from "../icons";
import { ChatPanel } from "../chat/ChatPanel";
import { Logo } from "../Logo";
import { CartPanel } from "../receipt/CartPanel";
import { BottomBar } from "./BottomBar";
import { FilterSheet } from "./FilterSheet";
import { EMPTY_FILTERS, filtersFromProfile, sheetFilterCount, toQuery, type Filters } from "./filters";
import { ItemDetail } from "./ItemDetail";
import { ProductCard } from "./ProductCard";

type Panel = "filters" | "cart" | "chat" | null;

export function Shop({ initialItems }: { initialItems: Item[] }) {
  const { items, refresh } = useLiveItems(initialItems);
  const router = useRouter();
  const resetSession = useKiosk((s) => s.resetSession);
  const hydrated = useHydrated();
  const profile = useKiosk((s) => s.profile);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [panel, setPanel] = useState<Panel>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  // Walk-away protection: clear the session and return to the welcome screen.
  const idleSecondsLeft = useIdleReset(() => {
    resetSession();
    router.push("/");
  });

  // Apply the shopper's fit from the welcome screen once the session is restored.
  const appliedProfile = useRef(false);
  useEffect(() => {
    if (hydrated && !appliedProfile.current) {
      appliedProfile.current = true;
      setFilters(filtersFromProfile(profile));
    }
  }, [hydrated, profile]);

  // Category tabs only show categories that have stock under the other filters.
  const withoutCategory = useMemo(() => searchItems(items, toQuery(filters, false)), [items, filters]);
  const visible = useMemo(() => {
    const list = filters.category ? withoutCategory.filter((i) => i.category === filters.category) : withoutCategory;
    // Items someone else has reserved sink to the bottom (stable sort keeps relevance order).
    return [...list].sort((x, y) => Number(x.status !== "available") - Number(y.status !== "available"));
  }, [withoutCategory, filters.category]);
  const categoryCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of withoutCategory) m.set(i.category, (m.get(i.category) ?? 0) + 1);
    return m;
  }, [withoutCategory]);

  const openItem = openId ? items.find((i) => i.id === openId) : null;

  const update = setFilters;
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [filters]);

  const chips: { key: string; label: string; clear: () => void }[] = [
    ...filters.sizes.map((s) => ({ key: `s${s}`, label: `Size ${s}`, clear: () => update({ ...filters, sizes: filters.sizes.filter((x) => x !== s) }) })),
    ...filters.waists.map((w) => ({ key: `w${w}`, label: `Waist ${w}″`, clear: () => update({ ...filters, waists: filters.waists.filter((x) => x !== w) }) })),
    ...filters.colours.map((c) => ({ key: `c${c}`, label: c, clear: () => update({ ...filters, colours: filters.colours.filter((x) => x !== c) }) })),
    ...filters.conditions.map((c) => ({ key: `k${c}`, label: c.replace(/_/g, " "), clear: () => update({ ...filters, conditions: filters.conditions.filter((x) => x !== c) }) })),
    ...(filters.maxPricePence ? [{ key: "p", label: `Under £${filters.maxPricePence / 100}`, clear: () => update({ ...filters, maxPricePence: null }) }] : []),
    ...(filters.text ? [{ key: "t", label: `“${filters.text}”`, clear: () => update({ ...filters, text: "" }) }] : []),
  ];

  return (
    <div className="flex h-dvh flex-col">
      <header className="shrink-0 border-b border-line bg-paper">
        <div className="flex h-20 items-center justify-between gap-6 px-6">
          <Link href="/" aria-label="Start again" className="flex h-16 items-center">
            <Logo size={34} />
          </Link>
          <div className="flex h-full items-stretch">
            {(
              [
                ["womens", "Women"],
                ["mens", "Men"],
                [null, "All"],
              ] as const
            ).map(([d, label]) => (
              <button
                key={label}
                onClick={() => update({ ...filters, department: d, category: null })}
                className={`label px-5 text-lg tracking-[0.18em] ${filters.department === d ? "underline underline-offset-[10px] decoration-2" : "text-muted"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button onClick={() => setPanel("filters")} className="label flex h-16 items-center gap-3 px-3 text-lg tracking-[0.18em]">
            <FiltersIcon />
            Filters{sheetFilterCount(filters) ? ` (${sheetFilterCount(filters)})` : ""}
          </button>
        </div>

        <div className="no-scrollbar flex h-14 items-stretch gap-1 overflow-x-auto px-4">
          <Tab active={!filters.category} onClick={() => update({ ...filters, category: null })}>
            All <sup className="text-muted">{withoutCategory.length}</sup>
          </Tab>
          {CATEGORIES.filter((c) => categoryCounts.get(c)).map((c) => (
            <Tab key={c} active={filters.category === c} onClick={() => update({ ...filters, category: c })}>
              {CATEGORY_LABELS[c]} <sup className="text-muted">{categoryCounts.get(c)}</sup>
            </Tab>
          ))}
        </div>
      </header>

      <div ref={scroller} className="flex-1 overflow-y-auto pb-20">
        <div className="flex min-h-14 flex-wrap items-center gap-2 px-6 py-3">
          <span className="label mr-2 text-base tracking-[0.15em]">
            {visible.length} {visible.length === 1 ? "item" : "items"}
          </span>
          {chips.map((c) => (
            <button key={c.key} onClick={c.clear} className="label flex h-10 items-center gap-2 border border-line bg-card px-3 text-sm tracking-[0.1em]">
              {c.label} <Close size={14} />
            </button>
          ))}
          {chips.length > 1 && (
            <button onClick={() => update({ ...EMPTY_FILTERS, department: filters.department })} className="label text-muted h-10 px-2 text-sm tracking-[0.1em] underline underline-offset-4">
              Clear all
            </button>
          )}
        </div>

        {visible.length > 0 ? (
          <div className="grid grid-cols-2 gap-px border-y border-line bg-line md:grid-cols-4 2xl:grid-cols-5">
            {visible.map((item, i) => (
              <ProductCard key={item.id} item={item} onOpen={setOpenId} priority={i < 8} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6 px-8 py-24 text-center">
            <p className="display text-4xl">Nothing on the rails matches</p>
            <p className="text-muted max-w-md text-lg">Stock changes every day. Try fewer filters, or ask our assistant to hunt for something similar.</p>
            <div className="flex gap-3">
              <button onClick={() => update({ ...EMPTY_FILTERS, department: filters.department })} className="label h-16 border border-line bg-card px-8 text-lg tracking-[0.15em]">
                Clear filters
              </button>
              <button onClick={() => setPanel("chat")} className="label h-16 bg-ink px-8 text-lg tracking-[0.15em] text-paper">
                Ask the assistant
              </button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>{openItem && <ItemDetail key={openItem.id} item={openItem} onClose={() => setOpenId(null)} />}</AnimatePresence>

      <AnimatePresence>
        {panel === "filters" && (
          <FilterSheet filters={filters} setFilters={update} resultCount={visible.length} onClose={() => setPanel(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {panel === "chat" && (
          <ChatPanel
            onClose={() => setPanel(null)}
            onOpenItem={(id) => {
              setPanel(null);
              setOpenId(id);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {panel === "cart" && (
          <CartPanel
            liveItems={items}
            onClose={() => setPanel(null)}
            onPrinted={() => void refresh()}
            onNewSession={() => {
              resetSession();
              router.push("/");
            }}
          />
        )}
      </AnimatePresence>

      <BottomBar
        search={filters.text}
        onSearch={(text) => update({ ...filters, text })}
        chatOpen={panel === "chat"}
        onChat={() => setPanel(panel === "chat" ? null : "chat")}
        onCart={() => setPanel("cart")}
        notice={
          idleSecondsLeft !== null && (
            <div className="label flex h-12 items-center justify-center gap-3 border-b border-line bg-ink text-base tracking-[0.12em] text-paper" role="status">
              Still shopping? Tap anywhere — otherwise we&apos;ll start fresh for the next person in {idleSecondsLeft}s
            </div>
          )
        }
      />
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`label shrink-0 border-b-2 px-4 text-base tracking-[0.14em] whitespace-nowrap ${active ? "border-ink" : "text-muted border-transparent"}`}
    >
      {children}
    </button>
  );
}
