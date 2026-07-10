import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  type Branch,
  type Debtor,
  type Expense,
  type HeldSale,
  type InventoryAlert,
  type Product,
  type Sale,
  type SaleLine,
  type StaffActivityLog,
  type StaffMember,
  type StockMovement,
  type StockStatus,
  type Supplier,
  type Transfer,
} from "@/data";
import { db, getMeta, newId, replaceBranchCache, replaceCache, setMeta, type CacheTableName, type OutboxCommand } from "@/offline/db";
import { setCurrencySymbol } from "@/lib/format";
import { useOnline } from "@/offline/connectivity";
import { isBackendApiError } from "@/lib/api";
import * as ep from "@/lib/endpoints";
import {
  adaptAlert,
  adaptBranch,
  adaptDebtor,
  adaptExpense,
  adaptMovement,
  adaptProduct,
  adaptSale,
  adaptSettings,
  adaptStaff,
  adaptStaffLog,
  adaptSupplier,
  adaptTransfer,
  profileToBackendBody,
  settingsToBackendBody,
} from "@/lib/adapters";

const WRITE_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Persisted active-branch selection. Matches the web-app's localStorage key. */
const SELECTED_BRANCH_KEY = "fahampesa:selectedBranchId";

export interface Settings {
  fullName: string;
  email: string;
  phone: string;
  businessName: string;
  businessPhone: string;
  businessAddress: string;
  currency: string;
  taxRate: string;
  lowStockThreshold: string;
  emailNotifications: boolean;
  smsNotifications: boolean;
  lowStockAlerts: boolean;
  offlineMode: boolean;
  autoBackup: boolean;
  backupFrequency: string;
  receiptHeader: string;
  receiptFooter: string;
  receiptThankYou: string;
}

const initialSettings: Settings = {
  // Identity/business fields are populated from /me + /settings after sign-in; blank until then.
  fullName: "",
  email: "",
  phone: "",
  businessName: "",
  businessPhone: "",
  businessAddress: "",
  currency: "KSh — Kenyan Shilling",
  taxRate: "16",
  lowStockThreshold: "10",
  emailNotifications: true,
  smsNotifications: false,
  lowStockAlerts: true,
  offlineMode: true,
  autoBackup: true,
  backupFrequency: "Daily",
  receiptHeader: "",
  receiptFooter: "",
  receiptThankYou: "Thank you for your business!",
};

export function stockStatusFor(quantity: number, reorderLevel: number): StockStatus {
  if (quantity <= 0) return "out";
  if (quantity <= reorderLevel) return "low";
  return "healthy";
}

/** Merge a fresh backend sales list over the local rows, keeping each sale's stable local id
 *  (matched by backendId) so open receipts / references survive a refresh. Still-unsynced local
 *  sales (queued, no backendId yet) are preserved on top. */
function mergeSales(prev: Sale[], backendRows: Sale[]): Sale[] {
  const localByBackend = new Map<string, Sale>();
  prev.forEach((s) => {
    if (s.backendId) localByBackend.set(s.backendId, s);
  });
  const merged = backendRows.map((b) => {
    const local = b.backendId ? localByBackend.get(b.backendId) : undefined;
    return local ? { ...b, id: local.id } : b;
  });
  // Keep only genuinely local, still-unsynced sales — exclude rows already represented in the
  // backend list (incl. pre-upgrade cached rows whose id IS the backend record id, no backendId).
  const backendIds = new Set(backendRows.map((b) => b.backendId));
  const unsynced = prev.filter((s) => !s.backendId && !backendIds.has(s.id));
  return [...unsynced, ...merged];
}

/** Normalize a form date (YYYY-MM-DD or display string) to an ISO date the backend accepts. */
function toIsoDate(value: string): string {
  if (!value || value === "Today" || value === "—") return new Date().toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/** Map any app-side payment label to the backend enum (cash|mpesa|bank_transfer|card|credit|cheque|other). */
function paymentEnum(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("mpesa") || l.includes("m-pesa")) return "mpesa";
  if (l.includes("bank")) return "bank_transfer";
  if (l.includes("card")) return "card";
  if (l.includes("credit")) return "credit";
  if (l.includes("cheque")) return "cheque";
  if (l.includes("cash")) return "cash";
  return "other";
}
/**
 * Build a branch contact payload the backend accepts. The branch form substitutes a "—" placeholder
 * for blank fields; sending that (or an invalid email) makes the backend reject the whole branch, so
 * omit anything that isn't a real value. Email must pass a basic format check.
 */
function branchContactPayload(phone?: string, email?: string): { phone?: string; email?: string } {
  const contact: { phone?: string; email?: string } = {};
  const cleanPhone = (phone ?? "").trim();
  if (cleanPhone && cleanPhone !== "—") contact.phone = cleanPhone;
  const cleanEmail = (email ?? "").trim();
  if (cleanEmail && cleanEmail !== "—" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) contact.email = cleanEmail;
  return contact;
}

/** Expenses don't allow 'credit'; collapse it to 'other'. */
function expensePaymentEnum(label: string): string {
  const value = paymentEnum(label);
  return value === "credit" ? "other" : value;
}

export interface CompleteSaleLine {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  discountType?: "fixed" | "percentage";
  lineTotal: number;
}

export interface CompleteSaleInput {
  branchId: string;
  customer: string;
  customerPhone?: string;
  customerEmail?: string;
  debtorId?: string;
  paymentMethod: string;
  notes?: string;
  tax?: number;
  cartDiscount?: number;
  // The raw discount the user entered (a percentage RATE when cartDiscountType is "percentage",
  // otherwise a fixed amount). This — not the computed money amount — is what the backend expects.
  cartDiscountValue?: number;
  cartDiscountType?: "fixed" | "percentage";
  subtotal?: number;
  amount: number;
  lines: CompleteSaleLine[];
}

export type SyncStatus = "online" | "offline" | "syncing" | "error";
export interface SyncFailure {
  commandId: string;
  label: string;
  error: string;
}

