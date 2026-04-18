
import { Customer, Product } from '../types';
import { parseVNDate } from './date';

/**
 * Chuẩn hóa chuỗi để so sánh: viết thường, loại bỏ dấu, bỏ khoảng trắng thừa.
 */
const normalize = (s: any) => String(s ?? '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/\s+/g, ' ')
  .trim();

/**
 * Kiểm tra xem học viên có ở trạng thái "chưa gán" hay không.
 * Quy ước: Trang_thai = "0" là chưa gán.
 */
export function isChuaGan(input: any): boolean {
  if (typeof input === 'object' && input !== null) {
    // Ưu tiên kiểm tra trường trang_thai (số 0/1)
    const val = String(input.trang_thai ?? '');
    if (val === '0') return true;
    if (val === '1') return false;

    // Dự phòng cho trang_thai_gan nếu trang_thai null/undefined
    const s = normalize(input.trang_thai_gan);
    if (s.includes('chua gan')) return true;
    if (s.includes('da gan')) return false;
    
    return false;
  }
  
  const s = String(input ?? '');
  return s === '0' || normalize(s).includes('chua gan');
}

/**
 * Xây dựng bản đồ sản phẩm để tra cứu nhanh thông tin gia_nhap/gia_ban.
 */
export function buildProductMap(products: Product[]) {
  const m = new Map<string, Product>();
  (products || []).forEach(p => {
    if (!p) return;
    if (p.id_sp) m.set(String(p.id_sp).trim(), p);
    if (p.ten_sp) m.set('NAME:' + normalize(p.ten_sp), p);
  });
  return m;
}

/**
 * Tính toán doanh thu, giá vốn, lợi nhuận cho một học viên.
 */
export function calcRevenueCostProfit(customer: Customer, products: Product[], prebuiltMap?: Map<string, Product>) {
  const productMap = prebuiltMap || buildProductMap(products || []);
  const items = Array.isArray(customer?.san_pham) ? customer.san_pham : [];

  let cost = 0;
  let revenueFromItems = 0;

  for (const it of items) {
    const qty = Number((it as any).so_luong ?? 0) || 0;
    if (qty <= 0) continue;

    const byId = (it as any).id_sp ? productMap.get(String((it as any).id_sp).trim()) : undefined;
    const byName = (it as any).ten_sp ? productMap.get('NAME:' + normalize((it as any).ten_sp)) : undefined;
    const p = byId || byName;

    const giaNhap = Number((it as any).gia_nhap ?? p?.gia_nhap ?? 0) || 0;
    const giaBan = Number((it as any).don_gia ?? (it as any).gia_ban ?? p?.gia_ban ?? 0) || 0;

    cost += giaNhap * qty;
    revenueFromItems += giaBan * qty;
  }

  const revenue = (Number(customer?.gia_tien ?? 0) || 0) > 0 ? Number(customer.gia_tien) : revenueFromItems;
  const profit = revenue - cost;

  return {
    revenue,
    cost,
    profit,
    hasVon: cost > 0
  };
}

/**
 * Xác định tháng lợi nhuận dựa trên ngày: 15 tháng này đến 14 tháng sau là tháng này.
 */
export function getProfitMonth(date: Date | string): string {
  const d = parseVNDate(date);
  if (!d || isNaN(d.getTime())) return 'Unknown';
  
  const day = d.getDate();
  let month = d.getMonth(); // 0-11
  let year = d.getFullYear();
  
  // Nếu ngày < 15, nó thuộc về bản ghi lợi nhuận của tháng trước
  if (day < 15) {
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
  }
  
  // Trả về định dạng MM/YYYY để dễ so sánh và sắp xếp
  return `${String(month + 1).padStart(2, '0')}/${year}`;
}
