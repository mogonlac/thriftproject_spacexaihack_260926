"use client";

import { useHydrated } from "@/hooks/useHydrated";
import { useKiosk } from "@/lib/store";
import { Bag, Chat, Close, Search } from "../icons";

export function BottomBar({
  search,
  onSearch,
  onChat,
  onCart,
  chatOpen,
  notice,
}: {
  search: string;
  onSearch: (v: string) => void;
  onChat: () => void;
  onCart: () => void;
  chatOpen: boolean;
  notice?: React.ReactNode;
}) {
  const hydrated = useHydrated();
  const count = useKiosk((s) => s.cart.length);
  const shownCount = hydrated ? count : 0;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper">
      {notice}
      <div className="grid h-20 grid-cols-[auto_1fr_auto] items-center gap-4 px-3">
        <button
          onClick={onChat}
          aria-pressed={chatOpen}
          className={`flex h-16 items-center gap-3 px-4 transition-colors ${chatOpen ? "bg-ink text-paper" : ""}`}
          aria-label="Ask our shopping assistant"
        >
          <Chat size={34} />
          <span className="label text-lg tracking-[0.15em]">Ask</span>
        </button>

        <label className="mx-auto flex h-14 w-full max-w-xl items-center gap-3 border-b border-line px-2">
          <Search size={24} />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="SEARCH THE RAILS"
            className="label h-full min-w-0 flex-1 bg-transparent text-lg tracking-[0.12em] outline-none placeholder:text-muted"
            enterKeyHint="search"
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          />
          {search && (
            <button onClick={() => onSearch("")} className="flex h-11 w-11 items-center justify-center" aria-label="Clear search">
              <Close size={20} />
            </button>
          )}
        </label>

        <button onClick={onCart} className="flex h-16 items-center gap-3 px-4" aria-label={`Your receipt, ${shownCount} items`}>
          <span className="label text-lg tracking-[0.15em]">Receipt</span>
          <Bag size={38} count={shownCount} />
        </button>
      </div>
    </nav>
  );
}