interface AppDataValue {
  products: Product[];
  sales: Sale[];
  suppliers: Supplier[];
  debtors: Debtor[];
  staff: StaffMember[];
  staffLogs: StaffActivityLog[];
  branches: Branch[];
  expenses: Expense[];
  movements: StockMovement[];
  alerts: InventoryAlert[];
  transfers: Transfer[];
  settings: Settings;
  toast: string | null;

  // sync surface
  online: boolean;
  syncStatus: SyncStatus;
  queueCount: number;
  lastSyncAt: number | null;
  failures: SyncFailure[];
  writeWindowExpired: boolean;
  /** Resolve the active branch id (from cache/server) once authenticated; returns null if the account has no branches yet. */
  bootstrap: (preferredBranchIds: string[]) => Promise<string | null>;
  refresh: (branchId: string) => Promise<void>;
  syncNow: () => Promise<void>;
  retryFailed: () => Promise<void>;

  notify: (message: string) => void;

  addProduct: (data: Omit<Product, "id" | "status">) => void;
  updateProduct: (id: string, data: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  adjustStock: (id: string, newQuantity: number, reason?: string, notes?: string) => void;

  createTransfer: (input: { fromBranchId: string; toBranchId: string; items: Array<{ productId: string; quantity: number }>; notes?: string }) => Promise<void>;
  transferAction: (id: string, action: "approve" | "ship" | "receive" | "cancel") => Promise<void>;

  addSupplier: (data: Omit<Supplier, "id">) => void;
  updateSupplier: (id: string, data: Partial<Supplier>) => void;
  deleteSupplier: (id: string) => void;
  recordSupplierPayment: (id: string, amount: number, method: string, reference?: string, notes?: string) => void;

  addDebtor: (data: Omit<Debtor, "id">) => void;
  updateDebtor: (id: string, data: Partial<Debtor>) => void;
  recordDebtorPayment: (id: string, amount: number, method?: string, reference?: string) => void;

  addStaff: (data: Omit<StaffMember, "id">) => void;
  toggleStaff: (id: string) => void;
  deleteStaff: (id: string) => void;

  addBranch: (data: Omit<Branch, "id">) => void;
  updateBranch: (id: string, data: Partial<Branch>) => void;
  deleteBranch: (id: string) => void;

  addExpense: (data: Omit<Expense, "id">) => void;
  updateExpense: (id: string, data: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;
  completeSale: (input: CompleteSaleInput) => Sale;
  refundSale: (saleId: string, reason: string) => void;
  deleteSale: (saleId: string) => void;

  heldSales: HeldSale[];
  holdSale: (draft: Omit<HeldSale, "id" | "savedAt">) => void;
  removeHeld: (id: string) => void;

  updateSettings: (patch: Partial<Settings>) => void;
}

const AppDataContext = createContext<AppDataValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const online = useOnline();

  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffLogs, setStaffLogs] = useState<StaffActivityLog[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [heldSales, setHeldSales] = useState<HeldSale[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const [syncStatus, setSyncStatus] = useState<SyncStatus>("offline");
  const [queueCount, setQueueCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [failures, setFailures] = useState<SyncFailure[]>([]);

  const toastTimer = useRef<number | undefined>(undefined);
  const activeBranch = useRef<string>("");
  const draining = useRef(false);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  // ---- load cache on mount (offline-first: show last-synced data immediately, no demo seed) ----
  useEffect(() => {
    (async () => {
      const [p, s, sup, deb, stf, br, exp] = await Promise.all([
        db.products.toArray(),
        db.sales.toArray(),
        db.suppliers.toArray(),
        db.debtors.toArray(),
        db.staff.toArray(),
        db.branches.toArray(),
        db.expenses.toArray(),
      ]);
      // The cache now holds multiple branches, so scope branch-specific tables to the last-selected
      // branch (bootstrap → refresh re-hydrates the correct branch moments later regardless).
      const savedBranch = localStorage.getItem(SELECTED_BRANCH_KEY) ?? "";
      const forBranch = <T extends { branchId?: string }>(rows: T[]) =>
        savedBranch ? rows.filter((r) => r.branchId === savedBranch) : rows;
      setProducts(forBranch(p));
      setSales(forBranch(s));
      setSuppliers(forBranch(sup));
      setDebtors(forBranch(deb));
      setStaff(stf);
      setBranches(br);
      setExpenses(forBranch(exp));
      const savedSettings = await getMeta<Settings>("settings");
      if (savedSettings) {
        if (savedSettings.currency) setCurrencySymbol(savedSettings.currency);
        setSettings((cur) => ({ ...cur, ...savedSettings }));
      }
      const savedLast = await getMeta<number>("lastSyncAt");
      if (savedLast) setLastSyncAt(savedLast);
      const pending = await db.outbox.where("status").notEqual("done").count();
      setQueueCount(pending);
    })();
  }, []);

  useEffect(() => {
    setSyncStatus(online ? "online" : "offline");
  }, [online]);

  const writeWindowExpired = useMemo(() => {
    // No way to recompute reactively from outbox here without a query; approximated via lastSyncAt.
    if (online) return false;
    if (!lastSyncAt) return false;
    return Date.now() - lastSyncAt > WRITE_WINDOW_MS;
  }, [online, lastSyncAt]);

  async function refreshQueueCount() {
    setQueueCount(await db.outbox.count());
  }

  // ---- account-level data (settings/profile) — not branch-scoped ----
  const loadAccountData = useCallback(async () => {
    if (!online) return;
    const setRaw = await ep.getSettings().catch(() => null);
    if (setRaw) {
      const session = await getMeta<Record<string, unknown>>("session");
      const mapped = adaptSettings(setRaw, session ?? null);
      if (mapped.currency) setCurrencySymbol(mapped.currency);
      setSettings((cur) => {
        const next = { ...cur, ...mapped };
        void setMeta("settings", next);
        return next;
      });
    }
  }, [online]);

  // ---- bootstrap: resolve which branch is active before loading its data ----
  const bootstrap = useCallback<AppDataValue["bootstrap"]>(
    async (preferredBranchIds) => {
      // Pull the branch list so we can pick a real id. When online we require server truth —
      // falling back to a stale cached id here would fire branch-scoped calls against a branch
      // that may no longer exist. Offline, the last-synced branches are the best we have.
      let list: Branch[] = [];
      if (online) {
        const raw = await ep.listBranches().catch(() => null);
        if (!raw) return null;
        list = raw.map(adaptBranch);
        await replaceCache("branches", list);
        setBranches(list);
      } else {
        list = await db.branches.toArray();
      }
      if (list.length === 0) return null;

      const ids = new Set(list.map((b) => b.id));
      const saved = localStorage.getItem(SELECTED_BRANCH_KEY);
      const resolved =
        (saved && ids.has(saved) ? saved : undefined) ??
        preferredBranchIds.find((id) => ids.has(id)) ??
        list[0].id;
      localStorage.setItem(SELECTED_BRANCH_KEY, resolved);
      activeBranch.current = resolved;
      void loadAccountData();
      return resolved;
    },
    [online, loadAccountData],
  );

  // ---- refresh: pull server truth into cache + state ----
  const refresh = useCallback(
    async (branchId: string) => {
      // No resolved branch yet (e.g. signed out, or the reconnect drain ran before bootstrap) —
      // skip rather than hit /branches/<empty>/… and produce spurious 401s.
      if (!branchId) return;
      activeBranch.current = branchId;

      // Hydrate state from THIS branch's cache first. This is what makes an offline branch switch
      // work: the per-branch cache survives (replaceBranchCache below never wipes other branches),
      // so switching shows that branch's last-synced data immediately instead of an empty screen.
      const [cp, cs, csup, cdeb, cexp] = await Promise.all([
        db.products.where("branchId").equals(branchId).toArray(),
        db.sales.where("branchId").equals(branchId).toArray(),
        db.suppliers.where("branchId").equals(branchId).toArray(),
        db.debtors.where("branchId").equals(branchId).toArray(),
        db.expenses.where("branchId").equals(branchId).toArray(),
      ]);
      setProducts(cp);
      setSales(cs);
      setSuppliers(csup);
      setDebtors(cdeb);
      setExpenses(cexp);

      if (!online) return;
      setSyncStatus("syncing");
      try {
        const [brRaw, prRaw, saRaw, exRaw, suRaw, deRaw, stRaw, mvRaw, alRaw, trRaw] = await Promise.all([
          ep.listBranches().catch(() => null),
          ep.listProducts(branchId).catch(() => null),
          ep.listSales(branchId).catch(() => null),
          ep.listExpenses(branchId).catch(() => null),
          ep.listSuppliers(branchId).catch(() => null),
          ep.listDebtors(branchId).catch(() => null),
          ep.listStaff().catch(() => null),
          ep.listMovements(branchId).catch(() => null),
          ep.listAlerts(branchId).catch(() => null),
          ep.listTransfers().catch(() => null),
        ]);

        if (brRaw) {
          const rows = brRaw.map(adaptBranch);
          await replaceCache("branches", rows);
          setBranches(rows);
        }
        if (prRaw) {
          const rows = prRaw.map((r) => adaptProduct(r, branchId));
          await replaceBranchCache("products", branchId, rows);
          setProducts(rows);
        }
        if (saRaw) {
          const backendRows = saRaw.map((r) => adaptSale(r, branchId));
          setSales((prev) => {
            // Merge keeps this branch's not-yet-synced optimistic sales; scope the cache to this branch.
            const merged = mergeSales(prev, backendRows);
            void replaceBranchCache("sales", branchId, merged.filter((row) => row.branchId === branchId));
            return merged;
          });
        }
        if (exRaw) {
          const rows = exRaw.map((r) => adaptExpense(r, branchId));
          await replaceBranchCache("expenses", branchId, rows);
          setExpenses(rows);
        }
        if (suRaw) {
          const rows = suRaw.map((r) => adaptSupplier(r, branchId));
          await replaceBranchCache("suppliers", branchId, rows);
          setSuppliers(rows);
        }
        if (deRaw) {
          const rows = deRaw.map((r) => adaptDebtor(r, branchId));
          await replaceBranchCache("debtors", branchId, rows);
          setDebtors(rows);
        }
        if (stRaw) {
          const rows = stRaw.map(adaptStaff);
          await replaceCache("staff", rows);
          setStaff(rows);
        }
        if (mvRaw) setMovements(mvRaw.map((r) => adaptMovement(r, branchId)));
        if (alRaw) setAlerts(alRaw.map((r) => adaptAlert(r, branchId)));
        if (trRaw) setTransfers(trRaw.map(adaptTransfer));
        const logsRaw = await ep.listStaffLogs().catch(() => null);
        if (logsRaw) setStaffLogs(logsRaw.map(adaptStaffLog));
        const now = Date.now();
        setLastSyncAt(now);
        await setMeta("lastSyncAt", now);
        setSyncStatus("online");
      } catch {
        setSyncStatus("error");
      }
    },
    [online],
  );

  // ---- outbox ----
  const executeCommand = useCallback(async (cmd: OutboxCommand) => {
    const payload = cmd.payload as Record<string, unknown>;
    const key = `${cmd.entityType}:${cmd.operation}`;
    switch (key) {
      case "product:create":
        return ep.createProduct(cmd.branchId, payload, cmd.idempotencyKey);
      case "product:update":
        return ep.updateProduct(cmd.branchId, cmd.entityId!, payload);
      case "product:delete":
        return ep.deleteProduct(cmd.branchId, cmd.entityId!);
      case "inventory:adjust":
        return ep.adjustStock(cmd.branchId, payload);
      case "sale:sale":
        return ep.createSale(cmd.branchId, payload, cmd.idempotencyKey);
      case "sale:refund":
        return ep.refundSale(cmd.branchId, cmd.entityId!, payload);
      case "sale:delete":
        return ep.deleteSale(cmd.branchId, cmd.entityId!);
      case "expense:create":
        return ep.createExpense(cmd.branchId, payload);
      case "expense:update":
        return ep.updateExpense(cmd.branchId, cmd.entityId!, payload);
      case "expense:delete":
        return ep.deleteExpense(cmd.branchId, cmd.entityId!);
      case "supplier:create":
        return ep.createSupplier(cmd.branchId, payload);
      case "supplier:update":
        return ep.updateSupplier(cmd.branchId, cmd.entityId!, payload);
      case "supplier:delete":
        return ep.deleteSupplier(cmd.branchId, cmd.entityId!);
      case "supplier:payment":
        return ep.supplierPayment(cmd.branchId, cmd.entityId!, payload);
      case "debtor:create":
        return ep.createDebtor(cmd.branchId, payload);
      case "debtor:update":
        return ep.updateDebtor(cmd.branchId, cmd.entityId!, payload);
      case "debtor:payment":
        return ep.debtorPayment(cmd.branchId, cmd.entityId!, payload);
      case "staff:create":
        return ep.createStaff(payload);
      case "staff:update":
        return ep.updateStaff(cmd.entityId!, payload);
      case "staff:delete":
        return ep.deleteStaff(cmd.entityId!);
      case "branch:create":
        return ep.createBranch(payload);
      case "branch:update":
        return ep.updateBranch(cmd.entityId!, payload);
      case "branch:delete":
        return ep.deleteBranch(cmd.entityId!);
      default:
        throw new Error(`Unknown command ${key}`);
    }
  }, []);

  const drain = useCallback(async () => {
    if (draining.current || !online) return;
    draining.current = true;
    try {
      const pending = await db.outbox.orderBy("clientTimestamp").toArray();
      for (const cmd of pending) {
        if (cmd.status === "failed") continue;
        if (Date.now() - cmd.clientTimestamp > WRITE_WINDOW_MS) {
          await db.outbox.update(cmd.commandId, { status: "failed", error: "Offline write window (24h) expired" });
          setFailures((f) => [...f, { commandId: cmd.commandId, label: `${cmd.entityType} ${cmd.operation}`, error: "Write window expired" }]);
          continue;
        }
        try {
          await db.outbox.update(cmd.commandId, { status: "inflight" });
          const result = await executeCommand(cmd);
          await db.outbox.delete(cmd.commandId);
          // A newly-synced sale gets its real, backend-assigned saleNumber (e.g. SALE-000042) —
          // the same identifier the web shows. Reconcile the optimistic row in place, keeping its
          // stable local id so an open receipt / any reference follows it to the real number.
          if (cmd.entityType === "sale" && cmd.operation === "sale" && result) {
            const backend = adaptSale(result as Record<string, unknown>, cmd.branchId);
            setSales((cur) => {
              let updated: Sale | undefined;
              const next = cur.map((s) => (s.id === cmd.entityId ? (updated = { ...backend, id: s.id }) : s));
              if (updated) void patchCache("sales", updated);
              return next;
            });
          }
        } catch (error) {
          if (isBackendApiError(error)) {
            // Server rejected (validation, insufficient stock, etc.) — needs review.
            await db.outbox.update(cmd.commandId, { status: "failed", error: error.message });
            setFailures((f) => [...f, { commandId: cmd.commandId, label: `${cmd.entityType} ${cmd.operation}`, error: error.message }]);
          } else {
            // Network blip — leave pending and stop draining.
            await db.outbox.update(cmd.commandId, { status: "pending" });
            break;
          }
        }
      }
      await refreshQueueCount();
      await refresh(activeBranch.current);
    } finally {
      draining.current = false;
    }
  }, [online, executeCommand, refresh]);

  // auto-drain when connectivity returns
  useEffect(() => {
    if (online) void drain();
  }, [online, drain]);

  const enqueue = useCallback(
    async (cmd: Omit<OutboxCommand, "status" | "attempts" | "clientTimestamp">) => {
      await db.outbox.put({ ...cmd, status: "pending", attempts: 0, clientTimestamp: Date.now() });
      await refreshQueueCount();
      void drain();
    },
    [drain],
  );

  // ---- helpers to keep cache + state in lockstep for optimistic writes ----
  async function patchCache<T extends { id: string }>(table: CacheTableName, row: T) {
    await db.table(table).put(row);
  }
  async function removeCache(table: CacheTableName, id: string) {
    await db.table(table).delete(id);
  }

  // ---- Products ----
  const addProduct = useCallback<AppDataValue["addProduct"]>(
    (data) => {
      const id = newId();
      const product: Product = { ...data, id, status: stockStatusFor(data.quantity, data.reorderLevel) };
      setProducts((cur) => [product, ...cur]);
      void patchCache("products", product);
      void enqueue({
        commandId: id,
        idempotencyKey: id,
        entityType: "product",
        entityId: id,
        operation: "create",
        branchId: data.branchId,
        baseVersion: null,
        payload: {
          name: data.name,
          barcode: data.barcode,
          category: data.category,
          description: data.description,
          sku: data.sku,
          unitOfMeasure: data.unitOfMeasure,
          isPerishable: data.isPerishable,
          images: data.images,
          inventory: {
            initialQuantity: data.quantity,
            initialStockReason: "opening_stock",
            reorderLevel: data.reorderLevel,
            costPrice: data.costPrice,
            sellingPrice: data.sellingPrice,
            supplierId: data.supplierId || undefined,
            batchNumber: data.batchNumber,
            binLocation: data.binLocation,
            expiryDate: data.expiryDate || undefined,
          },
        },
      });
      notify(`Added "${product.name}"`);
    },
    [enqueue, notify],
  );

  const updateProduct = useCallback<AppDataValue["updateProduct"]>(
    (id, data) => {
      let updated: Product | undefined;
      setProducts((cur) =>
        cur.map((p) => {
          if (p.id !== id) return p;
          updated = { ...p, ...data };
          updated.status = stockStatusFor(updated.quantity, updated.reorderLevel);
          return updated;
        }),
      );
      if (updated) void patchCache("products", updated);
      const branchId = updated?.branchId ?? activeBranch.current;
      void enqueue({
        commandId: newId(),
        idempotencyKey: newId(),
        entityType: "product",
        entityId: id,
        operation: "update",
        branchId,
        baseVersion: null,
        payload: {
          name: data.name,
          category: data.category,
          barcode: data.barcode,
          description: data.description,
          sku: data.sku,
          unitOfMeasure: data.unitOfMeasure,
          isPerishable: data.isPerishable,
          images: data.images,
          inventory: {
            reorderLevel: data.reorderLevel,
            costPrice: data.costPrice,
            sellingPrice: data.sellingPrice,
            batchNumber: data.batchNumber,
            binLocation: data.binLocation,
            expiryDate: data.expiryDate || undefined,
          },
        },
      });
      notify("Product updated");
    },
    [enqueue, notify],
  );

  const deleteProduct = useCallback<AppDataValue["deleteProduct"]>(
    (id) => {
      const branchId = products.find((p) => p.id === id)?.branchId ?? activeBranch.current;
      setProducts((cur) => cur.filter((p) => p.id !== id));
      void removeCache("products", id);
      void enqueue({ commandId: newId(), idempotencyKey: newId(), entityType: "product", entityId: id, operation: "delete", branchId, baseVersion: null, payload: {} });
      notify("Product deleted");
    },
    [enqueue, notify, products],
  );

  const adjustStock = useCallback<AppDataValue["adjustStock"]>(
    (id, newQuantity, reason, notes) => {
      let updated: Product | undefined;
      setProducts((cur) =>
        cur.map((p) => {
          if (p.id !== id) return p;
          updated = { ...p, quantity: newQuantity, status: stockStatusFor(newQuantity, p.reorderLevel), lastMovement: "Manual adjustment just now" };
          return updated;
        }),
      );
      if (updated) void patchCache("products", updated);
      const branchId = updated?.branchId ?? activeBranch.current;
      void enqueue({
        commandId: newId(),
        idempotencyKey: newId(),
        entityType: "inventory",
        entityId: id,
        operation: "adjust",
        branchId,
        baseVersion: null,
        payload: { productId: id, adjustmentType: "set", quantity: newQuantity, reason: reason || "stock_count", notes: notes || undefined },
      });
      notify("Stock adjusted");
    },
    [enqueue, notify],
  );

  // ---- Transfers (online-only direct calls) ----
  const createTransfer = useCallback<AppDataValue["createTransfer"]>(
    async (input) => {
      try {
        await ep.createTransfer({ fromBranchId: input.fromBranchId, toBranchId: input.toBranchId, items: input.items, notes: input.notes });
        const trRaw = await ep.listTransfers().catch(() => null);
        if (trRaw) setTransfers(trRaw.map(adaptTransfer));
        notify("Transfer created");
      } catch (error) {
        notify(isBackendApiError(error) ? error.message : "Couldn't create transfer");
      }
    },
    [notify],
  );

  const transferAction = useCallback<AppDataValue["transferAction"]>(
    async (id, action) => {
      try {
        await ep.transferAction(id, action);
        const trRaw = await ep.listTransfers().catch(() => null);
        if (trRaw) setTransfers(trRaw.map(adaptTransfer));
        notify(`Transfer ${action} done`);
      } catch (error) {
        notify(isBackendApiError(error) ? error.message : `Couldn't ${action} transfer`);
      }
    },
    [notify],
  );

  // ---- Suppliers ----
  const addSupplier = useCallback<AppDataValue["addSupplier"]>(
    (data) => {
      const id = newId();
      const row: Supplier = { ...data, id };
      setSuppliers((cur) => [row, ...cur]);
      void patchCache("suppliers", row);
      // Backend create accepts openingBalance (not status); status is set via update.
      void enqueue({
        commandId: id,
        idempotencyKey: id,
        entityType: "supplier",
        entityId: id,
        operation: "create",
        branchId: data.branchId,
        baseVersion: null,
        payload: {
          name: data.name,
          contactPerson: data.contact,
          phone: data.phone,
          email: data.email || undefined,
          address: data.address || undefined,
          categories: data.categories?.length ? data.categories : undefined,
          productsSupplied: data.productsSupplied?.length ? data.productsSupplied : undefined,
          paymentTerms: data.paymentTerms || undefined,
          openingBalance: data.outstanding,
        },
      });
      notify(`Added supplier "${data.name}"`);
    },
    [enqueue, notify],
  );

  const updateSupplier = useCallback<AppDataValue["updateSupplier"]>(
    (id, data) => {
      let updated: Supplier | undefined;
      setSuppliers((cur) => cur.map((s) => (s.id === id ? (updated = { ...s, ...data }) : s)));
      if (updated) void patchCache("suppliers", updated);
      void enqueue({
        commandId: newId(),
        idempotencyKey: newId(),
        entityType: "supplier",
        entityId: id,
        operation: "update",
        branchId: updated?.branchId ?? activeBranch.current,
        baseVersion: null,
        payload: {
          name: data.name,
          contactPerson: data.contact,
          phone: data.phone,
          email: data.email || undefined,
          address: data.address || undefined,
          categories: data.categories,
          productsSupplied: data.productsSupplied,
          paymentTerms: data.paymentTerms || undefined,
          status: data.status === undefined ? undefined : data.status === "active" ? "active" : "inactive",
        },
      });
      notify("Supplier updated");
    },
    [enqueue, notify],
  );

  const deleteSupplier = useCallback<AppDataValue["deleteSupplier"]>(
    (id) => {
      const branchId = suppliers.find((s) => s.id === id)?.branchId ?? activeBranch.current;
      setSuppliers((cur) => cur.filter((s) => s.id !== id));
      void removeCache("suppliers", id);
      void enqueue({ commandId: newId(), idempotencyKey: newId(), entityType: "supplier", entityId: id, operation: "delete", branchId, baseVersion: null, payload: {} });
      notify("Supplier deleted");
    },
    [enqueue, notify, suppliers],
  );

  const recordSupplierPayment = useCallback<AppDataValue["recordSupplierPayment"]>(
    (id, amount, method, reference, notes) => {
      const row = suppliers.find((s) => s.id === id);
      const branchId = row?.branchId ?? activeBranch.current;
      setSuppliers((cur) => cur.map((s) => (s.id === id ? { ...s, outstanding: Math.max(0, s.outstanding - amount), totalPaid: (s.totalPaid ?? 0) + amount } : s)));
      if (row) void patchCache("suppliers", { ...row, outstanding: Math.max(0, row.outstanding - amount), totalPaid: (row.totalPaid ?? 0) + amount });
      void enqueue({ commandId: newId(), idempotencyKey: newId(), entityType: "supplier", entityId: id, operation: "payment", branchId, baseVersion: null, payload: { amount, paymentMethod: paymentEnum(method), reference: reference || undefined, notes: notes || undefined } });
      notify("Supplier payment recorded");
    },
    [enqueue, notify, suppliers],
  );

  // ---- Debtors ----
  const addDebtor = useCallback<AppDataValue["addDebtor"]>(
    (data) => {
      const id = newId();
      const row: Debtor = { ...data, id };
      setDebtors((cur) => [row, ...cur]);
      void patchCache("debtors", row);
      // Backend persists name/phone/email/creditLimit/dueDate (no opening-debt field — debt accrues via credit sales).
      void enqueue({ commandId: id, idempotencyKey: id, entityType: "debtor", entityId: id, operation: "create", branchId: activeBranch.current, baseVersion: null, payload: { name: data.name, phone: data.phone, email: data.email || undefined, creditLimit: data.creditLimit, dueDate: data.dueDate || undefined } });
      notify(`Added debtor "${data.name}"`);
    },
    [enqueue, notify],
  );

  const updateDebtor = useCallback<AppDataValue["updateDebtor"]>(
    (id, data) => {
      let updated: Debtor | undefined;
      setDebtors((cur) => cur.map((d) => (d.id === id ? (updated = { ...d, ...data }) : d)));
      if (updated) void patchCache("debtors", updated);
      void enqueue({ commandId: newId(), idempotencyKey: newId(), entityType: "debtor", entityId: id, operation: "update", branchId: activeBranch.current, baseVersion: null, payload: { name: data.name, phone: data.phone, email: data.email || undefined, creditLimit: data.creditLimit, dueDate: data.dueDate || undefined, isActive: data.active } });
      notify("Debtor updated");
    },
    [enqueue, notify],
  );

  const recordDebtorPayment = useCallback<AppDataValue["recordDebtorPayment"]>(
    (id, amount, method, reference) => {
      setDebtors((cur) => cur.map((d) => (d.id === id ? { ...d, currentDebt: Math.max(0, d.currentDebt - amount) } : d)));
      const row = debtors.find((d) => d.id === id);
      if (row) void patchCache("debtors", { ...row, currentDebt: Math.max(0, row.currentDebt - amount) });
      void enqueue({ commandId: newId(), idempotencyKey: newId(), entityType: "debtor", entityId: id, operation: "payment", branchId: activeBranch.current, baseVersion: null, payload: { amount, paymentMethod: paymentEnum(method || "cash"), reference: reference || undefined } });
      notify("Payment recorded");
    },
    [enqueue, notify, debtors],
  );

  // ---- Staff (online-only) ----
  const addStaff = useCallback<AppDataValue["addStaff"]>(
    (data) => {
      const id = newId();
      const row: StaffMember = { ...data, id };
      setStaff((cur) => [row, ...cur]);
      void patchCache("staff", row);
      void enqueue({ commandId: id, idempotencyKey: id, entityType: "staff", entityId: id, operation: "create", branchId: activeBranch.current, baseVersion: null, payload: { fullName: data.name, email: data.email, phone: data.phone, role: data.role } });
      notify(`Added "${data.name}"`);
    },
    [enqueue, notify],
  );

  const toggleStaff = useCallback<AppDataValue["toggleStaff"]>(
    (id) => {
      let updated: StaffMember | undefined;
      setStaff((cur) => cur.map((m) => (m.id === id ? (updated = { ...m, status: m.status === "active" ? "inactive" : "active" }) : m)));
      if (updated) void patchCache("staff", updated);
      const next = updated;
      if (next) {
        void enqueue({
          commandId: newId(),
          idempotencyKey: newId(),
          entityType: "staff",
          entityId: id,
          operation: next.status === "active" ? "update" : "delete",
          branchId: activeBranch.current,
          baseVersion: null,
          payload: { status: next.status },
        });
      }
      notify("Staff status updated");
    },
    [enqueue, notify],
  );

  const deleteStaff = useCallback<AppDataValue["deleteStaff"]>(
    (id) => {
      setStaff((cur) => cur.filter((m) => m.id !== id));
      void removeCache("staff", id);
      void enqueue({ commandId: newId(), idempotencyKey: newId(), entityType: "staff", entityId: id, operation: "delete", branchId: activeBranch.current, baseVersion: null, payload: {} });
      notify("Staff member removed");
    },
    [enqueue, notify],
  );

  // ---- Branches (online-only) ----
  const addBranch = useCallback<AppDataValue["addBranch"]>(
    (data) => {
      const id = newId();
      const row: Branch = { ...data, id };
      setBranches((cur) => [...cur, row]);
      void patchCache("branches", row);
      void enqueue({
        commandId: id,
        idempotencyKey: id,
        entityType: "branch",
        entityId: id,
        operation: "create",
        branchId: id,
        baseVersion: null,
        payload: { name: data.name, branchCode: data.code, branchType: data.type, location: { address: data.city, city: data.city }, contact: branchContactPayload(data.phone, data.email) },
      });
      notify(`Added branch "${data.name}"`);
    },
    [enqueue, notify],
  );

  const updateBranch = useCallback<AppDataValue["updateBranch"]>(
    (id, data) => {
      let updated: Branch | undefined;
      setBranches((cur) => cur.map((b) => (b.id === id ? (updated = { ...b, ...data }) : b)));
      if (updated) void patchCache("branches", updated);
      void enqueue({
        commandId: newId(),
        idempotencyKey: newId(),
        entityType: "branch",
        entityId: id,
        operation: "update",
        branchId: id,
        baseVersion: null,
        // Include location so city edits persist (previously dropped), and sanitize contact.
        payload: {
          name: data.name,
          branchCode: data.code,
          branchType: data.type,
          ...(data.city ? { location: { address: data.city, city: data.city } } : {}),
          contact: branchContactPayload(data.phone, data.email),
        },
      });
      notify("Branch updated");
    },
    [enqueue, notify],
  );

  const deleteBranch = useCallback<AppDataValue["deleteBranch"]>(
    (id) => {
      const name = branches.find((b) => b.id === id)?.name ?? "Branch";
      setBranches((cur) => cur.filter((b) => b.id !== id));
      void removeCache("branches", id);
      // Permanent, cascading delete on the backend (owner-only). Routed through the outbox
      // like other branch writes; drains immediately when online.
      void enqueue({ commandId: newId(), idempotencyKey: newId(), entityType: "branch", entityId: id, operation: "delete", branchId: id, baseVersion: null, payload: {} });
      notify(`Deleted branch "${name}"`);
    },
    [branches, enqueue, notify],
  );

  // ---- Expenses ----
  const addExpense = useCallback<AppDataValue["addExpense"]>(
    (data) => {
      const id = newId();
      const row: Expense = { ...data, id };
      setExpenses((cur) => [row, ...cur]);
      void patchCache("expenses", row);
      void enqueue({
        commandId: id,
        idempotencyKey: id,
        entityType: "expense",
        entityId: id,
        operation: "create",
        branchId: activeBranch.current,
        baseVersion: null,
        payload: {
          amount: data.amount,
          category: data.category,
          description: data.description || undefined,
          vendor: data.vendor || undefined,
          receiptNumber: data.receipt && data.receipt !== "—" ? data.receipt : undefined,
          paymentMethod: expensePaymentEnum(data.paymentMethod),
          date: toIsoDate(data.date),
        },
      });
      notify(`Recorded expense "${data.description}"`);
    },
    [enqueue, notify],
  );

  const updateExpense = useCallback<AppDataValue["updateExpense"]>(
    (id, data) => {
      let updated: Expense | undefined;
      setExpenses((cur) => cur.map((e) => (e.id === id ? (updated = { ...e, ...data }) : e)));
      if (updated) void patchCache("expenses", updated);
      void enqueue({
        commandId: newId(),
        idempotencyKey: newId(),
        entityType: "expense",
        entityId: id,
        operation: "update",
        branchId: activeBranch.current,
        baseVersion: null,
        payload: {
          amount: data.amount,
          category: data.category,
          description: data.description || undefined,
          vendor: data.vendor || undefined,
          receiptNumber: data.receipt && data.receipt !== "—" ? data.receipt : undefined,
          paymentMethod: data.paymentMethod ? expensePaymentEnum(data.paymentMethod) : undefined,
          date: data.date ? toIsoDate(data.date) : undefined,
        },
      });
      notify("Expense updated");
    },
    [enqueue, notify],
  );

  const deleteExpense = useCallback<AppDataValue["deleteExpense"]>(
    (id) => {
      setExpenses((cur) => cur.filter((e) => e.id !== id));
      void removeCache("expenses", id);
      void enqueue({ commandId: newId(), idempotencyKey: newId(), entityType: "expense", entityId: id, operation: "delete", branchId: activeBranch.current, baseVersion: null, payload: {} });
      notify("Expense deleted");
    },
    [enqueue, notify],
  );

  // ---- Sales ----
  const saleNumberSeq = useRef(1);
  const completeSale = useCallback<AppDataValue["completeSale"]>(
    (input) => {
      const id = newId();
      const totalItems = input.lines.reduce((t, l) => t + l.quantity, 0);
      const lines: SaleLine[] = input.lines.map((l) => ({
        productId: l.productId,
        productName: l.productName,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discount: l.discount,
        discountType: l.discountType,
        lineTotal: l.lineTotal,
      }));
      const sale: Sale = {
        id,
        number: `Draft-${String(saleNumberSeq.current++).padStart(3, "0")}`,
        branchId: input.branchId,
        customer: input.customer.trim() || "Walk-in customer",
        items: totalItems,
        amount: input.amount,
        paymentMethod: input.paymentMethod,
        status: "queued",
        time: "Just now",
        lines,
        subtotal: input.subtotal,
        tax: input.tax,
        discount: input.cartDiscount,
        discountType: input.cartDiscountType,
        customerPhone: input.customerPhone,
        customerEmail: input.customerEmail,
        debtorId: input.debtorId,
        notes: input.notes,
        refunded: false,
      };
      setSales((cur) => [sale, ...cur]);
      void patchCache("sales", sale);

      // optimistic stock decrement
      setProducts((cur) =>
        cur.map((p) => {
          const line = input.lines.find((l) => l.productId === p.id);
          if (!line) return p;
          const quantity = Math.max(0, p.quantity - line.quantity);
          const next = { ...p, quantity, status: stockStatusFor(quantity, p.reorderLevel), lastMovement: "Sale deducted just now" };
          void patchCache("products", next);
          return next;
        }),
      );

      const items = input.lines.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        ...(l.discount ? { discount: l.discount, discountType: l.discountType ?? "fixed" } : {}),
      }));
      const customer: Record<string, unknown> = { name: sale.customer };
      if (input.customerPhone) customer.phone = input.customerPhone;
      if (input.customerEmail) customer.email = input.customerEmail;
      if (input.debtorId) customer.debtorId = input.debtorId;
      void enqueue({
        commandId: id,
        idempotencyKey: id,
        entityType: "sale",
        entityId: id,
        operation: "sale",
        branchId: input.branchId,
        baseVersion: null,
        payload: {
          items,
          paymentMethod: paymentEnum(input.paymentMethod),
          // tax is a flat amount server-side; discount is the raw rate/value (NOT the computed
          // money) so a percentage isn't re-applied as an amount. Falls back to cartDiscount for
          // callers that haven't been updated.
          tax: input.tax || undefined,
          discount: (input.cartDiscountValue ?? input.cartDiscount) || undefined,
          discountType: input.cartDiscountType,
          customer,
          notes: input.notes || undefined,
        },
      });
      notify("Sale recorded");
      return sale;
    },
    [enqueue, notify],
  );

