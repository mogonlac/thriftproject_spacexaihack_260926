"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { gbp } from "@/lib/format";
import { downloadReceiptPdf } from "@/lib/receiptPdf";
import type { Receipt } from "@/lib/types";
import { ReceiptPaper } from "./ReceiptPaper";

/**
 * "Printing" moment: the receipt feeds out of a printer slot line by line,
 * then the PDF is produced (stand-in for the thermal printer for now).
 */
export function PrintView({ receipt, onKeepBrowsing, onDone }: { receipt: Receipt; onKeepBrowsing: () => void; onDone: () => void }) {
  const [printed, setPrinted] = useState(false);
  const downloaded = useRef(false);
  const duration = Math.min(5.5, 2.4 + receipt.lines.length * 0.45);

  // Printer-ish feed: the paper reveals top-down in short bursts.
  const steps = 14;
  const keyframes = Array.from({ length: steps + 1 }, (_, i) => `inset(0 0 ${100 - (100 * i) / steps}% 0)`);
  const times = keyframes.map((_, i) => Math.min(1, (i / steps) ** 0.92));

  useEffect(() => {
    if (printed && !downloaded.current) {
      downloaded.current = true;
      void downloadReceiptPdf(receipt);
    }
  }, [printed, receipt]);

  return (
    <div className="grid h-full grid-cols-1 overflow-y-auto md:grid-cols-[1fr_1fr]">
      <div className="flex flex-col items-center px-6 pt-10 pb-16">
        {/* printer */}
        <div className="relative z-10 flex h-16 w-[400px] max-w-full items-end justify-center rounded-t-2xl bg-ink shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
          <span className="absolute top-4 left-5 h-2 w-2 rounded-full bg-accent" aria-hidden />
          <div className="mb-3 h-1.5 w-[340px] rounded-full bg-black" />
        </div>
        <div className="-mt-4 w-[330px] pt-1">
          <motion.div
            initial={{ clipPath: keyframes[0] }}
            animate={{ clipPath: keyframes }}
            transition={{ duration, times, ease: "linear" }}
            onAnimationComplete={() => setPrinted(true)}
            className="receipt-edge bg-white px-5 pt-6 pb-8 shadow-[0_6px_18px_rgba(0,0,0,0.12)]"
          >
            <ReceiptPaper receipt={receipt} />
          </motion.div>
        </div>
      </div>

      <div className="flex flex-col justify-center gap-8 border-line px-10 py-12 md:border-l">
        <div>
          <p className="label text-muted text-lg tracking-[0.2em]">{printed ? "Printed" : "Printing…"}</p>
          <h2 className="display mt-2 text-6xl">{printed ? "Take your receipt" : "Your receipt is on its way"}</h2>
        </div>
        <ol className="space-y-4 text-xl">
          <li className="flex gap-4">
            <span className="label w-8 shrink-0 text-2xl">1</span>
            <span>
              Find your <b>{receipt.lines.length}</b> {receipt.lines.length === 1 ? "item" : "items"} — each one lists its <b>rack</b>.
            </span>
          </li>
          <li className="flex gap-4">
            <span className="label w-8 shrink-0 text-2xl">2</span>
            <span>Try them on in the fitting room.</span>
          </li>
          <li className="flex gap-4">
            <span className="label w-8 shrink-0 text-2xl">3</span>
            <span>
              Pay at the till: <b>{gbp(receipt.total_pence)}</b> for everything you keep.
            </span>
          </li>
        </ol>
        <p className="text-muted text-lg">Changed your mind about something? Hang it on the returns rail by the fitting rooms.</p>

        <div className="flex flex-col gap-3">
          <button onClick={onDone} className="label h-20 bg-ink text-xl tracking-[0.18em] text-paper">
            Done — finish
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={onKeepBrowsing} className="label h-16 border border-line bg-card text-base tracking-[0.15em]">
              Keep browsing
            </button>
            <button
              onClick={() => void downloadReceiptPdf(receipt)}
              className="label h-16 border border-line bg-card text-base tracking-[0.15em]"
            >
              Save PDF again
            </button>
          </div>
          <a
            href={`/receipt/${receipt.id}?print=1`}
            target="_blank"
            rel="noreferrer"
            className="label text-muted h-11 self-center text-sm tracking-[0.15em] underline underline-offset-4"
          >
            Receipt printer view
          </a>
        </div>
      </div>
    </div>
  );
}
