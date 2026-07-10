import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

interface ModalProps {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
}

export default function Modal({ title, description, onClose, children, footer, size = "md" }: ModalProps) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      style={{ fontFamily: "var(--font-dm-sans)" }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={`flex max-h-[90vh] w-full ${size === "lg" ? "max-w-2xl" : "max-w-lg"} flex-col overflow-hidden rounded-[16px] bg-white shadow-2xl`}>
        <div className="flex items-start justify-between bg-gradient-to-r from-[#004AAD] to-[#0056CC] p-6 text-white">
          <div>
            <h2 className="text-xl font-bold">{title}</h2>
            {description && <p className="mt-1 text-sm text-blue-100">{description}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-2 transition-colors hover:bg-white/20" aria-label="Close">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">{children}</div>

        {footer && <div className="flex items-center justify-end gap-3 border-t border-[#eef2f7] p-4">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`dashboard-field w-full px-3 py-2 text-sm ${props.className ?? ""}`} />;
}

export function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`dashboard-field w-full px-3 py-2 text-sm ${props.className ?? ""}`} />;
}
