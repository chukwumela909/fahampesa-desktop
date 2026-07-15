// Shared domain types for the Fahampesa desktop app. Runtime data is loaded from the
// backend (see src/lib/endpoints.ts + src/store/AppData.tsx) and cached offline in
// IndexedDB — there is no demo/mock seed.

export type Role = "owner" | "manager" | "cashier";

export type ScreenKey =
  | "dashboard"
  | "products"
  | "sales"
  | "salesHistory"
  | "inventory"
  | "expenses"
  | "debtors"
  | "reports"
  | "suppliers"
  | "branches"
  | "staff"
  | "payments"
  | "notifications"
  | "settings";

export type BranchStatus = "active" | "disabled";
export type StockStatus = "healthy" | "low" | "out";
export type BranchType = "MAIN" | "BRANCH" | "OUTLET" | "WAREHOUSE" | "KIOSK";

export interface Branch {
  id: string;
  name: string;
  code: string;
  status: BranchStatus;
  /** Street address as stored on the backend (location.address); empty when unknown. */
  address: string;
  city: string;
  /** Country as stored on the backend (location.country); empty when unknown. */
  country: string;
  assignedRoles: Role[];
  type: BranchType;
  phone: string;
  email: string;
  manager: string;
  productCount: number;
  inventoryValue: number;
  lowStock: number;
}

export interface Product {
  id: string;
  branchId: string;
  name: string;
  barcode: string;
  category: string;
  quantity: number;
  reorderLevel: number;
  costPrice: number;
  sellingPrice: number;
  supplierId: string;
  status: StockStatus;
  lastMovement: string;
  // Extended catalog fields (optional — match the backend product/inventory models)
  description?: string;
  sku?: string;
  unitOfMeasure?: string;
  images?: string[];
  binLocation?: string;
  batchNumber?: string;
  expiryDate?: string;
  tags?: string[];
  isPerishable?: boolean;
  availableQuantity?: number;
  reservedQuantity?: number;
}

export interface StockMovement {
  id: string;
  branchId: string;
  productId: string;
  productName?: string;
  movementType: string;
  direction: "in" | "out";
  quantity: number;
  previousQuantity?: number;
  newQuantity?: number;
  reason: string;
  notes?: string;
  time: string;
  createdAtMs?: number;
}

export interface InventoryAlert {
  id: string;
  branchId: string;
  productId?: string;
  alertType: "low_stock" | "expiry" | "operational" | string;
  severity: "low" | "medium" | "high";
  message: string;
  status: "active" | "acknowledged" | "resolved" | string;
}

export interface TransferItem {
  productId: string;
  productName?: string;
  quantity: number;
}

export type TransferStatus = "requested" | "approved" | "in_transit" | "received" | "cancelled" | "rejected";

export interface Transfer {
  id: string;
  number?: string;
  fromBranchId: string;
  toBranchId: string;
  status: TransferStatus;
  priority: "low" | "normal" | "high";
  items: TransferItem[];
  notes?: string;
  time: string;
}

export interface SaleLine {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  discountType?: "fixed" | "percentage";
  lineTotal: number;
}

export interface Sale {
  id: string; // stable local id (client-generated for offline sales; kept across sync)
  backendId?: string; // the backend record id once synced — used for refund/delete/detail
  number?: string; // human-readable sale number for display (e.g. SALE-000123)
  branchId: string;
  customer: string;
  items: number;
  amount: number;
  paymentMethod: string;
  status: "synced" | "queued" | "conflict";
  time: string;
  // Extended detail (optional)
  lines?: SaleLine[];
  subtotal?: number;
  tax?: number;
  discount?: number;
  discountType?: "fixed" | "percentage";
  customerPhone?: string;
  customerEmail?: string;
  debtorId?: string;
  notes?: string;
  refunded?: boolean;
  createdAtMs?: number;
  /** Backend-stored profit (totalAmount - totalCost, cost captured at sale time). Absent on
   *  unsynced local rows and cashier-role responses (the backend strips margin fields). */
  profit?: number;
}

/** A locally-held (not yet completed) sale draft. Held sales are local-only — the
 *  backend has no held-sale endpoints. */
export interface HeldSale {
  id: string;
  savedAt: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  debtorId: string;
  paymentMethod: string;
  tax: string;
  discount: string;
  discountType: "fixed" | "percentage";
  notes: string;
  cart: Record<string, number>;
  lineDiscounts: Record<string, { value: string; type: "fixed" | "percentage" }>;
}

export interface Supplier {
  id: string;
  branchId: string;
  name: string;
  contact: string;
  phone: string;
  totalPurchases: number;
  outstanding: number;
  status: "active" | "watch" | "archived";
  email?: string;
  address?: string;
  categories?: string[];
  productsSupplied?: string[];
  paymentTerms?: string;
  totalPaid?: number;
}

export interface Debtor {
  id: string;
  branchId?: string;
  name: string;
  phone: string;
  creditLimit: number;
  currentDebt: number;
  risk: "low" | "medium" | "high";
  email?: string;
  dueDate?: string;
  totalPaid?: number;
  status?: "clear" | "outstanding" | "overdue";
  active?: boolean;
  /** Free-form note stored on the backend. */
  note?: string;
  /** Street address stored on the backend. */
  address?: string;
  /** ISO date the debt was taken (backdatable). */
  debtDate?: string;
}

export interface Expense {
  id: string;
  branchId?: string;
  description: string;
  category: string;
  amount: number;
  paymentMethod: string;
  vendor: string;
  receipt: string;
  date: string;
  createdAtMs?: number;
}

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  status: "active" | "inactive";
  branches: string[]; // resolved branch names (when the backend supplies them)
  branchIds: string[]; // assigned branch ids — resolved to names against the branch list
  lastLogin: string;
}

export interface StaffActivityLog {
  id: string;
  staffId: string;
  staffName: string;
  action: string;
  description: string;
  branchName?: string;
  amount?: number;
  severity: "info" | "warning" | "error" | "critical";
  time: string;
  createdAtMs?: number;
}

