import type {
  Branch,
  BranchType,
  Debtor,
  Expense,
  InventoryAlert,
  Product,
  Sale,
  StaffActivityLog,
  StaffMember,
  StockMovement,
  StockStatus,
  Supplier,
  Transfer,
  TransferStatus,
} from "@/data";

// Backend responses come through normalizeMongo (so `_id` is already `id`). Shapes are
// read defensively because a few modules (supplier/debtor/staff) weren't fully inspected.
type Raw = Record<string, any>;

const num = (value: unknown, fallback = 0): number => (typeof value === "number" ? value : Number(value) || fallback);
const str = (value: unknown, fallback = ""): string => (value == null ? fallback : String(value));

/** The subset of app Settings that maps to the backend `/settings` (business + receipt) and `/me` (profile) records. */
export interface SettingsPatch {
  fullName: string;
  email: string;
  phone: string;
  businessName: string;
  businessPhone: string;
  businessAddress: string;
  currency: string;
  taxRate: string;
  lowStockThreshold: string;
  receiptHeader: string;
  receiptFooter: string;
  receiptThankYou: string;
}

export function mapStockStatus(status: unknown): StockStatus {
  if (status === "in_stock") return "healthy";
  if (status === "low_stock") return "low";
  return "out"; // out_of_stock | discontinued | unknown
}

const PAYMENT_LABEL: Record<string, string> = {
  cash: "Cash",
  mpesa: "M-Pesa record",
  bank_transfer: "Bank Transfer",
  card: "Card record",
  credit: "Credit",
  cheque: "Cheque",
  other: "Other",
};
export const paymentLabel = (method: unknown): string => PAYMENT_LABEL[str(method)] ?? "Cash";

