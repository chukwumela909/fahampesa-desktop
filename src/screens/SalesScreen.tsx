import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Clock, History, LogOut, Loader2, Minus, Package, Plus, Power, Search, ShoppingCart, Trash2, User, Wifi, X } from "lucide-react";
import type { HeldSale, Sale } from "@/data";
import { useAppData } from "@/store/AppData";
import { formatMoney } from "@/lib/format";
import ReceiptModal from "@/components/ReceiptModal";

type PaymentMethodId = "CASH" | "MPESA" | "BANK_TRANSFER" | "CARD" | "CREDIT";
type DiscountType = "fixed" | "percentage";

const PAYMENT_METHODS: Array<{ id: PaymentMethodId; label: string }> = [
  { id: "CASH", label: "Cash" },
  { id: "MPESA", label: "M-Pesa" },
  { id: "BANK_TRANSFER", label: "Bank Transfer" },
  { id: "CARD", label: "Card" },
  { id: "CREDIT", label: "Credit" },
];
const PAYMENT_LABEL: Record<PaymentMethodId, string> = {
  CASH: "Cash",
  MPESA: "M-Pesa record",
  BANK_TRANSFER: "Bank Transfer",
  CARD: "Card record",
  CREDIT: "Credit",
};

type LineDiscount = { value: string; type: DiscountType };

interface SalesScreenProps {
  branchId: string;
  cashierName: string;
  onBack: () => void;
  onSignOut: () => void;
  onViewHistory: () => void;
}

