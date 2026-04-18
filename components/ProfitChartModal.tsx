
import React, { useMemo } from 'react';
import { X, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { Customer, Product, CustomerStatus } from '../types';
import { calcRevenueCostProfit, getProfitMonth, buildProductMap } from '../utils/finance';

interface ProfitChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  products: Product[];
}

export const ProfitChartModal: React.FC<ProfitChartModalProps> = ({ isOpen, onClose, customers, products }) => {
  const productMap = useMemo(() => buildProductMap(products), [products]);

  const chartData = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const monthlyProfits: Record<string, number> = {};

    // Khởi tạo 12 tháng của năm hiện tại
    for (let m = 1; m <= 12; m++) {
      const key = `${String(m).padStart(2, '0')}/${currentYear}`;
      monthlyProfits[key] = 0;
    }

    customers.forEach(c => {
      // Chỉ tính cho khách hàng không bị xóa và có ngày tạo
      if (!c.created_at || c.status === CustomerStatus.DELETED) return;
      
      const profitMonth = getProfitMonth(c.created_at);
      
      // Chỉ tính cho năm hiện tại
      if (profitMonth.endsWith(`/${currentYear}`)) {
        const fin = calcRevenueCostProfit(c, products, productMap);
        monthlyProfits[profitMonth] = (monthlyProfits[profitMonth] || 0) + fin.profit;
      }
    });

    return Object.keys(monthlyProfits)
      .sort((a, b) => {
        const [mA, yA] = a.split('/').map(Number);
        const [mB, yB] = b.split('/').map(Number);
        return (yA * 12 + mA) - (yB * 12 + mB);
      })
      .map(key => ({
        month: `T${key.split('/')[0]}`,
        profit: monthlyProfits[key],
        fullKey: key
      }));
  }, [customers, products, productMap]);

  if (!isOpen) return null;

  const formatVND = (num: number) => new Intl.NumberFormat('vi-VN').format(num);

  return (
    <div className="fixed inset-0 z-[8000] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white w-full max-w-4xl rounded-[2.5rem] overflow-hidden shadow-2xl relative z-10 animate-in zoom-in duration-300">
        <div className="p-6 sm:p-8 border-b border-blue-50 bg-blue-50/50 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-100">
              <TrendingUp size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-blue-900 uppercase tracking-tight">BIỂU ĐỒ LỢI NHUẬN</h3>
              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Dữ liệu 12 tháng năm {new Date().getFullYear()}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-white rounded-full text-blue-300 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 sm:p-10">
          <div className="h-[350px] sm:h-[450px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#6B7280', fontSize: 12, fontWeight: 600 }}
                  dy={10}
                />
                <YAxis 
                  hide 
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', padding: '12px' }}
                  formatter={(value: number) => [formatVND(value), 'Lợi nhuận']}
                  labelStyle={{ fontWeight: 800, color: '#1E3A8A', marginBottom: '4px' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="profit" 
                  stroke="#2563EB" 
                  strokeWidth={2} 
                  dot={{ r: 5, fill: '#2563EB', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 7, strokeWidth: 0 }}
                  animationDuration={1500}
                >
                  <LabelList 
                    dataKey="profit" 
                    position="top" 
                    formatter={(v: number) => v === 0 ? '' : formatVND(v)}
                    style={{ fontSize: '10px', fontWeight: 800, fill: '#F97316' }}
                    offset={12}
                  />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
          
          <div className="mt-8 p-6 bg-blue-50/50 rounded-3xl border border-blue-100">
            <p className="text-[11px] text-blue-600 font-bold leading-relaxed">
              * Quy định: Lợi nhuận tháng được tính từ ngày 15 của tháng đó đến hết ngày 14 của tháng tiếp theo. 
              Ví dụ: Lợi nhuận Tháng 3 được ghi nhận cho các giao dịch từ 15/03 đến 14/04.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
