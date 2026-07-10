import { useState } from "react";
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
import Modal, { Field, SelectInput, TextInput } from "@/components/ui/Modal";

const filters = ["All", "Active", "Overdue", "High Risk", "At Limit"] as const;
type Filter = (typeof filters)[number];
const PAYMENT_METHODS = ["Cash", "M-Pesa", "Bank Transfer", "Card", "Cheque"];

const riskBadge: Record<Debtor["risk"], string> = {
  high: "bg-[#FEE2E2] text-[#DC2626]",
  medium: "bg-[#FEF3E0] text-[#F29F05]",
  low: "bg-[#E8F5E8] text-[#66BB6A]",
};

function riskFor(currentDebt: number, creditLimit: number): Debtor["risk"] {
  const ratio = creditLimit > 0 ? currentDebt / creditLimit : 0;
  if (ratio >= 0.8) return "high";
  if (ratio >= 0.5) return "medium";
  return "low";
}

export default function DebtorsScreen() {
  const { debtors, addDebtor, updateDebtor, recordDebtorPayment } = useAppData();
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<Filter>("All");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Debtor | null>(null);
  const [paying, setPaying] = useState<Debtor | null>(null);
  const [viewing, setViewing] = useState<Debtor | null>(null);

  const active = debtors.filter((d) => d.active !== false);
  const outstanding = sum(active.map((d) => d.currentDebt));
  const highRisk = active.filter((d) => d.risk === "high").length;

  const visible = active.filter((d) => {
    if (!d.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
    switch (activeFilter) {
      case "Active": return d.currentDebt > 0;
      case "Overdue": return d.status === "overdue" || d.risk !== "low";
      case "High Risk": return d.risk === "high";
      case "At Limit": return d.currentDebt >= d.creditLimit * 0.9;
      default: return true;
    }
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
        <SummaryCard bg="bg-[#FEE2E2]" border="border-red-200/50" color="text-[#DC2626]" icon={<ExclamationTriangleIcon className="h-6 w-6 text-[#DC2626]" />} value={String(highRisk)} label="High Risk" />
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
            const available = debtor.creditLimit - debtor.currentDebt;
            return (
              <div key={debtor.id} className="rounded-2xl border border-[#e6ebf2] bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex items-start gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#2175C7] to-[#1565c0] text-lg font-bold text-white">{debtor.name.charAt(0)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-bold text-[#0f172a]">{debtor.name}</p>
                    <p className="text-sm text-[#64748b]">{debtor.phone}{debtor.dueDate ? ` · due ${new Date(debtor.dueDate).toLocaleDateString()}` : ""}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${riskBadge[debtor.risk]}`}>{debtor.risk} risk</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-[#f8fafc] p-3"><p className="text-xs font-medium text-[#64748b]">Outstanding</p><p className="text-sm font-bold text-[#F29F05]">{currency(debtor.currentDebt)}</p></div>
                  <div className="rounded-xl bg-[#f8fafc] p-3"><p className="text-xs font-medium text-[#64748b]">Available credit</p><p className="text-lg font-bold text-[#66BB6A]">{currency(available)}</p></div>
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

      {creating && <DebtorModal title="Add New Debtor" onClose={() => setCreating(false)} onSubmit={(d) => { addDebtor({ ...d, currentDebt: 0, risk: riskFor(0, d.creditLimit) }); setCreating(false); }} />}
      {editing && <DebtorModal title="Edit debtor" initial={editing} onClose={() => setEditing(null)} onSubmit={(d) => { updateDebtor(editing.id, d); setEditing(null); }} />}
      {paying && <PaymentModal debtor={paying} onClose={() => setPaying(null)} onSubmit={(amount, method, ref) => { recordDebtorPayment(paying.id, amount, method, ref); setPaying(null); }} />}
      {viewing && <DebtorDetailModal debtor={viewing} onClose={() => setViewing(null)} onPay={() => { setPaying(viewing); setViewing(null); }} />}
    </div>
  );
}

type DebtorFormData = { name: string; phone: string; email?: string; creditLimit: number; dueDate?: string };

function DebtorModal({ title, initial, onClose, onSubmit }: { title: string; initial?: Debtor; onClose: () => void; onSubmit: (d: DebtorFormData) => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone === "—" ? "" : initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [creditLimit, setCreditLimit] = useState(String(initial?.creditLimit ?? ""));
  const [dueDate, setDueDate] = useState(initial?.dueDate ? initial.dueDate.slice(0, 10) : "");
  const valid = name.trim() && Number(creditLimit) > 0;
  return (
    <Modal title={title} description="Create a credit customer" onClose={onClose}
      footer={<><button onClick={onClose} className="dashboard-action-muted">Cancel</button><button disabled={!valid} onClick={() => onSubmit({ name: name.trim(), phone: phone.trim() || "—", email: email.trim() || undefined, creditLimit: Number(creditLimit) || 0, dueDate: dueDate || undefined })} className="dashboard-action-primary disabled:opacity-50">Save debtor</button></>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Full name"><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer name" /></Field>
        <Field label="Phone"><TextInput value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+254 …" /></Field>
        <Field label="Email"><TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Optional" /></Field>
        <Field label="Credit limit"><TextInput type="number" min="0" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} placeholder="0" /></Field>
        <Field label="Due date"><TextInput type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
      </div>
      <p className="mt-3 text-xs text-[#94a3b8]">Debt accrues from credit sales. Installment schedules are managed on the web app.</p>
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

function DebtorDetailModal({ debtor, onClose, onPay }: { debtor: Debtor; onClose: () => void; onPay: () => void }) {
  const available = debtor.creditLimit - debtor.currentDebt;
  return (
    <Modal title={debtor.name} description={debtor.phone} onClose={onClose}
      footer={<><button onClick={onClose} className="dashboard-action-muted">Close</button><button onClick={onPay} className="dashboard-action-primary">Record payment</button></>}>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Detail label="Outstanding" value={currency(debtor.currentDebt)} />
        <Detail label="Credit limit" value={currency(debtor.creditLimit)} />
        <Detail label="Available" value={currency(available)} />
        <Detail label="Total paid" value={currency(debtor.totalPaid ?? 0)} />
        <Detail label="Status" value={debtor.status ?? "clear"} />
        <Detail label="Risk" value={debtor.risk} />
        {debtor.email && <Detail label="Email" value={debtor.email} />}
        {debtor.dueDate && <Detail label="Due date" value={new Date(debtor.dueDate).toLocaleDateString()} />}
      </div>
      <p className="mt-4 text-xs text-[#94a3b8]">Payment history syncs from the server; recorded payments reduce the outstanding balance.</p>
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
