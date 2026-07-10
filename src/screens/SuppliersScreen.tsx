import { useState } from "react";
import {
  TruckIcon,
  PlusIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  PhoneIcon,
  EnvelopeIcon,
  MapPinIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";
import type { Supplier } from "@/data";
import { useAppData } from "@/store/AppData";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import Modal, { Field, TextInput } from "@/components/ui/Modal";

const CATEGORY_OPTIONS = ["General", "Pantry", "Beverage", "Household", "Electronics", "Hardware", "Packaging", "Raw Materials", "Office Supplies", "Services", "Other"];

export default function SuppliersScreen({ branchId }: { branchId: string }) {
  const { suppliers, addSupplier, updateSupplier, deleteSupplier, notify } = useAppData();
  const confirm = useConfirm();
  const branchSuppliers = suppliers.filter((s) => branchId === "all" || s.branchId === branchId);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<Supplier | null>(null);

  const visible = branchSuppliers.filter((s) =>
    [s.name, s.contact, s.phone, s.email ?? "", ...(s.categories ?? []), ...(s.productsSupplied ?? [])]
      .some((f) => f.toLowerCase().includes(search.trim().toLowerCase())),
  );

  return (
    <div className="space-y-6" style={{ fontFamily: "var(--font-dm-sans)" }}>
      <div className="dashboard-panel flex flex-col gap-4 p-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="rounded-lg bg-blue-600 p-3"><TruckIcon className="h-8 w-8 text-white" /></div>
          <div><h1 className="dashboard-page-title">Suppliers</h1><p className="dashboard-page-subtitle mt-1">{branchSuppliers.length} supplier{branchSuppliers.length === 1 ? "" : "s"} on file</p></div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => notify("Suppliers refreshed")} className="dashboard-action-muted"><ArrowPathIcon className="mr-2 h-4 w-4" /> Refresh</button>
          <button onClick={() => setCreating(true)} className="dashboard-action-primary"><PlusIcon className="mr-2 h-4 w-4" /> Add supplier</button>
        </div>
      </div>

      <div className="dashboard-panel p-5">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, contact, category, or product" className="dashboard-field w-full py-3 pl-10 pr-4 text-sm" />
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="dashboard-panel p-16 text-center">
          <div className="mx-auto mb-6 grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50"><TruckIcon className="h-12 w-12 text-gray-400" /></div>
          <h3 className="mb-3 text-2xl font-bold text-gray-900">No suppliers found</h3>
          <p className="mx-auto max-w-md text-gray-600">Add suppliers for the active branch to track who supplies your products.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {visible.map((supplier) => (
            <div key={supplier.id} className="dashboard-panel flex h-full flex-col p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 p-2"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-lg font-bold text-white">{supplier.name.charAt(0)}</div></div>
                <div className="min-w-0"><p className="truncate text-lg font-bold text-gray-900">{supplier.name}</p>{supplier.contact && supplier.contact !== "—" && <p className="truncate text-sm font-medium text-gray-600">{supplier.contact}</p>}</div>
              </div>
              <div className="space-y-2">
                <ContactRow icon={<PhoneIcon className="h-4 w-4 text-gray-400" />} text={supplier.phone} />
                {supplier.email && <ContactRow icon={<EnvelopeIcon className="h-4 w-4 text-gray-400" />} text={supplier.email} />}
                <ContactRow icon={<MapPinIcon className="h-4 w-4 text-gray-400" />} text={supplier.address || "—"} />
              </div>
              {supplier.categories && supplier.categories.length > 0 && (
                <div className="mt-4">
                  <p className="mb-1.5 text-xs font-medium text-gray-500">Categories</p>
                  <div className="flex flex-wrap gap-1.5">{supplier.categories.map((c) => <span key={c} className="rounded-md bg-[#ecfdf3] px-2 py-0.5 text-xs font-medium text-[#027a48]">{c}</span>)}</div>
                </div>
              )}
              {supplier.productsSupplied && supplier.productsSupplied.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1.5 text-xs font-medium text-gray-500">Products supplied</p>
                  <div className="flex flex-wrap gap-1.5">{supplier.productsSupplied.map((p) => <span key={p} className="rounded-md bg-[#eef5ff] px-2 py-0.5 text-xs font-medium text-[#004aad]">{p}</span>)}</div>
                </div>
              )}
              <div className="mt-auto flex gap-2 pt-5">
                <button onClick={() => setViewing(supplier)} className="inline-flex flex-1 items-center justify-center gap-1 rounded-[10px] border border-[#e6ebf2] py-2 text-sm font-medium text-[#334155] hover:bg-[#f8fafc] hover:text-[#004aad]"><EyeIcon className="h-4 w-4" /> View</button>
                <button onClick={() => setEditing(supplier)} className="rounded-[10px] border border-[#e6ebf2] px-3 py-2 text-[#334155] hover:bg-blue-50 hover:text-blue-700" title="Edit"><PencilIcon className="h-4 w-4" /></button>
                <button onClick={async () => { if (await confirm({ title: "Delete supplier?", message: `"${supplier.name}" will be removed.`, confirmLabel: "Delete", danger: true })) deleteSupplier(supplier.id); }} className="rounded-[10px] border border-[#e6ebf2] px-3 py-2 text-[#334155] hover:bg-red-50 hover:text-red-700" title="Delete"><TrashIcon className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {creating && <SupplierModal title="Add supplier" onClose={() => setCreating(false)} onSubmit={(d) => { addSupplier({ ...d, branchId, totalPurchases: 0, outstanding: 0, status: "active" }); setCreating(false); }} />}
      {editing && <SupplierModal title="Edit supplier" initial={editing} onClose={() => setEditing(null)} onSubmit={(d) => { updateSupplier(editing.id, d); setEditing(null); }} />}
      {viewing && <SupplierDetailModal supplier={viewing} onClose={() => setViewing(null)} onEdit={() => { setEditing(viewing); setViewing(null); }} />}
    </div>
  );
}

type SupplierFormData = Pick<Supplier, "name" | "contact" | "phone" | "email" | "address" | "categories" | "productsSupplied">;

function SupplierModal({ title, initial, onClose, onSubmit }: { title: string; initial?: Supplier; onClose: () => void; onSubmit: (d: SupplierFormData) => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [contact, setContact] = useState(initial?.contact === "—" ? "" : initial?.contact ?? "");
  const [phone, setPhone] = useState(initial?.phone === "—" ? "" : initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [categories, setCategories] = useState<string[]>(initial?.categories ?? []);
  const [productsSupplied, setProductsSupplied] = useState((initial?.productsSupplied ?? []).join(", "));
  const valid = name.trim().length > 0;
  const toggleCat = (c: string) => setCategories((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));

  return (
    <Modal title={title} size="lg" onClose={onClose}
      footer={<><button onClick={onClose} className="dashboard-action-muted">Cancel</button><button disabled={!valid} onClick={() => onSubmit({ name: name.trim(), contact: contact.trim() || "—", phone: phone.trim() || "—", email: email.trim() || undefined, address: address.trim() || undefined, categories, productsSupplied: productsSupplied.split(",").map((p) => p.trim()).filter(Boolean) })} className="dashboard-action-primary disabled:opacity-50">Save supplier</button></>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Supplier name"><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Nairobi Grain Traders" /></Field>
        <Field label="Contact person"><TextInput value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Full name" /></Field>
        <Field label="Phone"><TextInput value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+254 …" /></Field>
        <Field label="Email"><TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Optional" /></Field>
        <div className="sm:col-span-2"><Field label="Address"><TextInput value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Optional" /></Field></div>
        <div className="sm:col-span-2"><Field label="Products supplied"><TextInput value={productsSupplied} onChange={(e) => setProductsSupplied(e.target.value)} placeholder="comma, separated" /></Field></div>
      </div>
      <div className="mt-4">
        <p className="mb-2 text-sm font-medium text-gray-700">Categories</p>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_OPTIONS.map((c) => (
            <button key={c} type="button" onClick={() => toggleCat(c)} className={`rounded-[8px] px-3 py-1.5 text-xs font-medium transition ${categories.includes(c) ? "bg-[#e8f3ff] text-[#0058c7]" : "bg-[#f2f3f6] text-[#676d78] hover:bg-[#e9edf3]"}`}>{c}</button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function SupplierDetailModal({ supplier, onClose, onEdit }: { supplier: Supplier; onClose: () => void; onEdit: () => void }) {
  return (
    <Modal title={supplier.name} description={supplier.contact !== "—" ? supplier.contact : undefined} size="lg" onClose={onClose}
      footer={<><button onClick={onClose} className="dashboard-action-muted">Close</button><button onClick={onEdit} className="dashboard-action-primary">Edit supplier</button></>}>
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Detail label="Phone" value={supplier.phone} />
          {supplier.email && <Detail label="Email" value={supplier.email} />}
          {supplier.address && <Detail label="Address" value={supplier.address} />}
        </div>
        {supplier.categories && supplier.categories.length > 0 && (
          <div><p className="mb-1 text-xs font-medium text-[#64748b]">Categories</p><div className="flex flex-wrap gap-1.5">{supplier.categories.map((c) => <span key={c} className="rounded-md bg-[#ecfdf3] px-2 py-0.5 text-xs font-medium text-[#027a48]">{c}</span>)}</div></div>
        )}
        {supplier.productsSupplied && supplier.productsSupplied.length > 0 && (
          <div><p className="mb-1 text-xs font-medium text-[#64748b]">Products supplied</p><div className="flex flex-wrap gap-1.5">{supplier.productsSupplied.map((p) => <span key={p} className="rounded-md bg-[#eef5ff] px-2 py-0.5 text-xs font-medium text-[#004aad]">{p}</span>)}</div></div>
        )}
      </div>
    </Modal>
  );
}

function ContactRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div className="flex items-center gap-2 text-sm text-gray-600">{icon}<span className="truncate">{text}</span></div>;
}
function Detail({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-medium text-[#64748b]">{label}</p><p className="text-sm font-semibold text-[#0f172a]">{value}</p></div>;
}
