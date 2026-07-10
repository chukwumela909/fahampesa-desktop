import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Squares2X2Icon,
  CubeIcon,
  BanknotesIcon,
  ArchiveBoxIcon,
  BuildingLibraryIcon,
  PresentationChartBarIcon,
  TruckIcon,
  BuildingOfficeIcon,
  UsersIcon,
  CreditCardIcon,
  UserCircleIcon,
  BellIcon,
  ChevronDownIcon,
  CheckIcon,
  ArrowRightOnRectangleIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";
import { Zap } from "lucide-react";
import type { Branch, ScreenKey } from "@/data";
import SyncStatus from "@/components/SyncStatus";

interface NavItem {
  name: string;
  key: ScreenKey;
  icon: typeof Squares2X2Icon;
}

const navigationItems: NavItem[] = [
  { name: "Dashboard", key: "dashboard", icon: Squares2X2Icon },
  { name: "Products", key: "products", icon: CubeIcon },
  { name: "Sales", key: "sales", icon: BanknotesIcon },
  { name: "Inventory", key: "inventory", icon: ArchiveBoxIcon },
  { name: "Debtors", key: "debtors", icon: BuildingLibraryIcon },
  { name: "Reports", key: "reports", icon: PresentationChartBarIcon },
  { name: "Suppliers", key: "suppliers", icon: TruckIcon },
  { name: "Branches", key: "branches", icon: BuildingOfficeIcon },
  { name: "Staff", key: "staff", icon: UsersIcon },
  { name: "Payments & Subscriptions", key: "payments", icon: CreditCardIcon },
];

export const pageTitles: Record<ScreenKey, { title: string; subtitle?: string }> = {
  dashboard: { title: "Dashboard" },
  products: { title: "Products", subtitle: "Manage Product Catalog" },
  sales: { title: "Sales", subtitle: "Record & Track Sales" },
  salesHistory: { title: "Sales History", subtitle: "Completed sales & receipts" },
  inventory: { title: "Inventory", subtitle: "Manage Products & Stock" },
  expenses: { title: "Expenses", subtitle: "Track Business Spending" },
  debtors: { title: "Debtor", subtitle: "Create a new credit customer" },
  reports: { title: "Reports & Analytics" },
  suppliers: { title: "Suppliers", subtitle: "Manage Business Suppliers" },
  branches: { title: "Branches", subtitle: "Manage Business Locations" },
  staff: { title: "Staff", subtitle: "Manage Team Members" },
  payments: { title: "Payments & Subscriptions", subtitle: "Manage your plan & billing" },
  notifications: { title: "Notifications", subtitle: "Alerts & sync status" },
  settings: { title: "Settings", subtitle: "Manage Account, Business & System Settings" },
};

interface AppShellProps {
  screen: ScreenKey;
  branches: Branch[];
  branchId: string;
  onBranchChange: (id: string) => void;
  onScreenChange: (screen: ScreenKey) => void;
  onSignOut: () => void;
  /** Whether to show the upsell — hidden for paid customers. */
  showGoPro: boolean;
  onGoPro: () => void;
  /** Screens gated behind Pro — shown with a lock and routed to the upsell. */
  lockedScreens?: ScreenKey[];
  /** Screens the current role may not access — removed from the nav entirely (e.g. cashiers). */
  hiddenScreens?: ScreenKey[];
  children: ReactNode;
}

