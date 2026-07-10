import { useMemo, useState } from "react";
import { MagnifyingGlassIcon, ArrowLeftIcon, EyeIcon, PrinterIcon, ArrowUturnLeftIcon, TrashIcon } from "@heroicons/react/24/outline";
import type { Sale } from "@/data";
import { useAppData } from "@/store/AppData";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { currency, formatMoney, sum } from "@/lib/format";
import Modal, { Field, TextInput } from "@/components/ui/Modal";
import { printReceipt } from "@/components/ReceiptModal";

type DateRange = "all" | "today" | "yesterday" | "7d" | "30d";
const DATE_LABELS: Record<DateRange, string> = { all: "All Time", today: "Today", yesterday: "Yesterday", "7d": "Last 7 Days", "30d": "Last 30 Days" };
const PAGE_SIZE = 10;

function inRange(sale: Sale, range: DateRange): boolean {
  if (range === "all") return true;
  const ts = sale.createdAtMs;
  if (!ts) return range === "today" || range === "7d" || range === "30d"; // local just-now sales
  const now = Date.now();
  const day = 86400000;
  if (range === "today") return now - ts < day;
  if (range === "yesterday") return now - ts >= day && now - ts < 2 * day;
  if (range === "7d") return now - ts < 7 * day;
  if (range === "30d") return now - ts < 30 * day;
  return true;
}

export default function SalesHistoryScreen({ branchId, onBack }: { branchId: string; onBack: () => void }) {
  const { sales, settings } = useAppData();
  const branchSales = useMemo(() => sales.filter((s) => branchId === "all" || s.branchId === branchId), [sales, branchId]);

  const [search, setSearch] = useState("");
  const [range, setRange] = useState<DateRange>("all");
  const [payment, setPayment] = useState("all");
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<Sale | null>(null);

  const paymentOptions = useMemo(() => ["all", ...Array.from(new Set(branchSales.map((s) => s.paymentMethod)))], [branchSales]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return branchSales.filter((s) => {
      if (!inRange(s, range)) return false;
      if (payment !== "all" && s.paymentMethod !== payment) return false;
      if (!q) return true;
      return (s.number ?? s.id).toLowerCase().includes(q) || s.customer.toLowerCase().includes(q) || (s.lines ?? []).some((l) => l.productName.toLowerCase().includes(q));
    });
  }, [branchSales, search, range, payment]);

  const totalSales = sum(filtered.filter((s) => !s.refunded).map((s) => s.amount));
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="space-y-6" style={{ fontFamily: "var(--font-dm-sans)" }}>
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="grid h-9 w-9 place-items-center rounded-[10px] border border-[#e6ebf2] text-[#334155] hover:bg-[#f8fafc]"><ArrowLeftIcon className="h-5 w-5" /></button>
        <div><h2 className="dashboard-section-title">Sales history</h2><p className="text-sm text-[#64748b]">Completed sales for this branch</p></div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total sales" value={currency(totalSales)} />
        <StatCard label="Transactions" value={String(filtered.length)} />
        <StatCard label="Refunded" value={String(filtered.filter((s) => s.refunded).length)} />
      </div>

      <div className="dashboard-panel p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#94a3b8]" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Search by receipt, customer, or product" className="dashboard-field w-full py-2 pl-10 pr-3 text-sm" />
          </div>
          <select value={range} onChange={(e) => { setRange(e.target.value as DateRange); setPage(0); }} className="dashboard-field px-3 py-2 text-sm">
            {(Object.keys(DATE_LABELS) as DateRange[]).map((r) => <option key={r} value={r}>{DATE_LABELS[r]}</option>)}
          </select>
          <select value={payment} onChange={(e) => { setPayment(e.target.value); setPage(0); }} className="dashboard-field px-3 py-2 text-sm">
            {paymentOptions.map((p) => <option key={p} value={p}>{p === "all" ? "All payments" : p}</option>)}
          </select>
        </div>

        {pageItems.length === 0 ? (
          <div className="dashboard-empty-state py-10 text-sm text-[#64748b]">No sales match these filters.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {pageItems.map((sale) => (
              <div key={sale.id} className="dashboard-list-item flex items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-[#0f172a]">
                    {sale.number ?? sale.id} · {sale.customer}
                    {sale.refunded && <span className="ml-2 rounded bg-[#fef2f2] px-1.5 py-0.5 text-[10px] font-semibold text-[#dc2626]">REFUNDED</span>}
                  </p>
                  <p className="truncate text-sm text-[#64748b]">{sale.time} · {sale.items} item{sale.items === 1 ? "" : "s"} · {sale.paymentMethod}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-[#0f172a]">{currency(sale.amount)}</p>
                  <span className={`text-xs font-semibold ${sale.status === "synced" ? "text-[#16a34a]" : "text-[#f59e0b]"}`}>{sale.status}</span>
                </div>
                <button onClick={() => setDetail(sale)} className="inline-flex items-center gap-1 text-xs font-semibold text-[#004aad] hover:text-[#003d8f]"><EyeIcon className="h-4 w-4" /> View</button>
              </div>
            ))}
          </div>
        )}

        {pageCount > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="rounded-[8px] border border-[#d0d5dd] px-3 py-2 text-sm font-medium text-[#334155] disabled:opacity-40">Previous</button>
            <span className="text-sm text-[#64748b]">Page {page + 1} of {pageCount}</span>
            <button disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)} className="rounded-[8px] border border-[#d0d5dd] px-3 py-2 text-sm font-medium text-[#334155] disabled:opacity-40">Next</button>
          </div>
        )}
      </div>

      {detail && <SaleDetailModal sale={detail} business={{ name: settings.businessName, phone: settings.businessPhone, address: settings.businessAddress, header: settings.receiptHeader, footer: settings.receiptFooter, thankYou: settings.receiptThankYou }} onClose={() => setDetail(null)} />}
    </div>
  );
}

