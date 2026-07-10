import Dexie, { type Table } from "dexie";
import type { Branch, Debtor, Expense, Product, Sale, StaffMember, Supplier } from "@/data";

/** A queued write awaiting replay against the backend. Modeled as a command so it can
 *  graduate to the backend's future /sync/push contract (commandId/baseVersion/op). */
export interface OutboxCommand {
  commandId: string;
  entityType: "product" | "sale" | "expense" | "supplier" | "debtor" | "staff" | "branch" | "inventory";
  entityId: string | null;
  operation: "create" | "update" | "delete" | "sale" | "adjust" | "payment" | "refund";
  branchId: string;
  payload: unknown;
  baseVersion: number | null;
  idempotencyKey: string;
  status: "pending" | "inflight" | "failed";
  error?: string;
  attempts: number;
  clientTimestamp: number;
}

/** Arbitrary key/value metadata: cached session, per-entity lastSyncAt, offline-session start. */
export interface MetaEntry {
  key: string;
  value: unknown;
}

class FahampesaDB extends Dexie {
  products!: Table<Product, string>;
  sales!: Table<Sale, string>;
  suppliers!: Table<Supplier, string>;
  debtors!: Table<Debtor, string>;
  staff!: Table<StaffMember, string>;
  branches!: Table<Branch, string>;
  expenses!: Table<Expense, string>;
  outbox!: Table<OutboxCommand, string>;
  meta!: Table<MetaEntry, string>;

  constructor() {
    super("fahampesa");
    const schema = {
      products: "id, branchId",
      sales: "id, branchId",
      suppliers: "id, branchId",
      debtors: "id, branchId",
      staff: "id",
      branches: "id",
      expenses: "id, branchId",
      outbox: "commandId, status, clientTimestamp",
      meta: "key",
    };
    this.version(1).stores(schema);
    // v2: clear the pre-update demo seed + read cache so upgraded clients re-sync real
    // server data (queued writes in `outbox` are preserved).
    this.version(2)
      .stores(schema)
      .upgrade(async (tx) => {
        await Promise.all(
          ["products", "sales", "suppliers", "debtors", "staff", "branches", "expenses"].map((t) => tx.table(t).clear()),
        );
        await tx.table("meta").delete("seeded");
        await tx.table("meta").delete("lastSyncAt");
      });
  }
}

export const db = new FahampesaDB();

export type CacheTableName = "products" | "sales" | "suppliers" | "debtors" | "staff" | "branches" | "expenses";

/** Replace the cached rows for an entity (used after a successful API fetch). */
export async function replaceCache<T extends { id: string }>(table: CacheTableName, rows: T[]): Promise<void> {
  await db.transaction("rw", db.table(table), async () => {
    await db.table(table).clear();
    await db.table(table).bulkPut(rows);
  });
}

/**
 * Replace only the rows belonging to one branch, leaving other branches' cached rows intact.
 * Used for branch-scoped tables so switching branches offline doesn't wipe the branch you're
 * about to view. Rows MUST carry a `branchId` matching the index.
 */
export async function replaceBranchCache<T extends { id: string; branchId?: string }>(
  table: CacheTableName,
  branchId: string,
  rows: T[]
): Promise<void> {
  await db.transaction("rw", db.table(table), async () => {
    await db.table(table).where("branchId").equals(branchId).delete();
    await db.table(table).bulkPut(rows);
  });
}

/**
 * Purge all cached business data, the outbox, and cached session metadata. Called on sign-out so
 * the next account signing in on this machine can't see the previous user's cached data or have
 * their queued offline writes replayed under the new account's token.
 */
export async function clearOfflineData(): Promise<void> {
  await db.transaction(
    "rw",
    [db.products, db.sales, db.suppliers, db.debtors, db.staff, db.branches, db.expenses, db.outbox, db.meta],
    async () => {
      await Promise.all([
        db.products.clear(),
        db.sales.clear(),
        db.suppliers.clear(),
        db.debtors.clear(),
        db.staff.clear(),
        db.branches.clear(),
        db.expenses.clear(),
        db.outbox.clear(),
        db.meta.clear(),
      ]);
    }
  );
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const entry = await db.meta.get(key);
  return entry?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}

export function newId(): string {
  return crypto.randomUUID();
}
