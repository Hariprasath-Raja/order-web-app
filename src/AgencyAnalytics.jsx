import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export default function AgencyAnalytics() {
  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState([]);
  const [productSalesData, setProductSalesData] = useState([]);
  const [metrics, setMetrics] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    totalUnits: 0,
    avgOrderValue: 0,
  });

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    setLoading(true);

    const { data: orders, error } = await supabase
      .from('Orders')
      .select(`
        OrderId,
        TotalAmount,
        CreatedAt,
        OrderStatus,
        OrderItems (
          ProductNameSnapshot,
          Quantity,
          LineTotal
        )
      `)
      .order('CreatedAt', { ascending: true });

    if (error || !orders) {
      setLoading(false);
      return;
    }

    // 1. Metric Counters
    let revSum = 0;
    let unitsSum = 0;
    const dailyMap = {};
    const productMap = {};

    orders.forEach((ord) => {
      const amount = parseFloat(ord.TotalAmount || 0);
      revSum += amount;

      // Date Format: DD/MM
      const dateKey = new Date(ord.CreatedAt).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
      });

      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = { date: dateKey, revenue: 0, ordersCount: 0 };
      }
      dailyMap[dateKey].revenue += amount;
      dailyMap[dateKey].ordersCount += 1;

      // Product sales aggregate
      (ord.OrderItems || []).forEach((item) => {
        const prodName = item.ProductNameSnapshot || 'Other';
        const qty = parseFloat(item.Quantity || 0);
        const itemTotal = parseFloat(item.LineTotal || 0);
        unitsSum += qty;

        if (!productMap[prodName]) {
          productMap[prodName] = { name: prodName, qty: 0, revenue: 0 };
        }
        productMap[prodName].qty += qty;
        productMap[prodName].revenue += itemTotal;
      });
    });

    // Top 8 Products by Revenue
    const sortedProducts = Object.values(productMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);

    setMetrics({
      totalRevenue: revSum,
      totalOrders: orders.length,
      totalUnits: unitsSum,
      avgOrderValue: orders.length > 0 ? (revSum / orders.length).toFixed(0) : 0,
    });

    setRevenueData(Object.values(dailyMap));
    setProductSalesData(sortedProducts);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-xs text-slate-400 font-medium">
        Loading sales intelligence & chart data...
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Revenue</p>
          <p className="text-xl font-extrabold text-emerald-700 mt-1">₹{metrics.totalRevenue.toLocaleString()}</p>
          <span className="text-[10px] text-slate-400">All registered orders</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Orders Dispatched</p>
          <p className="text-xl font-extrabold text-slate-800 mt-1">{metrics.totalOrders}</p>
          <span className="text-[10px] text-slate-400">Wholesale bookings</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Avg Order Value</p>
          <p className="text-xl font-extrabold text-slate-800 mt-1">₹{metrics.avgOrderValue}</p>
          <span className="text-[10px] text-slate-400">Per shop transaction</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Quantity</p>
          <p className="text-xl font-extrabold text-slate-800 mt-1">{metrics.totalUnits}</p>
          <span className="text-[10px] text-slate-400">Items/KG dispatched</span>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Daily Revenue Trend Chart */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800">
              Daily Revenue Trend (₹)
            </h3>
            <p className="text-[11px] text-slate-400">Day-by-day sales revenue volume</p>
          </div>

          <div className="w-full h-64">
            {revenueData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">No revenue data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#059669" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value) => [`₹${value}`, 'Revenue']}
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '10px', border: 'none', color: '#fff', fontSize: '11px' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#059669" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRev)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Product-Wise Sales Chart */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800">
              Top Products by Sales Value
            </h3>
            <p className="text-[11px] text-slate-400">Highest grossing catalog items</p>
          </div>

          <div className="w-full h-64">
            {productSalesData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">No product sales data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productSalesData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 10, fill: '#334155' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value) => [`₹${value}`, 'Revenue']}
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '10px', border: 'none', color: '#fff', fontSize: '11px' }}
                  />
                  <Bar dataKey="revenue" fill="#0284c7" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}