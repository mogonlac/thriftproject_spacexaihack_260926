"use client";

import { categoryLabel, COLOUR_SWATCH, gbp, PRICE_SOURCE_LABEL, sizeText } from "@/lib/format";
import { CONDITION_LABELS, type Item } from "@/lib/types";

const gbpShort = (v: number) => `£${v % 1 ? v.toFixed(2) : v}`;

/** Compact record view used on the scanner success panel and the inventory page. */
export function ItemCard({ item, large = false, showSources = false }: { item: Item; large?: boolean; showSources?: boolean }) {
  const v = item.valuation;
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
        {v?.resale_typical_gbp != null && (
          <div className="market">
            <span className="market-label">Resale market</span>
            <span>
              {v.resale_low_gbp != null && v.resale_high_gbp != null
                ? `${gbpShort(v.resale_low_gbp)}–${gbpShort(v.resale_high_gbp)}`
                : `~${gbpShort(v.resale_typical_gbp)}`}
              {" · typical "}{gbpShort(v.resale_typical_gbp)}
            </span>
            {showSources && v.sources.length > 0 && (
              <details>
                <summary>Evidence</summary>
                <p>{v.summary}</p>
                <ul>
                  {v.sources.map((s) => (
                    <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.title || new URL(s.url).hostname}</a></li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
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
