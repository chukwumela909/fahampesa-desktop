// The active business currency symbol. Set once from the loaded business settings
// (setCurrencySymbol) so every screen and printed receipt shows the business's real currency
// instead of a hardcoded "KSh". Defaults to KSh until settings resolve.
let currencySymbol = "KSh";

/** Map a currency code or free-text label (e.g. "KES", "NGN — Naira") to a display symbol. */
export function symbolForCurrency(currency: string | null | undefined): string {
  const c = (currency ?? "").toUpperCase();
  if (!c.trim()) return "KSh";
  if (c.includes("NGN") || c.includes("NAIRA") || c.includes("₦")) return "₦";
  if (c.includes("UGX")) return "USh";
  if (c.includes("TZS")) return "TSh";
  if (c.includes("GHS") || c.includes("CEDI") || c.includes("₵")) return "₵";
  if (c.includes("ZAR") || c.includes("RAND")) return "R";
  if (c.includes("RWF")) return "FRw";
  if (c.includes("ETB") || c.includes("BIRR")) return "Br";
  if (c.includes("GBP") || c.includes("POUND") || c.includes("£")) return "£";
  if (c.includes("EUR") || c.includes("€")) return "€";
  if (c.includes("USD") || c.includes("DOLLAR") || c.includes("$")) return "$";
  if (c.includes("KES") || c.includes("KSH") || c.includes("SHILLING")) return "KSh";
  // Unknown but short-looking code → show the raw code; otherwise fall back to KSh.
  const trimmed = (currency ?? "").trim();
  return trimmed.length > 0 && trimmed.length <= 4 ? trimmed : "KSh";
}

export function setCurrencySymbol(currency: string | null | undefined): void {
  currencySymbol = symbolForCurrency(currency);
}

export function getCurrencySymbol(): string {
  return currencySymbol;
}

export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/** Whole-unit currency, e.g. "KSh 1,250". */
export function currency(value: number): string {
  return `${currencySymbol} ${Math.round(value).toLocaleString()}`;
}

/** Money with up to 2 decimals, e.g. "KSh 1,250.50". */
export function formatMoney(value: number): string {
  return `${currencySymbol} ${value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
