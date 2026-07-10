# Fahampesa Desktop Screens PRD

## Purpose

Define the desktop application screens for Fahampesa. This PRD is intentionally screen-only: it describes user-facing views, navigation, data visibility, states, and interaction requirements. It does not define backend schemas, API internals, database implementation, or service architecture.

## Source References

- `C:\Users\Amirize\Desktop\fahampesa-backend\docs\implementation-plan.md`
- `C:\Users\Amirize\Desktop\fahampesa-backend\docs\prd.md`
- `C:\Users\Amirize\Desktop\fahampesa-backend\docs\core-user-modules.md`

## Product Context

Fahampesa is a desktop business workspace for branch-based merchants. The app must support inventory, sales, expenses, debtors, suppliers, purchases, reports, settings, subscriptions, and offline sync. The desktop experience must make branch scope obvious at all times because inventory, sales, expenses, suppliers, purchases, and reports are branch-specific.

## Primary Roles

- Owner: can view all branches, central analytics, billing, branch management, staff management, and sensitive financial fields.
- Manager: can work only in assigned branches, manage branch operations, and access allowed reports.
- Cashier: can work only in assigned branch views and must not see cost price, profit, stock valuation, supplier cost data, or restricted reports.
- Super admin: separate platform-admin portal. It is out of scope for the merchant desktop app screens except where account status messages affect merchant access.

## Global Screen Rules

- Every business screen must show the active branch context.
- Owner views must support branch selector values for individual branches and, where allowed, `All branches`.
- Manager and cashier users must only see assigned branches.
- Changing branch must reload branch-scoped inventory, sales, expenses, suppliers, purchases, and reports.
- Expired or paused accounts must become read-only for business data while keeping reporting and billing visibility.
- Online-only actions must be visually distinct when offline.
- Cashier screens must hide cost, profit, valuation, supplier balances, and any financial margin indicators.
- Destructive or audit-sensitive actions must show confirmation and reason capture where relevant.
- Stock quantity must never be edited directly. All stock changes must happen through sale, purchase receiving, transfer receiving, or stock adjustment screens.

## App Shell

### Desktop Window

Purpose: Provide a stable desktop workspace that feels like a business operating system.

Requirements:

- Window title: `Fahampesa`.
- App icon: Fahampesa logo.
- Minimum useful desktop size: 960 x 640.
- Layout must support dense tables and repeated daily workflows.

### Navigation

Primary navigation items:

- Dashboard
- Sales
- Inventory
- Suppliers
- Purchases
- Transfers
- Expenses
- Debtors
- Reports
- Sync
- Settings
- Billing

Role behavior:

- Cashier navigation should hide Reports that expose restricted financial metrics.
- Billing, branch management, and staff settings should be owner-only.
- Transfers may be visible to owner and manager only in v1 because transfer workflow actions require online access.

### Global Header

Required elements:

- Business name.
- Branch selector.
- Current user and role.
- Online/offline sync state.
- Subscription/access state when expired, paused, trialing, or near expiry.
- Quick action entry point for sale creation.

Branch selector states:

- Owner: `All branches` plus branch list.
- Manager: assigned branches only.
- Cashier: assigned branch only, or selector hidden if exactly one branch.
- Disabled branch: visible to owner with disabled status, not selectable for write actions.

## Screen Inventory

### 1. Authentication

Screens:

- Sign in
- Account loading/session resolution
- Access blocked/error

Requirements:

- Sign in should use Firebase-backed identity, but the UI should present this simply as Fahampesa account login.
- After sign in, show a brief loading state while business membership, role, branch access, and subscription access are resolved.
- If the user has no business membership, route to onboarding or show a clear access message.

Acceptance:

- Invalid or expired auth state returns the user to sign in.
- Users never see another business account's data during loading or error states.

### 2. Onboarding

Screens:

- Welcome
- Business profile setup
- First branch setup
- Country and billing region capture
- Setup complete

Required fields:

- Owner profile basics.
- Business name.
- Country.
- First branch name and location.
- Default business settings where necessary.

Requirements:

