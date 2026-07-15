import { useMemo } from "react";
import { BellAlertIcon, ExclamationTriangleIcon, ArchiveBoxIcon, CloudIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import type { ScreenKey } from "@/data";
import { useAppData } from "@/store/AppData";

type Note = { id: string; tone: "red" | "amber" | "blue" | "green"; icon: React.ReactNode; title: string; detail: string; action?: { label: string; screen: ScreenKey } };

const toneStyles: Record<Note["tone"], { wrap: string; icon: string }> = {
  red: { wrap: "border-[#fecaca] bg-[#fef2f2]", icon: "text-[#dc2626]" },
  amber: { wrap: "border-[#fed7aa] bg-[#fff7ed]", icon: "text-[#f59e0b]" },
  blue: { wrap: "border-[#bfdbfe] bg-[#eff6ff]", icon: "text-[#2563eb]" },
  green: { wrap: "border-[#bbf7d0] bg-[#f0fdf4]", icon: "text-[#16a34a]" },
};

export default function NotificationsScreen({ branchId, onScreenChange }: { branchId: string; onScreenChange: (s: ScreenKey) => void }) {
  const { products, alerts, failures, queueCount, online, lastSyncAt } = useAppData();

  const notes = useMemo<Note[]>(() => {
    const list: Note[] = [];
    failures.forEach((f) =>
      list.push({ id: `fail-${f.commandId}`, tone: "red", icon: <CloudIcon className="h-5 w-5" />, title: "Sync failed — needs review", detail: `${f.label}: ${f.error}`, action: { label: "Open dashboard", screen: "dashboard" } }),
    );
    if (queueCount > 0) list.push({ id: "queued", tone: "blue", icon: <CloudIcon className="h-5 w-5" />, title: `${queueCount} change${queueCount === 1 ? "" : "s"} queued`, detail: online ? "Syncing to the server…" : "Will sync when you reconnect." });
    alerts.filter((a) => branchId === "all" || a.branchId === branchId).forEach((a) =>
      list.push({ id: `alert-${a.id}`, tone: a.severity === "high" ? "red" : "amber", icon: <BellAlertIcon className="h-5 w-5" />, title: a.alertType.replace("_", " "), detail: a.message }),
    );
    const branchProducts = products.filter((p) => branchId === "all" || p.branchId === branchId);
    branchProducts.filter((p) => p.status === "out").forEach((p) =>
      list.push({ id: `out-${p.id}`, tone: "red", icon: <ArchiveBoxIcon className="h-5 w-5" />, title: "Out of stock", detail: `${p.name} is out of stock`, action: { label: "View inventory", screen: "inventory" } }),
    );
    branchProducts.filter((p) => p.status === "low").forEach((p) =>
      list.push({ id: `low-${p.id}`, tone: "amber", icon: <ExclamationTriangleIcon className="h-5 w-5" />, title: "Low stock", detail: `${p.name} has only ${p.quantity} left`, action: { label: "Restock", screen: "inventory" } }),
    );
    return list;
  }, [alerts, failures, queueCount, online, products, branchId]);

  return (
    <div className="space-y-6" style={{ fontFamily: "var(--font-dm-sans)" }}>
      <div className="dashboard-panel flex items-center justify-between p-5">
        <div className="flex items-center gap-2"><BellAlertIcon className="h-5 w-5 text-[#004aad]" /><h2 className="dashboard-section-title">Notifications</h2></div>
        <span className="text-sm text-[#64748b]">{lastSyncAt ? `Last sync ${new Date(lastSyncAt).toLocaleTimeString()}` : "Not synced yet"}</span>
      </div>

      {notes.length === 0 ? (
        <div className="dashboard-panel flex flex-col items-center gap-3 py-16 text-center">
          <CheckCircleIcon className="h-12 w-12 text-[#16a34a]" />
          <h3 className="text-lg font-semibold text-[#0f172a]">You're all caught up</h3>
          <p className="max-w-md text-sm text-[#64748b]">No alerts, low-stock warnings, or pending sync items right now.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => {
            const tone = toneStyles[n.tone];
            return (
              <div key={n.id} className={`flex items-start gap-3 rounded-[14px] border p-4 ${tone.wrap}`}>
                <span className={`mt-0.5 ${tone.icon}`}>{n.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold capitalize text-[#0f172a]">{n.title}</p>
                  <p className="text-sm text-[#475569]">{n.detail}</p>
                </div>
                {n.action && (
                  <button onClick={() => onScreenChange(n.action!.screen)} className="shrink-0 rounded-[8px] bg-white px-3 py-1.5 text-xs font-semibold text-[#004aad] shadow-sm hover:bg-[#f8fafc]">{n.action.label}</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
