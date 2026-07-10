import { useMemo, useState } from "react";
import { PlusIcon, MagnifyingGlassIcon, CurrencyDollarIcon, PencilIcon, TrashIcon, BuildingStorefrontIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import type { Expense } from "@/data";
import { useAppData } from "@/store/AppData";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { currency, sum } from "@/lib/format";
import Modal, { Field, SelectInput, TextInput } from "@/components/ui/Modal";

const CATEGORIES = ["Rent", "Utilities", "Salaries", "Office Supplies", "Inventory", "Marketing", "Equipment", "Travel", "Communications", "Professional Services", "Other"];
const PAYMENT_METHODS = ["Cash", "M-Pesa", "Bank Transfer", "Card", "Cheque"];
const categoryColor = (c: string) => {
  const map: Record<string, string> = { Rent: "bg-purple-100 text-purple-800", Utilities: "bg-blue-100 text-blue-800", Salaries: "bg-green-100 text-green-800", Marketing: "bg-pink-100 text-pink-800", Travel: "bg-amber-100 text-amber-800" };
  return map[c] ?? "bg-slate-100 text-slate-700";
};

export default function ExpensesScreen() {
  const { expenses, addExpense, updateExpense, deleteExpense } = useAppData();
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  const monthTotal = useMemo(() => sum(expenses.map((e) => e.amount)), [expenses]);
  const visible = expenses.filter((e) => [e.description, e.category, e.vendor].some((f) => f.toLowerCase().includes(search.trim().toLowerCase())));

  return (
    <div className="space-y-6" style={{ fontFamily: "var(--font-dm-sans)" }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#94a3b8]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search description, category, or vendor" className="dashboard-field w-full py-2 pl-10 pr-3 text-sm" />
        </div>
        <button onClick={() => setCreating(true)} className="dashboard-action-primary"><PlusIcon className="mr-1 h-4 w-4" /> Record expense</button>
      </div>

      <div className="dashboard-panel flex items-center justify-between p-6">
        <div><p className="text-sm font-medium text-[#64748b]">Total spending</p><p className="dashboard-metric-value text-2xl font-bold text-[#0f172a]">{currency(monthTotal)}</p></div>
        <div className="rounded-lg bg-red-100 p-3"><CurrencyDollarIcon className="h-6 w-6 text-red-600" /></div>
      </div>

      <div className="dashboard-panel p-5">
        <h3 className="dashboard-section-title mb-4">Recent expenses</h3>
        {visible.length === 0 ? (
          <div className="dashboard-empty-state py-10 text-sm text-[#64748b]">No expenses recorded.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {visible.map((expense) => (
              <div key={expense.id} className="flex items-center gap-4 rounded-[12px] bg-[#f8fafc] p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#0f172a]">{expense.description}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${categoryColor(expense.category)}`}>{expense.category}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-[#64748b]">
                    <span className="flex items-center gap-1"><BuildingStorefrontIcon className="h-4 w-4" />{expense.vendor || "—"}</span>
                    <span className="flex items-center gap-1"><DocumentTextIcon className="h-4 w-4" />{expense.receipt || "—"}</span>
                    <span>{expense.date}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-[#0f172a]">{currency(expense.amount)}</p>
                  <p className="text-sm text-[#64748b]">{expense.paymentMethod}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditing(expense)} className="rounded-lg p-2 text-green-600 hover:bg-green-50"><PencilIcon className="h-4 w-4" /></button>
                  <button onClick={async () => { if (await confirm({ title: "Delete expense?", message: `"${expense.description}" will be removed.`, confirmLabel: "Delete", danger: true })) deleteExpense(expense.id); }} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><TrashIcon className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {creating && <ExpenseModal title="Record expense" onClose={() => setCreating(false)} onSubmit={(d) => { addExpense(d); setCreating(false); }} />}
      {editing && <ExpenseModal title="Edit expense" initial={editing} onClose={() => setEditing(null)} onSubmit={(d) => { updateExpense(editing.id, d); setEditing(null); }} />}
    </div>
  );
}

type ExpenseFormData = Omit<Expense, "id">;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function ExpenseModal({ title, initial, onClose, onSubmit }: { title: string; initial?: Expense; onClose: () => void; onSubmit: (d: ExpenseFormData) => void }) {
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? CATEGORIES[0]);
  const [amount, setAmount] = useState(String(initial?.amount ?? ""));
  const [paymentMethod, setPaymentMethod] = useState(initial?.paymentMethod ?? PAYMENT_METHODS[0]);
  const [vendor, setVendor] = useState(initial?.vendor === "—" ? "" : initial?.vendor ?? "");
  const [receipt, setReceipt] = useState(initial?.receipt === "—" ? "" : initial?.receipt ?? "");
  const [date, setDate] = useState(() => {
    if (!initial?.date) return todayIso();
    const d = new Date(initial.date);
    return Number.isNaN(d.getTime()) ? todayIso() : d.toISOString().slice(0, 10);
  });
  const valid = description.trim() && Number(amount) > 0;
  return (
    <Modal title={title} description="Track a business cost" size="lg" onClose={onClose}
      footer={<><button onClick={onClose} className="dashboard-action-muted">Cancel</button><button disabled={!valid} onClick={() => onSubmit({ description: description.trim(), category, amount: Number(amount) || 0, paymentMethod, vendor: vendor.trim() || "—", receipt: receipt.trim() || "—", date })} className="dashboard-action-primary disabled:opacity-50">Save expense</button></>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label="Description"><TextInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What was it for?" /></Field></div>
        <Field label="Amount"><TextInput type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></Field>
        <Field label="Category"><SelectInput value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</SelectInput></Field>
        <Field label="Payment method"><SelectInput value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</SelectInput></Field>
        <Field label="Date"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Vendor"><TextInput value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Optional" /></Field>
        <Field label="Receipt number"><TextInput value={receipt} onChange={(e) => setReceipt(e.target.value)} placeholder="Optional" /></Field>
      </div>
    </Modal>
  );
}
