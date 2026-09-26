"use client";

import { motion } from "framer-motion";
import { gbp } from "@/lib/format";
import { WAIST_OPTIONS } from "@/lib/sizing";
import { ALPHA_SIZES, COLOUR_SWATCH, COLOURS, CONDITION_LABELS, CONDITIONS } from "@/lib/types";
import { Close } from "../icons";
import { Chip } from "../Chip";
import { EMPTY_FILTERS, PRICE_CAPS, type Filters } from "./filters";

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export function FilterSheet({
  filters,
  setFilters,
  resultCount,
  onClose,
}: {
  filters: Filters;
  setFilters: (f: Filters) => void;
  resultCount: number;
  onClose: () => void;
}) {
  const set = (patch: Partial<Filters>) => setFilters({ ...filters, ...patch });

  return (
    <>
      <motion.div
        className="fixed inset-0 z-[45] bg-ink/20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.aside
        className="fixed top-0 right-0 bottom-0 z-50 flex w-full max-w-[520px] flex-col border-l border-line bg-paper"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "tween", duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        aria-label="Filters"
      >
        <header className="flex h-20 shrink-0 items-center justify-between border-b border-line px-6">
          <h2 className="label text-xl tracking-[0.2em]">Filters</h2>
          <button onClick={onClose} className="flex h-14 w-14 items-center justify-center" aria-label="Close filters">
            <Close size={28} />
          </button>
        </header>

        <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
          <Section title="Shopping for">
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["womens", "Women"],
                  ["mens", "Men"],
                  [null, "Everyone"],
                ] as const
              ).map(([d, label]) => (
                <Chip key={label} active={filters.department === d} onClick={() => set({ department: d })}>
                  {label}
                </Chip>
              ))}
            </div>
          </Section>

          <Section title="Size">
            <div className="grid grid-cols-7 gap-2">
              {ALPHA_SIZES.map((s) => (
                <Chip key={s} active={filters.sizes.includes(s)} onClick={() => set({ sizes: toggle(filters.sizes, s) })}>
                  {s}
                </Chip>
              ))}
            </div>
          </Section>

          <Section title="Waist (inches)">
            <div className="grid grid-cols-5 gap-2">
              {WAIST_OPTIONS.map((w) => (
                <Chip key={w} active={filters.waists.includes(w)} onClick={() => set({ waists: toggle(filters.waists, w) })}>
                  {w}
                </Chip>
              ))}
            </div>
          </Section>

          <Section title="Colour">
            <div className="grid grid-cols-4 gap-2">
              {COLOURS.map((c) => {
                const active = filters.colours.includes(c);
                return (
                  <button
                    key={c}
                    onClick={() => set({ colours: toggle(filters.colours, c) })}
                    aria-pressed={active}
                    className={`label flex h-14 items-center gap-2 border px-3 text-base ${active ? "border-ink bg-ink text-paper" : "border-line bg-card"}`}
                  >
                    <span className="h-5 w-5 shrink-0 rounded-full border border-line/30" style={{ background: COLOUR_SWATCH[c] }} />
                    {c}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title="Price">
            <div className="grid grid-cols-3 gap-2">
              {PRICE_CAPS.map((p) => (
                <Chip
                  key={p}
                  active={filters.maxPricePence === p}
                  onClick={() => set({ maxPricePence: filters.maxPricePence === p ? null : p })}
                >
                  Under {gbp(p).replace(".00", "")}
                </Chip>
              ))}
              <Chip active={filters.maxPricePence === null} onClick={() => set({ maxPricePence: null })}>
                Any price
              </Chip>
            </div>
          </Section>

          <Section title="Condition">
            <div className="grid grid-cols-2 gap-2">
              {CONDITIONS.map((c) => (
                <Chip key={c} active={filters.conditions.includes(c)} onClick={() => set({ conditions: toggle(filters.conditions, c) })}>
                  {CONDITION_LABELS[c]}
                </Chip>
              ))}
            </div>
          </Section>
        </div>

        <footer className="grid shrink-0 grid-cols-[1fr_2fr] border-t border-line">
          <button
            onClick={() => setFilters({ ...EMPTY_FILTERS, category: filters.category, text: filters.text })}
            className="label h-20 border-r border-line text-lg tracking-[0.15em]"
          >
            Clear all
          </button>
          <button onClick={onClose} className="label h-20 bg-ink text-paper text-lg tracking-[0.15em]">
            Show {resultCount} {resultCount === 1 ? "item" : "items"}
          </button>
        </footer>
      </motion.aside>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="label text-muted text-base tracking-[0.18em]">{title}</h3>
      {children}
    </section>
  );
}
