import { useEffect, useState } from "react";
import {
  PlusIcon,
  UsersIcon,
  BanknotesIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  EyeIcon,
  UserMinusIcon,
} from "@heroicons/react/24/outline";
import type { Debtor } from "@/data";
import { useAppData } from "@/store/AppData";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { currency, sum } from "@/lib/format";
import * as ep from "@/lib/endpoints";
import Modal, { Field, SelectInput, TextInput } from "@/components/ui/Modal";

// Mutually exclusive tabs (mirrors the web app):
// Active = owing & not past due · Completed = fully paid · Overdue = owing & past due.
const filters = ["Active", "Completed", "Overdue"] as const;
type Filter = (typeof filters)[number];
const PAYMENT_METHODS = ["Cash", "M-Pesa", "Bank Transfer", "Card", "Cheque"];

type DebtorTabStatus = "Active" | "Completed" | "Overdue";

function tabStatusFor(debtor: Debtor): DebtorTabStatus {
  if (debtor.currentDebt <= 0) return "Completed";
  const pastDue = Boolean(debtor.dueDate && new Date(debtor.dueDate).getTime() < Date.now());
  return pastDue ? "Overdue" : "Active";
}

const statusBadge: Record<DebtorTabStatus, string> = {
  Active: "bg-[#E3F2FD] text-[#2175C7]",
  Completed: "bg-[#E8F5E8] text-[#66BB6A]",
  Overdue: "bg-[#FEE2E2] text-[#DC2626]",
};

export default function DebtorsScreen() {
  const { debtors, addDebtor, updateDebtor, recordDebtorPayment } = useAppData();
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<Filter>("Active");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Debtor | null>(null);
  const [paying, setPaying] = useState<Debtor | null>(null);
  const [viewing, setViewing] = useState<Debtor | null>(null);

  const active = debtors.filter((d) => d.active !== false);
  const outstanding = sum(active.map((d) => d.currentDebt));
  const overdueCount = active.filter((d) => tabStatusFor(d) === "Overdue").length;

  const visible = active.filter((d) => {
    if (!d.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return tabStatusFor(d) === activeFilter;
  });

  return (
    <div className="space-y-6" style={{ fontFamily: "var(--font-dm-sans)" }}>
      <div className="rounded-2xl border border-blue-200/50 bg-[#2175C7] p-6 shadow-lg">
        <button onClick={() => setCreating(true)} className="flex w-full items-center justify-center gap-3 rounded-xl p-4 text-white transition-colors hover:bg-white/10">
          <PlusIcon className="h-6 w-6" /><span className="text-lg font-bold">Add New Debtor</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard bg="bg-[#E3F2FD]" border="border-blue-200/50" color="text-[#2175C7]" icon={<UsersIcon className="h-6 w-6 text-[#2175C7]" />} value={String(active.length)} label="Total Debtors" />
        <SummaryCard bg="bg-[#FEF3E0]" border="border-orange-200/50" color="text-[#F29F05]" icon={<BanknotesIcon className="h-6 w-6 text-[#F29F05]" />} value={currency(outstanding)} label="Outstanding Debt" />
        <SummaryCard bg="bg-[#E8F5E8]" border="border-green-200/50" color="text-[#66BB6A]" icon={<CheckCircleIcon className="h-6 w-6 text-[#66BB6A]" />} value={currency(sum(active.map((d) => d.totalPaid ?? 0)))} label="Total Paid" />
        <SummaryCard bg="bg-[#FEE2E2]" border="border-red-200/50" color="text-[#DC2626]" icon={<ExclamationTriangleIcon className="h-6 w-6 text-[#DC2626]" />} value={String(overdueCount)} label="Overdue" />
      </div>

      <div className="rounded-2xl border border-[#e6ebf2] bg-[#f8fafc] p-4">
        <div className="relative mb-4">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#94a3b8]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search debtors by name" className="dashboard-field w-full py-3 pl-10 pr-4 text-sm" />
        </div>
        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <button key={filter} onClick={() => setActiveFilter(filter)} className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeFilter === filter ? "bg-[#2175C7] text-white" : "bg-white text-[#64748b] hover:bg-[#eef2f7]"}`}>{filter}</button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="dashboard-empty-state px-6 py-12 text-sm text-[#64748b]">No debtors match this filter.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {visible.map((debtor) => {
            const tabStatus = tabStatusFor(debtor);
            return (
              <div key={debtor.id} className="rounded-2xl border border-[#e6ebf2] bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex items-start gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#2175C7] to-[#1565c0] text-lg font-bold text-white">{debtor.name.charAt(0)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-bold text-[#0f172a]">{debtor.name}</p>
                    <p className="text-sm text-[#64748b]">{debtor.phone}{debtor.address ? ` · ${debtor.address}` : ""}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadge[tabStatus]}`}>{tabStatus}</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-[#f8fafc] p-3"><p className="text-xs font-medium text-[#64748b]">Owes</p><p className={`text-sm font-bold ${debtor.currentDebt > 0 ? "text-[#F29F05]" : "text-[#66BB6A]"}`}>{currency(debtor.currentDebt)}</p></div>
                  <div className="rounded-xl bg-[#f8fafc] p-3"><p className="text-xs font-medium text-[#64748b]">Due date</p><p className={`text-sm font-bold ${tabStatus === "Overdue" ? "text-[#DC2626]" : "text-[#0f172a]"}`}>{debtor.dueDate ? new Date(debtor.dueDate).toLocaleDateString() : "—"}</p></div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => setPaying(debtor)} className="flex-1 rounded-lg bg-[#66BB6A] py-2 text-sm font-medium text-white transition-colors hover:bg-[#5cb660]">Record Payment</button>
                  <button onClick={() => setViewing(debtor)} className="rounded-lg border border-[#e6ebf2] px-3 py-2 text-[#334155] hover:bg-[#f8fafc]" title="View"><EyeIcon className="h-4 w-4" /></button>
                  <button onClick={() => setEditing(debtor)} className="rounded-lg border border-[#e6ebf2] px-3 py-2 text-[#334155] hover:bg-[#f8fafc]" title="Edit"><PencilIcon className="h-4 w-4" /></button>
                  <button onClick={async () => { if (await confirm({ title: "Deactivate debtor?", message: `${debtor.name} will be hidden from the active list.`, confirmLabel: "Deactivate", danger: true })) updateDebtor(debtor.id, { active: false }); }} className="rounded-lg border border-[#e6ebf2] px-3 py-2 text-[#dc2626] hover:bg-[#fff1f2]" title="Deactivate"><UserMinusIcon className="h-4 w-4" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {creating && <DebtorModal title="Add New Debtor" onClose={() => setCreating(false)} onSubmit={(d) => { const opening = d.openingDebt ?? 0; addDebtor({ ...d, creditLimit: 0, currentDebt: opening, risk: "low" }); setCreating(false); }} />}
      {editing && <DebtorModal title="Edit debtor" initial={editing} onClose={() => setEditing(null)} onSubmit={(d) => { updateDebtor(editing.id, d); setEditing(null); }} />}
      {paying && <PaymentModal debtor={paying} onClose={() => setPaying(null)} onSubmit={(amount, method, ref) => { recordDebtorPayment(paying.id, amount, method, ref); setPaying(null); }} />}
      {viewing && <DebtorDetailModal debtor={viewing} onClose={() => setViewing(null)} onPay={() => { setPaying(viewing); setViewing(null); }} />}
    </div>
  );
}

