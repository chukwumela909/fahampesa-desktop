import { useMemo, useState } from "react";
import { PlusIcon, ChartBarIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import type { ScreenKey } from "@/data";
import { useAppData } from "@/store/AppData";
import { getCurrencySymbol, currency, sum } from "@/lib/format";

const dashboardAssets = {
  cartIcon: "/assets/dashboard/cart-icon.svg",
  receiptIcon: "/assets/dashboard/receipt-icon.svg",
  growthIcon: "/assets/dashboard/growth-icon.svg",
  calendarIcon: "/assets/dashboard/calendar-icon.svg",
  arrowDownIcon: "/assets/dashboard/arrow-down-icon.svg",
  emptyBoxIcon: "/assets/dashboard/empty-box-icon.svg",
};

type DateFilter = "today" | "week" | "month";
const filterLabel: Record<DateFilter, string> = { today: "Today", week: "This Week", month: "This Month" };
const filterPossessive: Record<DateFilter, string> = { today: "Today's", week: "This Week's", month: "This Month's" };

export default function DashboardScreen({ branchId, onScreenChange }: { branchId: string; onScreenChange: (screen: ScreenKey) => void }) {
  const { products, sales, expenses, settings } = useAppData();
  const greetingName = settings.fullName.trim() || "there";
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  const branchProducts = useMemo(() => products.filter((p) => branchId === "all" || p.branchId === branchId), [products, branchId]);
  const branchSales = useMemo(() => sales.filter((s) => branchId === "all" || s.branchId === branchId), [sales, branchId]);

  // Start of the selected period (today = midnight, week = Monday, month = 1st). The metric
  // cards reflect this window; "Recent Sales" below stays all-time-recent.
  const periodStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (dateFilter === "today") return d.getTime();
    if (dateFilter === "week") {
      const day = d.getDay();
      d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
      return d.getTime();
    }
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  }, [dateFilter]);

  // Optimistic just-now records may not carry a timestamp yet — count them in every window.
  const inPeriod = (ms?: number) => ms == null || ms >= periodStart;
  const periodSales = useMemo(() => branchSales.filter((s) => inPeriod(s.createdAtMs) && !s.refunded), [branchSales, periodStart]);
  const periodExpenses = useMemo(() => expenses.filter((e) => inPeriod(e.createdAtMs)), [expenses, periodStart]);

  const costFor = (productId: string) => branchProducts.find((p) => p.id === productId)?.costPrice ?? 0;
  const totalSalesAmount = sum(periodSales.map((sale) => sale.amount));
  const totalExpenses = sum(periodExpenses.map((expense) => expense.amount));
  // Prefer the backend-stored profit (cost captured at sale time) so desktop/web/backend all
  // report the identical figure. Recomputing COGS from the CURRENT catalog cost silently rewrites
  // historical profit whenever a product's cost price is edited (and counts deleted products as
  // free) — keep that only as a fallback for unsynced local rows, with a rough 38%-margin
  // estimate when a sale has no line detail at all.
  const totalProfit = Math.round(
    sum(
      periodSales.map((s) =>
        s.profit ?? (s.lines?.length ? s.amount - sum(s.lines.map((l) => costFor(l.productId) * l.quantity)) : s.amount * 0.38),
      ),
    ),
  );
  const lowStockProducts = branchProducts.filter((product) => product.status === "low");
  const outOfStockProducts = branchProducts.filter((product) => product.status === "out");

  return (
    <div className="space-y-6" style={{ fontFamily: "var(--font-dm-sans)" }}>
      {(lowStockProducts.length > 0 || outOfStockProducts.length > 0) && (
        <div className="border border-[#fed7aa] bg-[#fff7ed] rounded-[16px] p-4 shadow-[0_1px_2px_rgba(154,52,18,0.05)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <ExclamationTriangleIcon className="w-6 h-6 text-[#f97316]" />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="font-semibold text-[16px] text-[#9a3412]">Attention Required</h3>
                <p className="text-[14px] font-medium text-[#c2410c]">
                  {lowStockProducts.length + outOfStockProducts.length} alert
                  {lowStockProducts.length + outOfStockProducts.length !== 1 ? "s" : ""} need your attention
                </p>
                <div className="flex flex-col gap-2 mt-3">
                  {lowStockProducts.slice(0, 3).map((product) => (
                    <div key={product.id} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#f97316]" />
                      <span className="font-medium text-[14px] text-[#1c1d21]">Low Stock Alert</span>
                      <span className="text-[14px] text-[#717171]">
                        {product.name} has only {product.quantity} unit{product.quantity !== 1 ? "s" : ""} left
                      </span>
                    </div>
                  ))}
                  {outOfStockProducts.slice(0, 2).map((product) => (
                    <div key={product.id} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#dc2626]" />
                      <span className="font-medium text-[14px] text-[#1c1d21]">Out of Stock</span>
                      <span className="text-[14px] text-[#717171]">{product.name} is out of stock</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <button
              onClick={() => onScreenChange("inventory")}
              className="flex-shrink-0 px-4 py-2 bg-[#2175c7] text-white font-semibold text-[14px] rounded-[10px] hover:bg-[#1a5fa3] active:scale-[0.98] transition-all"
            >
              View All
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-[#0f172a]">Hello {greetingName},</h1>
        <p className="text-[15px] font-medium text-[#64748b]">Monitor your business performance</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative">
          <button
            onClick={() => setShowFilterDropdown((open) => !open)}
            className="flex items-center gap-2 px-4 py-3.5 bg-white border border-[#e6ebf2] rounded-[12px] text-[#64748b] shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-[#d7e0ec] hover:bg-[#f8fafc] hover:text-[#0f172a] transition-all"
          >
            <img src={dashboardAssets.calendarIcon} alt="" width={20} height={20} />
            <span className="font-semibold text-[14px]">{filterLabel[dateFilter]}</span>
            <img src={dashboardAssets.arrowDownIcon} alt="" width={20} height={20} className="transform rotate-180" />
          </button>
          {showFilterDropdown && (
            <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-[#ececf2] rounded-lg shadow-lg z-10">
              {(["today", "week", "month"] as DateFilter[]).map((value) => (
                <button
                  key={value}
                  onClick={() => {
                    setDateFilter(value);
                    setShowFilterDropdown(false);
                  }}
                  className={`w-full text-left px-4 py-3 hover:bg-[#e9f2f8] transition-colors text-sm first:rounded-t-lg last:rounded-b-lg ${
                    dateFilter === value ? "bg-[#e9f2f8] text-[#004aad] font-medium" : "text-[#717171]"
                  }`}
                >
                  {filterLabel[value]}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => onScreenChange("sales")} className="flex items-center gap-1.5 px-3.5 py-3.5 bg-[#004aad] rounded-[14px] active:scale-[0.98] transition-transform">
            <span className="font-semibold text-[14px] text-white">Fahampesa POS</span>
          </button>
          <button onClick={() => onScreenChange("products")} className="flex items-center gap-1.5 px-3.5 py-3.5 bg-[#e9f2f8] rounded-[14px] hover:bg-[#004aad] active:scale-[0.98] transition-all group">
            <PlusIcon className="w-5 h-5 text-[#004aad] group-hover:text-white transition-colors" />
            <span className="font-medium text-[14px] text-[#004aad] group-hover:text-white transition-colors">Add Product</span>
          </button>
          <button onClick={() => onScreenChange("expenses")} className="flex items-center gap-1.5 px-3.5 py-3.5 bg-[#e9f2f8] rounded-[14px] hover:bg-[#004aad] active:scale-[0.98] transition-all group">
            <PlusIcon className="w-5 h-5 text-[#004aad] group-hover:text-white transition-colors" />
            <span className="font-medium text-[14px] text-[#004aad] group-hover:text-white transition-colors">Add Expense</span>
          </button>
          <button onClick={() => onScreenChange("reports")} className="flex items-center gap-1.5 px-3.5 py-3.5 bg-[#e9f2f8] rounded-[14px] hover:bg-[#004aad] active:scale-[0.98] transition-all group">
            <ChartBarIcon className="w-5 h-5 text-[#004aad] group-hover:text-white transition-colors" />
            <span className="font-medium text-[14px] text-[#004aad] group-hover:text-white transition-colors">View Report</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard tone="#155dfc" icon={dashboardAssets.cartIcon} value={`${getCurrencySymbol()} ${totalSalesAmount.toLocaleString()}`} label={`${filterPossessive[dateFilter]} Sales`} onClick={() => onScreenChange("sales")} />
        <MetricCard tone="#e7000b" icon={dashboardAssets.receiptIcon} value={`${getCurrencySymbol()} ${totalExpenses.toLocaleString()}`} label={`${filterPossessive[dateFilter]} Expenses`} onClick={() => onScreenChange("expenses")} />
        <MetricCard tone="#82cd7e" icon={dashboardAssets.growthIcon} value={`${getCurrencySymbol()} ${totalProfit.toLocaleString()}`} label={`${filterPossessive[dateFilter]} Profit`} />
        <MetricCard tone="#71717a" icon={dashboardAssets.emptyBoxIcon} value={String(branchProducts.length)} label="Total Products" invertIcon onClick={() => onScreenChange("inventory")} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="dashboard-panel lg:col-span-3 p-5 flex flex-col gap-7">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-[18px] tracking-[-0.01em] text-[#0f172a]">Recent Sales</h3>
            <button onClick={() => onScreenChange("salesHistory")} className="px-4 py-2 bg-white border border-[#e6ebf2] rounded-[10px] text-[#334155] hover:bg-[#f8fafc] hover:text-[#004aad] transition-colors">
              <span className="font-semibold text-[14px]">View all</span>
            </button>
          </div>
          {branchSales.length === 0 ? (
            <EmptyPanel label="No Sales data yet" />
          ) : (
            <div className="flex flex-col gap-3">
              {branchSales.slice(0, 5).map((sale) => {
                const product = sale.lines?.[0]?.productName;
                const label = sale.number ?? `Sale #${sale.id.slice(0, 5)}`;
                return (
                  <div key={sale.id} className="dashboard-list-item flex items-center justify-between p-4">
                    <div className="flex flex-col">
                      <span className="text-[14px] font-semibold text-[#0f172a]">{label}{product ? ` - ${product}` : ""}</span>
                      <span className="text-[12px] text-[#64748b]">{sale.items} item{sale.items === 1 ? "" : "s"} • {sale.time}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[14px] font-bold text-[#0f172a]">{currency(sale.amount)}</span>
                      <span className="text-[12px] text-[#64748b]">{sale.paymentMethod}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="dashboard-panel lg:col-span-2 p-5 flex flex-col gap-7">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-[18px] tracking-[-0.01em] text-[#0f172a]">Latest Products</h3>
            <button onClick={() => onScreenChange("products")} className="px-4 py-2 bg-white border border-[#e6ebf2] rounded-[10px] text-[#334155] hover:bg-[#f8fafc] hover:text-[#004aad] transition-colors">
              <span className="font-semibold text-[14px]">View all</span>
            </button>
          </div>
          {branchProducts.length === 0 ? (
            <EmptyPanel label="No Product added yet" />
          ) : (
            <div className="flex flex-col gap-3">
              {branchProducts.slice(0, 5).map((product) => (
                <div key={product.id} className="dashboard-list-item flex items-center justify-between p-4">
                  <div className="flex flex-col">
                    <span className="text-[14px] font-semibold text-[#0f172a]">{product.name}</span>
                    <span className="text-[12px] text-[#64748b]">{product.category}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className={`text-[13px] font-semibold ${product.quantity === 0 ? "text-[#dc2626]" : "text-[#16a34a]"}`}>{product.quantity} pcs</span>
                    <span className="text-[11px] text-[#94a3b8]">SKU: {product.barcode}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ tone, icon, value, label, invertIcon, onClick }: { tone: string; icon: string; value: string; label: string; invertIcon?: boolean; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={`dashboard-card flex min-h-[168px] flex-col justify-between gap-6 p-5 ${onClick ? "cursor-pointer" : ""}`}>
      <div className="w-[100px] h-[52px] rounded-[12px] flex items-center justify-center" style={{ background: tone }}>
        <img src={icon} alt="" width={24} height={24} className={invertIcon ? "brightness-0 invert" : ""} />
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="dashboard-metric-value text-[22px] font-semibold tracking-[-0.01em] text-[#0f172a]">{value}</p>
        <p className="text-[13px] font-medium text-[#64748b]">{label}</p>
      </div>
    </div>
  );
}

function EmptyPanel({ label }: { label: string }) {
  return (
    <div className="flex-1 border border-dashed border-[#dbe3ee] rounded-[14px] bg-[#f8fafc] flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-[50px] h-[50px] flex items-center justify-center">
        <img src="/assets/dashboard/empty-box-icon.svg" alt="" width={50} height={50} className="opacity-50" />
      </div>
      <p className="text-[16px] text-[#71717a]" style={{ fontFamily: "var(--font-inter)" }}>{label}</p>
    </div>
  );
}
