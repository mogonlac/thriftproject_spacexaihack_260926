"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AlphaSize, Item } from "./types";

export interface Profile {
  department: "womens" | "mens" | null;
  size: AlphaSize | null;
  waist: number | null;
  heightCm: number | null;
  weightKg: number | null;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  items?: Item[];
  error?: boolean;
}

interface KioskState {
  sessionId: string;
  profile: Profile;
  cart: Item[];
  chat: ChatMessage[];
  setProfile: (p: Partial<Profile>) => void;
  addToCart: (item: Item) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  pushChat: (m: ChatMessage) => void;
  resetSession: () => void;
}

export const EMPTY_PROFILE: Profile = { department: null, size: null, waist: null, heightCm: null, weightKg: null };

const newSessionId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()));

export const useKiosk = create<KioskState>()(
  persist(
    (set) => ({
      sessionId: newSessionId(),
      profile: EMPTY_PROFILE,
      cart: [],
      chat: [],
      setProfile: (p) => set((s) => ({ profile: { ...s.profile, ...p } })),
      addToCart: (item) => set((s) => (s.cart.some((c) => c.id === item.id) ? s : { cart: [...s.cart, item] })),
      removeFromCart: (id) => set((s) => ({ cart: s.cart.filter((c) => c.id !== id) })),
      clearCart: () => set({ cart: [] }),
      pushChat: (m) => set((s) => ({ chat: [...s.chat, m] })),
      resetSession: () => set({ sessionId: newSessionId(), profile: EMPTY_PROFILE, cart: [], chat: [] }),
    }),
    {
      name: "thrift-kiosk",
      storage: createJSONStorage(() => sessionStorage),
      // Rehydrated manually in <KioskHydrator/> to avoid SSR hydration mismatches.
      skipHydration: true,
    },
  ),
);

export const useInCart = (id: string) => useKiosk((s) => s.cart.some((c) => c.id === id));
