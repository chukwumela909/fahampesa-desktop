import { useMemo, useState } from "react";
import {
  CubeIcon,
  ExclamationTriangleIcon,
  ArchiveBoxIcon,
  TruckIcon,
  ClockIcon,
  AdjustmentsHorizontalIcon,
  ArrowsRightLeftIcon,
  PlusIcon,
  BellAlertIcon,
} from "@heroicons/react/24/outline";
import type { Product, Transfer } from "@/data";
import { useAppData } from "@/store/AppData";
import { usePermissions } from "@/hooks/usePermissions";
import { currency, sum } from "@/lib/format";
import Modal, { Field, SelectInput, TextInput } from "@/components/ui/Modal";

type Tab = "dashboard" | "levels" | "movements" | "transfers";
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "levels", label: "Stock Levels" },
  { id: "movements", label: "Movements" },
  { id: "transfers", label: "Transfers" },
];

const ADJUST_REASONS = ["stock_count", "damage", "expiry", "loss", "correction", "theft", "other"];

const movementTone: Record<string, string> = {
  sale: "bg-red-100 text-red-700",
  purchase: "bg-green-100 text-green-700",
  transfer_in: "bg-purple-100 text-purple-700",
  transfer_out: "bg-purple-100 text-purple-700",
  adjustment: "bg-blue-100 text-blue-700",
  initial: "bg-slate-100 text-slate-700",
};

const transferStatusTone: Record<Transfer["status"], string> = {
  requested: "bg-[#fffaeb] text-[#b54708]",
  approved: "bg-[#eef5ff] text-[#004aad]",
  in_transit: "bg-[#f3e8ff] text-[#7e22ce]",
  received: "bg-[#ecfdf3] text-[#027a48]",
  cancelled: "bg-zinc-100 text-[#717171]",
  rejected: "bg-[#fef3f2] text-[#f04438]",
};

