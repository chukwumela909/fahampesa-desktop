import { useMemo, useRef, useState } from "react";
import {
  CubeIcon,
  TagIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  CloudArrowUpIcon,
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  QrCodeIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  PhotoIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";
import type { Product } from "@/data";
import { useAppData } from "@/store/AppData";
import { usePermissions } from "@/hooks/usePermissions";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { uploadProductImage } from "@/lib/api";
import { printHtmlBody, escapeHtml } from "@/lib/print";
import { currency, getCurrencySymbol, sum } from "@/lib/format";
import Modal, { Field, SelectInput, TextInput } from "@/components/ui/Modal";

// Same product categories as the web app (src/constants/categories.ts) so the
// two clients offer an identical dropdown.
const CATEGORIES = [
  "General Hardware",
  "Plumbing",
  "Electrical",
  "Tools & Equipment",
  "Building Materials",
  "Paints & Finishes",
  "Safety & Security",
  "Garden & Outdoor",
  "Fasteners & Fixings",
  "Electronics",
  "Food & Beverages",
  "Clothing",
  "Beauty & Health",
  "Home & Garden",
  "Sports & Outdoors",
  "Books & Media",
  "Automotive",
  "Toys & Games",
];
const UNITS = ["unit", "pcs", "kg", "g", "litre", "ml", "box", "pack", "bottle", "can", "bag", "dozen", "set", "pair", "meter"];

type ProductFilter = "all" | "in" | "low" | "out" | "expiring" | "supplier";

const stockText: Record<Product["status"], { label: string; className: string }> = {
  healthy: { label: "In Stock", className: "text-[#66BB6A]" },
  low: { label: "Low Stock", className: "text-[#F29F05]" },
  out: { label: "Out of Stock", className: "text-[#DC2626]" },
};

function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

function printLabel(product: Product) {
  const code = product.barcode || product.sku || product.id;
  // A lightweight barcode-like rendering (vertical bars derived from the code digits).
  const bars = code
    .split("")
    .map((ch) => {
      const w = (ch.charCodeAt(0) % 4) + 1;
      return `<span style="display:inline-block;width:${w}px;height:48px;background:#000;margin-right:1px"></span>`;
    })
    .join("");
  printHtmlBody(
    `Label — ${product.name}`,
    `<div style="font-family:sans-serif;text-align:center;padding:16px;margin:0">
      <div style="font-weight:700;font-size:15px">${escapeHtml(product.name)}</div>
      <div style="font-size:13px;margin:4px 0">${escapeHtml(getCurrencySymbol())} ${product.sellingPrice.toLocaleString()}</div>
      <div style="margin:10px 0;white-space:nowrap;overflow:hidden">${bars}</div>
      <div style="font-size:12px;letter-spacing:2px">${escapeHtml(code)}</div>
    </div>`,
  );
}

export default function ProductsScreen({ branchId }: { branchId: string }) {
  const { products: allProducts, suppliers, addProduct, updateProduct, deleteProduct, notify, online } = useAppData();
  const { canManage } = usePermissions();
  const confirm = useConfirm();
  const products = useMemo(() => allProducts.filter((p) => branchId === "all" || p.branchId === branchId), [allProducts, branchId]);
  const branchSuppliers = useMemo(() => suppliers.filter((s) => branchId === "all" || s.branchId === branchId), [suppliers, branchId]);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ProductFilter>("all");
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<Product | null>(null);
  const [bulk, setBulk] = useState(false);

  const stockValue = sum(products.map((p) => p.costPrice * p.quantity));
  const lowCount = products.filter((p) => p.status === "low").length;
  const outCount = products.filter((p) => p.status === "out").length;

  const visible = products.filter((p) => {
    const q = search.trim().toLowerCase();
    const matches = !q || [p.name, p.category, p.barcode, p.sku ?? ""].some((f) => f.toLowerCase().includes(q));
    if (!matches) return false;
    const dleft = daysUntil(p.expiryDate);
    switch (filter) {
      case "in": return p.status === "healthy";
      case "low": return p.status === "low";
      case "out": return p.status === "out";
      case "expiring": return dleft !== null && dleft <= 30;
      case "supplier": return Boolean(p.supplierId);
      default: return true;
    }
  });

  function exportCsv() {
    const header = ["Name", "SKU", "Barcode", "Category", "Quantity", "Reorder", "Cost", "Selling", "Status"];
    const rows = visible.map((p) => [p.name, p.sku ?? "", p.barcode, p.category, p.quantity, p.reorderLevel, p.costPrice, p.sellingPrice, p.status]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "products.csv";
    link.click();
    URL.revokeObjectURL(url);
    notify(`Exported ${visible.length} products`);
  }

  const filterChips: Array<{ id: ProductFilter; label: string; count: number }> = [
    { id: "all", label: "All", count: products.length },
    { id: "in", label: "In stock", count: products.filter((p) => p.status === "healthy").length },
    { id: "low", label: "Low stock", count: lowCount },
    { id: "out", label: "Out of stock", count: outCount },
    { id: "expiring", label: "Expiring soon", count: products.filter((p) => { const d = daysUntil(p.expiryDate); return d !== null && d <= 30; }).length },
    { id: "supplier", label: "With supplier", count: products.filter((p) => p.supplierId).length },
  ];

  return (
    <div className="space-y-6" style={{ fontFamily: "var(--font-dm-sans)" }}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<CubeIcon className="h-6 w-6 text-[#2175C7]" />} label="Total Products" value={String(products.length)} />
        <StatCard icon={<TagIcon className="h-6 w-6 text-[#66BB6A]" />} label="Stock Value" value={currency(stockValue)} hint="Total cost of stock on hand" />
        <StatCard icon={<ExclamationTriangleIcon className="h-6 w-6 text-[#F29F05]" />} label="Low Stock" value={String(lowCount)} />
        <StatCard icon={<ExclamationTriangleIcon className="h-6 w-6 text-[#DC2626]" />} label="Out of Stock" value={String(outCount)} />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {canManage && <ActionButton icon={PlusIcon} label="Add product" onClick={() => setCreating(true)} />}
        {canManage && <ActionButton icon={CloudArrowUpIcon} label="Bulk upload" onClick={() => setBulk(true)} />}
        <ActionButton icon={MagnifyingGlassIcon} label="Clear filters" onClick={() => { setFilter("all"); setSearch(""); }} />
        <ActionButton icon={ArrowDownTrayIcon} label="Export CSV" onClick={exportCsv} />
      </div>

      <div className="dashboard-panel p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="dashboard-section-title">Products</h3>
          <div className="relative w-full sm:w-80">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#94a3b8]" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, barcode, SKU, or category" className="dashboard-field w-full py-2 pl-10 pr-3 text-sm" />
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {filterChips.map((chip) => (
            <button
              key={chip.id}
              onClick={() => setFilter(chip.id)}
              className={`rounded-[8px] px-3 py-1.5 text-xs font-medium transition ${filter === chip.id ? "bg-[#e8f3ff] text-[#0058c7]" : "bg-[#f2f3f6] text-[#676d78] hover:bg-[#e9edf3]"}`}
            >
              {chip.label} ({chip.count})
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className="dashboard-empty-state py-8 text-center text-sm text-[#64748b]">No products match your search/filter.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {visible.map((product) => {
              const status = stockText[product.status];
              const image = product.images?.[0];
              return (
                <div key={product.id} className="dashboard-list-item flex items-center gap-4 p-4">
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-[12px] border border-[#e6ebf2] bg-[#f8fafc]">
                    {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <CubeIcon className="h-6 w-6 text-[#94a3b8]" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-[#0f172a]">{product.name}</p>
                    <p className="truncate text-sm font-medium text-[#64748b]">{product.quantity} {product.unitOfMeasure ?? "pcs"} · {product.category}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-medium text-[#94a3b8]">
                      <span>Reorder {product.reorderLevel}</span>
                      <span>Cost {currency(product.costPrice)}</span>
                      <span>Stock value {currency(product.costPrice * product.quantity)}</span>
                      {product.expiryDate && <span>Exp {new Date(product.expiryDate).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  <div className="hidden text-right sm:block">
                    <p className="font-semibold text-[#66BB6A]">{currency(product.sellingPrice)}</p>
                    <p className={`text-xs font-semibold ${status.className}`}>{status.label}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setViewing(product)} className="inline-flex items-center gap-1 text-xs font-semibold text-[#004aad] transition-colors hover:text-[#003d8f]">
                      <EyeIcon className="h-4 w-4" /> View
                    </button>
                    <button onClick={() => printLabel(product)} className="inline-flex items-center gap-1 text-xs font-semibold text-[#004aad] transition-colors hover:text-[#003d8f]">
                      <QrCodeIcon className="h-4 w-4" /> Label
                    </button>
                    {canManage && (
                      <button onClick={() => setEditing(product)} className="inline-flex items-center gap-1 text-xs font-semibold text-[#004aad] transition-colors hover:text-[#003d8f]">
                        <PencilIcon className="h-4 w-4" /> Edit
                      </button>
                    )}
                    {canManage && (
                      <button
                        onClick={async () => { if (await confirm({ title: "Delete product?", message: `"${product.name}" will be removed.`, confirmLabel: "Delete", danger: true })) deleteProduct(product.id); }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#dc2626] transition-colors hover:text-[#b91c1c]"
                      >
                        <TrashIcon className="h-4 w-4" /> Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {creating && (
        <ProductModal
          title="Add product"
          suppliers={branchSuppliers}
          online={online}
          notify={notify}
          onClose={() => setCreating(false)}
          onSubmit={(data) => {
            addProduct({ ...data, branchId, lastMovement: "Added just now" });
            setCreating(false);
          }}
        />
      )}
      {editing && (
        <ProductModal
          title="Edit product"
          initial={editing}
          suppliers={branchSuppliers}
          online={online}
          notify={notify}
          onClose={() => setEditing(null)}
          onSubmit={(data) => {
            updateProduct(editing.id, data);
            setEditing(null);
          }}
        />
      )}
      {viewing && <ProductDetailModal product={viewing} suppliers={branchSuppliers} onClose={() => setViewing(null)} onPrint={() => printLabel(viewing)} />}
      {bulk && (
        <BulkUploadModal
          onClose={() => setBulk(false)}
          onImport={(rows) => {
            rows.forEach((r) => addProduct({ ...r, branchId, supplierId: "", lastMovement: "Bulk imported" }));
            setBulk(false);
            notify(`Imported ${rows.length} products`);
          }}
        />
      )}
    </div>
  );
}

type ProductFormData = Omit<Product, "id" | "status" | "branchId" | "lastMovement">;

function ProductModal({
  title,
  initial,
  suppliers,
  online,
  notify,
  onClose,
  onSubmit,
}: {
  title: string;
  initial?: Product;
  suppliers: { id: string; name: string }[];
  online: boolean;
  notify: (m: string) => void;
  onClose: () => void;
  onSubmit: (data: ProductFormData) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [sku, setSku] = useState(initial?.sku ?? "");
  const [barcode, setBarcode] = useState(initial?.barcode ?? "");
  const [category, setCategory] = useState(initial?.category ?? CATEGORIES[0]);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [unitOfMeasure, setUnitOfMeasure] = useState(initial?.unitOfMeasure ?? "unit");
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? ""));
  const [reorderLevel, setReorderLevel] = useState(String(initial?.reorderLevel ?? "10"));
  const [costPrice, setCostPrice] = useState(String(initial?.costPrice ?? ""));
  const [sellingPrice, setSellingPrice] = useState(String(initial?.sellingPrice ?? ""));
  const [supplierId, setSupplierId] = useState(initial?.supplierId ?? "");
  const [binLocation, setBinLocation] = useState(initial?.binLocation ?? "");
  const [batchNumber, setBatchNumber] = useState(initial?.batchNumber ?? "");
  const [expiryDate, setExpiryDate] = useState(initial?.expiryDate ? initial.expiryDate.slice(0, 10) : "");
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [isPerishable, setIsPerishable] = useState(Boolean(initial?.isPerishable));
  const [images, setImages] = useState<string[]>(initial?.images ?? []);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const valid = name.trim() && Number(sellingPrice) > 0;
  const margin = (Number(sellingPrice) || 0) - (Number(costPrice) || 0);
  const marginPct = Number(costPrice) > 0 ? Math.round((margin / Number(costPrice)) * 100) : 0;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (images.length >= 3) break;
        const asset = await uploadProductImage(file);
        setImages((cur) => (cur.length >= 3 ? cur : [...cur, asset.url]));
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "Image upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <Modal
      title={title}
      description="Stock changes only via sale, purchase, or adjustment"
      size="lg"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="dashboard-action-muted">Cancel</button>
          <button
            disabled={!valid}
            onClick={() =>
              onSubmit({
                name: name.trim(),
                sku: sku.trim() || undefined,
                barcode: barcode.trim() || String(Math.floor(100000000 + Math.random() * 800000000)),
                category,
                description: description.trim() || undefined,
                unitOfMeasure,
                quantity: Number(quantity) || 0,
                reorderLevel: Number(reorderLevel) || 0,
                costPrice: Number(costPrice) || 0,
                sellingPrice: Number(sellingPrice) || 0,
                supplierId,
                binLocation: binLocation.trim() || undefined,
                batchNumber: batchNumber.trim() || undefined,
                expiryDate: expiryDate || undefined,
                tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
                isPerishable,
                images,
              })
            }
            className="dashboard-action-primary disabled:opacity-50"
          >
            Save product
          </button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Images */}
        <section>
          <p className="mb-2 text-sm font-semibold text-[#0f172a]">Images <span className="font-normal text-[#94a3b8]">(up to 3, first is primary)</span></p>
          <div className="flex flex-wrap items-center gap-3">
            {images.map((url, i) => (
              <div key={url} className="relative h-20 w-20 overflow-hidden rounded-[10px] border border-[#e6ebf2]">
                <img src={url} alt="" className="h-full w-full object-cover" />
                {i === 0 && <span className="absolute left-1 top-1 rounded bg-[#004aad] px-1 text-[9px] font-semibold text-white">Primary</span>}
                <button onClick={() => setImages((cur) => cur.filter((u) => u !== url))} className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white">
                  <XMarkIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {images.length < 3 && (
              <button
                type="button"
                disabled={!online || uploading}
                onClick={() => fileRef.current?.click()}
                className="grid h-20 w-20 place-items-center rounded-[10px] border-2 border-dashed border-[#dbe3ee] text-[#94a3b8] transition hover:border-[#004aad] hover:text-[#004aad] disabled:cursor-not-allowed disabled:opacity-50"
                title={online ? "Add image" : "Connect to add images"}
              >
                {uploading ? <span className="text-[10px]">Uploading…</span> : <PhotoIcon className="h-7 w-7" />}
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
          </div>
          {!online && <p className="mt-1 text-xs text-[#94a3b8]">Connect to the internet to add product images.</p>}
        </section>

        {/* Basics */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Product name"><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Premium Rice 5kg" /></Field>
          <Field label="Category">
            {/* Keep a legacy/unknown category selectable when editing an older product. */}
            <SelectInput value={category} onChange={(e) => setCategory(e.target.value)}>
              {(CATEGORIES.includes(category) ? CATEGORIES : [category, ...CATEGORIES]).map((c) => <option key={c}>{c}</option>)}
            </SelectInput>
          </Field>
          <Field label="SKU"><TextInput value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Optional" /></Field>
          <Field label="Barcode">
            <div className="flex gap-2">
              <TextInput value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Auto if blank" />
              <button type="button" onClick={() => setBarcode(String(Math.floor(100000000 + Math.random() * 800000000)))} className="dashboard-action-muted shrink-0 px-3 text-xs">Generate</button>
            </div>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description"><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Optional" className="dashboard-field w-full resize-none px-3 py-2 text-sm" /></Field>
          </div>
        </div>

        {/* Pricing & stock */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Cost price"><TextInput type="number" min="0" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} placeholder="0" /></Field>
          <Field label="Selling price"><TextInput type="number" min="0" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} placeholder="0" /></Field>
          <Field label="Unit of measure">
            <SelectInput value={unitOfMeasure} onChange={(e) => setUnitOfMeasure(e.target.value)}>{UNITS.map((u) => <option key={u}>{u}</option>)}</SelectInput>
          </Field>
          <Field label="Quantity">
            {/* Create-only: the update endpoint ignores quantity, so an editable field
                here "saved" then silently reverted. Stock changes go through Inventory. */}
            <TextInput type="number" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" disabled={Boolean(initial)} className={initial ? "opacity-60" : undefined} />
            {initial && <p className="mt-1 text-xs text-[#94a3b8]">Adjust stock from the Inventory screen.</p>}
          </Field>
          <Field label="Reorder level"><TextInput type="number" min="0" value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} /></Field>
          <Field label="Supplier">
            <SelectInput value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">None</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </SelectInput>
          </Field>
        </div>

        {sellingPrice && (
          <div className="rounded-[10px] bg-[#f8fafc] px-4 py-2 text-sm">
            <span className="text-[#64748b]">Profit margin: </span>
            <span className={`font-semibold ${margin < 0 ? "text-[#dc2626]" : "text-[#16a34a]"}`}>{currency(margin)} ({marginPct}%)</span>
          </div>
        )}

        {/* Advanced */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Bin location"><TextInput value={binLocation} onChange={(e) => setBinLocation(e.target.value)} placeholder="e.g. A1" /></Field>
          <Field label="Batch number"><TextInput value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} placeholder="Optional" /></Field>
          <Field label="Expiry date"><TextInput type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} /></Field>
          <div className="sm:col-span-2">
            <Field label="Tags"><TextInput value={tags} onChange={(e) => setTags(e.target.value)} placeholder="comma, separated" /></Field>
          </div>
          <div className="flex items-end">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[#334155]">
              <input type="checkbox" checked={isPerishable} onChange={(e) => setIsPerishable(e.target.checked)} className="h-4 w-4 rounded border-[#cbd5e1]" />
              Perishable item
            </label>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function ProductDetailModal({ product, suppliers, onClose, onPrint }: { product: Product; suppliers: { id: string; name: string }[]; onClose: () => void; onPrint: () => void }) {
  const supplier = suppliers.find((s) => s.id === product.supplierId);
  const margin = product.sellingPrice - product.costPrice;
  return (
    <Modal
      title={product.name}
      description={product.category}
      size="lg"
      onClose={onClose}
      footer={<><button onClick={onClose} className="dashboard-action-muted">Close</button><button onClick={onPrint} className="dashboard-action-primary"><QrCodeIcon className="mr-1 h-4 w-4" /> Print label</button></>}
    >
      <div className="space-y-5">
        {product.images && product.images.length > 0 && (
          <div className="flex gap-3">
            {product.images.map((url) => <img key={url} src={url} alt="" className="h-28 w-28 rounded-[12px] border border-[#e6ebf2] object-cover" />)}
          </div>
        )}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Detail label="Selling price" value={currency(product.sellingPrice)} />
          <Detail label="Cost price" value={currency(product.costPrice)} />
          <Detail label="Margin" value={`${currency(margin)}`} />
          <Detail label="In stock" value={`${product.quantity} ${product.unitOfMeasure ?? "pcs"}`} />
          <Detail label="Reorder at" value={String(product.reorderLevel)} />
          <Detail label="Status" value={stockText[product.status].label} />
          <Detail label="SKU" value={product.sku || "—"} />
          <Detail label="Barcode" value={product.barcode || "—"} />
          <Detail label="Supplier" value={supplier?.name || "—"} />
          <Detail label="Bin location" value={product.binLocation || "—"} />
          <Detail label="Batch" value={product.batchNumber || "—"} />
          <Detail label="Expiry" value={product.expiryDate ? new Date(product.expiryDate).toLocaleDateString() : "—"} />
        </div>
        {product.description && <div><p className="text-xs font-medium text-[#64748b]">Description</p><p className="text-sm text-[#0f172a]">{product.description}</p></div>}
        {product.tags && product.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">{product.tags.map((t) => <span key={t} className="rounded-md bg-[#eef5ff] px-2 py-1 text-xs font-medium text-[#004aad]">{t}</span>)}</div>
        )}
        <p className="text-xs text-[#94a3b8]">{product.lastMovement}{product.isPerishable ? " · Perishable" : ""}</p>
      </div>
    </Modal>
  );
}

function BulkUploadModal({ onClose, onImport }: { onClose: () => void; onImport: (rows: ProductFormData[]) => void }) {
  const [rows, setRows] = useState<ProductFormData[]>([]);
  const [error, setError] = useState("");

  function parse(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result);
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        if (lines.length < 2) { setError("CSV needs a header row and at least one product."); return; }
        const header = lines[0].split(",").map((h) => h.replace(/"/g, "").trim().toLowerCase());
        const idx = (name: string) => header.indexOf(name);
        const parsed: ProductFormData[] = lines.slice(1).map((line) => {
          const cells = line.split(",").map((c) => c.replace(/^"|"$/g, "").trim());
          const get = (n: string) => (idx(n) >= 0 ? cells[idx(n)] : "");
          return {
            name: get("name"),
            sku: get("sku") || undefined,
            barcode: get("barcode") || String(Math.floor(100000000 + Math.random() * 800000000)),
            category: get("category") || "Other",
            quantity: Number(get("quantity")) || 0,
            reorderLevel: Number(get("reorder")) || 0,
            costPrice: Number(get("cost")) || 0,
            sellingPrice: Number(get("selling")) || 0,
            supplierId: "",
            unitOfMeasure: "unit",
            images: [],
          };
        }).filter((r) => r.name);
        if (parsed.length === 0) { setError("No valid rows found. Need a 'name' column."); return; }
        setError("");
        setRows(parsed);
      } catch {
        setError("Could not parse that file.");
      }
    };
    reader.readAsText(file);
  }

  return (
    <Modal
      title="Bulk upload products"
      description="Import from a CSV with columns: Name, SKU, Barcode, Category, Quantity, Reorder, Cost, Selling"
      onClose={onClose}
      footer={<><button onClick={onClose} className="dashboard-action-muted">Cancel</button><button disabled={rows.length === 0} onClick={() => onImport(rows)} className="dashboard-action-primary disabled:opacity-50">Import {rows.length || ""}</button></>}
    >
      <div className="space-y-4">
        <input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && parse(e.target.files[0])} className="dashboard-field w-full px-3 py-2 text-sm" />
        {error && <p className="rounded-[8px] bg-[#fff1ee] px-3 py-2 text-sm text-[#d92d20]">{error}</p>}
        {rows.length > 0 && (
          <div className="rounded-[10px] border border-[#e6ebf2]">
            <div className="border-b border-[#e6ebf2] px-3 py-2 text-sm font-semibold text-[#0f172a]">{rows.length} products ready</div>
            <div className="max-h-48 overflow-y-auto">
              {rows.slice(0, 20).map((r, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="truncate text-[#0f172a]">{r.name}</span>
                  <span className="text-[#64748b]">{currency(r.sellingPrice)} · {r.quantity}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-[#64748b]">{label}</p>
      <p className="text-sm font-semibold text-[#0f172a]">{value}</p>
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick }: { icon: typeof PlusIcon; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="dashboard-action-secondary min-h-[72px] w-full p-6">
      <span className="flex items-center justify-center gap-3">
        <Icon className="h-5 w-5 text-[#004aad]" />
        <span className="text-sm font-medium">{label}</span>
      </span>
    </button>
  );
}

function StatCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="dashboard-card p-6">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[12px] bg-[#f8fafc]">{icon}</div>
      <p className="text-sm font-medium text-[#64748b]">{label}</p>
      <p className="dashboard-metric-value text-3xl font-semibold tracking-[-0.02em] text-[#0f172a]">{value}</p>
      {hint && <p className="mt-1 text-xs font-medium text-[#94a3b8]">{hint}</p>}
    </div>
  );
}
