import { LockClosedIcon } from "@heroicons/react/24/outline";
import { Zap } from "lucide-react";

interface UpgradeRequiredProps {
  /** Human-readable feature name, e.g. "Multi-branch management". */
  feature: string;
  /** True when the account was on a paid plan that has lapsed (renew vs upgrade copy). */
  expired: boolean;
  onGoPro: () => void;
}

export default function UpgradeRequired({ feature, expired, onGoPro }: UpgradeRequiredProps) {
  const title = expired ? "Your Pro plan has expired" : `${feature} is a Pro feature`;
  const description = expired
    ? `Renew your subscription to keep using ${feature.toLowerCase()} and the rest of Pro — multi-branch, staff, full analytics and sync.`
    : `Upgrade to Pro to unlock ${feature.toLowerCase()}, plus staff, full analytics and multi-device sync.`;

  return (
    <div className="flex min-h-[60vh] items-center justify-center" style={{ fontFamily: "var(--font-dm-sans)" }}>
      <div className="dashboard-panel max-w-md p-10 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#eef5ff]">
          <LockClosedIcon className="h-7 w-7 text-[#004aad]" />
        </div>
        <h2 className="text-xl font-bold text-[#0f172a]">{title}</h2>
        <p className="mt-2 text-sm text-[#64748b]">{description}</p>
        <button
          onClick={onGoPro}
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-semibold text-white transition-all duration-300"
          style={{
            background: "linear-gradient(90deg, rgba(64,183,255,1) 0%, rgba(0,50,117,1) 55%, rgba(129,80,249,1) 100%)",
            boxShadow: "0 4px 12px rgba(64,183,255,0.3)",
          }}
        >
          <Zap className="h-4 w-4" fill="currentColor" strokeWidth={0} />
          <span>{expired ? "Renew plan" : "Go Pro Now"}</span>
        </button>
      </div>
    </div>
  );
}