  const refundSale = useCallback<AppDataValue["refundSale"]>(
    (saleId, reason) => {
      let target: Sale | undefined;
      setSales((cur) =>
        cur.map((s) => {
          if (s.id !== saleId) return s;
          target = { ...s, refunded: true };
          return target;
        }),
      );
      if (target) void patchCache("sales", target);
      const lines = target?.lines;
      if (lines) {
        setProducts((cur) =>
          cur.map((p) => {
            const line = lines.find((l) => l.productId === p.id);
            if (!line) return p;
            const quantity = p.quantity + line.quantity;
            const next = { ...p, quantity, status: stockStatusFor(quantity, p.reorderLevel), lastMovement: "Refund restock" };
            void patchCache("products", next);
            return next;
          }),
        );
      }
      void enqueue({ commandId: newId(), idempotencyKey: newId(), entityType: "sale", entityId: target?.backendId ?? saleId, operation: "refund", branchId: target?.branchId ?? activeBranch.current, baseVersion: null, payload: { reason: reason || "Refund" } });
      notify("Sale refunded");
    },
    [enqueue, notify],
  );

  const deleteSale = useCallback<AppDataValue["deleteSale"]>(
    (saleId) => {
      const target = sales.find((s) => s.id === saleId);
      const branchId = target?.branchId ?? activeBranch.current;
      setSales((cur) => cur.filter((s) => s.id !== saleId));
      void removeCache("sales", saleId);
      void enqueue({ commandId: newId(), idempotencyKey: newId(), entityType: "sale", entityId: target?.backendId ?? saleId, operation: "delete", branchId, baseVersion: null, payload: {} });
      notify("Sale deleted");
    },
    [enqueue, notify, sales],
  );