- Onboarding must create the first branch as part of setup.
- Country must influence future billing flow: Kenya uses M-Pesa subscription checkout, non-Kenya uses Stripe card checkout.
- Free accounts are limited to one branch after onboarding unless upgraded or overridden.

Acceptance:

- New owner can reach the dashboard with one active branch.
- Users are not asked to create inventory before branch setup exists.

### 3. Dashboard

Screens:

- Owner dashboard
- Branch dashboard
- Cashier dashboard

Owner dashboard requirements:

- Support `All branches` and branch-specific views.
- Show sales summary, inventory value, low stock count, expenses, supplier payable summary, debtor summary, and branch performance.
- Include branch comparison when `All branches` is selected.

Manager dashboard requirements:

- Show assigned branch or assigned branch selector.
- Show sales, low stock, expenses, debtors, and operational alerts for assigned branches.

Cashier dashboard requirements:

- Show daily sales, active branch, quick sale entry, low stock operational warnings, and recent transactions.
- Hide profit, cost, stock valuation, and supplier payable metrics.

States:

- Empty business.
- No sales today.
- Low stock alerts.
- Offline mode.
- Read-only account.

Acceptance:

- Owner can distinguish all-branch metrics from branch-specific metrics.
- Cashier dashboard exposes no restricted financial fields.

### 4. Branches

Screens:

- Branch list
- Add branch
- Branch detail
- Disable branch confirmation
- Re-enable branch confirmation

Requirements:

- Owner can add branches up to plan limit: free 1, paid 6, unless admin override exists.
- Branches are disabled and re-enabled, not deleted.
- Disable/re-enable must require recent reauthentication or a reauthentication prompt.
- Disabled branches preserve historical reports and records.

Acceptance:

- Free account owner is blocked from adding a second branch with upgrade guidance.
- Disabled branches cannot receive new sales, inventory adjustments, purchases, or transfers.

### 5. Inventory

Screens:

- Inventory list
- Add product
- Edit product information
- Product detail
- Stock adjustment
- Bulk upload
- Export inventory report
- Label print

Inventory list top controls:

- Branch selector.
- Product search.
- Add product.
- Bulk upload.
- Export report.

Inventory table columns:

- Product name.
- Barcode with label print action.
- Category.
- Quantity.
- Reorder level.
- Cost price.
- Selling price.
- Stock value.
- Status.

Cashier visibility:

- Hide cost price and stock value.
- Hide profit/margin indicators.

Product detail requirements:

- Product info.
- Product image.
- Supplier.
- Cost price.
- Selling price.
- Profit margin.
- Stock per branch.
- Stock movement history.

Stock movement requirements:

- Show movement type, quantity, reason/reference, user, timestamp, and branch.
- Movements are append-only in the UI. Corrections must be adjustment or reversal actions.

Stock adjustment requirements:

- No direct quantity editing.
- User selects product, branch, adjustment direction/type, quantity, reason, and review summary.
- Adjustment creates stock movement history.

States:

- No products.
- Product not found.
- Low stock.
- Out of stock.
- Offline write allowed.
- Offline write expired or read-only blocked.

Acceptance:

- Quantity changes are only available through allowed stock action screens.
- Cashier cannot discover cost price, stock value, or profit through list, detail, export, or search result screens.

### 6. Sales

Screens:

- Sales register/new sale
- Sales list
- Sale detail/receipt
- Edit sale where permitted
- Soft delete/cancel sale confirmation

New sale requirements:

- Active branch is mandatory and visible.
- Product search or barcode scan entry.
- Multi-item cart.
- Quantity validation before completion.
- Payment method selection is record-only: cash, M-Pesa, card, credit, or mixed where supported.
- M-Pesa and card business sale payment methods must not launch provider checkout.
- Credit sale must connect to debtor selection or debtor creation.

Sale completion effects shown in UI:

- Stock decreases.
- Sale record appears in branch sales history.
- Low stock alerts update when relevant.

States:

- Product unavailable in selected branch.
- Insufficient stock.
- Offline sale queued.
- Sync conflict after offline sale.
- Read-only account blocks sale creation.

