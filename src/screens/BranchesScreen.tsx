import { useMemo, useState } from "react";
import {
  BuildingOfficeIcon,
  PlusIcon,
  ArrowPathIcon,
  ArrowLeftIcon,
  MapPinIcon,
  PhoneIcon,
  EnvelopeIcon,
  CheckCircleIcon,
  XCircleIcon,
  CubeIcon,
  ChartBarIcon,
  PencilIcon,
  EyeIcon,
  TrashIcon,
  UsersIcon,
  ExclamationTriangleIcon,
  IdentificationIcon,
  TagIcon,
} from "@heroicons/react/24/outline";
import type { Branch, BranchType, Product, StaffMember } from "@/data";
import { useAppData } from "@/store/AppData";
import { currency, sum } from "@/lib/format";
import { branchLocation, displayBranchName } from "@/lib/utils";
import Modal, { Field, SelectInput, TextInput } from "@/components/ui/Modal";

type Tab = "dashboard" | "branches" | "reports";
const BRANCH_TYPES: BranchType[] = ["MAIN", "BRANCH", "OUTLET", "WAREHOUSE", "KIOSK"];

const typeGradient: Record<BranchType, string> = {
  MAIN: "from-purple-500 to-purple-600",
  BRANCH: "from-blue-500 to-blue-600",
  OUTLET: "from-green-500 to-green-600",
  WAREHOUSE: "from-orange-500 to-orange-600",
  KIOSK: "from-gray-500 to-gray-600",
};

