
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
 * Chuyển đổi ngày (được admin lưu theo lịch giờ Việt Nam UTC+7) sang đối tượng Date 00:00:00 
 * tại múi giờ địa phương của thiết bị người dùng.
 * Ví dụ: Ngày bắt đầu 20/11/2026 (giờ VN) = 19/11/2026 09:00 (giờ Mỹ PST)
 * -> Tại Mỹ, ngày bắt đầu tương ứng theo lịch thiết bị địa phương là ngày 19/11/2026.
 */
export const parseVnDateToLocalDate = (input: string | Date | null | undefined): Date | null => {
  if (!input) return null;
  if (input instanceof Date) return new Date(input.getFullYear(), input.getMonth(), input.getDate());

  const s = String(input).trim();
  if (!s) return null;

  let y = 0, m = 0, d = 0;
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    y = parseInt(isoMatch[1], 10);
    m = parseInt(isoMatch[2], 10);
    d = parseInt(isoMatch[3], 10);
  } else if (s.includes('/')) {
    const parts = s.split('/');
    d = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10);
    y = parts[2] ? parseInt(parts[2], 10) : new Date().getFullYear();
  } else {
    const fallback = new Date(s);
    if (isNaN(fallback.getTime())) return null;
    return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate());
  }

  if (!y || !m || !d) return null;

  // Thời điểm 00:00:00 ngày đó theo giờ Việt Nam (UTC+7) tính bằng UTC timestamp:
  const vnStartUtcMs = Date.UTC(y, m - 1, d, 0, 0, 0) - 7 * 60 * 60 * 1000;
  const localDateAtVnStart = new Date(vnStartUtcMs);

  return new Date(localDateAtVnStart.getFullYear(), localDateAtVnStart.getMonth(), localDateAtVnStart.getDate());
};

/**
 * Lấy ngày bắt đầu hiệu lực theo lịch thiết bị của người dùng:
 * Tự động đồng bộ giữa mốc giờ VN (UTC+7) và mốc lịch địa phương của thiết bị.
 * Nếu ở Mỹ/Châu Âu (sau giờ VN): khi VN đã sang ngày 20/11 thì ở Mỹ là 19/11 đã được mở ngay!
 * Nếu ở Nhật/Úc (trước giờ VN): khi địa phương sang ngày 20/11 thì cũng được mở ngay!
 */
export const getEffectiveLocalDate = (startDateInput: string | Date | null | undefined): Date | null => {
  if (!startDateInput) return null;
  const localFromVn = parseVnDateToLocalDate(startDateInput);
  const plainLocal = parseVNDate(startDateInput);
  if (!localFromVn || !plainLocal) return localFromVn || plainLocal;
  return localFromVn.getTime() < plainLocal.getTime() ? localFromVn : plainLocal;
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
