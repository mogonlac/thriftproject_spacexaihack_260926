"use client";

import { useEffect, useState } from "react";
import { gbp } from "@/lib/format";
import { receiptQrDataUrl } from "@/lib/qr";
import {
  lineDetail,
  receiptDate,
  receiptItemCount,
  RECEIPT_STEPS,
  RECEIPT_TITLE,
  RETURNS_NOTE,
  RETURNS_TITLE,
  SHOP_NAME,
  THANKS,
} from "@/lib/receipt";
import type { Receipt } from "@/lib/types";

/**
 * The receipt as it looks on 80mm thermal paper. Width is set by the parent
 * (≈ 300px on screen, 72mm printable when printed).
 */
export function ReceiptPaper({ receipt, className = "" }: { receipt: Receipt; className?: string }) {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    receiptQrDataUrl(receipt.id).then(setQr).catch(() => setQr(null));
  }, [receipt.id]);

  return (
    <div className={`bg-white font-mono text-[12.5px] leading-[1.45] text-black ${className}`}>
      <div className="text-center">
        <p className="text-[17px] font-semibold tracking-[0.12em] uppercase">{SHOP_NAME}</p>
        <p>{RECEIPT_TITLE}</p>
        <p>{receiptDate(receipt.created_at)}</p>
      </div>
      <Rule />
      <ol className="space-y-2.5">
        {receipt.lines.map((l, i) => (
          <li key={l.item_id}>
            <div className="flex justify-between gap-3">
              <span className="font-semibold uppercase">
                {i + 1}. {l.title}
              </span>
              <span className="shrink-0">{gbp(l.price_pence)}</span>
            </div>
            {lineDetail(l) && <div className="pl-4 capitalize">{lineDetail(l)}</div>}
            <div className="pl-4 font-semibold">&gt;&gt; RACK {l.rack}</div>
          </li>
        ))}
      </ol>
      <Rule />
      <div className="flex justify-between">
        <span className="uppercase">{receiptItemCount(receipt)}</span>
      </div>
      <div className="flex justify-between text-[16px] font-semibold">
        <span>TOTAL</span>
        <span>{gbp(receipt.total_pence)}</span>
      </div>
      <Rule />
      <div className="flex flex-col items-center gap-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {qr ? <img src={qr} alt={`QR code ${receipt.id}`} className="h-28 w-28 [image-rendering:pixelated]" /> : <div className="h-28 w-28" />}
        <p className="text-[15px] font-semibold tracking-[0.25em]">{receipt.id}</p>
      </div>
      <Rule />
      <ol className="list-inside list-decimal">
        {RECEIPT_STEPS.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <Rule />
      <p className="font-semibold uppercase">{RETURNS_TITLE}</p>
      <p>{RETURNS_NOTE}</p>
      <Rule />
      <p className="text-center">{THANKS}</p>
    </div>
  );
}

function Rule() {
  return <div className="my-2.5 border-t border-dashed border-black" />;
}