function SaleDetailModal({ sale, business, onClose }: { sale: Sale; business: { name: string; phone: string; address: string; header?: string; footer?: string; thankYou?: string }; onClose: () => void }) {
  const { refundSale, deleteSale } = useAppData();
  const confirm = useConfirm();
  const [refunding, setRefunding] = useState(false);
  const [reason, setReason] = useState("");

  return (
    <Modal
      title={`Sale ${sale.number ?? sale.id}`}
      description={`${sale.time} · ${sale.paymentMethod}`}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <button onClick={async () => { if (await confirm({ title: "Delete sale?", message: `Sale ${sale.number ?? sale.id} will be removed.`, confirmLabel: "Delete", danger: true })) { deleteSale(sale.id); onClose(); } }} className="dashboard-action-muted text-[#dc2626]"><TrashIcon className="mr-1 h-4 w-4" /> Delete</button>
          {!sale.refunded && <button onClick={() => setRefunding(true)} className="dashboard-action-muted"><ArrowUturnLeftIcon className="mr-1 h-4 w-4" /> Refund</button>}
          <button onClick={() => printReceipt(sale, business)} className="dashboard-action-primary"><PrinterIcon className="mr-1 h-4 w-4" /> Print</button>
        </>
      }
    >
      {refunding ? (
        <div className="space-y-4">
          <p className="rounded-[10px] bg-[#fff7ed] p-3 text-sm text-[#9a3412]">Refunding returns all items to stock and (for credit) reduces the customer's balance.</p>
          <Field label="Reason (optional)"><TextInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Damaged goods" /></Field>
          <div className="flex justify-end gap-2">
            <button onClick={() => setRefunding(false)} className="dashboard-action-muted">Cancel</button>
            <button onClick={() => { refundSale(sale.id, reason); onClose(); }} className="dashboard-action-primary">Confirm refund</button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-[12px] border border-[#e6ebf2]">
            {(sale.lines ?? []).map((l, i) => (
              <div key={i} className="flex items-center justify-between border-b border-[#eef2f7] px-4 py-2 text-sm last:border-0">
                <span className="text-[#0f172a]">{l.quantity}× {l.productName}</span>
                <span className="font-semibold text-[#0f172a]">{formatMoney(l.lineTotal)}</span>
              </div>
            ))}
            {(!sale.lines || sale.lines.length === 0) && <div className="px-4 py-3 text-sm text-[#64748b]">Line items not available for this sale.</div>}
          </div>
          <div className="space-y-1 rounded-[12px] bg-[#f8fafc] p-4 text-sm">
            {sale.subtotal != null && <Row label="Subtotal" value={formatMoney(sale.subtotal)} />}
            {sale.tax ? <Row label="Tax" value={formatMoney(sale.tax)} /> : null}
            {sale.discount ? <Row label="Discount" value={`-${formatMoney(sale.discount)}`} /> : null}
            <div className="flex justify-between border-t border-[#d9dee7] pt-2 text-base font-bold"><span>Total</span><span>{formatMoney(sale.amount)}</span></div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Detail label="Customer" value={sale.customer} />
            <Detail label="Payment" value={sale.paymentMethod} />
            {sale.customerPhone && <Detail label="Phone" value={sale.customerPhone} />}
            {sale.customerEmail && <Detail label="Email" value={sale.customerEmail} />}
          </div>
          {sale.notes && <div><p className="text-xs font-medium text-[#64748b]">Notes</p><p className="text-sm text-[#0f172a]">{sale.notes}</p></div>}
        </div>
      )}
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between text-[#64748b]"><span>{label}</span><span>{value}</span></div>;
}
function Detail({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-medium text-[#64748b]">{label}</p><p className="text-sm font-semibold text-[#0f172a]">{value}</p></div>;
}
function StatCard({ label, value }: { label: string; value: string }) {
  return <div className="dashboard-card p-5"><p className="text-sm font-medium text-[#64748b]">{label}</p><p className="dashboard-metric-value text-2xl font-semibold text-[#0f172a]">{value}</p></div>;
}