export default function AppShell({
  screen,
  branches,
  branchId,
  onBranchChange,
  onScreenChange,
  onSignOut,
  showGoPro,
  onGoPro,
  lockedScreens = [],
  hiddenScreens = [],
  children,
}: AppShellProps) {
  const visibleNavigationItems = navigationItems.filter((item) => !hiddenScreens.includes(item.key));
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentPageInfo = pageTitles[screen] ?? { title: "Dashboard" };
  const currentBranch = branches.find((branch) => branch.id === branchId);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (showBranchDropdown && dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowBranchDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showBranchDropdown]);

  return (
    <div className="h-screen flex bg-[#f6f8fb] text-[#0f172a]" style={{ fontFamily: "var(--font-dm-sans)" }}>
      {/* Sidebar */}
      <div className="flex fixed inset-y-0 left-0 w-64 bg-white/95 border-r border-[#e7ebf2] shadow-[8px_0_30px_rgba(15,23,42,0.04)] z-50 backdrop-blur-md">
        <div className="flex flex-col w-full">
          {/* Sidebar Header */}
          <div className="flex-shrink-0 flex items-center h-[72px] border-b border-[#eef2f7] px-5">
            <div>
              <h2 className="text-[20px] font-bold leading-tight tracking-[-0.02em] text-[#001031]">FahamPesa</h2>
              <p className="text-[11px] font-medium text-[#64748b]">Business console</p>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 py-5 overflow-y-auto">
            <div className="space-y-1.5 px-3">
              {visibleNavigationItems.map((item) => {
                const isActive = screen === item.key;
                const locked = lockedScreens.includes(item.key);
                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => (locked ? onGoPro() : onScreenChange(item.key))}
                    title={locked ? "Upgrade to Pro to unlock" : undefined}
                    className={`relative flex w-full items-center py-3 px-3.5 rounded-[10px] transition-all duration-200 group text-left ${
                      isActive
                        ? "text-[#004aad] bg-[#eef5ff]"
                        : "text-[#64748b] hover:text-[#001031] hover:bg-[#f6f8fb]"
                    }`}
                  >
                    {isActive && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[#004aad]" />}
                    <item.icon
                      className={`h-5 w-5 mr-3 transition-colors duration-200 ${
                        isActive ? "text-[#004aad]" : "text-[#94a3b8] group-hover:text-[#004aad]"
                      }`}
                    />
                    <span
                      className={`text-sm transition-colors duration-200 ${
                        isActive ? "font-semibold text-[#004aad]" : "font-medium text-[#64748b] group-hover:text-[#001031]"
                      }`}
                    >
                      {item.name}
                    </span>
                    {locked && <LockClosedIcon className="ml-auto h-4 w-4 flex-shrink-0 text-[#94a3b8]" />}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Footer: Settings + Sign out */}
          <div className="flex-shrink-0 border-t border-[#eef2f7] px-3 py-4 space-y-1">
            <button
              onClick={() => onScreenChange("settings")}
              className={`flex items-center w-full py-3 px-3.5 rounded-[10px] transition-all duration-200 ${
                screen === "settings"
                  ? "text-[#004aad] bg-[#eef5ff]"
                  : "text-[#64748b] hover:bg-[#f6f8fb] hover:text-[#001031]"
              }`}
              title="Settings"
            >
              <UserCircleIcon className="h-7 w-7 mr-3" />
              <span className="text-sm font-medium">Settings</span>
            </button>
            <button
              onClick={onSignOut}
              className="flex items-center w-full py-3 px-3.5 rounded-[10px] text-[#64748b] hover:bg-[#fff1f2] hover:text-[#e11d48] transition-all duration-200"
              title="Sign out"
            >
              <ArrowRightOnRectangleIcon className="h-7 w-7 mr-3" />
              <span className="text-sm font-medium">Sign out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 ml-64">
        {/* Top navigation bar */}
        <div className="relative z-10 flex-shrink-0 flex min-h-[72px] bg-white/90 border-b border-[#e7ebf2] backdrop-blur-md">
          <div className="flex-1 px-4 sm:px-6 flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[17px] sm:text-[19px] font-semibold tracking-[-0.01em] text-[#0f172a]">
                {currentPageInfo.title}
              </h1>
              {currentPageInfo.subtitle && (
                <p className="truncate text-[13px] font-medium text-[#64748b]">{currentPageInfo.subtitle}</p>
              )}
            </div>

            {/* Right side */}
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              {/* Branch Selector */}
              {branches.length > 0 && (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => {
                      if (branches.length > 1) setShowBranchDropdown((open) => !open);
                    }}
                    disabled={branches.length <= 1}
                    className={`flex items-center px-3 py-2 text-sm font-medium text-[#475569] bg-[#f8fafc] border border-[#e2e8f0] rounded-[10px] transition-all duration-200 ${
                      branches.length > 1
                        ? "hover:bg-white hover:text-[#0f172a] hover:shadow-[0_8px_20px_rgba(15,23,42,0.06)]"
                        : "cursor-default"
                    }`}
                  >
                    <BuildingOfficeIcon className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline truncate max-w-32">{currentBranch?.name || "Select Branch"}</span>
                    {branches.length > 1 && <ChevronDownIcon className="h-4 w-4 ml-1 flex-shrink-0" />}
                  </button>

                  {branches.length > 1 && showBranchDropdown && (
                    <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-[#e2e8f0] rounded-[14px] shadow-[0_18px_45px_rgba(15,23,42,0.12)] z-50 max-h-60 overflow-y-auto">
                      <div className="py-1">
                        {branches.map((branch) => (
                          <button
                            key={branch.id}
                            onClick={() => {
                              onBranchChange(branch.id);
                              setShowBranchDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${
                              branchId === branch.id
                                ? "bg-[#eef5ff] text-[#004aad] font-medium"
                                : "text-[#0f172a] hover:bg-[#f8fafc]"
                            }`}
                          >
                            <div className="flex items-center">
                              <BuildingOfficeIcon
                                className={`h-4 w-4 mr-2 ${branchId === branch.id ? "text-[#004aad]" : "text-[#94a3b8]"}`}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{branch.name}</div>
                                <div className="text-xs text-[#94a3b8] truncate">{branch.code}</div>
                              </div>
                              {branchId === branch.id && <CheckIcon className="h-4 w-4 text-[#004aad] flex-shrink-0 ml-2" />}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <SyncStatus />

              {/* Go Pro Now — upsell, hidden once the customer is on a paid plan */}
              {showGoPro && (
                <button
                  onClick={onGoPro}
                  className="inline-flex items-center justify-center gap-[3px] px-[17px] py-[4px] rounded-[72px] text-white font-semibold transition-all duration-300"
                  style={{
                    background: "linear-gradient(90deg, rgba(64,183,255,1) 0%, rgba(0,50,117,1) 55%, rgba(129,80,249,1) 100%)",
                    width: "153px",
                    height: "40px",
                    fontFamily: "Archivo, sans-serif",
                    fontSize: "12.86px",
                    boxShadow: "0 4px 12px rgba(64,183,255,0.3)",
                  }}
                  title="Upgrade to Pro"
                >
                  <Zap className="w-[17px] h-[17px]" fill="currentColor" strokeWidth={0} />
                  <span>Go Pro Now</span>
                </button>
              )}

              {/* Notifications */}
              <button
                onClick={() => onScreenChange("notifications")}
                className="inline-flex items-center p-2 rounded-full text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a] transition-all duration-200"
                title="Notifications"
              >
                <span className="relative">
                  <BellIcon className="h-6 w-6 transition-colors" />
                  <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-white" />
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Main content */}
        <main className="flex-1 relative overflow-y-auto bg-[#f6f8fb]">
          <div className="py-6">
            <div className="w-full max-w-[1480px] mx-auto px-4 sm:px-6 md:px-8">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