Acceptance:

- User cannot oversell stock.
- Sale receipt always shows branch.
- Cashier can create sales without seeing cost or profit.

### 7. Expenses

Screens:

- Expense list
- Add expense
- Expense detail
- Edit/delete expense where permitted

Requirements:

- Expenses are branch scoped.
- Expense records include category, amount, date, notes, and branch.
- Reports can read expense data per branch.

States:

- No expenses.
- Offline queued expense.
- Read-only account blocks write.

Acceptance:

- Changing branch reloads expenses.
- Manager/cashier cannot access expenses outside assigned branches.

### 8. Debtors

Screens:

- Debtor list
- Add debtor
- Debtor detail
- Record debtor payment
- Credit sale flow connection

Requirements:

- Debtor balances update when credit sales are created and when payments are recorded.
- Debtor detail shows sale history, payments, outstanding balance, contact details, and branch context.

States:

- No debtors.
- Overdue balance.
- Offline debtor payment queued.
- Sync conflict on stale debtor balance.

Acceptance:

- Credit sale increases debtor balance.
- Debtor payment reduces debtor balance.

### 9. Suppliers

Screens:

- Supplier list
- Add supplier
- Supplier detail
- Supplier payment
- Supplier ledger

Supplier list columns:

- Supplier name.
- Contact.
- Total purchases.
- Outstanding balance.
- Status.

Add supplier fields:

- Name.
- Contact person.
- Phone.
- Email.
- Address.
- Opening balance.
- Payment terms.

Supplier detail requirements:

- Total purchases.
- Total paid.
- Outstanding balance.
- Tabs: Purchases, Payments, Ledger.
- Ledger entries are append-only. Corrections use reversal or adjustment entries.

Cashier visibility:

- Supplier module should be hidden unless a cashier-specific operational need is later approved.
- If visible, hide balances and cost-sensitive supplier data.

Acceptance:

- Supplier balances are branch-specific.
- Supplier detail never mixes branches.

### 10. Purchases

Screens:

- Purchase order list
- Create purchase order
- Purchase approval
- Purchase receiving
- Purchase detail

Requirements:

- Purchase must select a branch.
- Receiving a purchase increases inventory in the selected branch.
- Unpaid purchases create supplier payable impact.
- Purchase receiving screen must preview stock increases and supplier balance impact before confirmation.

States:

- Draft.
- Pending approval.
- Approved.
- Partially received, if supported.
- Received.
- Cancelled.
- Offline unavailable for approval/receiving where online-only.

Acceptance:

- Receiving updates inventory and supplier balance together from the user's perspective.
- User can trace received stock to purchase reference.

### 11. Transfers

Screens:

- Transfer list
- Create transfer request
- Transfer approval
- Ship transfer
- Receive transfer
- Reject/cancel transfer
- Transfer detail

Requirements:

- Transfer source and destination branches are required.
- Product must already exist in both source and destination branches.
- Workflow states: requested, approved, shipped, received, cancelled, rejected.
- Transfer receiving creates paired stock movement history.
- Transfer workflow actions are online-only in v1.

States:

- Product missing from destination branch.
- Insufficient source stock.
- Offline transfer actions disabled.
- Awaiting approval.
- Awaiting receive.

Acceptance:

- Transfer cannot mix businesses or unauthorized branches.
- Transfer detail shows movement reference and audit trail.

### 12. Reports

Screens:

- Reports overview
- Sales report
- Inventory valuation report
- Low-stock report
- Supplier report
- Expense report
- Branch performance report
- Export report flow

Requirements:

- Reports support branch selector.
- Owner can use `All branches`.
- Manager/cashier limited to assigned branch access.
- Cashier must not see cost, profit, valuation, or supplier cost reports.

Report states:

- No data for selected period.
- Offline report snapshot.
- Online refresh available.
- Export success/failure.

Acceptance:

- Role-aware field hiding applies to charts, tables, cards, exports, and detail drill-downs.
- Owner can compare branch performance centrally.

### 13. Offline Sync

Screens:

