import { useEffect, useState } from "react";
import {
  User,
  Building2,
  Smartphone,
  Database,
  CreditCard,
  Phone,
  Shield,
  LogOut,
  Save,
  Wifi,
  Cloud,
  Mail,
  MessageSquare,
} from "lucide-react";
import { useAppData, type Settings } from "@/store/AppData";
import DevicesPanel from "@/screens/DevicesPanel";

type Tab = "account" | "business" | "devices" | "data" | "pricing" | "support";

const TABS: Array<{ id: Tab; label: string; icon: typeof User }> = [
  { id: "account", label: "Account", icon: User },
  { id: "business", label: "Business", icon: Building2 },
  { id: "devices", label: "Devices", icon: Smartphone },
  { id: "data", label: "Data & Sync", icon: Database },
  { id: "pricing", label: "Pricing", icon: CreditCard },
  { id: "support", label: "Support", icon: Phone },
];

export default function SettingsScreen({ onSignOut }: { onSignOut: () => void }) {
  const { settings, updateSettings, notify, online, syncStatus, lastSyncAt, queueCount, syncNow } = useAppData();
  const [tab, setTab] = useState<Tab>("account");
  const [draft, setDraft] = useState<Settings>(settings);

  // Settings load asynchronously from the backend (/me + /settings) after mount. Keep the
  // editable draft in step with the synced values so Profile/Tax/Business reflect the server.
  useEffect(() => setDraft(settings), [settings]);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setDraft((current) => ({ ...current, [key]: value }));

  function save() {
    updateSettings(draft);
    notify("Settings saved");
  }

  return (
    <div className="space-y-6" style={{ fontFamily: "var(--font-dm-sans)" }}>
      <div className="dashboard-panel p-1.5">
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-6">
          {TABS.map((item) => (
            <button key={item.id} onClick={() => setTab(item.id)} className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all ${tab === item.id ? "bg-white text-[#004aad] shadow-sm" : "text-[#64748b] hover:text-[#0f172a]"}`}>
              <item.icon className="h-4 w-4" /> {item.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "account" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Section title="Profile Settings" icon={<User className="h-5 w-5 text-[#004aad]" />} description="Your personal account details">
            <Field label="Full Name" value={draft.fullName} onChange={(v) => set("fullName", v)} />
            <Field label="Email" value={draft.email} onChange={(v) => set("email", v)} />
            <Field label="Phone Number" value={draft.phone} onChange={(v) => set("phone", v)} />
          </Section>


          <Section title="Security & Actions" icon={<Shield className="h-5 w-5 text-[#004aad]" />} description="Manage your session" className="lg:col-span-2">
            <div className="flex flex-wrap gap-3">
              <button onClick={onSignOut} className="inline-flex items-center gap-2 rounded-[12px] bg-[#e11d48] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#be123c]">
                <LogOut className="h-4 w-4" /> Log out
              </button>
              <button onClick={save} className="dashboard-action-primary">
                <Save className="mr-1 h-4 w-4" /> Save changes
              </button>
            </div>
          </Section>
        </div>
      )}

      {tab === "business" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Section title="Business Profile" icon={<Building2 className="h-5 w-5 text-[#004aad]" />} description="Information shown on receipts">
            <Field label="Business Name" value={draft.businessName} onChange={(v) => set("businessName", v)} />
            <Field label="Business Phone" value={draft.businessPhone} onChange={(v) => set("businessPhone", v)} />
            <Field label="Business Address" value={draft.businessAddress} onChange={(v) => set("businessAddress", v)} />
            <Field label="Currency" value={draft.currency} onChange={(v) => set("currency", v)} />
          </Section>

          <Section title="Tax Settings" icon={<CreditCard className="h-5 w-5 text-[#004aad]" />} description="VAT and stock thresholds">
            <Field label="Tax Rate (%)" value={draft.taxRate} onChange={(v) => set("taxRate", v)} />
            <Field label="Low Stock Threshold" value={draft.lowStockThreshold} onChange={(v) => set("lowStockThreshold", v)} />
          </Section>

          <Section title="Receipt Template" icon={<CreditCard className="h-5 w-5 text-[#004aad]" />} description="Text printed on customer receipts" className="lg:col-span-2">
            <Field label="Header text" value={draft.receiptHeader} onChange={(v) => set("receiptHeader", v)} />
            <Field label="Thank-you message" value={draft.receiptThankYou} onChange={(v) => set("receiptThankYou", v)} />
            <button onClick={save} className="dashboard-action-primary mt-1"><Save className="mr-1 h-4 w-4" /> Save changes</button>
          </Section>
        </div>
      )}

      {tab === "data" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Section title="Sync Status" icon={<Wifi className="h-5 w-5 text-[#004aad]" />} description="Live connection and queue" tint>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[10px] bg-white p-3"><p className="text-xs text-[#64748b]">Connection</p><p className={`text-lg font-bold ${online ? "text-[#15803d]" : "text-[#f59e0b]"}`}>{syncStatus === "syncing" ? "Syncing…" : online ? "Online" : "Offline"}</p></div>
              <div className="rounded-[10px] bg-white p-3"><p className="text-xs text-[#64748b]">Queued</p><p className="text-lg font-bold text-[#0f172a]">{queueCount}</p></div>
            </div>
            <p className="text-sm text-[#64748b]">{lastSyncAt ? `Last synced ${new Date(lastSyncAt).toLocaleString()}` : "Not synced yet"}</p>
            <button onClick={() => void syncNow()} disabled={!online} className="dashboard-action-primary mt-1 w-full disabled:opacity-50">Sync now</button>
            <p className="text-xs text-[#94a3b8]">Offline mode is always on — sales and edits made without a connection sync automatically when you're back online.</p>
          </Section>
          <Section title="Data Backup" icon={<Cloud className="h-5 w-5 text-[#004aad]" />} description="Your data is safe" tint>
            <p className="text-sm text-[#64748b]">Everything you record is stored on the FahamPesa server the moment it syncs — there's nothing to back up manually. This device also keeps a local copy so you can keep working offline.</p>
          </Section>
        </div>
      )}

      {tab === "devices" && <DevicesPanel notify={notify} />}

      {tab === "pricing" && (
        <Section title="Pricing & Taxes" icon={<CreditCard className="h-5 w-5 text-[#004aad]" />} description="Pricing rules and tax profiles">
          <div className="rounded-lg bg-[#f8fafc] p-4">
            <p className="text-sm font-medium text-[#0f172a]">Standard VAT</p>
            <p className="text-sm text-[#64748b]">Current rate: {draft.taxRate}% — applied to taxable sales.</p>
          </div>
        </Section>
      )}

      {tab === "support" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Section title="Contact Support" icon={<Phone className="h-5 w-5 text-[#004aad]" />} description="We're here to help">
            <div className="space-y-3 rounded-lg border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
              <SupportRow icon={<Phone className="h-4 w-4 text-white" />} bg="bg-[#004aad]" text="+254 722 628 885" />
              <SupportRow icon={<Mail className="h-4 w-4 text-white" />} bg="bg-[#004aad]" text="support@fahampesa.com" />
              <SupportRow icon={<MessageSquare className="h-4 w-4 text-white" />} bg="bg-green-600" text="WhatsApp: +254 722 628 885" />
            </div>
          </Section>
          <Section title="Quick Help" icon={<MessageSquare className="h-5 w-5 text-[#004aad]" />} description="Talk to a human">
            <p className="text-sm text-[#64748b]">Message us on WhatsApp or email support@fahampesa.com — we usually reply within a few hours and can walk you through anything, including training for your team.</p>
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, icon, description, children, className, tint }: { title: string; icon: React.ReactNode; description: string; children: React.ReactNode; className?: string; tint?: boolean }) {
  return (
    <div className={`dashboard-panel p-6 ${tint ? "border-[#004aad]/20 bg-[#004aad]/5" : ""} ${className ?? ""}`}>
      <div className="mb-1 flex items-center gap-2">
        {icon}
        <h3 className="dashboard-section-title">{title}</h3>
      </div>
      <p className="mb-5 text-sm text-[#64748b]">{description}</p>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="dashboard-field w-full px-3 py-2 text-sm" />
    </div>
  );
}


function SupportRow({ icon, bg, text }: { icon: React.ReactNode; bg: string; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`grid h-8 w-8 place-items-center rounded-full ${bg}`}>{icon}</span>
      <span className="text-sm text-[#334155]">{text}</span>
    </div>
  );
}
