"use client";

import { Logo } from "@thrift/shared/Logo";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ItemCard } from "@/components/ItemCard";
import { gbp } from "@/lib/format";
import type { Item } from "@/lib/types";

// Internal check/review screen for the scanner — not the shopper storefront.
export default function InventoryPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "review">("all");
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/items?limit=120", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setItems(data.items);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(load, 4000); // new scans appear automatically
    return () => clearInterval(id);
  }, [load]);

  const patch = async (id: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data.error || "Update failed"); return; }
    setItems((list) => list?.map((i) => (i.id === id ? data.item : i)) ?? null);
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this scan?")) return;
    const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
    if (res.ok) setItems((list) => list?.filter((i) => i.id !== id) ?? null);
  };

  const shown = items?.filter((i) => filter === "all" || i.needs_review) ?? [];
  const reviewCount = items?.filter((i) => i.needs_review).length ?? 0;

  return (
    <div className="inventory">
      <header className="topbar">
        <div className="brand">
          <Logo size={36} />
          <strong>Inventory</strong>
          <span className="muted station">{items ? `${items.length} items` : "loading…"}</span>
        </div>
        <nav className="top-actions">
          <div className="seg">
            <button className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>All</button>
            <button className={filter === "review" ? "on" : ""} onClick={() => setFilter("review")}>
              Needs review {reviewCount > 0 && <b>{reviewCount}</b>}
            </button>
          </div>
          <Link href="/" className="btn primary">← Scanner</Link>
        </nav>
      </header>

      {error && <div className="warning">{error}</div>}
      {items && shown.length === 0 && (
        <div className="empty">{filter === "review" ? "Nothing needs review." : "No items yet — scan a garment."}</div>
      )}

      <div className="inv-grid">
        {shown.map((item) => (
          <div key={item.id} className="inv-cell">
            <ItemCard item={item} showSources />
            <div className="inv-actions">
              {item.needs_review && item.price_source === "ai_suggested" && (
                <button className="btn primary small" onClick={() => patch(item.id, { price_pence: item.price_pence, needs_review: false })}>
                  Confirm {gbp(item.price_pence)}
                </button>
              )}
              {item.needs_review && item.price_source !== "ai_suggested" && (
                <button className="btn primary small" onClick={() => patch(item.id, { needs_review: false })}>Mark reviewed</button>
              )}
              <button className="btn ghost small" onClick={() => setEditing(editing === item.id ? null : item.id)}>Edit</button>
              <button className="btn ghost small danger" onClick={() => remove(item.id)}>Delete</button>
            </div>
            {editing === item.id && (
              <form
                className="edit-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  const price = Number(f.get("price"));
                  await patch(item.id, {
                    title: f.get("title"),
                    size_label: f.get("size_label"),
                    brand: f.get("brand"),
                    rack: f.get("rack"),
                    ...(Number.isFinite(price) && Math.round(price * 100) !== item.price_pence ? { price_pence: Math.round(price * 100) } : {}),
                    needs_review: false,
                  });
                  setEditing(null);
                }}
              >
                <label>Title<input name="title" defaultValue={item.title} required /></label>
                <label>Size<input name="size_label" defaultValue={item.size_label ?? ""} /></label>
                <label>Brand<input name="brand" defaultValue={item.brand ?? ""} /></label>
                <label>Price £<input name="price" type="number" step="0.01" min="0" defaultValue={(item.price_pence / 100).toFixed(2)} /></label>
                <label>Rack<input name="rack" defaultValue={item.rack} required /></label>
                <button className="btn primary small">Save</button>
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
