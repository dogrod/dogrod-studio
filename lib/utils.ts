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
