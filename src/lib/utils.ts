import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Branch name for display. Older accounts stored the main branch as
 * "<Business> - Main" while the UI also renders a MAIN type badge, so "Main"
 * appeared twice. Strip the redundant suffix whenever the branch is the MAIN one.
 * (Mirrors displayBranchName in the web app.)
 */
export function displayBranchName(name: string, branchCodeOrType?: string | null): string {
  const trimmed = (name || "").trim();
  if (!branchCodeOrType || branchCodeOrType.toUpperCase() !== "MAIN") return trimmed;
  const stripped = trimmed.replace(/\s*[-–—]\s*main(\s+branch)?$/i, "").trim();
  return stripped || trimmed;
}

/**
 * Human-readable branch location built from the fields the backend actually
 * stores (address, city, country) — never a hardcoded country. Older desktop
 * records saved address == city, so consecutive duplicates are collapsed.
 */
export function branchLocation(branch: { address?: string; city?: string; country?: string }): string {
  const parts = [branch.address, branch.city, branch.country]
    .map((part) => (part || "").trim())
    .filter((part) => part.length > 0 && part !== "—");
  const unique = parts.filter((part, index) => parts.indexOf(part) === index);
  return unique.join(", ") || "—";
}