export default function BranchesScreen() {
  const { branches, products, staff, addBranch, updateBranch, deleteBranch, notify, online, syncNow } = useAppData();
  const [tab, setTab] = useState<Tab>("branches");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [deleting, setDeleting] = useState<Branch | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);

  // The backend's branch.totalInventoryValue / productCount come back as 0, so derive them from
  // the loaded products (Σ costPrice×quantity). Products are loaded for the active branch, so that
  // branch shows real figures; other branches fall back to whatever the backend supplied.
  const statsByBranch = useMemo(() => {
    const map = new Map<string, { count: number; value: number }>();
    products.forEach((p) => {
      const cur = map.get(p.branchId) ?? { count: 0, value: 0 };
      cur.count += 1;
      cur.value += p.costPrice * p.quantity;
      map.set(p.branchId, cur);
    });
    return map;
  }, [products]);
  const productCountFor = (id: string) => statsByBranch.get(id)?.count ?? branches.find((b) => b.id === id)?.productCount ?? 0;
  const inventoryValueFor = (id: string) => statsByBranch.get(id)?.value ?? branches.find((b) => b.id === id)?.inventoryValue ?? 0;

  const activeCount = branches.filter((b) => b.status === "active").length;
  // The backend refuses to permanently delete the only active branch — mirror that guard here.
  const canDelete = (branch: Branch) => !(branch.status === "active" && activeCount <= 1);
  const totalInventory = sum(branches.map((b) => inventoryValueFor(b.id)));
  const totalProducts = sum(branches.map((b) => productCountFor(b.id)));
  const visible = branches.filter((b) => b.name.toLowerCase().includes(search.trim().toLowerCase()));
  const ranked = [...branches].sort((a, b) => inventoryValueFor(b.id) - inventoryValueFor(a.id));
  const rankAccent = ["from-amber-400 to-yellow-500", "from-slate-300 to-slate-400", "from-orange-400 to-orange-500"];

  const viewing = viewingId ? branches.find((b) => b.id === viewingId) ?? null : null;
  if (viewingId && viewing) {
    return (
      <>
        <BranchDetail
          branch={viewing}
          products={products.filter((p) => p.branchId === viewing.id)}
          staff={staff.filter((s) => s.branchIds.includes(viewing.id))}
          productCount={productCountFor(viewing.id)}
          inventoryValue={inventoryValueFor(viewing.id)}
          online={online}
          canDelete={canDelete(viewing)}
          onBack={() => setViewingId(null)}
          onEdit={() => setEditing(viewing)}
          onDelete={() => setDeleting(viewing)}
        />
        {editing && (
          <BranchModal
            title="Edit branch"
            initial={editing}
            onClose={() => setEditing(null)}
            onSubmit={(data) => {
              updateBranch(editing.id, data);
              setEditing(null);
            }}
          />
        )}
        {deleting && (
          <DeleteBranchModal
            branch={deleting}
            onClose={() => setDeleting(null)}
            onConfirm={() => {
              deleteBranch(deleting.id);
              setDeleting(null);
              setViewingId(null);
            }}
          />
        )}
      </>
    );
  }

  return (
    <div className="space-y-6" style={{ fontFamily: "var(--font-dm-sans)" }}>
      <div className="dashboard-panel flex flex-col gap-4 p-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="rounded-lg bg-blue-600 p-3">
            <BuildingOfficeIcon className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="dashboard-page-title">Branches</h1>
            <p className="dashboard-page-subtitle mt-1">Manage business locations</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => { notify("Refreshing…"); void syncNow(); }} className="dashboard-action-muted">
            <ArrowPathIcon className="mr-2 h-4 w-4" /> Refresh
          </button>
          <button onClick={() => setCreating(true)} disabled={!online} title={online ? "Add branch" : "Online only"} className="dashboard-action-primary disabled:cursor-not-allowed disabled:opacity-50">
            <PlusIcon className="mr-2 h-4 w-4" /> Add branch{!online && " (online only)"}
          </button>
        </div>
      </div>

      <div className="dashboard-panel p-1.5">
        <div className="grid grid-cols-3 gap-1">
          {([
            { id: "dashboard", label: "Dashboard" },
            { id: "branches", label: "Branches" },
            { id: "reports", label: "Reports" },
          ] as const).map((item) => (
            <button key={item.id} onClick={() => setTab(item.id)} className={`rounded-lg py-2.5 text-sm font-medium transition-all ${tab === item.id ? "bg-white text-[#004aad] shadow-sm" : "text-[#64748b] hover:text-[#0f172a]"}`}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "dashboard" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <MetricCard icon={<BuildingOfficeIcon className="h-6 w-6 text-blue-600" />} iconBg="bg-blue-50" label="Total Branches" value={String(branches.length)} hint="Network coverage" />
            <MetricCard icon={<CheckCircleIcon className="h-6 w-6 text-green-600" />} iconBg="bg-green-50" label="Active Branches" value={String(activeCount)} hint={`${branches.length ? Math.round((activeCount / branches.length) * 100) : 0}% online`} />
            <MetricCard icon={<CubeIcon className="h-6 w-6 text-slate-600" />} iconBg="bg-slate-50" label="Total Inventory" value={currency(totalInventory)} hint={`${totalProducts} products`} />
          </div>

          <div className="dashboard-panel p-6">
            <h3 className="dashboard-section-title mb-4">Top Performing Branches</h3>
            {ranked.length === 0 ? (
              <div className="dashboard-empty-state py-8 text-center text-sm text-[#64748b]">No branch data yet.</div>
            ) : (
              <div className="flex flex-col gap-3">
                {ranked.slice(0, 5).map((branch, i) => (
                  <div key={branch.id} className="flex items-center gap-4 rounded-[12px] border border-[#e6ebf2] p-4">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br ${rankAccent[i] ?? "from-slate-200 to-slate-300"} text-sm font-bold text-white`}>{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-[#0f172a]">{branch.name}</p>
                      <p className="text-sm text-[#64748b]">{productCountFor(branch.id)} product{productCountFor(branch.id) === 1 ? "" : "s"} · {branch.city}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-[#16a34a]">{currency(inventoryValueFor(branch.id))}</p>
                      <p className="text-xs text-[#94a3b8]">Inventory value</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "branches" && (
        <>
          <div className="rounded-xl bg-gradient-to-r from-slate-50 to-gray-50 p-6">
            <div className="relative">
              <BuildingOfficeIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search branches" className="w-full rounded-xl border-0 bg-white py-3 pl-10 pr-4 text-sm shadow-sm focus:outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
            {visible.map((branch) => (
              <div key={branch.id} className="dashboard-panel group p-6">
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-xl bg-gradient-to-r ${typeGradient[branch.type]} p-2`}>
                      <BuildingOfficeIcon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-gray-900 group-hover:text-blue-700">{displayBranchName(branch.name, branch.type)}</p>
                      <span className="text-xs font-medium text-gray-500">{branch.code} · {branch.type}</span>
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${branch.status === "active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                    {branch.status === "active" ? "Active" : "Closed"}
                  </span>
                </div>

                <div className="space-y-2">
                  <Row icon={<MapPinIcon className="h-4 w-4 text-gray-400" />} text={branchLocation(branch)} />
                  <Row icon={<PhoneIcon className="h-4 w-4 text-gray-400" />} text={branch.phone} />
                  <Row icon={<EnvelopeIcon className="h-4 w-4 text-gray-400" />} text={branch.email} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-blue-50 p-3 text-center">
                    <p className="text-2xl font-bold text-blue-700">{productCountFor(branch.id)}</p>
                    <p className="text-xs text-blue-600">Products</p>
                  </div>
                  <div className="rounded-lg bg-green-50 p-3 text-center">
                    <p className="text-lg font-bold text-green-700">{currency(inventoryValueFor(branch.id))}</p>
                    <p className="text-xs text-green-600">Inventory</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-r from-blue-400 to-blue-500 text-[10px] font-bold text-white">{branch.manager.charAt(0)}</span>
                  {branch.manager} • Manager
                </div>

                <div className="mt-4 flex gap-2">
                  <button onClick={() => setViewingId(branch.id)} className="inline-flex flex-1 items-center justify-center gap-1 rounded-[10px] border border-[#e6ebf2] py-2 text-sm font-medium text-[#334155] transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700">
                    <EyeIcon className="h-4 w-4" /> View
                  </button>
                  <button onClick={() => setEditing(branch)} disabled={!online} title={online ? "Edit" : "Online only"} className="inline-flex items-center justify-center rounded-[10px] border border-[#e6ebf2] px-3 py-2 text-sm font-medium text-[#334155] transition-colors hover:border-green-300 hover:bg-green-50 hover:text-green-700 disabled:cursor-not-allowed disabled:opacity-50">
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleting(branch)}
                    disabled={!online || !canDelete(branch)}
                    title={!online ? "Online only" : !canDelete(branch) ? "Can't delete the only active branch" : "Delete branch"}
                    className="inline-flex items-center justify-center rounded-[10px] border border-[#e6ebf2] px-3 py-2 text-sm font-medium text-[#334155] transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "reports" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={<CheckCircleIcon className="h-6 w-6 text-green-600" />} iconBg="bg-green-50" label="Active Branch Rate" value={`${branches.length ? Math.round((activeCount / branches.length) * 100) : 0}%`} hint={`${activeCount} of ${branches.length} active`} />
            <MetricCard icon={<CubeIcon className="h-6 w-6 text-blue-600" />} iconBg="bg-blue-50" label="Products Per Branch" value={String(branches.length ? Math.round(totalProducts / branches.length) : 0)} hint="Average" />
            <MetricCard icon={<ChartBarIcon className="h-6 w-6 text-slate-600" />} iconBg="bg-slate-50" label="Average Inventory" value={currency(branches.length ? Math.round(totalInventory / branches.length) : 0)} hint="Per branch" />
            <MetricCard icon={<BuildingOfficeIcon className="h-6 w-6 text-orange-600" />} iconBg="bg-orange-50" label="Low Stock Alerts" value={String(sum(branches.map((b) => b.lowStock)))} hint="Needs attention" />
          </div>

          <div className="dashboard-panel p-6">
            <h3 className="dashboard-section-title mb-4">Branch Performance</h3>
            {ranked.length === 0 ? (
              <div className="dashboard-empty-state py-8 text-center text-sm text-[#64748b]">No branch data yet.</div>
            ) : (
              <div className="flex flex-col gap-4">
                {ranked.map((branch) => {
                  const share = totalInventory > 0 ? Math.round((inventoryValueFor(branch.id) / totalInventory) * 100) : 0;
                  return (
                    <div key={branch.id} className="flex flex-col gap-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <BuildingOfficeIcon className="h-4 w-4 text-[#94a3b8]" />
                          <span className="font-medium text-[#0f172a]">{branch.name}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${branch.status === "active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{branch.status === "active" ? "Active" : "Closed"}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-[#64748b]">
                          <span>{productCountFor(branch.id)} products</span>
                          <span>{branch.lowStock} low</span>
                          <span className="font-semibold text-[#0f172a]">{currency(inventoryValueFor(branch.id))}</span>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-[#eef2f7]"><div className="h-2 rounded-full bg-[#004aad]" style={{ width: `${share}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {creating && (
        <BranchModal
          title="Add branch"
          onClose={() => setCreating(false)}
          onSubmit={(data) => {
            addBranch({ ...data, status: "active", assignedRoles: ["owner"], productCount: 0, inventoryValue: 0, lowStock: 0 });
            setCreating(false);
          }}
        />
      )}
      {editing && (
        <BranchModal
          title="Edit branch"
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={(data) => {
            updateBranch(editing.id, data);
            setEditing(null);
          }}
        />
      )}
      {deleting && (
        <DeleteBranchModal
          branch={deleting}
          onClose={() => setDeleting(null)}
          onConfirm={() => {
            deleteBranch(deleting.id);
            setDeleting(null);
          }}
        />
      )}
    </div>
  );
}

function BranchDetail({
  branch,
  products,
  staff,
  productCount,
  inventoryValue,
  online,
  canDelete,
  onBack,
  onEdit,
  onDelete,
}: {
  branch: Branch;
  products: Product[];
  staff: StaffMember[];
  productCount: number;
  inventoryValue: number;
  online: boolean;
  canDelete: boolean;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isActive = branch.status === "active";
  const lowStock = products.filter((p) => p.status === "low" || p.status === "out").length || branch.lowStock;

  // Category breakdown from the branch's own products (blank when products aren't loaded for this branch).
  const categories = useMemo(() => {
    const map = new Map<string, { count: number; value: number }>();
    products.forEach((p) => {
      const key = p.category || "Uncategorized";
      const cur = map.get(key) ?? { count: 0, value: 0 };
      cur.count += 1;
      cur.value += p.costPrice * p.quantity;
      map.set(key, cur);
    });
    return [...map.entries()].map(([name, s]) => ({ name, ...s })).sort((a, b) => b.value - a.value);
  }, [products]);

  return (
    <div className="space-y-6" style={{ fontFamily: "var(--font-dm-sans)" }}>
      <div className="dashboard-panel flex flex-col gap-4 p-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} title="Back to branches" className="grid h-11 w-11 place-items-center rounded-xl border border-[#e6ebf2] text-[#334155] transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700">
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div className={`rounded-xl bg-gradient-to-r ${typeGradient[branch.type]} p-3`}>
            <BuildingOfficeIcon className="h-8 w-8 text-white" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="dashboard-page-title">{displayBranchName(branch.name, branch.type)}</h1>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{branch.code}</span>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">{branch.type}</span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                {isActive ? <CheckCircleIcon className="h-3.5 w-3.5" /> : <XCircleIcon className="h-3.5 w-3.5" />}
                {isActive ? "Active" : "Closed"}
              </span>
            </div>
            <p className="dashboard-page-subtitle mt-1">Branch details &amp; operations</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="dashboard-action-muted">
            <ArrowLeftIcon className="mr-2 h-4 w-4" /> Back
          </button>
          <button onClick={onEdit} disabled={!online} title={online ? "Edit branch" : "Online only"} className="dashboard-action-primary disabled:cursor-not-allowed disabled:opacity-50">
            <PencilIcon className="mr-2 h-4 w-4" /> Edit details{!online && " (online only)"}
          </button>
          <button
            onClick={onDelete}
            disabled={!online || !canDelete}
            title={!online ? "Online only" : !canDelete ? "Can't delete the only active branch" : "Delete branch"}
            className="inline-flex items-center rounded-[12px] border border-[#fecaca] bg-white px-4 py-2.5 text-sm font-semibold text-[#dc2626] transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <TrashIcon className="mr-2 h-4 w-4" /> Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<CubeIcon className="h-6 w-6 text-blue-600" />} iconBg="bg-blue-50" label="Products" value={String(productCount)} hint="In this branch" />
        <MetricCard icon={<ChartBarIcon className="h-6 w-6 text-green-600" />} iconBg="bg-green-50" label="Inventory Value" value={currency(inventoryValue)} hint="Cost basis" />
        <MetricCard icon={<ExclamationTriangleIcon className="h-6 w-6 text-orange-600" />} iconBg="bg-orange-50" label="Low Stock" value={String(lowStock)} hint="Needs attention" />
        <MetricCard icon={<UsersIcon className="h-6 w-6 text-purple-600" />} iconBg="bg-purple-50" label="Staff" value={String(staff.length)} hint="Assigned members" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="dashboard-panel p-6">
          <h3 className="dashboard-section-title mb-4">Location &amp; Contact</h3>
          <div className="space-y-4">
            <DetailRow icon={<MapPinIcon className="h-4 w-4 text-gray-400" />} label="Location" value={branchLocation(branch)} />
            <DetailRow icon={<PhoneIcon className="h-4 w-4 text-gray-400" />} label="Phone" value={branch.phone} />
            <DetailRow icon={<EnvelopeIcon className="h-4 w-4 text-gray-400" />} label="Email" value={branch.email} />
          </div>
        </div>

        <div className="dashboard-panel p-6">
          <h3 className="dashboard-section-title mb-4">Operational Details</h3>
          <div className="space-y-4">
            <DetailRow
              icon={isActive ? <CheckCircleIcon className="h-4 w-4 text-green-500" /> : <XCircleIcon className="h-4 w-4 text-red-500" />}
              label="Status"
              value={isActive ? "Active" : "Closed"}
            />
            <DetailRow icon={<IdentificationIcon className="h-4 w-4 text-gray-400" />} label="Branch code" value={branch.code} />
            <DetailRow icon={<BuildingOfficeIcon className="h-4 w-4 text-gray-400" />} label="Type" value={branch.type} />
            <div className="flex items-center gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-r from-blue-400 to-blue-500 text-xs font-bold text-white">{branch.manager.charAt(0).toUpperCase()}</span>
              <div>
                <p className="text-xs text-gray-500">Manager</p>
                <p className="font-medium text-gray-900">{branch.manager} • Manager</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-panel p-6">
        <h3 className="dashboard-section-title mb-4">Assigned Staff ({staff.length})</h3>
        {staff.length === 0 ? (
          <div className="dashboard-empty-state flex flex-col items-center py-8 text-center">
            <UsersIcon className="mb-3 h-12 w-12 text-gray-300" />
            <p className="text-sm font-medium text-gray-700">No staff assigned</p>
            <p className="text-xs text-gray-500">No staff members are currently assigned to this branch.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {staff.map((member) => (
              <div key={member.id} className="flex items-center justify-between rounded-[12px] border border-[#e6ebf2] p-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-slate-500 to-slate-600 text-sm font-bold text-white">
                    {member.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[#0f172a]">{member.name}</p>
                    <p className="truncate text-sm text-[#64748b]">{member.role} · {member.email}</p>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${member.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                  {member.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="dashboard-panel p-6">
        <h3 className="dashboard-section-title mb-4">Inventory by Category</h3>
        {categories.length === 0 ? (
          <div className="dashboard-empty-state flex flex-col items-center py-8 text-center">
            <TagIcon className="mb-3 h-12 w-12 text-gray-300" />
            <p className="text-sm font-medium text-gray-700">No product data</p>
            <p className="text-xs text-gray-500">Open this branch to load its products, then reopen to see the breakdown.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {categories.map((cat) => {
              const share = inventoryValue > 0 ? Math.round((cat.value / inventoryValue) * 100) : 0;
              return (
                <div key={cat.name} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <TagIcon className="h-4 w-4 text-[#94a3b8]" />
                      <span className="font-medium text-[#0f172a]">{cat.name}</span>
                      <span className="text-xs text-[#64748b]">{cat.count} product{cat.count === 1 ? "" : "s"}</span>
                    </div>
                    <span className="font-semibold text-[#0f172a]">{currency(cat.value)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#eef2f7]"><div className="h-2 rounded-full bg-[#004aad]" style={{ width: `${share}%` }} /></div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="truncate font-medium text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function DeleteBranchModal({ branch, onClose, onConfirm }: { branch: Branch; onClose: () => void; onConfirm: () => void }) {
  const [confirmText, setConfirmText] = useState("");
  // Type-to-confirm: deleting a branch permanently removes it and every record it owns.
  const matches = confirmText.trim().toLowerCase() === branch.name.trim().toLowerCase();

  return (
    <Modal
      title="Delete branch"
      description="This action is permanent and cannot be undone."
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="dashboard-action-muted">Cancel</button>
          <button
            disabled={!matches}
            onClick={onConfirm}
            className="inline-flex items-center rounded-[12px] bg-[#dc2626] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#b91c1c] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <TrashIcon className="mr-2 h-4 w-4" /> Delete branch
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-[12px] border border-[#fecaca] bg-red-50 p-4">
          <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-[#dc2626]" />
          <div className="text-sm text-[#7f1d1d]">
            <p className="font-semibold">You're about to permanently delete "{branch.name}".</p>
            <p className="mt-1">This also deletes all of its inventory, sales, expenses, debtors, suppliers, and related records. This cannot be recovered.</p>
          </div>
        </div>
        <Field label={`Type the branch name (${branch.name}) to confirm`}>
          <TextInput value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={branch.name} autoFocus />
        </Field>
      </div>
    </Modal>
  );
}

type BranchFormData = Pick<Branch, "name" | "code" | "address" | "city" | "country" | "type" | "phone" | "email" | "manager">;

function BranchModal({ title, initial, onClose, onSubmit }: { title: string; initial?: Branch; onClose: () => void; onSubmit: (data: BranchFormData) => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  // No location defaults: the branch's real address/city/country come from the
  // user — a Nairobi/Kenya default previously mislabeled non-Kenyan branches.
  const [address, setAddress] = useState(initial?.address ?? "");
  const [city, setCity] = useState(initial?.city === "—" ? "" : initial?.city ?? "");
  const [country, setCountry] = useState(initial?.country ?? "");
  const [type, setType] = useState<BranchType>(initial?.type ?? "BRANCH");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [manager, setManager] = useState(initial?.manager ?? "");
  const valid = name.trim().length > 0;

  return (
    <Modal
      title={title}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="dashboard-action-muted">Cancel</button>
          <button
            disabled={!valid}
            onClick={() => onSubmit({ name: name.trim(), code: (code.trim() || name.trim().slice(0, 3)).toUpperCase(), address: address.trim(), city: city.trim(), country: country.trim(), type, phone: phone.trim() || "—", email: email.trim() || "—", manager: manager.trim() || "Unassigned" })}
            className="dashboard-action-primary disabled:opacity-50"
          >
            Save branch
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Branch name"><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Karen Outlet" /></Field>
        <Field label="Branch code"><TextInput value={code} onChange={(e) => setCode(e.target.value)} placeholder="Auto if blank" /></Field>
        <Field label="Street address"><TextInput value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. Diamond Plaza, Rumumasi" /></Field>
        <Field label="City"><TextInput value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Port Harcourt" /></Field>
        <Field label="Country"><TextInput value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. Nigeria" /></Field>
        <Field label="Type">
          <SelectInput value={type} onChange={(e) => setType(e.target.value as BranchType)}>
            {BRANCH_TYPES.map((t) => <option key={t}>{t}</option>)}
          </SelectInput>
        </Field>
        <Field label="Phone"><TextInput value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" /></Field>
        <Field label="Email"><TextInput value={email} onChange={(e) => setEmail(e.target.value)} placeholder="branch@business.com" /></Field>
        <Field label="Manager"><TextInput value={manager} onChange={(e) => setManager(e.target.value)} placeholder="Manager name" /></Field>
      </div>
    </Modal>
  );
}

function MetricCard({ icon, iconBg, label, value, hint }: { icon: React.ReactNode; iconBg: string; label: string; value: string; hint: string }) {
  return (
    <div className="dashboard-panel flex items-center gap-4 p-6">
      <div className={`rounded-lg ${iconBg} p-3`}>{icon}</div>
      <div>
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-400">{hint}</p>
      </div>
    </div>
  );
}

function Row({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      {icon}
      <span className="truncate">{text}</span>
    </div>
  );
}
