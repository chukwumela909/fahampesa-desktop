import { useEffect, useState } from "react";
import {
  Smartphone,
  Printer,
  ScanLine,
  QrCode,
  Bluetooth,
  Wifi,
  Usb,
  Plus,
  Trash2,
  Star,
  Activity,
} from "lucide-react";

// Device management for the desktop app. Mirrors the web app's Settings → Devices section
// (pairing, printer/scanner/barcode config, connection options, diagnostics). Settings are
// persisted locally — native hardware discovery/pairing will plug in here once the Tauri
// device bridge lands; for now devices are added manually.

type DeviceType = "PRINTER" | "SCANNER" | "TERMINAL" | "CASH_DRAWER" | "SCALE" | "DISPLAY";
type ConnectionType = "USB" | "BLUETOOTH" | "NETWORK" | "WIRELESS";
type DeviceStatus = "connected" | "offline" | "error";

interface PairedDevice {
  id: string;
  name: string;
  type: DeviceType;
  connectionType: ConnectionType;
  status: DeviceStatus;
  isDefault: boolean;
}

interface DeviceSettings {
  pairedDevices: PairedDevice[];
  printer: { quality: "DRAFT" | "NORMAL" | "HIGH"; paperSize: "58mm" | "80mm" | "A4" | "Letter"; copies: number; autoPrintReceipts: boolean; headerLogo: boolean; printBarcodes: boolean };
  scanner: { quality: "LOW" | "MEDIUM" | "HIGH"; autoScan: boolean; ocr: boolean };
  barcode: { format: "EAN" | "UPC" | "QR" | "CODE128"; autoGenerate: boolean; printOnLabels: boolean; includePrice: boolean };
  connection: { bluetooth: boolean; wifi: boolean; usb: boolean; timeout: number };
}

const STORAGE_KEY = "fahampesa:deviceSettings";

const DEVICE_TYPES: DeviceType[] = ["PRINTER", "SCANNER", "TERMINAL", "CASH_DRAWER", "SCALE", "DISPLAY"];
const CONNECTION_TYPES: ConnectionType[] = ["USB", "BLUETOOTH", "NETWORK", "WIRELESS"];

const DEFAULTS: DeviceSettings = {
  pairedDevices: [],
  printer: { quality: "NORMAL", paperSize: "80mm", copies: 1, autoPrintReceipts: true, headerLogo: true, printBarcodes: false },
  scanner: { quality: "MEDIUM", autoScan: false, ocr: false },
  barcode: { format: "CODE128", autoGenerate: true, printOnLabels: true, includePrice: false },
  connection: { bluetooth: true, wifi: true, usb: true, timeout: 30 },
};

function load(): DeviceSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<DeviceSettings>;
    return {
      pairedDevices: parsed.pairedDevices ?? [],
      printer: { ...DEFAULTS.printer, ...parsed.printer },
      scanner: { ...DEFAULTS.scanner, ...parsed.scanner },
      barcode: { ...DEFAULTS.barcode, ...parsed.barcode },
      connection: { ...DEFAULTS.connection, ...parsed.connection },
    };
  } catch {
    return DEFAULTS;
  }
}

const typeIcon: Record<DeviceType, typeof Printer> = {
  PRINTER: Printer,
  SCANNER: ScanLine,
  TERMINAL: Smartphone,
  CASH_DRAWER: Smartphone,
  SCALE: Smartphone,
  DISPLAY: Smartphone,
};

const statusTone: Record<DeviceStatus, string> = {
  connected: "bg-green-100 text-green-700",
  offline: "bg-slate-100 text-slate-600",
  error: "bg-red-100 text-red-700",
};

