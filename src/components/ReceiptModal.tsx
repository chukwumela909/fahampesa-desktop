import { Printer } from "lucide-react";
import type { Sale } from "@/data";
import { useAppData } from "@/store/AppData";
import { formatMoney } from "@/lib/format";
import { printHtmlBody, escapeHtml } from "@/lib/print";
import Modal from "@/components/ui/Modal";

interface BusinessInfo {
  name: string;
  phone: string;
  address: string;
  header?: string;
  thankYou?: string;
}

function buildReceiptHtml(sale: Sale, business: BusinessInfo): string {
  const rows = (sale.lines ?? [])
    .map(
      (l) =>
        `<tr><td>${l.quantity}× ${escapeHtml(l.productName)}</td><td style="text-align:right">${formatMoney(l.lineTotal)}</td></tr>`,
    )
    .join("");
  return `
    <div style="font-family:monospace;max-width:300px;margin:0 auto;font-size:12px">
      ${business.header ? `<div style="text-align:center">${escapeHtml(business.header)}</div>` : ""}
      <div style="text-align:center">
        <div style="font-weight:700;font-size:14px">${escapeHtml(business.name)}</div>
        ${business.phone ? `<div>${escapeHtml(business.phone)}</div>` : ""}
        ${business.address ? `<div>${escapeHtml(business.address)}</div>` : ""}
      </div>
      <hr/>
      <div>Receipt: ${escapeHtml(sale.number ?? sale.id)}</div>
      <div>${escapeHtml(sale.time)}</div>
      ${sale.customer ? `<div>Customer: ${escapeHtml(sale.customer)}</div>` : ""}
      <hr/>
      <table style="width:100%;border-collapse:collapse">${rows}</table>
      <hr/>
      ${sale.subtotal != null ? `<div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>${formatMoney(sale.subtotal)}</span></div>` : ""}
      ${sale.tax ? `<div style="display:flex;justify-content:space-between"><span>Tax</span><span>${formatMoney(sale.tax)}</span></div>` : ""}
      ${sale.discount ? `<div style="display:flex;justify-content:space-between"><span>Discount</span><span>-${formatMoney(sale.discount)}</span></div>` : ""}
      <div style="display:flex;justify-content:space-between;font-weight:700;font-size:14px"><span>TOTAL</span><span>${formatMoney(sale.amount)}</span></div>
      <div>Paid: ${escapeHtml(sale.paymentMethod)}</div>
      <hr/>
      <div style="text-align:center">${escapeHtml(business.thankYou || "Thank you for your business!")}</div>
    </div>`;
}

export function printReceipt(sale: Sale, business: BusinessInfo) {
  printHtmlBody(`Receipt ${sale.number ?? sale.id}`, buildReceiptHtml(sale, business), "<style>@page{margin:8mm}body{margin:0}</style>");
}

export default function ReceiptModal({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const { settings } = useAppData();
  const business: BusinessInfo = { name: settings.businessName, phone: settings.businessPhone, address: settings.businessAddress, header: settings.receiptHeader, thankYou: settings.receiptThankYou };

  return (
    <Modal
      title="Receipt"
      description={sale.number ?? sale.id}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="dashboard-action-muted">Skip</button>
          <button onClick={() => printReceipt(sale, business)} className="dashboard-action-primary"><Printer className="mr-1 h-4 w-4" /> Print receipt</button>
        </>
      }
    >
      <div className="rounded-[12px] border border-[#e6ebf2] bg-white p-5 font-mono text-[13px] text-[#0f172a]">
        <div className="text-center">
          <p className="text-[15px] font-bold">{business.name}</p>
          {business.phone && <p className="text-[#64748b]">{business.phone}</p>}
          {business.address && <p className="text-[#64748b]">{business.address}</p>}
        </div>
        <div className="my-3 border-t border-dashed border-[#cbd5e1]" />
        <div className="flex justify-between text-[#64748b]"><span>{sale.number ?? sale.id}</span><span>{sale.time}</span></div>
        {sale.customer && <p className="text-[#64748b]">Customer: {sale.customer}</p>}
        <div className="my-3 border-t border-dashed border-[#cbd5e1]" />
        <div className="space-y-1">
          {(sale.lines ?? []).map((l, i) => (
            <div key={i} className="flex justify-between">
              <span>{l.quantity}× {l.productName}</span>
              <span>{formatMoney(l.lineTotal)}</span>
            </div>
          ))}
        </div>
        <div className="my-3 border-t border-dashed border-[#cbd5e1]" />
        {sale.subtotal != null && <div className="flex justify-between text-[#64748b]"><span>Subtotal</span><span>{formatMoney(sale.subtotal)}</span></div>}
        {sale.tax ? <div className="flex justify-between text-[#64748b]"><span>Tax</span><span>{formatMoney(sale.tax)}</span></div> : null}
        {sale.discount ? <div className="flex justify-between text-[#d92d20]"><span>Discount</span><span>-{formatMoney(sale.discount)}</span></div> : null}
        <div className="mt-1 flex justify-between text-[15px] font-bold"><span>TOTAL</span><span>{formatMoney(sale.amount)}</span></div>
        <p className="mt-1 text-[#64748b]">Paid: {sale.paymentMethod}</p>
        <div className="my-3 border-t border-dashed border-[#cbd5e1]" />
        <p className="text-center text-[#64748b]">{business.thankYou || "Thank you for your business!"}</p>
      </div>
    </Modal>
  );
}