- Sync status panel
- Sync history
- Queued changes
- Conflict list
- Conflict detail/rebase flow
- Device registration
- Cursor expired recovery

Requirements:

- Global sync state must be visible from the app shell.
- Users can see queued local writes and last successful sync time.
- Stale offline writes must show conflict details and guide the user to review and retry.
- Offline write session expires after 24 hours.
- Branch creation, staff/admin changes, transfer workflow actions, and subscription actions are online-only in v1.

States:

- Online and synced.
- Offline with write access available.
- Offline write window expired.
- Syncing.
- Sync failed.
- Conflict requires review.
- Cursor expired; full resync required.

Acceptance:

- User understands whether a change is saved locally, synced, conflicted, or blocked.
- Read-only account and expired offline write window block new writes clearly.

### 14. Billing

Screens:

- Subscription overview
- Plan selection
- Kenya M-Pesa checkout
- Non-Kenya Stripe checkout
- Payment history
- Receipt detail
- Expired/read-only billing prompt

Requirements:

- Pricing: monthly `KSH 2000 / USD 10`, yearly `KSH 20000 / USD 100`.
- Kenya accounts use M-Pesa STK subscription checkout.
- Non-Kenya accounts use Stripe card checkout.
- Business sale payments must never be confused with Fahampesa subscription billing.
- Expired and paused accounts retain read-only access and show billing recovery actions to owners.

States:

- Active.
- Trialing, if used.
- Expiring soon.
- Expired read-only.
- Paused read-only.
- Payment pending.
- Payment failed with retry.
- Payment success.

Acceptance:

- Owner can understand current subscription status without contacting support.
- Non-owner roles do not manage billing.

### 15. Settings

Screens:

- Business settings
- Receipt settings
- Notification settings
- Device settings
- Sync settings
- Staff and permissions
- Branch settings

Requirements:

- Settings remain role scoped.
- Staff/admin changes are online-only in v1.
- Branch settings respect disabled branch behavior.
- Device settings should show current desktop device and sync registration state.

Acceptance:

- Cashier cannot access owner-only settings.
- Settings clearly show when changes require online access.

## Cross-Screen Empty States

Every major list screen must include a useful empty state:

- Inventory: add first product or bulk upload.
- Sales: create first sale.
- Suppliers: add first supplier.
- Purchases: create purchase order.
- Transfers: create transfer request when multiple branches are available.
- Expenses: record expense.
- Debtors: add debtor or create credit sale.
- Reports: change date range or create operational data first.

## Cross-Screen Error and Blocking States

Required blocking states:

- No assigned branch.
- Branch disabled.
- Account expired.
- Account paused.
- Offline and action is online-only.
- Offline write window expired.
- Permission denied.
- Sync conflict.
- Cursor expired/full resync required.

Each blocking state must explain:

- What happened.
- Whether the user's existing data is safe.
- What action is available next.

## Screen Prioritization

### MVP Desktop Screens

1. Sign in and session loading.
2. Onboarding with first branch.
3. App shell with branch selector and sync state.
4. Dashboard.
5. Inventory list, product detail, add product, stock adjustment.
6. Sales register, sales list, sale detail.
7. Suppliers list, supplier detail, add supplier.
8. Purchases list, create purchase, receive purchase.
9. Reports overview with sales, low stock, and inventory views.
10. Sync status and queued changes.
11. Billing overview and checkout entry.
12. Settings basics.

### Post-MVP or Advanced Screens

- Bulk upload refinement.
- Label print refinement.
- Transfer full workflow.
- Debtor advanced history.
- Conflict rebase detail tooling.
- Staff permissions management.
- Branch disable/re-enable flow with reauthentication.
- Rich export management.

## Open Questions

- Should cashier users see the Expenses module in v1, or should it be manager/owner only?
- Should purchase receiving support partial receiving in v1?
- Should debtors be branch-specific only, or business-level identities with branch-scoped balances?
- Should inventory exports be available offline from local data?
- Should desktop support multiple businesses per signed-in user, or exactly one active business in v1?
- Which existing Web-App screens should be treated as visual references for dashboard, inventory, billing, and landing-style onboarding?