  const holdSale = useCallback<AppDataValue["holdSale"]>(
    (draft) => {
      setHeldSales((cur) => [{ ...draft, id: newId(), savedAt: new Date().toISOString() }, ...cur]);
      notify("Sale held");
    },
    [notify],
  );

  const removeHeld = useCallback<AppDataValue["removeHeld"]>((id) => {
    setHeldSales((cur) => cur.filter((h) => h.id !== id));
  }, []);

  const updateSettings = useCallback<AppDataValue["updateSettings"]>(
    (patch) => {
      if (patch.currency) setCurrencySymbol(patch.currency);
      setSettings((cur) => {
        const next = { ...cur, ...patch };
        void setMeta("settings", next);
        return next;
      });
      // Settings are account-level and low-stakes — pushed directly when online (not queued).
      if (online) {
        const body = settingsToBackendBody(patch);
        if (Object.keys(body).length > 0) void ep.updateSettings(body).catch(() => {});
        const profile = profileToBackendBody(patch);
        if (Object.keys(profile).length > 0) void ep.updateMe(profile).catch(() => {});
      }
    },
    [online],
  );

  const syncNow = useCallback(async () => {
    await drain();
    await refresh(activeBranch.current);
    await loadAccountData();
  }, [drain, refresh, loadAccountData]);

