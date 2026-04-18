
/**
 * Date utilities for Mega Phuong System
 * Optimized for Vietnamese dd/MM/yyyy display and yyyy-MM-dd ISO storage
 */

/**
 * Parses a string in dd/MM/yyyy, dd/MM, or yyyy-MM-dd format into a Date object.
 */
export const parseVNDate = (input: string | Date | null | undefined): Date | null => {
  if (!input) return null;
  if (input instanceof Date) return new Date(input.getFullYear(), input.getMonth(), input.getDate());

  const s = String(input).trim();
  if (!s) return null;

  // Case 1: yyyy-MM-dd (ISO) - Handles 2024-05-01 or 2024-05-01T08:30:00Z
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1]);
    const m = parseInt(isoMatch[2]);
    const d = parseInt(isoMatch[3]);
    return new Date(y, m - 1, d);
  }

  // Case 2: dd/MM/yyyy or dd/MM
  if (s.includes('/')) {
    const parts = s.split('/');
    const d = parseInt(parts[0]);
    const m = parseInt(parts[1]);
    const y = parts[2] ? parseInt(parts[2]) : new Date().getFullYear();
    
    const date = new Date(y, m - 1, d);
    if (isNaN(date.getTime())) return null;
    // Strict validation: Ensure day and month didn't "roll over" (e.g., Feb 30 -> Mar 2)
    if (date.getDate() !== d || date.getMonth() !== m - 1) return null;
    return date;
  }

  const fallback = new Date(s);
  return isNaN(fallback.getTime()) ? null : new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate());
};

/**
 * Converts any date format to yyyy-MM-dd for API storage keys.
 */
export const toISODateKey = (input: string | Date | null | undefined): string => {
  const d = parseVNDate(input);
  if (!d) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Converts any date format to dd/MM/yyyy for Vietnamese display.
 */
export const formatVNDate = (input: string | Date | null | undefined, withYear = true): string => {
  const d = parseVNDate(input);
  if (!d) return "";
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  if (!withYear) return `${day}/${month}`;
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Legacy compatibility (re-routing existing calls)
 */
export const formatDDMMYYYY = (i: any) => formatVNDate(i, true);
export const formatDDMM = (i: any) => formatVNDate(i, false);
export const toInputDateString = toISODateKey;
export const toVnZeroHour = (dateLike?: any) => {
  if (!dateLike) return parseVNDate(new Date())!;
  return parseVNDate(dateLike) || parseVNDate(new Date())!;
};

export const getDiffDays = (d1: Date, d2: Date): number => {
  const diffTime = d2.getTime() - d1.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};
