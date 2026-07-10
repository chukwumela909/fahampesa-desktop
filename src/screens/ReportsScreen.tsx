import { useMemo, useState } from "react";
import { ArrowDownTrayIcon, CalendarDaysIcon, ChevronDownIcon, PrinterIcon, TagIcon } from "@heroicons/react/24/outline";
import type { Sale } from "@/data";
import { useAppData } from "@/store/AppData";
import { currency, sum } from "@/lib/format";
import { printHtmlBody } from "@/lib/print";

type Range = "today" | "7d" | "30d" | "all";
const RANGE_LABELS: Record<Range, string> = { today: "Today", "7d": "Last 7 Days", "30d": "Last 30 Days", all: "All Time" };

function inRange(sale: Sale, range: Range): boolean {
  if (range === "all") return true;
  const ts = sale.createdAtMs;
  if (!ts) return true; // local just-now sales count in every recent window
  const days = range === "today" ? 1 : range === "7d" ? 7 : 30;
  return Date.now() - ts < days * 86400000;
}

export default function ReportsScreen({ branchId }: { branchId: string }) {
  const { products: allProducts, sales: allSales, expenses } = useAppData();
  const [range, setRange] = useState<Range>("7d");
  const [rangeOpen, setRangeOpen] = useState(false);

  const products = useMemo(() => allProducts.filter((p) => branchId === "all" || p.branchId === branchId), [allProducts, branchId]);
  const sales = useMemo(() => allSales.filter((s) => (branchId === "all" || s.branchId === branchId) && !s.refunded && inRange(s, range)), [allSales, branchId, range]);

  const costFor = (productId: string) => allProducts.find((p) => p.id === productId)?.costPrice ?? 0;

  const totalSales = sum(sales.map((s) => s.amount));
  const cogs = sum(sales.flatMap((s) => (s.lines ?? []).map((l) => costFor(l.productId) * l.quantity)));
  const totalProfit = sales.some((s) => s.lines?.length) ? totalSales - cogs : Math.round(totalSales * 0.38);
  const transactions = sales.length;
  const totalExpenses = sum(expenses.map((e) => e.amount));
  const inventoryValue = sum(products.map((p) => p.costPrice * p.quantity));

  // payment method breakdown
  const paymentBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    sales.forEach((s) => map.set(s.paymentMethod, (map.get(s.paymentMethod) ?? 0) + s.amount));
    const total = totalSales || 1;
    return Array.from(map.entries()).map(([label, value]) => ({ label, pct: Math.round((value / total) * 100), value })).sort((a, b) => b.value - a.value);
  }, [sales, totalSales]);

  // top products
  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    sales.forEach((s) => (s.lines ?? []).forEach((l) => {
      const cur = map.get(l.productId) ?? { name: l.productName, qty: 0, revenue: 0 };
      cur.qty += l.quantity;
      cur.revenue += l.lineTotal;
      map.set(l.productId, cur);
    }));
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [sales]);

  // Sales vs Profit trend — daily buckets for today/7d, weekly for 30d, monthly for all-time.
  const trend = useMemo(() => {
    const now = Date.now();
    const dayMs = 86400000;
    type Bucket = { label: string; start: number; end: number; sales: number; profit: number };
    const buckets: Bucket[] = [];
    if (range === "all") {
      const d = new Date();
      for (let i = 5; i >= 0; i--) {
        const start = new Date(d.getFullYear(), d.getMonth() - i, 1).getTime();
        const end = new Date(d.getFullYear(), d.getMonth() - i + 1, 1).getTime();
        buckets.push({ label: new Date(start).toLocaleString([], { month: "short" }), start, end, sales: 0, profit: 0 });
      }
    } else if (range === "30d") {
      for (let i = 3; i >= 0; i--) {
        const end = now - i * 7 * dayMs;
        const start = end - 7 * dayMs;
        buckets.push({ label: new Date(start).toLocaleDateString([], { day: "numeric", month: "short" }), start, end, sales: 0, profit: 0 });
      }
    } else {
      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0);
      for (let i = 6; i >= 0; i--) {
        const start = midnight.getTime() - i * dayMs;
        buckets.push({ label: new Date(start).toLocaleDateString([], { weekday: "short" }), start, end: start + dayMs, sales: 0, profit: 0 });
      }
    }
    sales.forEach((s) => {
      const ts = s.createdAtMs ?? now;
      const bucket = buckets.find((b) => ts >= b.start && ts < b.end) ?? buckets[buckets.length - 1];
      if (!bucket) return;
      bucket.sales += s.amount;
      const saleCogs = (s.lines ?? []).reduce((t, l) => t + costFor(l.productId) * l.quantity, 0);
      bucket.profit += s.lines?.length ? s.amount - saleCogs : Math.round(s.amount * 0.38);
    });
    return buckets;
  }, [sales, range]);

  const trendMax = Math.max(1, ...trend.flatMap((b) => [b.sales, b.profit]));
  const trendPoints = (key: "sales" | "profit") =>
    trend.map((b, i) => `${trend.length === 1 ? 50 : (i / (trend.length - 1)) * 100},${100 - (b[key] / trendMax) * 100}`).join(" ");

  function exportCsv() {
    const header = ["Receipt", "Date", "Customer", "Items", "Amount", "Payment"];
    const rows = sales.map((s) => [s.number ?? s.id, s.time, s.customer, s.items, s.amount, s.paymentMethod]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-report-${range}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printReport() {
    const rows = topProducts.map((p) => `<tr><td>${p.name}</td><td style="text-align:right">${p.qty}</td><td style="text-align:right">${currency(p.revenue)}</td></tr>`).join("");
    printHtmlBody(
      "Sales Report",
      `<div style="font-family:sans-serif;padding:24px">
      <h1>Sales Report — ${RANGE_LABELS[range]}</h1>
      <p>Total sales: <b>${currency(totalSales)}</b> · Profit: <b>${currency(totalProfit)}</b> · Transactions: <b>${transactions}</b> · Expenses: <b>${currency(totalExpenses)}</b></p>
      <h3>Top products</h3>
      <table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Product</th><th style="text-align:right">Qty</th><th style="text-align:right">Revenue</th></tr></thead><tbody>${rows || "<tr><td>No sales</td></tr>"}</tbody></table>
    </div>`,
    );
  }

  const maxQty = Math.max(...products.map((p) => p.quantity), 1);

  return (
    <div className="space-y-6 pb-8" style={{ fontFamily: "var(--font-dm-sans)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="dashboard-page-title">Reports &amp; Analytics</h1>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={exportCsv} className="dashboard-action-muted"><ArrowDownTrayIcon className="mr-1 h-4 w-4" /> Export CSV</button>
          <button onClick={printReport} className="dashboard-action-muted"><PrinterIcon className="mr-1 h-4 w-4" /> Print</button>
          <div className="relative">
            <button onClick={() => setRangeOpen((o) => !o)} className="dashboard-action-primary min-w-[162px] justify-between px-3 py-[15px]">
              <span className="flex items-center gap-2"><CalendarDaysIcon className="h-4 w-4" /> {RANGE_LABELS[range]}</span>
              <ChevronDownIcon className="h-4 w-4" />
            </button>
            {rangeOpen && (
              <div className="absolute right-0 top-full z-10 mt-2 w-44 rounded-lg border border-[#ececf2] bg-white shadow-lg">
                {(Object.keys(RANGE_LABELS) as Range[]).map((r) => (
                  <button key={r} onClick={() => { setRange(r); setRangeOpen(false); }} className={`block w-full px-4 py-2.5 text-left text-sm first:rounded-t-lg last:rounded-b-lg hover:bg-[#e9f2f8] ${range === r ? "bg-[#e9f2f8] font-medium text-[#004aad]" : "text-[#717171]"}`}>{RANGE_LABELS[r]}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Sales" value={currency(totalSales)} tone="blue" />
        <StatCard label="Total Profit" value={currency(totalProfit)} tone="green" />
        <StatCard label="Transactions" value={String(transactions)} tone="blue" />
        <StatCard label="Expenses" value={currency(totalExpenses)} tone="red" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="dashboard-panel p-5 lg:col-span-3">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="dashboard-section-title text-base">Sales vs Profit Trend</h3>
            <div className="flex items-center gap-4 text-xs font-medium text-[#525252]">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#004aad]" /> Sales</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#027a48]" /> Profit</span>
            </div>
          </div>
          {totalSales === 0 ? (
            <p className="text-sm text-[#94a3b8]">No sales in this period.</p>
          ) : (
            <>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-[200px] w-full">
                <polyline points={trendPoints("sales")} fill="none" stroke="#004aad" strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
                <polyline points={trendPoints("profit")} fill="none" stroke="#027a48" strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
              </svg>
              <div className="mt-2 flex justify-between text-[10px] text-[#717171]">
                {trend.map((b, i) => <span key={i} className="flex-1 truncate text-center">{b.label}</span>)}
              </div>
            </>
          )}
        </div>
        <div className="dashboard-panel p-5 lg:col-span-2">
          <h3 className="dashboard-section-title mb-5 text-base">Payment Methods</h3>
          {paymentBreakdown.length === 0 ? (
            <p className="text-sm text-[#94a3b8]">No sales in this period.</p>
          ) : (
            <div className="space-y-4">
              {paymentBreakdown.map((m) => (
                <div key={m.label} className="flex items-center gap-3">
                  <span className="min-w-[96px] text-xs font-normal text-[#525252]">{m.label}</span>
                  <div className="h-1.5 flex-1 rounded-sm bg-[#e9f2f8]"><div className="h-1.5 rounded-sm bg-[#004aad]" style={{ width: `${m.pct}%` }} /></div>
                  <span className="w-20 text-right text-xs font-medium text-[#0f172a]">{m.pct}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="dashboard-panel p-5 lg:col-span-3">
          <h3 className="dashboard-section-title mb-5 text-base">Inventory by Product</h3>
          {products.length === 0 ? (
            <p className="text-sm text-[#94a3b8]">No products.</p>
          ) : (
            <div className="flex h-[180px] items-end gap-3">
              {products.slice(0, 12).map((product) => (
                <div key={product.id} className="flex flex-1 flex-col items-center gap-2">
                  <div className="w-full max-w-[30px] rounded-t-lg bg-[#d4e7f4] transition-colors hover:bg-[#004aad]" style={{ height: `${Math.max(8, (product.quantity / maxQty) * 140)}px` }} title={`${product.name}: ${product.quantity}`} />
                  <span className="max-w-[60px] truncate text-[10px] text-[#717171]">{product.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="dashboard-panel flex flex-col gap-4 p-5 lg:col-span-2">
          <div className="flex items-center justify-between"><h3 className="dashboard-section-title text-base">Inventory value</h3><span className="dashboard-metric-value text-base text-[#0f172a]">{products.length} items</span></div>
          <div className="rounded-[14px] bg-[#f8fafc] p-4">
            <div className="flex items-center gap-2"><TagIcon className="h-4 w-4 text-[#717171]" /><span className="text-sm text-[#717171]">Cost value</span></div>
            <p className="mt-2 text-2xl font-bold text-black">{currency(inventoryValue)}</p>
          </div>
        </div>
      </div>

      <div className="dashboard-panel p-5">
        <h3 className="dashboard-section-title mb-4 text-base">Best performing products</h3>
        {topProducts.length === 0 ? (
          <div className="dashboard-empty-state py-8 text-sm text-[#64748b]">No sales in this period.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-[#f6f6f6] text-left text-[#717171]"><th className="px-3 py-2 font-medium">Product</th><th className="px-3 py-2 text-right font-medium">Units sold</th><th className="px-3 py-2 text-right font-medium">Revenue</th></tr></thead>
              <tbody>
                {topProducts.map((p, i) => (
                  <tr key={i} className={i % 2 ? "bg-[#fafafa]" : ""}>
                    <td className="px-3 py-3 font-medium text-[#0f172a]">{p.name}</td>
                    <td className="px-3 py-3 text-right text-[#0f172a]">{p.qty}</td>
                    <td className="px-3 py-3 text-right font-semibold text-[#16a34a]">{currency(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone: "blue" | "green" | "red" }) {
  const toneBg = tone === "blue" ? "bg-[#E9F2F8] text-[#004aad]" : tone === "green" ? "bg-[#D1FAE5] text-[#027a48]" : "bg-[#FEE2E2] text-[#dc2626]";
  return (
    <div className="dashboard-card flex min-h-[120px] flex-col justify-between px-4 py-5">
      <div className="flex items-start justify-between"><p className="text-[13px] font-medium text-[#64748b]">{label}</p><span className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${toneBg}`}>●</span></div>
      <p className="dashboard-metric-value text-2xl font-semibold tracking-[-0.02em] text-[#0f172a]">{value}</p>
    </div>
  );
}
