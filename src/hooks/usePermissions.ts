import { useAuth } from "@/auth/AuthContext";
import type { ScreenKey } from "@/data";

export type Role = "owner" | "manager" | "cashier";

/**
 * Capability flags derived from the backend session role, mirroring the Web-App's useBusinessRole.
 * The backend is the real authority (it 403s writes for cashiers); this hides the affordances so a
 * cashier isn't shown management actions that would only fail at sync.
 *
 * Cashiers run the sales register only (client requirement): no dashboard, products, inventory,
 * payments, or managerial screens. The POS product grid inside the sales screen is unaffected.
 */
export function usePermissions() {
  const { session } = useAuth();
  const role = (session?.role === "owner" || session?.role === "manager" ? session.role : "cashier") as Role;

  const isOwner = role === "owner";
  const isManager = role === "owner" || role === "manager";

  return {
    role,
    isOwner,
    isManager,
    isCashier: role === "cashier",
    // Managers and owners manage catalog/stock/expenses/debtors/suppliers.
    canManage: isManager,
    // Only owners manage branches and billing.
    canManageBranches: isOwner,
    canManageBilling: isOwner,
    // Cost, profit, margin and stock valuation are hidden from cashiers (backend also strips them).
    canSeeCost: isManager,
  };
}

/** Screens a cashier cannot open — hidden from the nav and blocked on navigation. */
export const CASHIER_RESTRICTED_SCREENS: ScreenKey[] = [
  "dashboard",
  "products",
  "inventory",
  "payments",
  "expenses",
  "debtors",
  "reports",
  "suppliers",
  "branches",
  "staff",
];