export default function InventoryScreen({ branchId }: { branchId: string }) {
  const { products: allProducts, movements, alerts, transfers, branches, adjustStock, createTransfer, transferAction, online, notify } = useAppData();
  const { canManage } = usePermissions();
  const products = useMemo(() => allProducts.filter((p) => branchId === "all" || p.branchId === branchId), [allProducts, branchId]);
  const branchMovements = useMemo(() => movements.filter((m) => branchId === "all" || m.branchId === branchId), [movements, branchId]);
  const branchAlerts = useMemo(() => alerts.filter((a) => branchId === "all" || a.branchId === branchId), [alerts, branchId]);

  const [tab, setTab] = useState<Tab>("dashboard");
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const [creatingTransfer, setCreatingTransfer] = useState(false);

  const lowCount = products.filter((p) => p.status === "low").length;
  const outCount = products.filter((p) => p.status === "out").length;
  const inventoryValue = sum(products.map((p) => p.costPrice * p.quantity));
  const nameFor = (id: string) => allProducts.find((p) => p.id === id)?.name ?? id.slice(0, 8);

  return (
    <div className="space-y-6" style={{ fontFamily: "var(--font-dm-sans)" }}>
      <div className="dashboard-panel p-1.5">
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
          {TABS.map((item) => (
            <button key={item.id} onClick={() => setTab(item.id)} className={`rounded-[10px] px-4 py-2.5 text-sm font-medium transition-all ${tab === item.id ? "bg-white text-[#004aad] shadow-sm" : "text-[#64748b] hover:text-[#0f172a]"}`}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "dashboard" && (
        <>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Total Products" value={String(products.length)} icon={<CubeIcon className="h-8 w-8 text-[#004aad]" />} />
            <MetricCard label="Low Stock Items" value={String(lowCount)} valueClass="text-[#f59e0b]" icon={<ExclamationTriangleIcon className="h-8 w-8 text-orange-600" />} />
            <MetricCard label="Out of Stock" value={String(outCount)} valueClass="text-[#dc2626]" icon={<ArchiveBoxIcon className="h-8 w-8 text-red-600" />} />
            <MetricCard label="Inventory Value" value={currency(inventoryValue)} valueClass="text-[#16a34a]" icon={<TruckIcon className="h-8 w-8 text-green-600" />} />
          </div>

          {branchAlerts.length > 0 && (
            <div className="dashboard-panel p-5">
              <div className="mb-4 flex items-center gap-2"><BellAlertIcon className="h-5 w-5 text-[#f59e0b]" /><h2 className="dashboard-section-title">Alerts</h2></div>
              <div className="flex flex-col gap-2">
                {branchAlerts.slice(0, 8).map((a) => (
                  <div key={a.id} className={`flex items-center gap-3 rounded-[10px] p-3 ${a.severity === "high" ? "bg-[#fef2f2]" : a.severity === "low" ? "bg-[#f8fafc]" : "bg-[#fff7ed]"}`}>
                    <span className={`h-2 w-2 rounded-full ${a.severity === "high" ? "bg-[#dc2626]" : a.severity === "low" ? "bg-[#94a3b8]" : "bg-[#f59e0b]"}`} />
                    <span className="flex-1 text-sm text-[#0f172a]">{a.message}</span>
                    <span className="text-xs font-medium capitalize text-[#64748b]">{a.alertType.replace("_", " ")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="dashboard-panel p-5">
            <h2 className="dashboard-section-title mb-4">Recent Stock Movements</h2>
            {branchMovements.length === 0 ? (
              <div className="dashboard-empty-state py-8 text-sm text-[#64748b]">No stock movements recorded yet.</div>
            ) : (
              <div className="flex flex-col gap-3">
                {branchMovements.slice(0, 6).map((m) => (
                  <div key={m.id} className="dashboard-list-item flex items-center gap-3 p-3">
                    <span className={`grid h-8 w-8 place-items-center rounded-full ${movementTone[m.movementType] ?? "bg-slate-100 text-slate-700"}`}><ClockIcon className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[#0f172a]">{m.productName ?? nameFor(m.productId)}</p>
                      <p className="text-sm capitalize text-[#64748b]">{m.movementType.replace("_", " ")} · {m.reason} · {m.time}</p>
                    </div>
                    <span className={`text-sm font-semibold ${m.direction === "in" ? "text-[#16a34a]" : "text-[#dc2626]"}`}>{m.direction === "in" ? "+" : "-"}{m.quantity}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {tab === "levels" && (
        <div className="dashboard-panel p-5">
          <div className="flex flex-col gap-3">
            {products.map((product) => (
              <div key={product.id} className="flex items-center gap-4 rounded-[12px] border border-[#e6ebf2] p-4">
                <div className="grid h-16 w-16 flex-shrink-0 place-items-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                  {product.images?.[0] ? <img src={product.images[0]} alt="" className="h-full w-full object-cover" /> : <CubeIcon className="h-7 w-7 text-[#94a3b8]" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[#0f172a]">{product.name}</p>
                  <p className="text-sm text-[#64748b]">{product.category} · reorder at {product.reorderLevel}</p>
                </div>
                <div className="hidden text-center sm:block"><p className="text-xs text-[#94a3b8]">In stock</p><p className="font-semibold text-[#0f172a]">{product.quantity}</p></div>
                <div className="hidden text-center md:block"><p className="text-xs text-[#94a3b8]">Available</p><p className="font-semibold text-[#0f172a]">{product.availableQuantity ?? product.quantity}</p></div>
                <div className="hidden text-center md:block"><p className="text-xs text-[#94a3b8]">Reserved</p><p className="font-semibold text-[#0f172a]">{product.reservedQuantity ?? 0}</p></div>
                <StockBadge status={product.status} />
                {canManage && (
                  <button onClick={() => setAdjusting(product)} className="inline-flex items-center rounded-[10px] border border-[#e6ebf2] px-3 py-2 text-sm font-medium text-[#334155] hover:bg-[#f8fafc] hover:text-[#004aad]">
                    <AdjustmentsHorizontalIcon className="mr-1 h-4 w-4" /> Adjust
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "movements" && (
        <div className="dashboard-panel p-5">
          {branchMovements.length === 0 ? (
            <div className="dashboard-empty-state py-12 text-sm text-[#64748b]">No stock movements yet. Sales, purchases, and adjustments will appear here.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#f6f6f6] text-left text-[#717171]">
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Product</th>
                    <th className="px-3 py-2 font-medium">Reason</th>
                    <th className="px-3 py-2 text-right font-medium">Qty</th>
                    <th className="px-3 py-2 text-right font-medium">Stock</th>
                    <th className="px-3 py-2 text-right font-medium">When</th>
                  </tr>
                </thead>
                <tbody>
                  {branchMovements.map((m, i) => (
                    <tr key={m.id} className={i % 2 ? "bg-[#fafafa]" : ""}>
                      <td className="px-3 py-2"><span className={`rounded px-2 py-0.5 text-xs font-medium capitalize ${movementTone[m.movementType] ?? "bg-slate-100 text-slate-700"}`}>{m.movementType.replace("_", " ")}</span></td>
                      <td className="px-3 py-2 text-[#0f172a]">{m.productName ?? nameFor(m.productId)}</td>
                      <td className="px-3 py-2 text-[#64748b]">{m.reason}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${m.direction === "in" ? "text-[#16a34a]" : "text-[#dc2626]"}`}>{m.direction === "in" ? "+" : "-"}{m.quantity}</td>
                      <td className="px-3 py-2 text-right text-[#64748b]">{m.previousQuantity != null && m.newQuantity != null ? `${m.previousQuantity}→${m.newQuantity}` : "—"}</td>
                      <td className="px-3 py-2 text-right text-[#64748b]">{m.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "transfers" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="dashboard-section-title">Stock transfers</h2>
            <button onClick={() => (online ? setCreatingTransfer(true) : notify("Transfers require a connection"))} disabled={!online} title={online ? "New transfer" : "Online only"} className="dashboard-action-primary disabled:cursor-not-allowed disabled:opacity-50">
              <PlusIcon className="mr-1 h-4 w-4" /> New transfer{!online && " (online only)"}
            </button>
          </div>
          <div className="dashboard-panel p-5">
            {transfers.length === 0 ? (
              <div className="dashboard-empty-state py-12 text-sm text-[#64748b]">No transfers yet. Move stock between branches with a new transfer.</div>
            ) : (
              <div className="flex flex-col gap-3">
                {transfers.map((t) => {
                  const from = branches.find((b) => b.id === t.fromBranchId)?.name ?? "Branch";
                  const to = branches.find((b) => b.id === t.toBranchId)?.name ?? "Branch";
                  const totalQty = t.items.reduce((s, it) => s + it.quantity, 0);
                  return (
                    <div key={t.id} className="flex flex-wrap items-center gap-3 rounded-[12px] border border-[#e6ebf2] p-4">
                      <ArrowsRightLeftIcon className="h-5 w-5 text-[#94a3b8]" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[#0f172a]">{t.number ?? t.id.slice(0, 8)} · {from} → {to}</p>
                        <p className="text-sm text-[#64748b]">{t.items.length} product{t.items.length === 1 ? "" : "s"} · {totalQty} units · {t.time}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${transferStatusTone[t.status]}`}>{t.status.replace("_", " ")}</span>
                      <div className="flex gap-2">
                        {t.status === "requested" && <ActionBtn label="Approve" onClick={() => transferAction(t.id, "approve")} disabled={!online} />}
                        {t.status === "approved" && <ActionBtn label="Ship" onClick={() => transferAction(t.id, "ship")} disabled={!online} />}
                        {t.status === "in_transit" && <ActionBtn label="Receive" onClick={() => transferAction(t.id, "receive")} disabled={!online} />}
                        {(t.status === "requested" || t.status === "approved") && <ActionBtn label="Cancel" tone="danger" onClick={() => transferAction(t.id, "cancel")} disabled={!online} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {adjusting && (
        <AdjustModal
          product={adjusting}
          onClose={() => setAdjusting(null)}
          onSubmit={(quantity, reason, notes) => { adjustStock(adjusting.id, quantity, reason, notes); setAdjusting(null); }}
        />
      )}
      {creatingTransfer && (
        <TransferModal
          fromBranchId={branchId !== "all" ? branchId : branches[0]?.id ?? ""}
          branches={branches}
          products={products}
          onClose={() => setCreatingTransfer(false)}
          onSubmit={(input) => { void createTransfer(input); setCreatingTransfer(false); }}
        />
      )}
    </div>
  );
}

function AdjustModal({ product, onClose, onSubmit }: { product: Product; onClose: () => void; onSubmit: (quantity: number, reason: string, notes: string) => void }) {
  const [quantity, setQuantity] = useState(String(product.quantity));
  const [reason, setReason] = useState(ADJUST_REASONS[0]);
  const [notes, setNotes] = useState("");
  const valid = quantity !== "" && Number(quantity) >= 0;
  return (
    <Modal
      title="Adjust stock"
      description={product.name}
      onClose={onClose}
      footer={<><button onClick={onClose} className="dashboard-action-muted">Cancel</button><button disabled={!valid} onClick={() => onSubmit(Number(quantity), reason, notes)} className="dashboard-action-primary disabled:opacity-50">Save adjustment</button></>}
    >
      <div className="space-y-4">
        <div className="rounded-[12px] bg-[#f8fafc] p-4 text-sm text-[#64748b]">Current stock: <span className="font-semibold text-[#0f172a]">{product.quantity} pcs</span> · reorder at {product.reorderLevel}</div>
        <Field label="New quantity"><TextInput type="number" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></Field>
        <Field label="Reason">
          <SelectInput value={reason} onChange={(e) => setReason(e.target.value)}>
            {ADJUST_REASONS.map((r) => <option key={r} value={r} className="capitalize">{r.replace("_", " ")}</option>)}
          </SelectInput>
        </Field>
        <Field label="Notes"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional" className="dashboard-field w-full resize-none px-3 py-2 text-sm" /></Field>
      </div>
    </Modal>
  );
}

function TransferModal({
  fromBranchId,
  branches,
  products,
  onClose,
  onSubmit,
}: {
  fromBranchId: string;
  branches: { id: string; name: string }[];
  products: Product[];
  onClose: () => void;
  onSubmit: (input: { fromBranchId: string; toBranchId: string; items: Array<{ productId: string; quantity: number }>; notes?: string }) => void;
}) {
  const [from, setFrom] = useState(fromBranchId);
  const [to, setTo] = useState(branches.find((b) => b.id !== fromBranchId)?.id ?? "");
  const [qty, setQty] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");

  const items = Object.entries(qty).map(([productId, q]) => ({ productId, quantity: Number(q) || 0 })).filter((i) => i.quantity > 0);
  const valid = from && to && from !== to && items.length > 0;

  return (
    <Modal
      title="New stock transfer"
      description="Move stock from one branch to another"
      size="lg"
      onClose={onClose}
      footer={<><button onClick={onClose} className="dashboard-action-muted">Cancel</button><button disabled={!valid} onClick={() => onSubmit({ fromBranchId: from, toBranchId: to, items, notes: notes || undefined })} className="dashboard-action-primary disabled:opacity-50">Create transfer</button></>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="From branch">
            <SelectInput value={from} onChange={(e) => setFrom(e.target.value)}>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</SelectInput>
          </Field>
          <Field label="To branch">
            <SelectInput value={to} onChange={(e) => setTo(e.target.value)}><option value="">Select…</option>{branches.filter((b) => b.id !== from).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</SelectInput>
          </Field>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-[#0f172a]">Items to transfer</p>
          <div className="max-h-60 space-y-2 overflow-y-auto">
            {products.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-[10px] border border-[#e6ebf2] px-3 py-2">
                <span className="flex-1 truncate text-sm text-[#0f172a]">{p.name} <span className="text-[#94a3b8]">({p.quantity} in stock)</span></span>
                <input type="number" min="0" max={p.quantity} value={qty[p.id] ?? ""} onChange={(e) => setQty((cur) => ({ ...cur, [p.id]: e.target.value }))} placeholder="0" className="dashboard-field h-9 w-20 px-2 text-sm" />
              </div>
            ))}
          </div>
        </div>
        <Field label="Notes"><TextInput value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" /></Field>
      </div>
    </Modal>
  );
}

function ActionBtn({ label, onClick, disabled, tone }: { label: string; onClick: () => void; disabled?: boolean; tone?: "danger" }) {
  return (
    <button onClick={onClick} disabled={disabled} className={`rounded-[8px] px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${tone === "danger" ? "bg-[#fff1ee] text-[#f04438] hover:bg-[#ffe4e0]" : "bg-[#eef5ff] text-[#004aad] hover:bg-[#dcecff]"}`}>
      {label}
    </button>
  );
}

function MetricCard({ label, value, valueClass, icon }: { label: string; value: string; valueClass?: string; icon: React.ReactNode }) {
  return (
    <div className="dashboard-card flex items-center justify-between p-6">
      <div><p className="text-sm font-medium text-[#64748b]">{label}</p><p className={`dashboard-metric-value text-3xl font-semibold tracking-[-0.02em] ${valueClass ?? "text-[#0f172a]"}`}>{value}</p></div>
      {icon}
    </div>
  );
}

function StockBadge({ status }: { status: Product["status"] }) {
  if (status === "out") return <span className="rounded-md border border-red-500 px-2 py-1 text-xs font-medium text-red-600">Out of stock</span>;
  if (status === "low") return <span className="rounded-md bg-[#fef3c7] px-2 py-1 text-xs font-medium text-[#b45309]">Low stock</span>;
  return <span className="rounded-md bg-[#dcfce7] px-2 py-1 text-xs font-medium text-[#15803d]">Healthy</span>;
}
