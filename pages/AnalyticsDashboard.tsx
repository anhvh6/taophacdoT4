
import React, { useMemo, useState } from 'react';
import { Layout } from '../components/Layout';
import { Card, Button } from '../components/UI';
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight, 
  PieChart as PieChartIcon, 
  BarChart3, 
  Activity,
  ChevronLeft,
  Filter,
  Download
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell, 
  PieChart, 
  Pie, 
  AreaChart, 
  Area,
  Legend
} from 'recharts';
import { Customer, Product, CustomerStatus } from '../types';
import { calcRevenueCostProfit, getProfitMonth } from '../utils/finance';
import { toISODateKey, parseVNDate } from '../utils/date';

const formatVND = (num: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
const formatNumber = (num: number) => new Intl.NumberFormat('vi-VN').format(num);

interface AnalyticsDashboardProps {
  onNavigate: (page: string, params?: any) => void;
  customers: Customer[];
  products: Product[];
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ onNavigate, customers, products }) => {
  const [timeRange, setTimeRange] = useState<'month' | 'quarter' | 'year'>('month');
  
  // Data Processing
  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const activeCustomers = customers.filter(c => c.status !== CustomerStatus.DELETED);
    
    // Revenue & Profit
    let totalRevenue = 0;
    let totalProfit = 0;
    let currentCycleRevenue = 0;
    let currentCycleProfit = 0;
    let lastCycleProfit = 0;
    
    // Student Status
    const statusCounts = {
      active: 0,
      noPlan: 0,
      expiring: 0,
      expired: 0
    };
    
    // Monthly Data for Year Chart
    const monthlyData = Array.from({ length: 12 }, (_, i) => ({
      name: `T${i + 1}`,
      revenue: 0,
      profit: 0,
      students: 0
    }));

    const currentCycleKey = getProfitMonth(now);
    const [currentCycleM, currentCycleY] = currentCycleKey.split('/').map(Number);

    activeCustomers.forEach(c => {
      const fin = calcRevenueCostProfit(c, products);
      
      const profitMonthKey = getProfitMonth(c.created_at || Date.now());
      const [m, y] = profitMonthKey.split('/').map(Number);
      
      // Monthly Data for the current year
      if (y === currentYear) {
        totalRevenue += fin.revenue;
        totalProfit += fin.profit;
        
        monthlyData[m - 1].revenue += fin.revenue;
        monthlyData[m - 1].profit += fin.profit;
        
        // Count new students by their creation date month
        const createdDate = parseVNDate(c.created_at) || new Date();
        if (createdDate.getFullYear() === currentYear) {
          monthlyData[createdDate.getMonth()].students += 1;
        }
        
        if (profitMonthKey === currentCycleKey) {
          currentCycleRevenue += fin.revenue;
          currentCycleProfit += fin.profit;
        } else {
          // Check for last cycle
          const lastCycleM = currentCycleM === 1 ? 12 : currentCycleM - 1;
          const lastCycleY = currentCycleM === 1 ? currentCycleY - 1 : currentCycleY;
          if (m === lastCycleM && y === lastCycleY) {
            lastCycleProfit += fin.profit;
          }
        }
      }
      
      // Status Logic
      const hasPlan = !!c.video_date && String(c.video_date).trim() !== "";
      const start = parseVNDate(c.start_date) || new Date();
      const end = parseVNDate(c.end_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const diff = today.getTime() - start.getTime();
      const currentDay = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
      
      let daysLeft = 0;
      if (end) {
        const diffEnd = end.getTime() - today.getTime();
        daysLeft = Math.ceil(diffEnd / (1000 * 60 * 60 * 24));
      } else {
        daysLeft = (c.duration_days || 30) - (currentDay > 0 ? currentDay : 0);
      }
      
      if (!hasPlan) statusCounts.noPlan++;
      else if (currentDay < 1) {
        // "Chưa bắt đầu" is now ignored or merged into active for the chart as per request to remove it
        statusCounts.active++; 
      }
      else if (daysLeft < 0) statusCounts.expired++;
      else if (daysLeft <= 5) statusCounts.expiring++;
      else statusCounts.active++;
    });

    const profitContribution = totalProfit === 0 ? 0 : (currentCycleProfit / totalProfit) * 100;

    return {
      totalRevenue,
      totalProfit,
      currentCycleRevenue,
      currentCycleProfit,
      profitContribution,
      statusCounts,
      monthlyData,
      totalStudents: activeCustomers.length
    };
  }, [customers, products]);

  const pieData = [
    { name: 'Đang hoạt động', value: stats.statusCounts.active, color: '#10B981', statusKey: 'active' },
    { name: 'Sắp hết hạn', value: stats.statusCounts.expiring, color: '#F59E0B', statusKey: 'expiring' },
    { name: 'Chưa có phác đồ', value: stats.statusCounts.noPlan, color: '#EF4444', statusKey: 'noPlan' },
    { name: 'Đã kết thúc', value: stats.statusCounts.expired, color: '#6B7280', statusKey: 'expired' },
  ];

  const handleStatusClick = (statusKey: string) => {
    onNavigate('dashboard', { filterStatus: statusKey });
  };

  return (
    <Layout 
      title="THỐNG KÊ & PHÂN TÍCH"
      onBack={() => onNavigate('dashboard')}
      actions={
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Download size={14} className="mr-1.5" /> Xuất báo cáo
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-8 pb-20">
        {/* Top Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6 bg-white border-blue-50 shadow-sm hover:shadow-md transition-all">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-blue-50 rounded-2xl text-blue-600">
                <DollarSign size={24} />
              </div>
              <div className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                <ArrowUpRight size={14} />
                {stats.profitContribution.toFixed(1)}% năm
              </div>
            </div>
            <h3 className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-1">Lợi nhuận chu kỳ này</h3>
            <p className="text-2xl font-black text-blue-900">{formatVND(stats.currentCycleProfit)}</p>
            <p className="text-[10px] font-bold text-gray-400 mt-1">Doanh thu: {formatVND(stats.currentCycleRevenue)}</p>
          </Card>

          <Card className="p-6 bg-white border-blue-50 shadow-sm hover:shadow-md transition-all">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">
                <TrendingUp size={24} />
              </div>
            </div>
            <h3 className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-1">Tổng lợi nhuận năm</h3>
            <p className="text-2xl font-black text-emerald-700">{formatVND(stats.totalProfit)}</p>
            <p className="text-[10px] font-bold text-gray-400 mt-1">Doanh thu: {formatVND(stats.totalRevenue)}</p>
          </Card>

          <Card className="p-6 bg-white border-blue-50 shadow-sm hover:shadow-md transition-all">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-purple-50 rounded-2xl text-purple-600">
                <Users size={24} />
              </div>
            </div>
            <h3 className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-1">Tổng số học viên</h3>
            <p className="text-2xl font-black text-purple-900">{formatNumber(stats.totalStudents)}</p>
          </Card>

          <Card className="p-6 bg-white border-blue-50 shadow-sm hover:shadow-md transition-all">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-orange-50 rounded-2xl text-orange-600">
                <Activity size={24} />
              </div>
            </div>
            <h3 className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-1">Tỷ lệ hoạt động</h3>
            <p className="text-2xl font-black text-orange-700">
              {stats.totalStudents > 0 ? ((stats.statusCounts.active / stats.totalStudents) * 100).toFixed(1) : 0}%
            </p>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Revenue Over Time */}
          <Card className="p-8 bg-white border-blue-50 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-black text-blue-900 uppercase tracking-tight">Biểu đồ doanh thu & Lợi nhuận</h3>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Chu kỳ từ ngày 15 tháng này đến 14 tháng sau</p>
              </div>
              <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100">
                <button 
                  onClick={() => setTimeRange('month')}
                  className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${timeRange === 'month' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  Tháng
                </button>
                <button 
                  onClick={() => setTimeRange('year')}
                  className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${timeRange === 'year' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  Năm
                </button>
              </div>
            </div>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.monthlyData}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.05}/>
                    </linearGradient>
                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F97316" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#F97316" stopOpacity={0.05}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#94A3B8' }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#94A3B8' }}
                    tickFormatter={(value) => `${value / 1000000}M`}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                    formatter={(value: number) => [formatVND(value), '']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="none" 
                    fillOpacity={1} 
                    fill="url(#colorRev)" 
                    name="Doanh thu" 
                    label={{ position: 'top', fill: '#1E40AF', fontSize: 10, fontWeight: 800, formatter: (val: number) => val > 0 ? formatNumber(val) : '' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="profit" 
                    stroke="none" 
                    fillOpacity={1} 
                    fill="url(#colorProfit)" 
                    name="Lợi nhuận" 
                    label={{ position: 'bottom', fill: '#C2410C', fontSize: 10, fontWeight: 800, formatter: (val: number) => val > 0 ? formatNumber(val) : '' }}
                  />
                  <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Student Status Distribution */}
          <Card className="p-8 bg-white border-blue-50 shadow-sm">
            <div className="mb-8">
              <h3 className="text-lg font-black text-blue-900 uppercase tracking-tight">Trạng thái học viên</h3>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Phân bổ theo tình trạng phác đồ hiện tại</p>
            </div>
            <div className="flex flex-col md:flex-row items-center justify-center gap-8">
              <div className="h-[300px] w-full md:w-1/2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-4 w-full md:w-1/2">
                {pieData.map((item, index) => (
                  <div 
                    key={index} 
                    onClick={() => handleStatusClick(item.statusKey)}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100 cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                      <span className="text-[11px] font-bold text-gray-600 uppercase tracking-tight group-hover:text-blue-700">{item.name}</span>
                    </div>
                    <span className="text-sm font-black text-blue-900">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Bottom Section: Comparison & Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Activity Comparison */}
          <Card className="lg:col-span-2 p-8 bg-white border-blue-50 shadow-sm">
             <div className="mb-8">
                <h3 className="text-lg font-black text-blue-900 uppercase tracking-tight">Tăng trưởng học viên</h3>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Số lượng học viên mới đăng ký theo tháng</p>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 700, fill: '#94A3B8' }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 700, fill: '#94A3B8' }}
                    />
                    <Tooltip 
                      cursor={{ fill: '#F8FAFC' }}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar 
                      dataKey="students" 
                      fill="#3B82F6" 
                      radius={[4, 4, 0, 0]} 
                      barSize={16}
                      name="Học viên mới" 
                      label={{ position: 'top', fill: '#1E3A8A', fontSize: 10, fontWeight: 800 }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
          </Card>

          {/* Quick Insights */}
          <Card className="p-8 bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-none shadow-xl">
            <h3 className="text-lg font-black uppercase tracking-tight mb-6">Thông tin nhanh</h3>
            <div className="flex flex-col gap-6">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-white/10 rounded-xl">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-1">Chu kỳ hiện tại</p>
                  <p className="text-sm font-bold">Tháng {new Date().getMonth() + 1} / {new Date().getFullYear()}</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="p-2 bg-white/10 rounded-xl">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-1">Dự kiến doanh thu năm</p>
                  <p className="text-sm font-bold">{formatVND(stats.totalRevenue * 1.2)}</p>
                  <p className="text-[10px] text-emerald-300 font-bold mt-1">+20% so với dự kiến ban đầu</p>
                </div>
              </div>

              <div className="mt-4 p-4 bg-white/10 rounded-2xl border border-white/10">
                <p className="text-[10px] font-bold uppercase tracking-widest mb-3 opacity-60">Top trạng thái</p>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold">Hoạt động</span>
                  <span className="text-xs font-black">{((stats.statusCounts.active / stats.totalStudents) * 100).toFixed(0)}%</span>
                </div>
                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-400 h-full rounded-full" 
                    style={{ width: `${(stats.statusCounts.active / stats.totalStudents) * 100}%` }}
                  ></div>
                </div>
              </div>

              <Button 
                variant="primary" 
                className="mt-4 bg-white text-blue-600 hover:bg-blue-50 border-none py-4"
                onClick={() => onNavigate('dashboard')}
              >
                QUẢN LÝ HỌC VIÊN
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
};
