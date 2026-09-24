/**
 * Chuẩn hóa chuỗi tìm kiếm:
 * 1. Chuyển thành chữ thường.
 * 2. Loại bỏ dấu tiếng Việt (ví dụ: "Phương" -> "phuong").
 * 3. Loại bỏ toàn bộ khoảng trắng thừa (ví dụ: "  mega   phuong " -> "megaphuong").
 */
export const normalizeSearchText = (str: any): string => {
  if (str === null || str === undefined) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .replace(/\s+/g, '');
};

/**
 * Kiểm tra xem chuỗi nguồn (target) có chứa từ khóa tìm kiếm (query) hay không:
 * - Không phân biệt hoa / thường
 * - Không phân biệt khoảng trắng (tìm "nguyen van" vẫn khớp "nguyen  van" hay "nguyenvan")
 * - Tìm có dấu hay không dấu đều khớp (ví dụ tìm "phuong" khớp "Phương")
 */
export const matchesSearch = (target: any, query: string): boolean => {
  const cleanQuery = normalizeSearchText(query);
  if (!cleanQuery) return true;
  const cleanTarget = normalizeSearchText(target);
  return cleanTarget.includes(cleanQuery);
};