type DebtorFormData = { name: string; phone: string; address?: string; debtDate?: string; dueDate?: string; note?: string; openingDebt?: number };

function DebtorModal({ title, initial, onClose, onSubmit }: { title: string; initial?: Debtor; onClose: () => void; onSubmit: (d: DebtorFormData) => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone === "—" ? "" : initial?.phone ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [dueDate, setDueDate] = useState(initial?.dueDate ? initial.dueDate.slice(0, 10) : "");
  const [note, setNote] = useState(initial?.note ?? "");
  // Amount owed + date taken are create-only: editing never rewrites the balance.
  const isEdit = Boolean(initial);
  const [openingDebt, setOpeningDebt] = useState("");
  const [debtDate, setDebtDate] = useState(new Date().toISOString().slice(0, 10));
  const openingDebtNum = Number(openingDebt) || 0;
  const valid = Boolean(name.trim() && phone.trim());
  return (
    <Modal title={title} description="Track who owes you, how much, and when it's due" onClose={onClose}
      footer={<><button onClick={onClose} className="dashboard-action-muted">Cancel</button><button disabled={!valid} onClick={() => onSubmit({ name: name.trim(), phone: phone.trim(), address: address.trim() || undefined, debtDate: isEdit ? undefined : debtDate || undefined, dueDate: dueDate || undefined, note: note.trim() || (isEdit ? "" : undefined), openingDebt: isEdit ? undefined : openingDebtNum > 0 ? openingDebtNum : undefined })} className="dashboard-action-primary disabled:opacity-50">Save debtor</button></>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Full name"><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer name" /></Field>
        <Field label="Phone"><TextInput value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" /></Field>
        <div className="sm:col-span-2"><Field label="Address"><TextInput value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Optional" /></Field></div>
        {!isEdit && <Field label="Amount owed"><TextInput type="number" min="0" value={openingDebt} onChange={(e) => setOpeningDebt(e.target.value)} placeholder="0" /></Field>}
        {!isEdit && <Field label="Date debt taken"><TextInput type="date" value={debtDate} onChange={(e) => setDebtDate(e.target.value)} /></Field>}
        <Field label="Due date"><TextInput type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
      </div>
      <div className="mt-4">
        <Field label="Note"><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Optional" className="dashboard-field w-full resize-none px-3 py-2 text-sm" /></Field>
      </div>
      <p className="mt-3 text-xs text-[#94a3b8]">Payments can be partial — record them anytime from the debtor's card. Further debt accrues from credit sales.</p>
    </Modal>
  );
}

function PaymentModal({ debtor, onClose, onSubmit }: { debtor: Debtor; onClose: () => void; onSubmit: (amount: number, method: string, reference: string) => void }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(PAYMENT_METHODS[0]);
  const [reference, setReference] = useState("");
  const valid = Number(amount) > 0;
  return (
    <Modal title="Record Payment" description={debtor.name} onClose={onClose}
      footer={<><button onClick={onClose} className="dashboard-action-muted">Cancel</button><button disabled={!valid} onClick={() => onSubmit(Number(amount), method, reference)} className="dashboard-action-primary disabled:opacity-50">Record payment</button></>}>
      <div className="space-y-4">
        <div className="rounded-[12px] bg-[#f8fafc] p-4 text-sm text-[#64748b]">Outstanding: <span className="font-semibold text-[#F29F05]">{currency(debtor.currentDebt)}</span></div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Amount"><TextInput type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></Field>
          <Field label="Method"><SelectInput value={method} onChange={(e) => setMethod(e.target.value)}>{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</SelectInput></Field>
        </div>
        <Field label="Reference"><TextInput value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional (e.g. M-Pesa code)" /></Field>
      </div>
    </Modal>
  );
}

type PaymentRow = { id: string; amount: number; method: string; reference: string; balanceAfter: number; at: number };

function DebtorDetailModal({ debtor, onClose, onPay }: { debtor: Debtor; onClose: () => void; onPay: () => void }) {
  const [payments, setPayments] = useState<PaymentRow[] | null>(null); // null = loading
  const [historyError, setHistoryError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await ep.getDebtor(debtor.branchId ?? "", debtor.id);
        const list = Array.isArray((raw as { payments?: unknown }).payments)
          ? ((raw as { payments: Record<string, unknown>[] }).payments)
          : [];
        const rows: PaymentRow[] = list.map((p, index) => ({
          id: String(p.id ?? p._id ?? index),
          amount: Number(p.amount ?? 0),
          method: String(p.paymentMethod ?? "cash"),
          reference: p.reference ? String(p.reference) : "",
          balanceAfter: Number(p.outstandingBalance ?? 0),
          at: p.createdAt ? new Date(String(p.createdAt)).getTime() : 0,
        }));
        if (!cancelled) setPayments(rows);
      } catch {
        if (!cancelled) {
          setPayments([]);
          setHistoryError(true);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [debtor.id, debtor.branchId]);

  return (
    <Modal title={debtor.name} description={debtor.phone} onClose={onClose}
      footer={<><button onClick={onClose} className="dashboard-action-muted">Close</button><button onClick={onPay} className="dashboard-action-primary">Record payment</button></>}>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Detail label="Owes" value={currency(debtor.currentDebt)} />
        <Detail label="Total paid" value={currency(debtor.totalPaid ?? 0)} />
        <Detail label="Status" value={tabStatusFor(debtor)} />
        {debtor.debtDate && <Detail label="Debt taken" value={new Date(debtor.debtDate).toLocaleDateString()} />}
        {debtor.dueDate && <Detail label="Due date" value={new Date(debtor.dueDate).toLocaleDateString()} />}
        {debtor.address && <Detail label="Address" value={debtor.address} />}
      </div>
      {debtor.note && (
        <div className="mt-4 rounded-[12px] bg-[#f8fafc] p-4">
          <p className="text-xs font-medium text-[#64748b]">Note</p>
          <p className="mt-1 text-sm text-[#0f172a]">{debtor.note}</p>
        </div>
      )}

      <div className="mt-5">
        <p className="mb-2 text-sm font-semibold text-[#0f172a]">Payment history{payments ? ` (${payments.length})` : ""}</p>
        {payments === null ? (
          <p className="text-sm text-[#94a3b8]">Loading payments…</p>
        ) : historyError ? (
          <p className="text-sm text-[#b42318]">Couldn't load the payment history — check your connection and reopen.</p>
        ) : payments.length === 0 ? (
          <p className="text-sm text-[#94a3b8]">No payments recorded yet.</p>
        ) : (
          <div className="max-h-56 space-y-2 overflow-y-auto">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-[10px] border border-[#e6ebf2] px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#0f172a]">
                    {currency(p.amount)} <span className="text-xs font-medium uppercase text-[#94a3b8]">{p.method === "mpesa" ? "M-Pesa" : p.method.replace("_", " ")}</span>
                  </p>
                  <p className="truncate text-xs text-[#64748b]">{p.at ? new Date(p.at).toLocaleString() : "—"}{p.reference ? ` · Ref: ${p.reference}` : ""}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[11px] text-[#94a3b8]">Balance after</p>
                  <p className="text-xs font-semibold text-[#0f172a]">{currency(p.balanceAfter)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function SummaryCard({ bg, border, color, icon, value, label }: { bg: string; border: string; color: string; icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className={`rounded-xl border ${border} ${bg} p-4 text-center`}>
      <div className="mb-2 flex justify-center">{icon}</div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className={`text-sm font-medium ${color}`}>{label}</p>
    </div>
  );
}
function Detail({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-medium text-[#64748b]">{label}</p><p className="text-sm font-semibold capitalize text-[#0f172a]">{value}</p></div>;
}
