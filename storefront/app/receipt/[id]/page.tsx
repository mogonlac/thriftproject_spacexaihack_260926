import { notFound } from "next/navigation";
import { AutoPrint } from "@/components/receipt/AutoPrint";
import { ReceiptPaper } from "@/components/receipt/ReceiptPaper";
import { normaliseReceiptId, repo } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * Printable receipt for an 80mm thermal printer (AirPrint / Star / Epson via the
 * browser print dialog). `?print=1` opens the print dialog automatically.
 */
export default async function ReceiptPage(props: PageProps<"/receipt/[id]">) {
  const { id } = await props.params;
  const { print } = await props.searchParams;
  const receipt = await repo.getReceipt(normaliseReceiptId(id));
  if (!receipt) notFound();

  return (
    <main className="flex min-h-dvh justify-center bg-soft py-10 print:block print:bg-white print:py-0">
      <style>{`@page { size: 80mm auto; margin: 0 } @media print { html, body { background: #fff } }`}</style>
      <div className="w-[80mm] bg-white px-[4mm] py-[6mm] shadow print:shadow-none">
        <ReceiptPaper receipt={receipt} />
      </div>
      {print === "1" && <AutoPrint />}
    </main>
  );
}