function timeLabel(iso: unknown): string {
  if (!iso) return "Just now";
  const date = new Date(str(iso));
  if (Number.isNaN(date.getTime())) return "Just now";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** `GET /branches/:id/products` → product fields merged with `inventory: {...}`. */
export function adaptProduct(raw: Raw, branchId: string): Product {
  const inv: Raw = raw.inventory ?? {};
  return {
    id: str(raw.id),
    branchId,
    name: str(raw.name, "Unnamed product"),
    barcode: str(raw.barcode ?? raw.sku ?? raw.id),
    category: str(raw.category, "Uncategorized"),
    quantity: num(inv.quantity ?? inv.availableQuantity),
    availableQuantity: inv.availableQuantity != null ? num(inv.availableQuantity) : undefined,
    reservedQuantity: inv.reservedQuantity != null ? num(inv.reservedQuantity) : undefined,
    reorderLevel: num(inv.reorderLevel),
    costPrice: num(inv.costPrice),
    sellingPrice: num(inv.sellingPrice),
    supplierId: str(inv.supplierId ?? raw.supplierId),
    status: mapStockStatus(inv.status),
    lastMovement: inv.lastMovementAt ? `Updated ${timeLabel(inv.lastMovementAt)}` : "Synced from server",
    description: raw.description ? str(raw.description) : undefined,
    sku: raw.sku ? str(raw.sku) : undefined,
    unitOfMeasure: str(raw.unitOfMeasure, "unit"),
    images: Array.isArray(raw.images) ? raw.images.map(String) : [],
    binLocation: inv.binLocation ? str(inv.binLocation) : undefined,
    batchNumber: inv.batchNumber ? str(inv.batchNumber) : undefined,
    expiryDate: inv.expiryDate ? str(inv.expiryDate) : undefined,
    isPerishable: Boolean(raw.isPerishable),
  };
}

export function adaptSale(raw: Raw, branchId: string): Sale {
  const items: Raw[] = Array.isArray(raw.items) ? raw.items : [];
  const itemCount = items.reduce((total, item) => total + num(item.quantity, 1), 0) || items.length;
  const createdAtMs = raw.createdAt ? new Date(str(raw.createdAt)).getTime() : undefined;
  return {
    id: str(raw.id),
    backendId: str(raw.id),
    number: raw.saleNumber ? str(raw.saleNumber) : undefined,
    branchId,
    customer: str(raw.customer?.name, "Walk-in customer"),
    items: itemCount,
    amount: num(raw.totalAmount ?? raw.amount),
    paymentMethod: paymentLabel(raw.paymentMethod),
    status: "synced",
    time: timeLabel(raw.createdAt),
    lines: items.map((it) => ({
      productId: str(it.productId),
      productName: str(it.productName, "Item"),
      quantity: num(it.quantity, 1),
      unitPrice: num(it.unitPrice),
      discount: it.discount ? num(it.discount) : undefined,
      discountType: it.discountType === "percentage" ? "percentage" : it.discount ? "fixed" : undefined,
      lineTotal: num(it.lineSubtotal ?? it.lineTotal ?? num(it.unitPrice) * num(it.quantity, 1)),
    })),
    subtotal: num(raw.subtotal),
    tax: num(raw.tax),
    discount: num(raw.discountAmount ?? raw.discount),
    // Backend-stored profit — the dashboards prefer this over recomputing COGS from the current
    // catalog cost, so desktop/web/backend all report the identical figure.
    profit: raw.profit != null ? num(raw.profit) : undefined,
    customerPhone: raw.customer?.phone ? str(raw.customer.phone) : undefined,
    customerEmail: raw.customer?.email ? str(raw.customer.email) : undefined,
    debtorId: raw.customer?.debtorId ? str(raw.customer.debtorId) : undefined,
    notes: raw.notes ? str(raw.notes) : undefined,
    refunded: Boolean(raw.isRefunded ?? raw.refundedAt),
    createdAtMs: Number.isNaN(createdAtMs) ? undefined : createdAtMs,
  };
}

export function adaptExpense(raw: Raw, branchId: string): Expense {
  const when = raw.date ?? raw.createdAt;
  const createdAtMs = when ? new Date(str(when)).getTime() : undefined;
  return {
    id: str(raw.id),
    branchId,
    description: str(raw.description, "Expense"),
    category: str(raw.category, "Other"),
    amount: num(raw.amount),
    paymentMethod: paymentLabel(raw.paymentMethod),
    vendor: str(raw.vendor, "—"),
    receipt: str(raw.receiptNumber ?? raw.receipt, "—"),
    date: raw.date ? new Date(str(raw.date)).toLocaleDateString() : "—",
    createdAtMs: createdAtMs != null && Number.isNaN(createdAtMs) ? undefined : createdAtMs,
  };
}

export function adaptSupplier(raw: Raw, branchId: string): Supplier {
  // Backend supplier status enum is just 'active' | 'inactive'.
  const status = str(raw.status, "active");
  return {
    id: str(raw.id),
    branchId,
    name: str(raw.name, "Supplier"),
    contact: str(raw.contactPerson ?? raw.contact, "—"),
    phone: str(raw.phone, "—"),
    totalPurchases: num(raw.totalPurchases),
    outstanding: num(raw.currentBalance ?? raw.outstandingBalance ?? raw.outstanding ?? raw.balance),
    status: status === "inactive" ? "archived" : "active",
    email: raw.email ? str(raw.email) : undefined,
    address: raw.address ? str(raw.address) : undefined,
    categories: Array.isArray(raw.categories) ? raw.categories.map(String) : [],
    productsSupplied: Array.isArray(raw.productsSupplied) ? raw.productsSupplied.map(String) : [],
    paymentTerms: raw.paymentTerms ? str(raw.paymentTerms) : undefined,
    totalPaid: num(raw.totalPaid),
  };
}

export function adaptDebtor(raw: Raw, branchId: string): Debtor {
  const creditLimit = num(raw.creditLimit);
  const currentDebt = num(raw.currentDebt ?? raw.balance ?? raw.outstanding);
  const ratio = creditLimit > 0 ? currentDebt / creditLimit : 0;
  const status = str(raw.paymentStatus);
  return {
    id: str(raw.id),
    branchId,
    name: str(raw.name ?? raw.fullName, "Debtor"),
    phone: str(raw.phone, "—"),
    creditLimit,
    currentDebt,
    risk: ratio >= 0.8 ? "high" : ratio >= 0.5 ? "medium" : "low",
    email: raw.email ? str(raw.email) : undefined,
    dueDate: raw.dueDate ? str(raw.dueDate) : undefined,
    totalPaid: num(raw.totalPayments),
    status: status === "outstanding" || status === "overdue" ? status : "clear",
    active: raw.isActive !== false,
  };
}

export function adaptStaff(raw: Raw): StaffMember {
  const role = str(raw.role, "cashier");
  const branches: string[] = Array.isArray(raw.assignedBranchNames)
    ? raw.assignedBranchNames.map(String)
    : Array.isArray(raw.branches)
      ? raw.branches.map((b: Raw) => str(b.name ?? b))
      : [];
  // Backend serializes assignments as `assignedBranchIds` (the web hit the same gotcha:
  // reading the wrong key showed everyone as "no branches assigned").
  const branchIds: string[] = Array.isArray(raw.assignedBranchIds)
    ? raw.assignedBranchIds.map(String)
    : Array.isArray(raw.branchIds)
      ? raw.branchIds.map(String)
      : [];
  return {
    id: str(raw.id),
    name: str(raw.fullName ?? raw.name, "Team member"),
    email: str(raw.email, "—"),
    phone: str(raw.phone, "—"),
    role: role === "manager" || role === "owner" ? role : "cashier",
    status: str(raw.status) === "active" ? "active" : "inactive",
    branches,
    branchIds,
    // The backend nests the timestamp under `user.lastLoginAt`; older shapes put it top-level.
    lastLogin: (() => {
      const last = raw.lastLoginAt ?? raw.user?.lastLoginAt;
      return last ? new Date(str(last)).toLocaleString() : "—";
    })(),
  };
}

const LOG_SEVERITIES = new Set(["info", "warning", "error", "critical"]);

export function adaptStaffLog(raw: Raw): StaffActivityLog {
  const meta: Raw = raw.metadata ?? {};
  const createdAt = raw.timestamp ?? raw.createdAt;
  const createdAtMs = createdAt ? new Date(str(createdAt)).getTime() : undefined;
  const severity = str(raw.severity, "info");
  return {
    id: str(raw.id),
    staffId: str(raw.staffId ?? raw.userId),
    staffName: str(raw.staffName ?? raw.fullName, "Team member"),
    action: str(raw.action, "ACTIVITY"),
    description: str(raw.description ?? raw.message, "Activity recorded"),
    branchName: meta.branchName ? str(meta.branchName) : undefined,
    amount: meta.amount != null ? num(meta.amount) : undefined,
    severity: (LOG_SEVERITIES.has(severity) ? severity : "info") as StaffActivityLog["severity"],
    time: createdAt ? new Date(str(createdAt)).toLocaleString() : "—",
    createdAtMs: createdAtMs != null && Number.isNaN(createdAtMs) ? undefined : createdAtMs,
  };
}

export function adaptMovement(raw: Raw, branchId: string): StockMovement {
  const createdAtMs = raw.createdAt ? new Date(str(raw.createdAt)).getTime() : undefined;
  return {
    id: str(raw.id),
    branchId,
    productId: str(raw.productId),
    productName: raw.productName ? str(raw.productName) : undefined,
    movementType: str(raw.movementType, "adjustment"),
    direction: raw.direction === "in" ? "in" : "out",
    quantity: num(raw.quantity),
    previousQuantity: raw.previousQuantity != null ? num(raw.previousQuantity) : undefined,
    newQuantity: raw.newQuantity != null ? num(raw.newQuantity) : undefined,
    reason: str(raw.reason, "—"),
    notes: raw.notes ? str(raw.notes) : undefined,
    time: timeLabel(raw.createdAt),
    createdAtMs: Number.isNaN(createdAtMs) ? undefined : createdAtMs,
  };
}

export function adaptAlert(raw: Raw, branchId: string): InventoryAlert {
  return {
    id: str(raw.id),
    branchId,
    productId: raw.productId ? str(raw.productId) : undefined,
    alertType: str(raw.alertType, "operational"),
    severity: raw.severity === "high" ? "high" : raw.severity === "low" ? "low" : "medium",
    message: str(raw.message, "Alert"),
    status: str(raw.status, "active"),
  };
}

const TRANSFER_STATUSES: TransferStatus[] = ["requested", "approved", "in_transit", "received", "cancelled", "rejected"];

export function adaptTransfer(raw: Raw): Transfer {
  const status = str(raw.status, "requested") as TransferStatus;
  return {
    id: str(raw.id),
    number: raw.transferNumber ? str(raw.transferNumber) : undefined,
    fromBranchId: str(raw.fromBranchId),
    toBranchId: str(raw.toBranchId),
    status: TRANSFER_STATUSES.includes(status) ? status : "requested",
    priority: raw.priority === "high" ? "high" : raw.priority === "low" ? "low" : "normal",
    items: Array.isArray(raw.items)
      ? raw.items.map((it: Raw) => ({ productId: str(it.productId), productName: it.productName ? str(it.productName) : undefined, quantity: num(it.quantity) }))
      : [],
    notes: raw.notes ? str(raw.notes) : undefined,
    time: timeLabel(raw.createdAt),
  };
}

const BRANCH_TYPES: BranchType[] = ["MAIN", "BRANCH", "OUTLET", "WAREHOUSE", "KIOSK"];

export function adaptBranch(raw: Raw): Branch {
  const type = str(raw.branchType, "BRANCH").toUpperCase();
  return {
    id: str(raw.id),
    name: str(raw.name, "Branch"),
    code: str(raw.branchCode ?? raw.code, "—"),
    status: str(raw.status, "active") === "active" ? "active" : "disabled",
    city: str(raw.location?.city ?? raw.city, "—"),
    assignedRoles: ["owner"],
    type: (BRANCH_TYPES.includes(type as BranchType) ? type : "BRANCH") as BranchType,
    phone: str(raw.contact?.phone ?? raw.phone, "—"),
    email: str(raw.contact?.email ?? raw.email, "—"),
    manager: str(raw.managerName ?? raw.manager, "Unassigned"),
    productCount: num(raw.totalProducts ?? raw.productCount),
    inventoryValue: num(raw.totalInventoryValue ?? raw.inventoryValue),
    lowStock: num(raw.lowStockItemsCount ?? raw.lowStockCount ?? raw.lowStock),
  };
}

// ---- settings & profile ----

/** `GET /settings` + cached session → the Settings fields the app shows.
 *  The backend nests business fields under `businessProfile` and receipt fields under
 *  `receiptSettings` (same shape the web app reads). Older/flat shapes are tolerated as a
 *  fallback so a server that returns flat fields still maps. */
export function adaptSettings(raw: Raw, session?: Raw | null): Partial<SettingsPatch> {
  const out: Partial<SettingsPatch> = {};
  const bp: Raw = raw.businessProfile ?? {};
  const rs: Raw = raw.receiptSettings ?? {};
  const pick = (a: unknown, b: unknown) => (a != null ? a : b);

  const businessName = pick(bp.businessName, raw.businessName);
  if (businessName != null) out.businessName = str(businessName);
  const businessPhone = pick(bp.businessPhone, raw.businessPhone);
  if (businessPhone != null) out.businessPhone = str(businessPhone);
  const businessAddress = pick(bp.businessAddress, raw.businessAddress);
  if (businessAddress != null) out.businessAddress = str(businessAddress);
  const currency = pick(bp.currency, raw.currency);
  if (currency != null) out.currency = str(currency);
  const taxRate = pick(bp.taxRate, raw.taxRate);
  if (taxRate != null) out.taxRate = String(taxRate);
  const lowStock = pick(bp.lowStockThreshold, raw.lowStockThreshold);
  if (lowStock != null) out.lowStockThreshold = String(lowStock);

  const header = pick(rs.receiptHeaderText, raw.receiptHeaderText);
  if (header != null) out.receiptHeader = str(header);
  const footer = pick(rs.receiptFooterText, raw.receiptFooterText);
  if (footer != null) out.receiptFooter = str(footer);
  const thankYou = pick(rs.receiptThankYouMessage, raw.receiptThankYouMessage);
  if (thankYou != null) out.receiptThankYou = str(thankYou);

  const auth: Raw = session?.auth ?? {};
  if (auth.name != null) out.fullName = str(auth.name);
  if (auth.email != null) out.email = str(auth.email);
  if (auth.phone != null) out.phone = str(auth.phone);
  return out;
}

/** Map edited Settings → `PATCH /settings` body. The backend expects nested
 *  `businessProfile` / `receiptSettings` objects (matching the web app's payload). */
export function settingsToBackendBody(patch: Partial<SettingsPatch>): Raw {
  const businessProfile: Raw = {};
  if (patch.businessName !== undefined) businessProfile.businessName = patch.businessName;
  if (patch.businessPhone !== undefined) businessProfile.businessPhone = patch.businessPhone;
  if (patch.businessAddress !== undefined) businessProfile.businessAddress = patch.businessAddress;
  if (patch.currency !== undefined) businessProfile.currency = patch.currency;
  if (patch.taxRate !== undefined) businessProfile.taxRate = Number(patch.taxRate) || 0;
  if (patch.lowStockThreshold !== undefined) businessProfile.lowStockThreshold = Number(patch.lowStockThreshold) || 0;

  const receiptSettings: Raw = {};
  if (patch.receiptHeader !== undefined) receiptSettings.receiptHeaderText = patch.receiptHeader;
  if (patch.receiptThankYou !== undefined) receiptSettings.receiptThankYouMessage = patch.receiptThankYou;
  if (patch.receiptFooter !== undefined) receiptSettings.receiptFooterText = patch.receiptFooter;

  const body: Raw = {};
  if (Object.keys(businessProfile).length > 0) body.businessProfile = businessProfile;
  if (Object.keys(receiptSettings).length > 0) body.receiptSettings = receiptSettings;
  return body;
}

/** Map edited Settings → `PATCH /me` body (profile fields the backend owns). */
export function profileToBackendBody(patch: Partial<SettingsPatch>): Raw {
  const body: Raw = {};
  if (patch.fullName !== undefined) body.fullName = patch.fullName;
  if (patch.phone !== undefined) body.phone = patch.phone;
  return body;
}
