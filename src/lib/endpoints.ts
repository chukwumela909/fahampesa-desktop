import { api } from "@/lib/api";

// Thin wrappers over the branch-scoped REST surface. Bodies are passed through as-is;
// the sync layer is responsible for shaping app data into backend payloads.

type Raw = Record<string, any>;
const b = (branchId: string) => `/branches/${encodeURIComponent(branchId)}`;

// ---- reads ----
export const listBranches = () => api<Raw[]>("/branches");
export const listProducts = (branchId: string) => api<Raw[]>(`${b(branchId)}/products`);
export const listInventory = (branchId: string) => api<Raw[]>(`${b(branchId)}/inventory`);
export const listSales = (branchId: string) => api<Raw[]>(`${b(branchId)}/sales`);
export const listExpenses = (branchId: string) => api<Raw[]>(`${b(branchId)}/expenses`);
export const listSuppliers = (branchId: string) => api<Raw[]>(`${b(branchId)}/suppliers`);
export const listDebtors = (branchId: string) => api<Raw[]>(`${b(branchId)}/debtors`);
export const listStaff = () => api<Raw[]>("/staff");
export const listStaffLogs = () => api<Raw[]>("/staff/logs?limit=50");

// ---- products ----
export const createProduct = (branchId: string, body: Raw, idempotencyKey: string) =>
  api<Raw>(`${b(branchId)}/products`, { method: "POST", body, idempotencyKey });
export const updateProduct = (branchId: string, id: string, body: Raw) =>
  api<Raw>(`${b(branchId)}/products/${id}`, { method: "PATCH", body });
export const deleteProduct = (branchId: string, id: string) =>
  api<Raw>(`${b(branchId)}/products/${id}`, { method: "DELETE" });

// ---- inventory ----
export const adjustStock = (branchId: string, body: Raw) =>
  api<Raw>(`${b(branchId)}/inventory/adjustments`, { method: "POST", body });
export const listMovements = (branchId: string) => api<Raw[]>(`${b(branchId)}/inventory/movements`);
export const listAlerts = (branchId: string) => api<Raw[]>(`${b(branchId)}/inventory/alerts`);

// ---- transfers (business-level, online-only) ----
export const listTransfers = () => api<Raw[]>("/transfers");
export const createTransfer = (body: Raw) => api<Raw>("/transfers", { method: "POST", body });
export const transferAction = (id: string, action: "approve" | "ship" | "receive" | "cancel") =>
  api<Raw>(`/transfers/${id}/${action}`, { method: "POST", body: {} });

// ---- sales ----
export const createSale = (branchId: string, body: Raw, idempotencyKey: string) =>
  api<Raw>(`${b(branchId)}/sales`, { method: "POST", body, idempotencyKey });
export const refundSale = (branchId: string, id: string, body: Raw) =>
  api<Raw>(`${b(branchId)}/sales/${id}/refund`, { method: "POST", body });
export const deleteSale = (branchId: string, id: string) =>
  api<Raw>(`${b(branchId)}/sales/${id}`, { method: "DELETE" });

// ---- expenses ----
export const createExpense = (branchId: string, body: Raw) =>
  api<Raw>(`${b(branchId)}/expenses`, { method: "POST", body });
export const updateExpense = (branchId: string, id: string, body: Raw) =>
  api<Raw>(`${b(branchId)}/expenses/${id}`, { method: "PATCH", body });
export const deleteExpense = (branchId: string, id: string) =>
  api<Raw>(`${b(branchId)}/expenses/${id}`, { method: "DELETE" });

// ---- suppliers ----
export const createSupplier = (branchId: string, body: Raw) =>
  api<Raw>(`${b(branchId)}/suppliers`, { method: "POST", body });
export const updateSupplier = (branchId: string, id: string, body: Raw) =>
  api<Raw>(`${b(branchId)}/suppliers/${id}`, { method: "PATCH", body });
export const deleteSupplier = (branchId: string, id: string) =>
  api<Raw>(`${b(branchId)}/suppliers/${id}`, { method: "DELETE" });
export const supplierPayment = (branchId: string, id: string, body: Raw) =>
  api<Raw>(`${b(branchId)}/suppliers/${id}/payments`, { method: "POST", body });
export const listSupplierPayments = (branchId: string, id: string) =>
  api<Raw[]>(`${b(branchId)}/suppliers/${id}/payments`);

// ---- debtors ----
export const createDebtor = (branchId: string, body: Raw) =>
  api<Raw>(`${b(branchId)}/debtors`, { method: "POST", body });
export const updateDebtor = (branchId: string, id: string, body: Raw) =>
  api<Raw>(`${b(branchId)}/debtors/${id}`, { method: "PATCH", body });
export const debtorPayment = (branchId: string, id: string, body: Raw) =>
  api<Raw>(`${b(branchId)}/debtors/${id}/payments`, { method: "POST", body });

// ---- staff ----
export const createStaff = (body: Raw) => api<Raw>("/staff", { method: "POST", body });
// Invitation flow: the backend emails the invitee a join link (Resend) and the
// response carries { inviteUrl, emailSent } for the UI to surface/share.
export const createStaffInvitation = (body: Raw) => api<Raw>("/staff/invitations", { method: "POST", body });
export const listStaffInvitations = (status?: string) =>
  api<Raw[]>(`/staff/invitations${status ? `?status=${status}` : ""}`);
export const updateStaff = (id: string, body: Raw) => api<Raw>(`/staff/${id}`, { method: "PATCH", body });
export const deleteStaff = (id: string) => api<Raw>(`/staff/${id}`, { method: "DELETE" });
export const activateStaff = (id: string) => api<Raw>(`/staff/${id}/activate`, { method: "POST" });

// ---- branches (online-only writes) ----
export const createBranch = (body: Raw) => api<Raw>("/branches", { method: "POST", body });
export const updateBranch = (id: string, body: Raw) => api<Raw>(`/branches/${id}`, { method: "PATCH", body });
// Permanent, cascading delete (owner-only; backend rejects deleting the last active branch).
export const deleteBranch = (id: string) => api<Raw>(`/branches/${id}`, { method: "DELETE" });

// ---- billing / subscription (account-level, online-only) ----
export const getBillingPlans = (country?: string) =>
  api<Raw>(`/billing/plans${country ? `?country=${encodeURIComponent(country)}` : ""}`);
export const getSubscription = () => api<Raw>("/billing/subscription");
export const getBillingHistory = () => api<Raw[]>("/billing/history");

// ---- settings & profile (account-level) ----
export const getSettings = () => api<Raw>("/settings");
export const updateSettings = (body: Raw) => api<Raw>("/settings", { method: "PATCH", body });
export const updateMe = (body: Raw) => api<Raw>("/me", { method: "PATCH", body });
