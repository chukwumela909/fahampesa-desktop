import { CheckCircle } from "lucide-react";
import { useAppData } from "@/store/AppData";

export default function Toast() {
  const { toast } = useAppData();
  if (!toast) return null;

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[200] -translate-x-1/2" style={{ fontFamily: "var(--font-dm-sans)" }}>
      <div className="flex items-center gap-2 rounded-[12px] border border-[#cbe3d4] bg-[#ecfdf3] px-4 py-3 text-sm font-semibold text-[#027a48] shadow-[0_14px_30px_rgba(15,23,42,0.12)]">
        <CheckCircle className="h-4 w-4" />
        {toast}
      </div>
    </div>
  );
}
