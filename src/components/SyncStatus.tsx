import { useState } from "react";
import { Cloud, CloudOff, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useAppData } from "@/store/AppData";
import Modal from "@/components/ui/Modal";

function relativeTime(ts: number | null): string {
  if (!ts) return "never";
  const diff = Date.now() - ts;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

export default function SyncStatus() {
  const { online, syncStatus, queueCount, lastSyncAt, failures, writeWindowExpired, syncNow, retryFailed } = useAppData();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const syncing = syncStatus === "syncing";
  const dot = !online ? "bg-[#f97316]" : failures.length ? "bg-[#dc2626]" : queueCount ? "bg-[#f59e0b]" : "bg-[#12b76a]";
  const label = syncing ? "Syncing…" : !online ? "Offline" : queueCount ? `${queueCount} queued` : "Synced";

  async function doSync() {
    setBusy(true);
    await syncNow();
    setBusy(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-[10px] border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-sm font-medium text-[#475569] transition-all hover:bg-white hover:text-[#0f172a]"
        title="Sync status"
      >
        {online ? <Cloud className="h-4 w-4" /> : <CloudOff className="h-4 w-4 text-[#f97316]" />}
        <span className={`h-2 w-2 rounded-full ${dot} ${syncing ? "animate-pulse" : ""}`} />
        <span className="hidden sm:inline">{label}</span>
      </button>

      {open && (
        <Modal
          title="Sync status"
          description={online ? "Connected to the server" : "Working offline — changes are queued"}
          onClose={() => setOpen(false)}
          footer={
            <>
              <button onClick={() => setOpen(false)} className="dashboard-action-muted">Close</button>
              <button onClick={doSync} disabled={busy || !online} className="dashboard-action-primary disabled:opacity-50">
                <RefreshCw className={`mr-1 h-4 w-4 ${busy ? "animate-spin" : ""}`} /> Sync now
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Connection" value={online ? "Online" : "Offline"} tone={online ? "green" : "amber"} />
              <Stat label="Last sync" value={relativeTime(lastSyncAt)} />
              <Stat label="Queued writes" value={String(queueCount)} tone={queueCount ? "amber" : "slate"} />
              <Stat label="Needs review" value={String(failures.length)} tone={failures.length ? "red" : "slate"} />
            </div>

            {writeWindowExpired && (
              <div className="flex items-start gap-2 rounded-[12px] border border-[#fed7aa] bg-[#fff7ed] p-3 text-[13px] text-[#9a3412]">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Offline write window (24h) expired. Reconnect to sync before recording new changes.
              </div>
            )}

            {failures.length > 0 ? (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-[#0f172a]">Failed writes</p>
                  <button onClick={retryFailed} className="text-xs font-semibold text-[#004aad] hover:underline">Retry all</button>
                </div>
                <div className="space-y-2">
                  {failures.map((f) => (
                    <div key={f.commandId} className="flex items-start gap-2 rounded-[10px] border border-[#fee2e2] bg-[#fef2f2] p-3 text-[13px]">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#dc2626]" />
                      <div>
                        <p className="font-medium capitalize text-[#991b1b]">{f.label}</p>
                        <p className="text-[#b91c1c]">{f.error}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-[12px] bg-[#f0fdf4] p-3 text-[13px] text-[#166534]">
                <CheckCircle2 className="h-4 w-4" />
                {queueCount ? "Queued changes will sync automatically when online." : "All changes are synced."}
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

function Stat({ label, value, tone = "slate" }: { label: string; value: string; tone?: "green" | "amber" | "red" | "slate" }) {
  const color = tone === "green" ? "text-[#15803d]" : tone === "amber" ? "text-[#b45309]" : tone === "red" ? "text-[#b91c1c]" : "text-[#0f172a]";
  return (
    <div className="rounded-[12px] bg-[#f8fafc] p-3">
      <p className="text-xs font-medium text-[#64748b]">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}
