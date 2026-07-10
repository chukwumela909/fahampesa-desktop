import { useEffect, useMemo, useState } from "react";
import { CheckCircleIcon, CreditCardIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { useAppData } from "@/store/AppData";
import { getBillingHistory, getBillingPlans, getSubscription } from "@/lib/endpoints";

type Raw = Record<string, any>;

function money(currency: string, amount: number): string {
  const symbol = currency === "KSH" || currency === "KES" ? "KSh " : currency === "USD" ? "$" : `${currency} `;
  return `${symbol}${amount.toLocaleString()}`;
}

function dateLabel(value: unknown): string {
  if (!value) return "—";
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

const statusTone: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  pending: "bg-amber-100 text-amber-700",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-red-100 text-red-700",
  expired: "bg-slate-100 text-slate-600",
};

const planLabel = (planType: unknown) => (planType === "yearly" ? "1 Year Pro Plan" : planType === "monthly" ? "1 Month Pro Plan" : "Pro Plan");

export default function PaymentsScreen() {
  const { notify } = useAppData();
  const [plans, setPlans] = useState<Raw | null>(null);
  const [sub, setSub] = useState<Raw | null>(null);
  const [history, setHistory] = useState<Raw[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [p, s, h] = await Promise.all([
        getBillingPlans().catch(() => null),
        getSubscription().catch(() => null),
        getBillingHistory().catch(() => null),
      ]);
      if (cancelled) return;
      setPlans(p);
      setSub(s);
      setHistory(Array.isArray(h) ? h : []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Billing currency is location-based (KSH in Kenya, USD elsewhere). Use the region the
  // backend reports; show the standard plan prices for that region (matching the web).
  const currency = (plans?.currency as string) ?? "USD";
  const monthly = currency === "KSH" || currency === "KES" ? 2000 : 10;
  const yearly = currency === "KSH" || currency === "KES" ? 20000 : 100;

  const account = sub?.account ?? {};
  const activeType = sub?.subscription?.planType as string | undefined;
  const endsAt = account.subscriptionEndsAt as string | undefined;
  // Paid access requires an active plan that hasn't lapsed — mirror App.tsx and the backend's
  // hasActivePaidAccess. Without the expiry check an expired-but-not-yet-flipped subscription
  // wrongly shows as the active plan and hides the upgrade CTA.
  const isPaid =
    account.planTier === "paid" &&
    account.subscriptionStatus === "active" &&
    !!endsAt &&
    new Date(endsAt).getTime() > Date.now();

  const planOptions = useMemo(
    () => [
      { id: "free", name: "Free Plan", price: money(currency, 0), cycle: "/month", active: !isPaid, features: ["Single device", "Core POS & inventory", "Basic reports"] },
      { id: "monthly", name: "1 Month Pro Plan", price: money(currency, monthly), cycle: "/month", active: isPaid && activeType === "monthly", features: ["Everything in Free", "Multi-branch & staff", "Full analytics & sync"] },
      { id: "yearly", name: "1 Year Pro Plan", price: money(currency, yearly), cycle: "/year", active: isPaid && activeType === "yearly", features: ["Everything in Pro", "2 months free", "Priority support"] },
    ],
    [currency, monthly, yearly, isPaid, activeType],
  );

  return (
    <div className="space-y-6" style={{ fontFamily: "var(--font-dm-sans)" }}>
      <div className="dashboard-panel flex flex-col gap-4 p-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="rounded-lg bg-blue-600 p-3"><CreditCardIcon className="h-8 w-8 text-white" /></div>
          <div>
            <h1 className="dashboard-page-title">Payments &amp; Subscriptions</h1>
            <p className="dashboard-page-subtitle mt-1">
              {isPaid ? `You're on the ${planLabel(activeType)}${endsAt ? ` · renews ${dateLabel(endsAt)}` : ""}` : "You're on the Free plan"}
            </p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${isPaid ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>
          {isPaid ? <><CheckCircleIcon className="h-4 w-4" /> Pro</> : "Free"}
        </span>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {planOptions.map((plan) => (
          <div key={plan.id} className={`dashboard-panel flex flex-col p-6 ${plan.active ? "ring-2 ring-[#004aad]" : ""}`}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#0f172a]">{plan.name}</h3>
              {plan.active && <span className="rounded-full bg-[#eef5ff] px-2 py-0.5 text-xs font-semibold text-[#004aad]">Current</span>}
            </div>
            <p className="mb-4"><span className="text-3xl font-extrabold text-[#0f172a]">{plan.price}</span><span className="text-sm text-[#64748b]">{plan.cycle}</span></p>
            <ul className="mb-6 flex-1 space-y-2">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-[#475569]"><CheckCircleIcon className="h-4 w-4 shrink-0 text-[#16a34a]" /> {f}</li>
              ))}
            </ul>
            {plan.id !== "free" && !plan.active && (
              <button
                onClick={() => notify("To upgrade, complete payment in the Fahampesa web app — your plan then syncs here automatically.")}
                className="dashboard-action-primary w-full justify-center"
              >
                <SparklesIcon className="mr-1 h-4 w-4" /> Upgrade
              </button>
            )}
            {plan.active && <div className="rounded-[10px] bg-[#f8fafc] py-2.5 text-center text-sm font-medium text-[#16a34a]">Active plan</div>}
          </div>
        ))}
      </div>

      {/* Billing history */}
      <div className="dashboard-panel p-6">
        <h3 className="dashboard-section-title mb-4">Billing History</h3>
        {history === null ? (
          <p className="text-sm text-[#94a3b8]">Loading billing history…</p>
        ) : history.length === 0 ? (
          <div className="dashboard-empty-state py-10 text-center text-sm text-[#64748b]">No billing history yet. Upgrade to Pro to get started.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#f6f6f6] text-left text-[#717171]">
                  <th className="px-3 py-2 font-medium">Plan</th>
                  <th className="px-3 py-2 font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">Purchase Date</th>
                  <th className="px-3 py-2 font-medium">End Date</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((record, i) => {
                  const status = String(record.status ?? "pending");
                  return (
                    <tr key={String(record.id ?? i)} className={i % 2 ? "bg-[#fafafa]" : ""}>
                      <td className="px-3 py-3 font-medium text-[#0f172a]">{planLabel(record.planType)}</td>
                      <td className="px-3 py-3 text-[#0f172a]">{money(String(record.currency ?? currency), Number(record.amount) || 0)}</td>
                      <td className="px-3 py-3 text-[#64748b]">{dateLabel(record.startDate ?? record.createdAt)}</td>
                      <td className="px-3 py-3 text-[#64748b]">{dateLabel(record.endDate)}</td>
                      <td className="px-3 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusTone[status] ?? "bg-slate-100 text-slate-600"}`}>{status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
