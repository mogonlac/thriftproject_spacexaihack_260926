"use client";

import type { jsPDF } from "jspdf";
import { gbp } from "./format";
import { receiptQrDataUrl } from "./qr";
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
} from "./receipt";
import type { Receipt } from "./types";

// 80mm roll, ~72mm printable. Height grows with the number of items.
const PAGE_W = 80;
const MARGIN = 4;
const TEXT_W = PAGE_W - MARGIN * 2;
const QR_MM = 30;

function layout(doc: jsPDF, r: Receipt, qr: string): number {
  let y = 8;
  const line = (h: number) => (y += h);
  const text = (s: string, opts: { size?: number; bold?: boolean; align?: "left" | "center" | "right"; x?: number } = {}) => {
    doc.setFont("courier", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.size ?? 9);
    const x = opts.x ?? (opts.align === "center" ? PAGE_W / 2 : opts.align === "right" ? PAGE_W - MARGIN : MARGIN);
    doc.text(s, x, y, { align: opts.align ?? "left" });
  };
  const wrapped = (s: string, opts: { size?: number; bold?: boolean; indent?: number; width?: number } = {}) => {
    doc.setFont("courier", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.size ?? 9);
    const lines: string[] = doc.splitTextToSize(s, (opts.width ?? TEXT_W) - (opts.indent ?? 0));
    lines.forEach((l, i) => {
      if (i > 0) line(3.8);
      doc.text(l, MARGIN + (opts.indent ?? 0), y);
    });
  };
  const rule = () => {
    line(3);
    doc.setLineDashPattern([0.8, 0.8], 0);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    line(5);
  };

  text(SHOP_NAME.toUpperCase(), { size: 13, bold: true, align: "center" });
  line(5);
  text(RECEIPT_TITLE, { align: "center" });
  line(4);
  text(receiptDate(r.created_at), { align: "center" });
  rule();

  r.lines.forEach((l, i) => {
    text(gbp(l.price_pence), { bold: true, align: "right" });
    wrapped(`${i + 1}. ${l.title.toUpperCase()}`, { bold: true, width: TEXT_W - 16 });
    const detail = lineDetail(l);
    if (detail) {
      line(3.8);
      wrapped(detail.replace(/(^|· )([a-z])/g, (_m, a: string, b: string) => a + b.toUpperCase()), { indent: 4 });
    }
    line(3.8);
    text(`>> RACK ${l.rack}`, { bold: true, x: MARGIN + 4 });
    line(5.5);
  });
  y -= 5.5;
  rule();

  text(receiptItemCount(r).toUpperCase());
  line(5);
  text("TOTAL", { size: 12, bold: true });
  text(gbp(r.total_pence), { size: 12, bold: true, align: "right" });
  rule();

  doc.addImage(qr, "PNG", (PAGE_W - QR_MM) / 2, y - 2, QR_MM, QR_MM);
  line(QR_MM + 3);
  text(r.id.split("").join(" "), { size: 12, bold: true, align: "center" });
  rule();

  RECEIPT_STEPS.forEach((s, i) => {
    if (i > 0) line(3.8);
    wrapped(`${i + 1}. ${s}`);
  });
  rule();

  text(RETURNS_TITLE.toUpperCase(), { bold: true });
  line(4);
  wrapped(RETURNS_NOTE);
  rule();
  wrapped(THANKS);
  return y + 8;
}

export async function buildReceiptPdf(receipt: Receipt): Promise<jsPDF> {
  const { jsPDF } = await import("jspdf");
  const qr = await receiptQrDataUrl(receipt.id);
  // Measure on a throwaway tall page, then render on a page cut to length.
  const height = layout(new jsPDF({ unit: "mm", format: [PAGE_W, 1000] }), receipt, qr);
  const doc = new jsPDF({ unit: "mm", format: [PAGE_W, Math.max(height, 120)] });
  layout(doc, receipt, qr);
  doc.setProperties({ title: `Receipt ${receipt.id}`, subject: SHOP_NAME });
  return doc;
}

export async function downloadReceiptPdf(receipt: Receipt) {
  const doc = await buildReceiptPdf(receipt);
  doc.save(`receipt-${receipt.id}.pdf`);
}
