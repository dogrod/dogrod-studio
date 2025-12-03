import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatFractionalSeconds(value: number | null | undefined) {
  if (!value || value <= 0) return null;
  if (value < 1) {
    const denominator = Math.round(1 / value);
    return `1/${denominator}`;
  }
  return `${value.toFixed(1).replace(/\.0$/, "")}s`;
}

export function formatAperture(value: number | null | undefined) {
  if (!value || value <= 0) return null;
  return `f/${value.toFixed(1).replace(/\.0$/, "")}`;
}

export function formatFocalLength(value: number | null | undefined) {
  if (!value || value <= 0) return null;
  return `${Math.round(value)}mm`;
}

/**
 * Convert a decimal aspect ratio to a readable format like "4:3"
 * Matches against common aspect ratios first, then falls back to calculated ratio
 */
export function formatAspectRatio(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;

  const numValue = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(numValue) || numValue <= 0) return null;

  // Common aspect ratios [width, height]
  const commonRatios: [number, number][] = [
    [1, 1],    // 1.0
    [5, 4],    // 1.25
    [4, 3],    // 1.333...
    [3, 2],    // 1.5
    [16, 10],  // 1.6
    [5, 3],    // 1.666...
    [16, 9],   // 1.777...
    [2, 1],    // 2.0
    [21, 9],   // 2.333...
    // Portrait versions
    [4, 5],    // 0.8
    [3, 4],    // 0.75
    [2, 3],    // 0.666...
    [10, 16],  // 0.625
    [3, 5],    // 0.6
    [9, 16],   // 0.5625
    [1, 2],    // 0.5
    [9, 21],   // 0.4285...
  ];

  // Try to match against common aspect ratios (2% tolerance)
  for (const [w, h] of commonRatios) {
    const decimal = w / h;
    if (Math.abs(numValue - decimal) / decimal < 0.02) {
      return `${w}:${h}`;
    }
  }

  // Fallback: find a simple ratio with small denominator
  const maxDenom = 20;
  for (let denom = 1; denom <= maxDenom; denom++) {
    const numer = Math.round(numValue * denom);
    const ratio = numer / denom;
    if (Math.abs(numValue - ratio) < 0.01) {
      const gcd = gcdCalc(numer, denom);
      return `${numer / gcd}:${denom / gcd}`;
    }
  }

  // Last resort: return decimal rounded to 2 places
  return numValue.toFixed(2);
}

function gcdCalc(a: number, b: number): number {
  return b === 0 ? a : gcdCalc(b, a % b);
}
