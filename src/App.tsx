import { useEffect, useState, type FormEvent } from "react";
import AppShell from "@/components/AppShell";
import UpgradeRequired from "@/components/UpgradeRequired";
import SignInScreen, {
  SessionLoadingScreen,
  AccessBlockedScreen,
  type LoginMode,
} from "@/components/SignInScreen";
import DashboardScreen from "@/screens/DashboardScreen";
import SalesScreen from "@/screens/SalesScreen";
import SalesHistoryScreen from "@/screens/SalesHistoryScreen";
import ProductsScreen from "@/screens/ProductsScreen";
import InventoryScreen from "@/screens/InventoryScreen";
import SuppliersScreen from "@/screens/SuppliersScreen";
import ReportsScreen from "@/screens/ReportsScreen";
import DebtorsScreen from "@/screens/DebtorsScreen";
import ExpensesScreen from "@/screens/ExpensesScreen";
import StaffScreen from "@/screens/StaffScreen";
import BranchesScreen from "@/screens/BranchesScreen";
import PaymentsScreen from "@/screens/PaymentsScreen";
import NotificationsScreen from "@/screens/NotificationsScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import { useAppData } from "@/store/AppData";
import { useAuth } from "@/auth/AuthContext";
import { CASHIER_RESTRICTED_SCREENS } from "@/hooks/usePermissions";
import type { ScreenKey } from "@/data";

export default function App() {
  const { branches, bootstrap, refresh } = useAppData();
  const { status, user, session, blockedReason, signInError, signIn, signOutUser } = useAuth();

  // Paid customers don't see the upsell. Plan status comes from the /me session.
  // Mirror the backend's hasActivePaidAccess exactly: a paid tier, an active
  // subscription, AND an end date still in the future. Checking only planTier (or
  // even the stored status, which can lag a day behind expiry) would keep premium
  // unlocked after a subscription lapses and hide the upgrade button.
  const subscriptionEndsAt = session?.subscriptionEndsAt;
  const isPaid =
    session?.planTier === "paid" &&
    session?.subscriptionStatus === "active" &&
    !!subscriptionEndsAt &&
    new Date(subscriptionEndsAt).getTime() > Date.now();

  // Screens behind the Pro plan (multi-branch & staff). When the account isn't on
  // an active paid plan these route to the upgrade prompt instead of the feature.
  const PREMIUM_SCREENS: ScreenKey[] = ["branches", "staff"];
  const lockedScreens = isPaid ? [] : PREMIUM_SCREENS;
  // Was on a paid plan that has since lapsed — tailors the copy (renew vs upgrade).
  const subscriptionExpired = session?.planTier === "paid" && !isPaid;

  // Cashiers run the sales register only — hide managerial screens from the nav and block direct
  // navigation to them. The backend already 403s these operations for cashiers; this stops the app
  // from showing actions that would only fail at sync.
  const isCashier = session?.role !== "owner" && session?.role !== "manager";
  const roleHiddenScreens: ScreenKey[] = isCashier ? CASHIER_RESTRICTED_SCREENS : [];

  const [loginMode, setLoginMode] = useState<LoginMode>("email");
  const [authEmail, setAuthEmail] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [localError, setLocalError] = useState("");
  const [screen, setScreen] = useState<ScreenKey>("dashboard");
  const [branchId, setBranchId] = useState("");

  // Once authenticated, resolve a real branch id from the server (or cache) before loading data.
  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    void (async () => {
      const resolved = await bootstrap(session?.assignedBranchIds ?? []);
      if (!cancelled && resolved) setBranchId(resolved);
    })();
    return () => {
      cancelled = true;
    };
  }, [status, session, bootstrap]);

  // Pull server truth into the cache whenever the resolved branch changes.
  useEffect(() => {
    if (status === "authenticated" && branchId) void refresh(branchId);
  }, [status, branchId, refresh]);

  function handleBranchChange(id: string) {
    localStorage.setItem("fahampesa:selectedBranchId", id);
    setBranchId(id);
  }

  // Block navigation to screens the current role can't access (cashiers → managerial screens).
  function changeScreen(next: ScreenKey) {
    setScreen(roleHiddenScreens.includes(next) ? "dashboard" : next);
  }

  function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loginMode === "phone") {
      setLocalError("Phone sign-in isn't available in the desktop app yet — please sign in with email.");
      return;
    }
    setLocalError("");
    if (!authEmail.trim() || !authPassword.trim()) {
      setLocalError("Enter your email address and password to continue.");
      return;
    }
    void signIn(authEmail, authPassword);
  }

  async function handleSignOut() {
    await signOutUser();
    setScreen("dashboard");
    setBranchId("");
    setAuthPassword("");
  }

  if (status === "loading") {
    return <SessionLoadingScreen email={user?.email ?? authEmail ?? ""} />;
  }

  if (status === "signed_out") {
    return (
      <SignInScreen
        mode={loginMode}
        email={authEmail}
        phone={authPhone}
        password={authPassword}
        error={localError || signInError}
        onModeChange={(mode) => {
          setLoginMode(mode);
          setLocalError("");
        }}
        onEmailChange={setAuthEmail}
        onPhoneChange={setAuthPhone}
        onPasswordChange={setAuthPassword}
        onSubmit={handleSignIn}
      />
    );
  }

  if (status === "blocked") {
    return <AccessBlockedScreen email={user?.email ?? ""} reason={blockedReason} onBackToSignIn={handleSignOut} />;
  }

  // status === "authenticated"
  if (screen === "sales") {
    return (
      <SalesScreen
        branchId={branchId}
        cashierName={user?.displayName ?? user?.email?.split("@")[0] ?? "User"}
        onBack={() => setScreen("dashboard")}
        onSignOut={handleSignOut}
        onViewHistory={() => setScreen("salesHistory")}
      />
    );
  }

  return (
    <AppShell
      screen={screen}
      branches={branches}
      branchId={branchId}
      onBranchChange={handleBranchChange}
      onScreenChange={changeScreen}
      onSignOut={handleSignOut}
      showGoPro={!isPaid}
      onGoPro={() => setScreen("payments")}
      lockedScreens={lockedScreens}
      hiddenScreens={roleHiddenScreens}
    >
      {screen === "dashboard" && <DashboardScreen branchId={branchId} onScreenChange={changeScreen} />}
      {screen === "salesHistory" && <SalesHistoryScreen branchId={branchId} onBack={() => setScreen("dashboard")} />}
      {screen === "products" && <ProductsScreen branchId={branchId} />}
      {screen === "inventory" && <InventoryScreen branchId={branchId} />}
      {screen === "expenses" && <ExpensesScreen />}
      {screen === "suppliers" && <SuppliersScreen branchId={branchId} />}
      {screen === "reports" && <ReportsScreen branchId={branchId} />}
      {screen === "debtors" && <DebtorsScreen />}
      {screen === "staff" && (isPaid ? <StaffScreen /> : <UpgradeRequired feature="Staff management" expired={subscriptionExpired} onGoPro={() => setScreen("payments")} />)}
      {screen === "branches" && (isPaid ? <BranchesScreen /> : <UpgradeRequired feature="Multi-branch management" expired={subscriptionExpired} onGoPro={() => setScreen("payments")} />)}
      {screen === "payments" && <PaymentsScreen />}
      {screen === "notifications" && <NotificationsScreen branchId={branchId} onScreenChange={changeScreen} />}
      {screen === "settings" && <SettingsScreen onSignOut={handleSignOut} />}
    </AppShell>
  );
}
