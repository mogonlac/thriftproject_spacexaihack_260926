"use client";

import { useState } from "react";
import { isCurrentSize, sizePatch, sizeRows, type SizeChoice } from "@/lib/sizes";
import type { Item } from "@/lib/types";

/**
 * "What size is it?" — shown after each scan so the volunteer can confirm or
 * correct the size with one tap (the AI often can't read a label from the
 * camera). Whatever the AI read is pre-selected. Answering is optional: the
 * station keeps scanning hands-free either way.
 */
export function SizePrompt({ item, onSaved }: { item: Item; onSaved: (item: Item) => void }) {
  const rows = sizeRows(item);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [answered, setAnswered] = useState(false);

  if (rows.length === 0) return null;
  const detected = Boolean(item.size_label || item.size_alpha || item.waist_in);

  async function choose(choice: SizeChoice) {
    const key = `${choice.kind}:${choice.label}`;
    setSaving(key);
    setError("");
    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sizePatch(choice)),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't save the size");
      setAnswered(true);
      onSaved(data.item as Item);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the size");
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className={`size-prompt${answered ? " answered" : ""}`} aria-label="Garment size">
      <div className="size-head">
        <h2>{answered ? "Size saved" : "What size is it?"}</h2>
        <span className="size-hint">
          {answered
            ? "Tap another to change it"
            : detected
              ? "Label read by AI — tap to confirm or change"
              : "Check the label and tap the size"}
        </span>
      </div>
      {rows.map((row) => (
        <div key={row.title} className="size-row">
          <span className="size-row-title">{row.title}</span>
          <div className="size-grid" style={{ gridTemplateColumns: `repeat(${Math.min(row.choices.length, 10)}, minmax(0, 1fr))` }}>
            {row.choices.map((c) => {
              const key = `${c.kind}:${c.label}`;
              const current = isCurrentSize(item, c);
              return (
                <button
                  key={key}
                  className={`size-btn${current ? " current" : ""}`}
                  aria-pressed={current}
                  disabled={saving !== null}
                  onClick={() => choose(c)}
                >
                  {saving === key ? "…" : c.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {error && <p className="size-error">{error}</p>}
    </section>
  );
}