export default function DevicesPanel({ notify }: { notify: (message: string) => void }) {
  const [settings, setSettings] = useState<DeviceSettings>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  // pairing form
  const [name, setName] = useState("");
  const [type, setType] = useState<DeviceType>("PRINTER");
  const [connectionType, setConnectionType] = useState<ConnectionType>("USB");

  const update = <K extends keyof DeviceSettings>(key: K, value: DeviceSettings[K]) => setSettings((cur) => ({ ...cur, [key]: value }));

  function pairDevice() {
    if (!name.trim()) return;
    const device: PairedDevice = {
      id: `dev-${Date.now()}`,
      name: name.trim(),
      type,
      connectionType,
      status: "connected",
      isDefault: !settings.pairedDevices.some((d) => d.type === type),
    };
    update("pairedDevices", [...settings.pairedDevices, device]);
    setName("");
    notify(`Paired ${device.name}`);
  }

  function removeDevice(id: string) {
    update("pairedDevices", settings.pairedDevices.filter((d) => d.id !== id));
  }

  function setDefault(device: PairedDevice) {
    update("pairedDevices", settings.pairedDevices.map((d) => (d.type === device.type ? { ...d, isDefault: d.id === device.id } : d)));
  }

  const connected = settings.pairedDevices.filter((d) => d.status === "connected").length;
  const offline = settings.pairedDevices.filter((d) => d.status === "offline").length;
  const errored = settings.pairedDevices.filter((d) => d.status === "error").length;

  return (
    <div className="space-y-6">
      {/* Pair a device */}
      <Panel title="Pair a Device" icon={<Smartphone className="h-5 w-5 text-[#004aad]" />} description="Add a printer, scanner, or other peripheral. Automatic discovery is coming with native device support.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_160px_160px_auto]">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Device name" className="dashboard-field h-10 px-3 text-sm" />
          <Select value={type} onChange={(v) => setType(v as DeviceType)} options={DEVICE_TYPES.map((t) => ({ value: t, label: title(t) }))} />
          <Select value={connectionType} onChange={(v) => setConnectionType(v as ConnectionType)} options={CONNECTION_TYPES.map((c) => ({ value: c, label: title(c) }))} />
          <button onClick={pairDevice} disabled={!name.trim()} className="dashboard-action-primary h-10 disabled:opacity-50"><Plus className="mr-1 h-4 w-4" /> Pair</button>
        </div>

        {settings.pairedDevices.length === 0 ? (
          <div className="dashboard-empty-state mt-4 px-6 py-10 text-center text-sm text-[#64748b]">No devices paired yet. Pair a printer or scanner to get started.</div>
        ) : (
          <div className="mt-4 flex flex-col gap-2">
            {settings.pairedDevices.map((device) => {
              const Icon = typeIcon[device.type];
              return (
                <div key={device.id} className="flex items-center gap-3 rounded-[12px] border border-[#e6ebf2] p-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#eef5ff] text-[#004aad]"><Icon className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-[#0f172a]">{device.name}</p>
                      {device.isDefault && <span className="rounded bg-[#eef5ff] px-1.5 py-0.5 text-[10px] font-semibold text-[#004aad]">Default</span>}
                    </div>
                    <p className="text-xs text-[#64748b]">{title(device.type)} · {title(device.connectionType)}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusTone[device.status]}`}>{device.status}</span>
                  <button onClick={() => setDefault(device)} disabled={device.isDefault} className="grid h-8 w-8 place-items-center rounded-[8px] border border-[#e6ebf2] text-[#94a3b8] hover:text-[#f59e0b] disabled:opacity-40" title="Set as default"><Star className="h-4 w-4" /></button>
                  <button onClick={() => removeDevice(device.id)} className="grid h-8 w-8 place-items-center rounded-[8px] border border-[#e6ebf2] text-[#94a3b8] hover:bg-red-50 hover:text-red-600" title="Remove"><Trash2 className="h-4 w-4" /></button>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Printer configuration */}
        <Panel title="Printer Configuration" icon={<Printer className="h-5 w-5 text-[#004aad]" />} description="Receipt printing defaults">
          <Select label="Print quality" value={settings.printer.quality} onChange={(v) => update("printer", { ...settings.printer, quality: v as DeviceSettings["printer"]["quality"] })} options={["DRAFT", "NORMAL", "HIGH"].map((o) => ({ value: o, label: title(o) }))} />
          <Select label="Paper size" value={settings.printer.paperSize} onChange={(v) => update("printer", { ...settings.printer, paperSize: v as DeviceSettings["printer"]["paperSize"] })} options={["58mm", "80mm", "A4", "Letter"].map((o) => ({ value: o, label: o }))} />
          <NumberField label="Copies" value={settings.printer.copies} min={1} max={10} onChange={(n) => update("printer", { ...settings.printer, copies: n })} />
          <Toggle label="Auto-print receipts" on={settings.printer.autoPrintReceipts} onChange={(v) => update("printer", { ...settings.printer, autoPrintReceipts: v })} />
          <Toggle label="Print header logo" on={settings.printer.headerLogo} onChange={(v) => update("printer", { ...settings.printer, headerLogo: v })} />
          <Toggle label="Print barcodes on receipt" on={settings.printer.printBarcodes} onChange={(v) => update("printer", { ...settings.printer, printBarcodes: v })} />
        </Panel>

        {/* Scanner configuration */}
        <Panel title="Scanner Configuration" icon={<ScanLine className="h-5 w-5 text-[#004aad]" />} description="Barcode scanner behavior">
          <Select label="Scan quality" value={settings.scanner.quality} onChange={(v) => update("scanner", { ...settings.scanner, quality: v as DeviceSettings["scanner"]["quality"] })} options={["LOW", "MEDIUM", "HIGH"].map((o) => ({ value: o, label: title(o) }))} />
          <Toggle label="Auto-scan mode" on={settings.scanner.autoScan} onChange={(v) => update("scanner", { ...settings.scanner, autoScan: v })} />
          <Toggle label="OCR enabled" on={settings.scanner.ocr} onChange={(v) => update("scanner", { ...settings.scanner, ocr: v })} />
        </Panel>

        {/* Barcode settings */}
        <Panel title="Barcode Settings" icon={<QrCode className="h-5 w-5 text-[#004aad]" />} description="How product barcodes are generated and printed">
          <Select label="Format" value={settings.barcode.format} onChange={(v) => update("barcode", { ...settings.barcode, format: v as DeviceSettings["barcode"]["format"] })} options={["EAN", "UPC", "QR", "CODE128"].map((o) => ({ value: o, label: o }))} />
          <Toggle label="Auto-generate barcodes" on={settings.barcode.autoGenerate} onChange={(v) => update("barcode", { ...settings.barcode, autoGenerate: v })} />
          <Toggle label="Print on labels" on={settings.barcode.printOnLabels} onChange={(v) => update("barcode", { ...settings.barcode, printOnLabels: v })} />
          <Toggle label="Include price in barcode" on={settings.barcode.includePrice} onChange={(v) => update("barcode", { ...settings.barcode, includePrice: v })} />
        </Panel>

        {/* Connection settings */}
        <Panel title="Connection Settings" icon={<Bluetooth className="h-5 w-5 text-[#004aad]" />} description="Which connection methods to use for devices">
          <Toggle label={<span className="flex items-center gap-2"><Bluetooth className="h-4 w-4" /> Bluetooth</span>} on={settings.connection.bluetooth} onChange={(v) => update("connection", { ...settings.connection, bluetooth: v })} />
          <Toggle label={<span className="flex items-center gap-2"><Wifi className="h-4 w-4" /> Wi-Fi / Network</span>} on={settings.connection.wifi} onChange={(v) => update("connection", { ...settings.connection, wifi: v })} />
          <Toggle label={<span className="flex items-center gap-2"><Usb className="h-4 w-4" /> USB</span>} on={settings.connection.usb} onChange={(v) => update("connection", { ...settings.connection, usb: v })} />
          <NumberField label="Device timeout (seconds)" value={settings.connection.timeout} min={5} max={300} onChange={(n) => update("connection", { ...settings.connection, timeout: n })} />
        </Panel>
      </div>

      {/* Diagnostics */}
      <Panel title="Device Health & Diagnostics" icon={<Activity className="h-5 w-5 text-[#004aad]" />} description="Status across all paired devices">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Connected" value={connected} tone="text-[#16a34a]" />
          <Stat label="Offline" value={offline} tone="text-[#64748b]" />
          <Stat label="Errors" value={errored} tone="text-[#dc2626]" />
        </div>
        {/* Diagnostics/cache/reset buttons removed: they only fired toasts (and "reset"
            blindly marked every device connected), faking hardware health that was never
            checked. Real device integration can reintroduce them with actual probes. */}
        <p className="mt-4 text-xs text-[#94a3b8]">Device status is reported by each device when it connects. Automatic discovery and diagnostics aren't available yet.</p>
      </Panel>
    </div>
  );
}

function title(value: string): string {
  return value.split("_").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
}

function Panel({ title, icon, description, children }: { title: string; icon: React.ReactNode; description: string; children: React.ReactNode }) {
  return (
    <div className="dashboard-panel p-6">
      <div className="mb-1 flex items-center gap-2">{icon}<h3 className="dashboard-section-title">{title}</h3></div>
      <p className="mb-5 text-sm text-[#64748b]">{description}</p>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Select({ label, value, onChange, options }: { label?: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <div>
      {label && <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="dashboard-field w-full px-3 py-2 text-sm">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <input type="number" min={min} max={max} value={value} onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || min)))} className="dashboard-field w-full px-3 py-2 text-sm" />
    </div>
  );
}

function Toggle({ label, on, onChange }: { label: React.ReactNode; on: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-[#334155]">{label}</span>
      <button onClick={() => onChange(!on)} className={`relative h-6 w-11 rounded-full transition-colors ${on ? "bg-[#004aad]" : "bg-gray-200"}`} aria-pressed={on}>
        <span className={`absolute top-[2px] h-5 w-5 rounded-full bg-white transition-all ${on ? "left-[22px]" : "left-[2px]"}`} />
      </button>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-[12px] bg-[#f8fafc] p-4 text-center">
      <p className={`text-2xl font-bold ${tone}`}>{value}</p>
      <p className="text-xs font-medium text-[#64748b]">{label}</p>
    </div>
  );
}
