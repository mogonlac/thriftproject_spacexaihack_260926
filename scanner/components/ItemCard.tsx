"use client";

import { categoryLabel, COLOUR_SWATCH, gbp, PRICE_SOURCE_LABEL, sizeText } from "@/lib/format";
import { CONDITION_LABELS, type Item } from "@/lib/types";

/** Compact record view used on the scanner success panel and the inventory page. */
export function ItemCard({ item, large = false }: { item: Item; large?: boolean }) {
  const size = sizeText(item);
  const conf = item.ai_confidence?.overall;
  return (
    <article className={`item-card${large ? " large" : ""}`}>
      <div className="item-photo">
        {item.photos[0] ? <img src={item.photos[0]} alt={item.title} /> : <div className="no-photo">No photo</div>}
        <span className={`status-pill status-${item.status}`}>{item.status.replace("_", " ")}</span>
      </div>
      <div className="item-body">
        <h3>{item.title}</h3>
        <div className="item-meta">
          <span>{categoryLabel(item.category)}{item.subcategory ? ` · ${item.subcategory}` : ""}</span>
        </div>
        <dl className="item-facts">
          <div><dt>Size</dt><dd>{size ?? <em>not visible</em>}</dd></div>
          <div>
            <dt>Colour</dt>
            <dd><i className="swatch" style={{ background: COLOUR_SWATCH[item.colour] }} />{item.colour}</dd>
          </div>
          <div>
            <dt>Price</dt>
            <dd>
              {gbp(item.price_pence)}{" "}
              <span className={`badge price-${item.price_source ?? "tag"}`}>
                {PRICE_SOURCE_LABEL[item.price_source ?? "tag"]}
              </span>
            </dd>
          </div>
          <div><dt>Rack</dt><dd className="rack-code">{item.rack}</dd></div>
          <div><dt>Condition</dt><dd>{CONDITION_LABELS[item.condition]}</dd></div>
          {item.brand && <div><dt>Brand</dt><dd>{item.brand}</dd></div>}
        </dl>
        {item.tags.length > 0 && (
          <div className="tags">{item.tags.map((t) => <span key={t}>{t}</span>)}</div>
        )}
        <div className="item-foot">
          {item.needs_review && <span className="badge review">Needs review</span>}
          {item.ai_model && (
            <span className="muted">
              {item.ai_model === "fallback" ? "Fallback analysis" : item.ai_model}
              {conf != null && item.ai_model !== "fallback" ? ` · ${Math.round(conf * 100)}% confident` : ""}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