  const retryFailed = useCallback(async () => {
    // Reset the client timestamp so commands that failed only because the 24h offline write window
    // lapsed get a fresh window and actually re-attempt — otherwise the drain's age check re-fails
    // them immediately and "Retry all" loops forever. Genuine failures re-surface with their error.
    const now = Date.now();
    await db.outbox
      .where("status")
      .equals("failed")
      .modify((cmd) => {
        cmd.status = "pending";
        cmd.clientTimestamp = now;
        cmd.error = undefined;
      });
    setFailures([]);
    await refreshQueueCount();
    void drain();
  }, [drain]);

  const value = useMemo<AppDataValue>(
    () => ({
      products, sales, suppliers, debtors, staff, staffLogs, branches, expenses, movements, alerts, transfers, settings, toast,
      online, syncStatus, queueCount, lastSyncAt, failures, writeWindowExpired,
      bootstrap, refresh, syncNow, retryFailed, notify,
      addProduct, updateProduct, deleteProduct, adjustStock, createTransfer, transferAction,
      addSupplier, updateSupplier, deleteSupplier, recordSupplierPayment,
      addDebtor, updateDebtor, recordDebtorPayment,
      addStaff, toggleStaff, deleteStaff,
      addBranch, updateBranch, deleteBranch, addExpense, updateExpense, deleteExpense, completeSale, refundSale, deleteSale,
      heldSales, holdSale, removeHeld,
      updateSettings,
    }),
    [
      products, sales, suppliers, debtors, staff, staffLogs, branches, expenses, movements, alerts, transfers, settings, toast,
      online, syncStatus, queueCount, lastSyncAt, failures, writeWindowExpired,
      bootstrap, refresh, syncNow, retryFailed, notify,
      addProduct, updateProduct, deleteProduct, adjustStock, createTransfer, transferAction, addSupplier, updateSupplier, deleteSupplier, recordSupplierPayment,
      addDebtor, updateDebtor, recordDebtorPayment, addStaff, toggleStaff, deleteStaff, addBranch, updateBranch, deleteBranch,
      addExpense, updateExpense, deleteExpense, completeSale, refundSale, deleteSale, heldSales, holdSale, removeHeld,
      updateSettings,
    ],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataValue {
  const value = useContext(AppDataContext);
  if (!value) throw new Error("useAppData must be used within AppDataProvider");
  return value;
}
