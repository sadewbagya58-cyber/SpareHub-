import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines conditional CSS classes and merges conflicting Tailwind classes.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Formats a monetary amount in Sri Lankan Rupees (LKR) from integer cents/minor units.
 * 100 minor units = 1.00 LKR
 */
export function formatLKR(minorUnits: number): string {
  const rupees = minorUnits / 100;
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(rupees);
}