export default function SalesScreen({ branchId, cashierName, onBack, onSignOut, onViewHistory }: SalesScreenProps) {
  const { products: allProducts, sales: allSales, debtors, settings, completeSale, holdSale, removeHeld, heldSales } = useAppData();
  // Default tax rate (%) comes from the business's configured VAT rate in settings.
  const defaultTaxRate = settings.taxRate ?? "";
  const products = useMemo(() => allProducts.filter((p) => branchId === "all" || p.branchId === branchId), [allProducts, branchId]);
  const recentSales = useMemo(
    () => allSales.filter((s) => (branchId === "all" || s.branchId === branchId) && !s.refunded).slice(0, 6),
    [allSales, branchId],
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [lineDiscounts, setLineDiscounts] = useState<Record<string, LineDiscount>>({});
  const [customerName, setCustomerName] = useState("");
  const [debtorId, setDebtorId] = useState("");
  // The right panel starts on a landing view (Record Sale button + recent sales); the cart
  // form is revealed only after the user starts recording a sale, matching the web POS.
  const [recording, setRecording] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId>("CASH");
  // `tax` holds the tax RATE as a percentage string (not an absolute amount);
  // the amount is derived from the cart subtotal below. Seeded from settings VAT.
  const [tax, setTax] = useState(defaultTaxRate);
  const [discount, setDiscount] = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>("fixed");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [receipt, setReceipt] = useState<Sale | null>(null);
  const [showHeld, setShowHeld] = useState(false);
  // Follow the live sale so the open receipt reflects the backend saleNumber once it syncs
  // (the optimistic row keeps its stable id, so this lookup survives reconciliation & refresh).
  const receiptLive = receipt ? allSales.find((s) => s.id === receipt.id) ?? receipt : null;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Settings (and the configured VAT rate) load asynchronously after sign-in.
  // Keep the tax field in sync with the configured rate while not mid-sale so
  // new sales pick up the latest business tax rate without clobbering edits.
  useEffect(() => {
    if (!recording) setTax(defaultTaxRate);
  }, [defaultTaxRate, recording]);

  const displayTime = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const displayDate = now.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });

  const categoryOptions = useMemo(() => {
    const counts = new Map<string, number>();
    products.forEach((product) => counts.set(product.category, (counts.get(product.category) ?? 0) + 1));
    return [{ value: "all", label: "All", count: products.length }, ...Array.from(counts.entries()).map(([value, count]) => ({ value, label: value, count }))];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return products
      .filter((product) => {
        if (selectedCategory !== "all" && product.category !== selectedCategory) return false;
        if (!query) return true;
        return product.name.toLowerCase().includes(query) || product.barcode.toLowerCase().includes(query) || product.category.toLowerCase().includes(query);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, searchQuery, selectedCategory]);

  const cartItems = useMemo(
    () =>
      Object.entries(cart)
        .map(([productId, quantity]) => {
          const product = products.find((item) => item.id === productId);
          if (!product) return null;
          const ld = lineDiscounts[productId];
          const gross = product.sellingPrice * quantity;
          const dval = Number(ld?.value) || 0;
          const discountAmount = ld?.type === "percentage" ? (gross * dval) / 100 : dval;
          const lineTotal = Math.max(0, gross - discountAmount);
          return { product, quantity, gross, discountAmount, lineTotal, ld };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
    [cart, products, lineDiscounts],
  );

  const cartQuantity = cartItems.reduce((t, i) => t + i.quantity, 0);
  const subtotal = cartItems.reduce((t, i) => t + i.lineTotal, 0);
  // Tax is entered as a percentage rate and applied to the subtotal (VAT-style).
  const taxRate = Math.max(0, Number(tax) || 0);
  const taxAmount = (subtotal * taxRate) / 100;
  const discountValue = Number(discount) || 0;
  // Cart discount applies to the taxed base (subtotal + tax), matching the backend.
  const cartDiscountBase = subtotal + taxAmount;
  const cartDiscountAmount = discountType === "percentage" ? (cartDiscountBase * discountValue) / 100 : discountValue;
  const totalAmount = Math.max(0, cartDiscountBase - cartDiscountAmount);

  function addProduct(product: (typeof products)[number]) {
    setRecording(true);
    setCart((current) => {
      const existing = current[product.id] ?? 0;
      if (existing >= product.quantity) return current;
      return { ...current, [product.id]: existing + 1 };
    });
  }
  function reduceProduct(productId: string) {
    setCart((current) => {
      const existing = current[productId] ?? 0;
      if (existing <= 1) { const next = { ...current }; delete next[productId]; return next; }
      return { ...current, [productId]: existing - 1 };
    });
  }
  function removeCartItem(productId: string) {
    setCart((current) => { const next = { ...current }; delete next[productId]; return next; });
  }
  function setLineDiscount(productId: string, patch: Partial<LineDiscount>) {
    setLineDiscounts((cur) => ({ ...cur, [productId]: { value: patch.value ?? cur[productId]?.value ?? "", type: patch.type ?? cur[productId]?.type ?? "fixed" } }));
  }

  function clearSale() {
    setCart({});
    setLineDiscounts({});
    setCustomerName("");
    setDebtorId("");
    setTax(defaultTaxRate);
    setDiscount("");
    setNotes("");
    setPaymentMethod("CASH");
  }

  function onHoldSale() {
    if (cartItems.length === 0) return;
    holdSale({ customerName, customerPhone: "", customerEmail: "", debtorId, paymentMethod, tax, discount, discountType, notes, cart, lineDiscounts });
    clearSale();
    setRecording(false);
  }

  function resumeHeld(held: HeldSale) {
    setCart(held.cart);
    setLineDiscounts(held.lineDiscounts);
    setCustomerName(held.customerName);
    setDebtorId(held.debtorId);
    setPaymentMethod(held.paymentMethod as PaymentMethodId);
    setTax(held.tax);
    setDiscount(held.discount);
    setDiscountType(held.discountType);
    setNotes(held.notes);
    removeHeld(held.id);
    setShowHeld(false);
    setRecording(true);
  }

  function onCompleteSale() {
    if (cartItems.length === 0) return;
    if (paymentMethod === "CREDIT" && !debtorId) return;
    setSubmitting(true);
    const lines = cartItems.map((i) => ({
      productId: i.product.id,
      productName: i.product.name,
      quantity: i.quantity,
      unitPrice: i.product.sellingPrice,
      discount: i.ld && Number(i.ld.value) ? Number(i.ld.value) : undefined,
      discountType: i.ld?.type,
      lineTotal: i.lineTotal,
    }));
    window.setTimeout(() => {
      // Show the actual sale record as the receipt (not a throwaway number). Once it syncs, its
      // number reconciles to the backend's real saleNumber (e.g. SALE-000042) — the same id the
      // web shows — and the open receipt follows it live via `receiptLive` below.
      const created = completeSale({
        branchId,
        customer: customerName,
        debtorId: paymentMethod === "CREDIT" ? debtorId : undefined,
        paymentMethod: PAYMENT_LABEL[paymentMethod],
        notes: notes || undefined,
        tax: taxAmount || undefined,
        cartDiscount: cartDiscountAmount || undefined,
        cartDiscountValue: discountValue || undefined,
        cartDiscountType: discountType,
        subtotal,
        amount: totalAmount,
        lines,
      });
      setSubmitting(false);
      setReceipt(created);
      clearSale();
      setRecording(false);
    }, 400);
  }

  const completeDisabled = submitting || cartItems.length === 0 || (paymentMethod === "CREDIT" && !debtorId);

  return (
    <div className="min-h-screen overflow-hidden bg-[#f6f8fb] text-[#0f172a]" style={{ fontFamily: "var(--font-dm-sans)" }}>
      <header className="flex h-[78px] items-center border-b border-[#1a2547] bg-[#0b1733] text-white shadow-[0_1px_2px_rgba(0,0,0,0.25)]">
        <div className="flex h-full shrink-0 items-center gap-4 border-r border-[#1a2547] px-5">
          <button type="button" onClick={onBack} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[#cbd5e1] transition hover:bg-[#1a2547] hover:text-white" title="Back to dashboard">
            <ArrowLeft className="h-5 w-5" /> Back
          </button>
          <h1 className="text-[18px] font-semibold tracking-[-0.01em]">Fahampesa POS</h1>
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-5 px-7">
          <button type="button" onClick={onViewHistory} className="hidden items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[#cbd5e1] transition hover:bg-[#1a2547] hover:text-white sm:flex" title="Sales history">
            <History className="h-5 w-5" /> History
          </button>
          <div className="hidden h-8 w-px bg-[#1f2a4a] sm:block" />
          <div className="hidden items-center gap-3 text-sm font-medium md:flex"><User className="h-5 w-5" /><span>User: {cashierName}</span></div>
          <div className="hidden h-8 w-px bg-[#1f2a4a] md:block" />
          <div className="hidden items-center gap-3 text-sm font-medium sm:flex"><Wifi className="h-5 w-5 text-[#20c75a]" /><span>Online</span></div>
          <div className="h-8 w-px bg-[#1f2a4a]" />
          <div className="text-center leading-tight"><div className="text-[18px] font-bold">{displayTime}</div><div className="text-[14px] text-[#94a3b8]">{displayDate}</div></div>
          <div className="h-8 w-px bg-[#1f2a4a]" />
          <button type="button" onClick={onBack} className="grid h-11 w-11 place-items-center rounded-full text-[#cbd5e1] transition hover:bg-[#1a2547] hover:text-white" title="Back to dashboard"><Power className="h-7 w-7" /></button>
          <button type="button" onClick={onSignOut} className="flex items-center gap-2 rounded-xl bg-[#1a2547] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#e11d48]" title="Log out"><LogOut className="h-5 w-5" /><span className="hidden sm:inline">Log out</span></button>
        </div>
      </header>

      <main className="grid h-[calc(100vh-78px)] grid-cols-1 gap-4 overflow-hidden p-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="dashboard-panel min-h-0 overflow-hidden px-5 py-6">
          <div className="mb-6 grid gap-4 lg:grid-cols-[130px_minmax(240px,1fr)_auto] lg:items-center">
            <h2 className="text-[24px] font-bold tracking-[-0.02em]">Products</h2>
            <div className="relative">
              <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#767b88]" />
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search products by name, SKU, category, barcode…" className="dashboard-field h-10 w-full pl-12 pr-4 text-[13px]" />
            </div>
            {heldSales.length > 0 && (
              <button onClick={() => setShowHeld((s) => !s)} className="flex h-10 items-center gap-2 rounded-[8px] bg-[#fff7ed] px-3 text-[13px] font-semibold text-[#b45309]">
                <Clock className="h-4 w-4" /> Held ({heldSales.length})
              </button>
            )}
          </div>

          {showHeld && heldSales.length > 0 && (
            <div className="mb-4 space-y-2 rounded-[8px] border border-[#fed7aa] bg-[#fff7ed] p-3">
              {heldSales.map((h) => {
                const count = Object.values(h.cart).reduce((t, q) => t + q, 0);
                return (
                  <div key={h.id} className="flex items-center justify-between rounded-[6px] bg-white px-3 py-2 text-[13px]">
                    <span className="font-medium text-[#0f172a]">{h.customerName || "Walk-in"} · {count} item{count === 1 ? "" : "s"}</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => resumeHeld(h)} className="rounded bg-[#eef5ff] px-2 py-1 text-xs font-semibold text-[#004aad]">Resume</button>
                      <button onClick={() => removeHeld(h.id)} className="rounded bg-[#fff1ee] px-2 py-1 text-xs font-semibold text-[#f04438]">Discard</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mb-4 flex gap-3 overflow-x-auto pb-1">
            {categoryOptions.map((option) => (
              <button key={option.value} type="button" onClick={() => setSelectedCategory(option.value)} className={`h-8 shrink-0 rounded-[8px] px-3 text-[12px] font-medium transition ${selectedCategory === option.value ? "bg-[#e8f3ff] text-[#0058c7]" : "bg-[#f2f3f6] text-[#676d78] hover:bg-[#e9edf3]"}`}>
                {option.label} ({option.count})
              </button>
            ))}
          </div>

          <div className="h-[calc(100%-118px)] overflow-y-auto pr-2">
            {filteredProducts.length === 0 ? (
              <div className="grid h-full place-items-center text-center"><div><Package className="mx-auto mb-3 h-12 w-12 text-[#a1a7b3]" /><h3 className="text-lg font-semibold">No products found</h3><p className="mt-1 text-sm text-[#6b7280]">Try another search term or category.</p></div></div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                {filteredProducts.map((product) => {
                  const quantity = cart[product.id] ?? 0;
                  const outOfStock = product.quantity <= quantity;
                  const image = product.images?.[0];
                  return (
                    <article key={product.id} className={`rounded-[8px] border bg-white p-2 transition ${quantity > 0 ? "border-[#1f57c8] shadow-[0_0_0_1px_rgba(31,87,200,0.1)]" : "border-[#edf0f4] hover:border-[#d7dce5] hover:shadow-[0_12px_24px_rgba(15,23,42,0.06)]"}`}>
                      <button type="button" onClick={() => addProduct(product)} disabled={outOfStock} className="relative mb-2 grid h-[104px] w-full place-items-center overflow-hidden rounded-[7px] bg-[#f4f5f7] disabled:cursor-default" title="Add product">
                        {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <Package className="h-12 w-12 text-[#aeb4bf]" />}
                      </button>
                      <div className="space-y-1">
                        <div className="min-h-[34px]">
                          <h3 className="line-clamp-2 text-[11px] font-bold leading-snug text-[#171b25]">{product.name}</h3>
                          <div className="mt-1 flex items-center justify-between gap-2 text-[9px] text-[#808794]"><span className="truncate">{product.category}</span><span className="shrink-0">SKU: {product.barcode}</span></div>
                        </div>
                        <div className="flex items-end justify-between gap-2">
                          <div><p className="text-[14px] font-extrabold leading-tight">{formatMoney(product.sellingPrice)}</p><p className="text-[8px] text-[#7d8491]">Stock: {product.quantity} pcs</p></div>
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => reduceProduct(product.id)} disabled={quantity === 0} className="grid h-6 w-6 place-items-center rounded-[6px] bg-[#004aad] text-white shadow-sm transition hover:bg-[#003d8f] disabled:bg-[#d6dbe6]"><Minus className="h-4 w-4" /></button>
                            <span className="min-w-3 text-center text-[14px] font-semibold">{quantity}</span>
                            <button type="button" onClick={() => addProduct(product)} disabled={outOfStock} className="grid h-6 w-6 place-items-center rounded-[6px] bg-[#004aad] text-white shadow-sm transition hover:bg-[#003d8f] disabled:bg-[#d6dbe6]"><Plus className="h-4 w-4" /></button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <aside className="min-h-0 overflow-hidden rounded-[8px]">
          <section className="dashboard-panel flex h-full flex-col p-5">
            {!recording ? (
              <div className="flex h-full min-h-0 flex-col">
                <h2 className="mb-4 text-[24px] font-bold tracking-[-0.02em]">Sales</h2>
                <button type="button" onClick={() => setRecording(true)} className="dashboard-action-primary mb-6 flex h-14 w-full items-center justify-center gap-2 text-[16px]">
                  <Plus className="h-5 w-5" /> Record Sale
                </button>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-[18px] font-bold">Recent Sales</h3>
                  <button type="button" onClick={onViewHistory} className="text-[13px] font-semibold text-[#004aad] transition hover:text-[#003d8f]">View all</button>
                </div>
                <div className="-mr-1 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                  {recentSales.length === 0 ? (
                    <div className="grid min-h-[160px] place-items-center text-center text-[#777e8b]">
                      <div><ShoppingCart className="mx-auto mb-3 h-10 w-10 text-[#c1c7d0]" /><p className="text-sm font-semibold">No sales yet</p><p className="mt-1 text-xs">Completed sales will appear here.</p></div>
                    </div>
                  ) : (
                    recentSales.map((s) => {
                      const product = s.lines?.[0]?.productName;
                      const label = s.number ?? `Sale #${s.id.slice(0, 5)}`;
                      return (
                        <button key={s.id} type="button" onClick={() => setReceipt(s)} className="flex w-full items-center justify-between rounded-[8px] border border-[#edf0f4] bg-white px-3 py-2.5 text-left transition hover:border-[#004aad] hover:bg-[#f8fbff]" title="View receipt">
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-[#141925]">{label}{product ? ` - ${product}` : ""}</p>
                            <p className="text-[11px] text-[#7a818f]">{s.items} item{s.items === 1 ? "" : "s"} · {s.time} · {s.paymentMethod}</p>
                          </div>
                          <span className="shrink-0 text-[14px] font-bold">{formatMoney(s.amount)}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
            <>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[24px] font-bold tracking-[-0.02em]">Record Sale</h2>
              <button type="button" onClick={() => { clearSale(); setRecording(false); }} className="grid h-8 w-8 place-items-center rounded-full text-[#06112b] transition hover:bg-[#f2f4f7]" title="Close sale"><X className="h-6 w-6" /></button>
            </div>

            <div className="-mr-1 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name" className="dashboard-field h-10 w-full px-3 text-[13px]" />

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="text-[18px] font-bold">Ordered Items</h3>
                  <button type="button" onClick={clearSale} disabled={cartItems.length === 0} className="rounded-[5px] bg-[#fff1ee] px-2 py-1 text-[11px] font-medium text-[#f04438] disabled:opacity-50">Clear all</button>
                </div>
                <div className="border-b border-dashed border-[#aeb4bf] pb-4">
                  {cartItems.length === 0 ? (
                    <div className="grid min-h-[120px] place-items-center text-center text-[#777e8b]"><div><ShoppingCart className="mx-auto mb-3 h-10 w-10 text-[#c1c7d0]" /><p className="text-sm font-semibold">No items selected</p><p className="mt-1 text-xs">Add products from the grid.</p></div></div>
                  ) : (
                    <div className="space-y-3">
                      {cartItems.map((i) => (
                        <div key={i.product.id} className="rounded-[8px] border border-[#edf0f4] bg-white p-3">
                          <div className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-start gap-3">
                            <button type="button" onClick={() => removeCartItem(i.product.id)} className="mt-0.5 grid h-6 w-6 place-items-center rounded-[5px] bg-[#fff1ee] text-[#ef4444]"><Trash2 className="h-3.5 w-3.5" /></button>
                            <div className="min-w-0"><p className="text-[14px] font-semibold text-[#141925]"><span className="mr-2 text-[#7a818f]">{i.quantity}x</span>{i.product.name}</p><p className="mt-0.5 text-[11px] font-medium text-[#7a818f]">Unit {formatMoney(i.product.sellingPrice)}</p></div>
                            <div className="text-right"><p className="text-[14px] font-bold">{formatMoney(i.lineTotal)}</p>{i.discountAmount > 0 && <p className="text-[11px] font-semibold text-[#d92d20]">-{formatMoney(i.discountAmount)}</p>}</div>
                          </div>
                          <div className="mt-2 grid grid-cols-[minmax(0,1fr)_96px] gap-2">
                            <input type="number" min="0" value={i.ld?.value ?? ""} onChange={(e) => setLineDiscount(i.product.id, { value: e.target.value })} placeholder="Line discount" className="dashboard-field h-9 px-2 text-[12px]" />
                            <select value={i.ld?.type ?? "fixed"} onChange={(e) => setLineDiscount(i.product.id, { type: e.target.value as DiscountType })} className="dashboard-field h-9 px-1 text-[12px]"><option value="fixed">Fixed</option><option value="percentage">%</option></select>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2 rounded-[8px] bg-[#f8fafc] p-3">
                <div className="flex justify-between text-[13px] font-semibold text-[#777e8b]"><span>Subtotal ({cartQuantity} items)</span><span>{formatMoney(subtotal)}</span></div>
                <div className="flex justify-between text-[13px] font-semibold text-[#777e8b]"><span>Tax{taxRate > 0 ? ` (${taxRate}%)` : ""}</span><span>{formatMoney(taxAmount)}</span></div>
                <div className="flex justify-between text-[13px] font-semibold text-[#d92d20]"><span>Cart discount</span><span>-{formatMoney(cartDiscountAmount)}</span></div>
                <div className="flex justify-between border-t border-[#d9dee7] pt-2"><span className="text-[16px] font-bold text-[#141925]">Total</span><span className="text-[24px] font-extrabold">{formatMoney(totalAmount)}</span></div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="text-[12px] font-semibold text-[#777e8b]">Tax rate (%)<input type="number" min="0" max="100" step="0.1" value={tax} onChange={(e) => setTax(e.target.value)} placeholder="0" className="dashboard-field mt-1 h-10 w-full px-3 text-[13px]" /></label>
                <label className="text-[12px] font-semibold text-[#777e8b]">Cart discount
                  <div className="mt-1 grid grid-cols-[minmax(0,1fr)_64px] gap-1">
                    <input type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" className="dashboard-field h-10 px-2 text-[13px]" />
                    <select value={discountType} onChange={(e) => setDiscountType(e.target.value as DiscountType)} className="dashboard-field h-10 px-1 text-[13px]"><option value="fixed">Fix</option><option value="percentage">%</option></select>
                  </div>
                </label>
              </div>

              <div>
                <p className="mb-2 text-[14px] font-bold">Payment method</p>
                <div className="flex flex-wrap gap-2">
                  {PAYMENT_METHODS.map((method) => (
                    <button key={method.id} type="button" onClick={() => setPaymentMethod(method.id)} className={`h-9 rounded-[8px] px-3 text-[13px] font-semibold transition ${paymentMethod === method.id ? "bg-[#e8f3ff] text-[#0058c7]" : "bg-[#f3f3f4] text-[#747b88] hover:bg-[#e9edf3]"}`}>{method.label}</button>
                  ))}
                </div>
                {paymentMethod === "CREDIT" && (
                  <select value={debtorId} onChange={(e) => setDebtorId(e.target.value)} className="dashboard-field mt-2 h-10 w-full px-3 text-[13px]">
                    <option value="">Select debtor…</option>
                    {debtors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                )}
              </div>

              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Sale notes (optional)" className="dashboard-field w-full resize-none px-3 py-2 text-[13px]" />
            </div>

            <div className="mt-3 flex shrink-0 gap-2">
              <button type="button" onClick={onHoldSale} disabled={cartItems.length === 0} className="dashboard-action-secondary h-12 flex-1 disabled:opacity-50">Hold</button>
              <button type="button" onClick={onCompleteSale} disabled={completeDisabled} className="dashboard-action-primary flex h-12 flex-[2] text-[16px] disabled:bg-[#aeb9d2]">
                {submitting && <Loader2 className="h-5 w-5 animate-spin" />} Complete Sale
              </button>
            </div>
            </>
            )}
          </section>
        </aside>
      </main>

      {receiptLive && <ReceiptModal sale={receiptLive} onClose={() => setReceipt(null)} />}
    </div>
  );
}
