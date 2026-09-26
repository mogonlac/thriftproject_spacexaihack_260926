import QRCode from "qrcode";

/** QR payload is just the receipt code, so any scanner at the till can type it into /staff. */
export function receiptQrDataUrl(receiptId: string): Promise<string> {
  return QRCode.toDataURL(receiptId, { margin: 0, width: 256, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
}
