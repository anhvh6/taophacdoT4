
import React, { useState, useEffect } from 'react';
import { Save, Trash2, Plus, Package, CheckCircle2 } from 'lucide-react';
import { Layout } from '../components/Layout';
import { Card, Button } from '../components/UI';
import { api } from '../services/api';
import { Product } from '../types';
import { safeSetLocalStorage } from '../src/utils/storage';

export const ProductManagement: React.FC<{ onNavigate: (page: string) => void, onRefresh?: () => void }> = ({ onNavigate, onRefresh }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Thử lấy từ cache trước để hiển thị ngay lập tức
        const cachedProducts = localStorage.getItem('mega_products_cache');
        if (cachedProducts) {
          try {
            setProducts(JSON.parse(cachedProducts));
            setLoading(false); // Có dữ liệu rồi thì không cần hiện loading xoay xoay nữa
          } catch (e) {
            console.error("Lỗi parse cache sản phẩm:", e);
          }
        } else {
          setLoading(true); // Chỉ hiện loading nếu không có cache
        }

        const data = await api.getProducts();
        setProducts(data);
        safeSetLocalStorage('mega_products_cache', JSON.stringify(data));
      } catch (err) {
        console.error("Lỗi tải sản phẩm:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await api.saveProducts(products);
      
      // Cập nhật lại cache sau khi lưu thành công
      safeSetLocalStorage('mega_products_cache', JSON.stringify(products));
      if (onRefresh) onRefresh();
      
      setShowSuccess(true);
      
      // Hiển thị thông báo 1 giây rồi tự động chuyển trang
      setTimeout(() => {
        setShowSuccess(false);
        onNavigate('dashboard');
      }, 1000);
    } catch (err) {
      alert("Lỗi khi lưu sản phẩm. Vui lòng thử lại.");
      setIsSaving(false);
    }
  };

  const addProduct = () => {
    setProducts([...products, { id_sp: "SP" + Date.now(), ten_sp: "Sản phẩm mới", gia_nhap: 0, gia_ban: 0, trang_thai: 1 }]);
  };

  const updateProduct = (idx: number, updates: Partial<Product>) => {
    const newProducts = [...products];
    newProducts[idx] = { ...newProducts[idx], ...updates };
    setProducts(newProducts);
  };

  const removeProduct = (idx: number) => {
    setProducts(products.filter((_, i) => i !== idx));
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN').format(val);
  };

  const parseCurrency = (str: string) => {
    return parseInt(str.replace(/\./g, '')) || 0;
  };

  const handleNameFocus = (idx: number, currentValue: string) => {
    if (currentValue === "Sản phẩm mới") {
      updateProduct(idx, { ten_sp: "" });
    }
  };

  return (
    <Layout 
      title="DANH MỤC SẢN PHẨM" 
      onBack={() => onNavigate('dashboard')} 
      actions={
        <Button size="sm" onClick={handleSave} disabled={isSaving}>
          <Save size={16} className="mr-2" /> {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
        </Button>
      }
    >
      {/* Overlay thông báo thành công */}
      {showSuccess && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white p-8 rounded-3xl shadow-2xl border border-blue-100 flex flex-col items-center gap-4 animate-in zoom-in duration-300">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600">
              <CheckCircle2 size={40} />
            </div>
            <h2 className="text-xl font-bold text-blue-900 uppercase tracking-tight">Lưu thành công!</h2>
            <p className="text-sm text-gray-500">Đang quay lại trang chủ...</p>
          </div>
        </div>
      )}

      {loading && products.length === 0 ? (
        <div className="max-w-5xl mx-auto space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-2xl w-full"></div>
          ))}
        </div>
      ) : (
        <Card className="max-w-5xl mx-auto shadow-none border-blue-100 p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-blue-50/50">
                  <tr>
                    <th className="p-3 text-[10px] text-blue-700 uppercase text-center w-12">STT</th>
                    <th className="p-3 text-[10px] text-blue-700 uppercase text-left">Tên sản phẩm</th>
                    <th className="p-3 text-[10px] text-blue-700 uppercase text-right">Giá nhập</th>
                    <th className="p-3 text-[10px] text-blue-700 uppercase text-right">Giá bán</th>
                    <th className="p-3 text-[10px] text-blue-700 uppercase text-center">Tồn kho</th>
                    <th className="p-3 text-[10px] text-blue-700 uppercase text-center w-12">Xóa</th>
                  </tr>
              </thead>
              <tbody>
                  {products.map((p, idx) => (
                    <tr key={p.id_sp} className="border-b border-blue-50 hover:bg-blue-50/30 transition-colors">
                      <td className="p-2 text-center text-[10px] font-bold text-gray-400">
                        {idx + 1}
                      </td>
                      <td className="p-2">
                        <input 
                          className="line-input text-xs" 
                          placeholder="Nhập tên sản phẩm..."
                          value={p.ten_sp || ''} 
                          onFocus={() => handleNameFocus(idx, p.ten_sp)}
                          onChange={e => updateProduct(idx, { ten_sp: e.target.value })} 
                        />
                      </td>
                      <td className="p-2">
                        <input 
                          className="line-input text-xs text-right" 
                          value={formatCurrency(p.gia_nhap || 0)} 
                          onChange={e => updateProduct(idx, { gia_nhap: parseCurrency(e.target.value) })} 
                        />
                      </td>
                      <td className="p-2">
                        <input 
                          className="line-input text-xs text-right font-bold text-blue-600" 
                          value={formatCurrency(p.gia_ban || 0)} 
                          onChange={e => updateProduct(idx, { gia_ban: parseCurrency(e.target.value) })} 
                        />
                      </td>
                      <td className="p-2 text-center">
                        <select 
                          className="line-input text-[10px] text-center cursor-pointer" 
                          value={p.trang_thai ?? 1} 
                          onChange={e => updateProduct(idx, { trang_thai: parseInt(e.target.value) || 0 })}
                        >
                          <option value={1}>Còn hàng</option>
                          <option value={0}>Hết hàng</option>
                        </select>
                      </td>
                      <td className="p-2 text-center">
                        <button 
                          className="text-red-300 hover:text-red-500 p-2 transition-colors" 
                          onClick={() => removeProduct(idx)}
                          title="Xóa tạm thời"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {products.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-10 text-center text-gray-400 italic text-sm">Chưa có sản phẩm nào trong danh mục...</td>
                    </tr>
                  )}
              </tbody>
            </table>
          </div>
          
          <div className="p-4 bg-gray-50/50 border-t border-blue-50">
            <Button variant="secondary" className="w-full" size="sm" onClick={addProduct}>
              <Plus size={14} className="mr-2" /> Thêm sản phẩm mới
            </Button>
            <p className="text-[9px] text-gray-400 mt-2 text-center uppercase tracking-widest font-medium">
              Lưu ý: Các thay đổi (bao gồm cả việc xóa) chỉ có hiệu lực sau khi nhấn nút "Lưu thay đổi"
            </p>
          </div>
        </Card>
      )}
    </Layout>
  );
};
