import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Icons } from './Icons';

export default function AgencyAnalytics({ selectedAgency }) {
  // Navigation: 5 Distinct Analytics Types
  const [activeTab, setActiveTab] = useState('REVENUE'); // 'REVENUE' | 'CATEGORY' | 'PRODUCT' | 'HSN' | 'ORDERS'

  // Time Window Preset
  const [timeFilter, setTimeFilter] = useState('ALL'); // 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'ALL'

  // Data States
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (selectedAgency?.AgencyId) {
      fetchAnalyticsData();
    }
  }, [selectedAgency]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      // 1. Categories
      const { data: catData } = await supabase
        .from('Categories')
        .select('*')
        .eq('AgencyId', selectedAgency.AgencyId);

      // 2. Products with Tax Slab
      const { data: prodData } = await supabase
        .from('Products')
        .select(`
          ProductId,
          ProductName,
          CategoryId,
          HsnCode,
          BasePrice,
          TaxSlabMaster ( TaxPercentage )
        `)
        .eq('AgencyId', selectedAgency.AgencyId);

      // 3. Orders with OrderItems
      const { data: orderData } = await supabase
        .from('Orders')
        .select(`
          OrderId,
          CreatedAt,
          OrderStatus,
          SubTotal,
          TotalTaxAmount,
          TotalAmount,
          TotalWeightKg,
          RouteSnapshot,
          ShopNameSnapshot,
          OrderItems (
            ProductId,
            ProductNameSnapshot,
            Quantity,
            UnitPriceSnapshot,
            UomCodeSnapshot,
            TaxPercentageSnapshot,
            CgstAmount,
            SgstAmount,
            LineTotal
          )
        `)
        .eq('AgencyId', selectedAgency.AgencyId)
        .order('CreatedAt', { ascending: false });

      if (catData) setCategories(catData);
      if (prodData) setProducts(prodData);
      if (orderData) setOrders(orderData);
    } catch (err) {
      console.error('Analytics Fetch Error:', err);
    }
    setLoading(false);
  };

  // Helper date filter
  const filterOrdersByTime = (list) => {
    const now = new Date();
    return list.filter((ord) => {
      if (!ord.CreatedAt) return false;
      const d = new Date(ord.CreatedAt);

      if (timeFilter === 'TODAY') {
        return (
          d.getDate() === now.getDate() &&
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
      }
      if (timeFilter === 'THIS_WEEK') {
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        return d >= weekAgo;
      }
      if (timeFilter === 'THIS_MONTH') {
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }
      return true;
    });
  };

  const filteredOrders = filterOrdersByTime(orders);

  // Mappings
  const prodMap = {};
  products.forEach((p) => {
    prodMap[p.ProductId] = p;
  });

  const catMap = {};
  categories.forEach((c) => {
    catMap[c.CategoryId] = c.CategoryName;
  });

  // ==========================================
  // METRIC COMPUTATIONS
  // ==========================================

  // 1. OVERALL REVENUE METRICS
  const totalRevenue = filteredOrders.reduce((sum, o) => sum + parseFloat(o.TotalAmount || 0), 0);
  const totalTaxable = filteredOrders.reduce((sum, o) => sum + parseFloat(o.SubTotal || 0), 0);
  const totalGstCollected = filteredOrders.reduce((sum, o) => sum + parseFloat(o.TotalTaxAmount || 0), 0);
  const totalOrdersCount = filteredOrders.length;
  const avgOrderValue = totalOrdersCount > 0 ? totalRevenue / totalOrdersCount : 0;
  const totalWeightKg = filteredOrders.reduce((sum, o) => sum + parseFloat(o.TotalWeightKg || 0), 0);

  // 2. CATEGORY ANALYTICS MAP
  const categoryStatsMap = {};
  categories.forEach((cat) => {
    categoryStatsMap[cat.CategoryId] = {
      id: cat.CategoryId,
      name: cat.CategoryName,
      revenue: 0,
      units: 0,
      orderCount: 0,
      uniqueProducts: new Set(),
    };
  });
  categoryStatsMap['UNCAT'] = {
    id: 'UNCAT',
    name: 'General / Uncategorized',
    revenue: 0,
    units: 0,
    orderCount: 0,
    uniqueProducts: new Set(),
  };

  // 3. PRODUCT ANALYTICS MAP
  const productStatsMap = {};

  // 4. HSN TAX ANALYTICS MAP
  const hsnStatsMap = {};

  // 5. ORDERS & ROUTE DISPATCH MAP
  const routeStatsMap = {};
  const statusStatsMap = {};

  // Aggregate single loop over filtered orders
  filteredOrders.forEach((ord) => {
    // Status counts
    const st = ord.OrderStatus || 'ordered';
    statusStatsMap[st] = (statusStatsMap[st] || 0) + 1;

    // Route counts
    const route = ord.RouteSnapshot || 'Direct Route';
    if (!routeStatsMap[route]) {
      routeStatsMap[route] = { route, ordersCount: 0, totalAmount: 0, totalWeight: 0 };
    }
    routeStatsMap[route].ordersCount += 1;
    routeStatsMap[route].totalAmount += parseFloat(ord.TotalAmount || 0);
    routeStatsMap[route].totalWeight += parseFloat(ord.TotalWeightKg || 0);

    const items = ord.OrderItems || [];
    const categoriesSeenInOrder = new Set();

    items.forEach((it) => {
      const p = prodMap[it.ProductId] || {};
      const catId = p.CategoryId || 'UNCAT';
      const prodName = it.ProductNameSnapshot || p.ProductName || 'Unnamed Product';
      const hsn = p.HsnCode || '1905';
      const qty = parseFloat(it.Quantity || 0);
      const lineTotal = parseFloat(it.LineTotal || 0);
      const cgst = parseFloat(it.CgstAmount || 0);
      const sgst = parseFloat(it.SgstAmount || 0);
      const taxRate = parseFloat(it.TaxPercentageSnapshot || p.TaxSlabMaster?.TaxPercentage || 5);
      const taxable = lineTotal / (1 + taxRate / 100);

      // Category update
      if (!categoryStatsMap[catId]) {
        categoryStatsMap[catId] = {
          id: catId,
          name: catMap[catId] || 'Other',
          revenue: 0,
          units: 0,
          orderCount: 0,
          uniqueProducts: new Set(),
        };
      }
      categoryStatsMap[catId].revenue += lineTotal;
      categoryStatsMap[catId].units += qty;
      categoryStatsMap[catId].uniqueProducts.add(prodName);
      categoriesSeenInOrder.add(catId);

      // Product update
      if (!productStatsMap[prodName]) {
        productStatsMap[prodName] = {
          name: prodName,
          category: catMap[catId] || 'General',
          hsn,
          unitsSold: 0,
          totalRevenue: 0,
          orderCount: 0,
        };
      }
      productStatsMap[prodName].unitsSold += qty;
      productStatsMap[prodName].totalRevenue += lineTotal;
      productStatsMap[prodName].orderCount += 1;

      // HSN Tax update
      if (!hsnStatsMap[hsn]) {
        hsnStatsMap[hsn] = {
          hsnCode: hsn,
          taxRate,
          taxableValue: 0,
          cgstAmount: 0,
          sgstAmount: 0,
          totalValue: 0,
          unitsSold: 0,
        };
      }
      hsnStatsMap[hsn].taxableValue += taxable;
      hsnStatsMap[hsn].cgstAmount += cgst;
      hsnStatsMap[hsn].sgstAmount += sgst;
      hsnStatsMap[hsn].totalValue += lineTotal;
      hsnStatsMap[hsn].unitsSold += qty;
    });

    categoriesSeenInOrder.forEach((cid) => {
      if (categoryStatsMap[cid]) categoryStatsMap[cid].orderCount += 1;
    });
  });

  const categoryList = Object.values(categoryStatsMap)
    .filter((c) => c.revenue > 0 || c.units > 0)
    .sort((a, b) => b.revenue - a.revenue);

  const productList = Object.values(productStatsMap).sort((a, b) => b.totalRevenue - a.totalRevenue);

  const hsnList = Object.values(hsnStatsMap).sort((a, b) => b.totalValue - a.totalValue);

  const routeList = Object.values(routeStatsMap).sort((a, b) => b.totalAmount - a.totalAmount);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 px-2 sm:px-0 pb-12">
      {/* 1. TOP HEADER & TIMEFRAME FILTER */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 uppercase tracking-wider">
              {selectedAgency?.AgencyName}
            </span>
            <span className="text-xs text-slate-400 font-semibold">
              5-Way Intelligence Engine
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 mt-1">
            Agency Performance & Accounting Analytics
          </h2>
        </div>

        {/* Time Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'TODAY', label: 'Today' },
            { id: 'THIS_WEEK', label: 'Last 7 Days' },
            { id: 'THIS_MONTH', label: 'This Month' },
            { id: 'ALL', label: 'All Time' },
          ].map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setTimeFilter(pill.id)}
              className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer ${
                timeFilter === pill.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {pill.label}
            </button>
          ))}

          <button
            type="button"
            onClick={fetchAnalyticsData}
            className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 ml-1 cursor-pointer"
            title="Refresh"
          >
            <Icons.Refresh className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. 5 ANALYTICS TYPE TABS */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 text-xs">
        {[
          { id: 'REVENUE', label: '💰 1. Revenue & Orders Summary' },
          { id: 'CATEGORY', label: '🏷️ 2. Category Analytics' },
          { id: 'PRODUCT', label: '📦 3. Product Sales' },
          { id: 'HSN', label: '📊 4. HSN & GST Breakdown' },
          { id: 'ORDERS', label: '🚚 5. Orders & Route Dispatch' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-2 rounded-xl font-extrabold whitespace-nowrap transition cursor-pointer ${
              activeTab === tab.id
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-24 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
          Calculating agency analytics across reports...
        </div>
      ) : (
        <>
          {/* ========================================================================= */}
          {/* TAB 1: REVENUE & GENERAL SUMMARY */}
          {/* ========================================================================= */}
          {activeTab === 'REVENUE' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Gross Revenue
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                    ₹{totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </h3>
                  <span className="text-[11px] text-emerald-600 font-semibold block mt-1">
                    Taxable: ₹{totalTaxable.toFixed(2)}
                  </span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Total GST Collected
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-emerald-700 mt-1">
                    ₹{totalGstCollected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </h3>
                  <span className="text-[11px] text-slate-400 block mt-1">
                    CGST + SGST Combined
                  </span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Total Orders Fulfilled
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                    {totalOrdersCount}
                  </h3>
                  <span className="text-[11px] text-slate-500 font-medium block mt-1">
                    Avg Bill: ₹{avgOrderValue.toFixed(2)}
                  </span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Dispatch Volume
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-1 font-mono">
                    {totalWeightKg.toFixed(2)} KG
                  </h3>
                  <span className="text-[11px] text-slate-400 block mt-1">
                    Total load picked & sent
                  </span>
                </div>
              </div>

              {/* Revenue Quick Insight */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
                <h3 className="text-sm font-extrabold text-slate-900">
                  Revenue Breakdown Highlights
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="font-bold text-slate-500 block">Top Revenue Driver:</span>
                    <p className="font-extrabold text-slate-800 text-sm mt-0.5">
                      {categoryList[0]?.name || 'None'}
                    </p>
                    <span className="text-[11px] text-emerald-700 font-bold">
                      ₹{categoryList[0]?.revenue.toFixed(2) || '0.00'}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="font-bold text-slate-500 block">Star Selling Product:</span>
                    <p className="font-extrabold text-slate-800 text-sm mt-0.5 truncate">
                      {productList[0]?.name || 'None'}
                    </p>
                    <span className="text-[11px] text-emerald-700 font-bold">
                      {productList[0]?.unitsSold || 0} units (₹{productList[0]?.totalRevenue.toFixed(2) || '0.00'})
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="font-bold text-slate-500 block">Active GST Slabs:</span>
                    <p className="font-extrabold text-slate-800 text-sm mt-0.5">
                      {hsnList.length} Active HSN Codes
                    </p>
                    <span className="text-[11px] text-slate-500">
                      Standardized for sales tax filing
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: CATEGORY-WISE ANALYTICS */}
          {/* ========================================================================= */}
          {activeTab === 'CATEGORY' && (
            <div className="space-y-4">
              {/* Visual Share Contribution */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Category Revenue Share (% Contribution)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Proportion of total gross revenue generated by each product line
                  </p>
                </div>

                {categoryList.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No category sales recorded in this timeframe.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {categoryList.map((c) => {
                      const sharePct =
                        totalRevenue > 0
                          ? ((c.revenue / totalRevenue) * 100).toFixed(1)
                          : 0;

                      return (
                        <div key={c.id} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-800">{c.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                ({c.uniqueProducts.size} item varieties)
                              </span>
                            </div>
                            <div className="flex items-center gap-2 font-mono">
                              <span className="font-bold text-slate-900">
                                ₹{c.revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </span>
                              <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-800 text-[10px] font-extrabold rounded">
                                {sharePct}%
                              </span>
                            </div>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-emerald-600 h-2 rounded-full transition-all duration-500"
                              style={{ width: `${sharePct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Category Table */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Category Volume & Performance Table
                  </h3>
                </div>
                <div className="w-full overflow-x-auto">
                  <table className="w-full min-w-[550px] text-left text-xs border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px]">
                      <tr>
                        <th className="py-3 px-4">#</th>
                        <th className="py-3 px-4">Category Name</th>
                        <th className="py-3 px-4 text-center">Orders Present</th>
                        <th className="py-3 px-4 text-right">Units Sold</th>
                        <th className="py-3 px-4 text-right">Revenue</th>
                        <th className="py-3 px-4 text-right">Share %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {categoryList.map((c, idx) => {
                        const share =
                          totalRevenue > 0 ? ((c.revenue / totalRevenue) * 100).toFixed(1) : 0;
                        return (
                          <tr key={c.id} className="hover:bg-slate-50/60 transition">
                            <td className="py-3 px-4 font-mono text-slate-400 font-bold">{idx + 1}</td>
                            <td className="py-3 px-4 font-extrabold text-slate-800">{c.name}</td>
                            <td className="py-3 px-4 text-center text-slate-600">
                              <span className="bg-slate-100 px-2 py-0.5 rounded font-semibold text-[11px]">
                                {c.orderCount} orders
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-slate-700">
                              {c.units} units
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-black text-slate-900 text-sm">
                              ₹{c.revenue.toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
                                {share}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: PRODUCT-WISE SALES ANALYTICS */}
          {/* ========================================================================= */}
          {activeTab === 'PRODUCT' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Product Velocity & Sales Ranking
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Fastest-moving items ranked by total billings and dispatched units
                  </p>
                </div>
                <span className="text-xs font-bold text-slate-500">
                  {productList.length} Products Sold
                </span>
              </div>

              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-[650px] text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px]">
                    <tr>
                      <th className="py-3 px-4 w-12 text-center">Rank</th>
                      <th className="py-3 px-4">Product Name</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4 font-mono">HSN Code</th>
                      <th className="py-3 px-4 text-right">Dispatched Qty</th>
                      <th className="py-3 px-4 text-right">Order Frequency</th>
                      <th className="py-3 px-4 text-right">Total Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {productList.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="py-12 text-center text-slate-400">
                          No product order records found for this period.
                        </td>
                      </tr>
                    ) : (
                      productList.map((p, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60 transition">
                          <td className="py-3 px-4 text-center font-mono font-bold text-slate-400">
                            #{idx + 1}
                          </td>
                          <td className="py-3 px-4 font-extrabold text-slate-900">{p.name}</td>
                          <td className="py-3 px-4 text-slate-500 text-[11px]">{p.category}</td>
                          <td className="py-3 px-4 font-mono text-slate-600 font-bold">{p.hsn}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                            {p.unitsSold}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-500">
                            {p.orderCount} bills
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-black text-slate-900 text-sm">
                            ₹{p.totalRevenue.toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: HSN CODE & GST TAX BREAKDOWN */}
          {/* ========================================================================= */}
          {activeTab === 'HSN' && (
            <div className="space-y-4">
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      HSN Code Tax Filing Summary (GSTR-1 Format)
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Segregated taxable values and CGST/SGST splits per Harmonized System of Nomenclature
                    </p>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold font-mono">
                    {hsnList.length} Active HSN Codes
                  </span>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="w-full overflow-x-auto">
                  <table className="w-full min-w-[700px] text-left text-xs border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px]">
                      <tr>
                        <th className="py-3 px-4 font-mono">HSN Code</th>
                        <th className="py-3 px-4 text-center">GST Rate</th>
                        <th className="py-3 px-4 text-right">Units Sold</th>
                        <th className="py-3 px-4 text-right">Taxable Value (₹)</th>
                        <th className="py-3 px-4 text-right">CGST (₹)</th>
                        <th className="py-3 px-4 text-right">SGST (₹)</th>
                        <th className="py-3 px-4 text-right font-black">Gross Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {hsnList.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="py-12 text-center text-slate-400 font-sans">
                            No HSN records found.
                          </td>
                        </tr>
                      ) : (
                        hsnList.map((h, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/60 transition">
                            <td className="py-3.5 px-4 font-black text-slate-900">{h.hsnCode}</td>
                            <td className="py-3.5 px-4 text-center">
                              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold text-[11px]">
                                {h.taxRate}%
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right text-slate-600 font-bold">
                              {h.unitsSold}
                            </td>
                            <td className="py-3.5 px-4 text-right font-bold text-slate-800">
                              ₹{h.taxableValue.toFixed(2)}
                            </td>
                            <td className="py-3.5 px-4 text-right text-emerald-700">
                              ₹{h.cgstAmount.toFixed(2)}
                            </td>
                            <td className="py-3.5 px-4 text-right text-emerald-700">
                              ₹{h.sgstAmount.toFixed(2)}
                            </td>
                            <td className="py-3.5 px-4 text-right font-black text-slate-900 text-sm">
                              ₹{h.totalValue.toFixed(2)}
                            </td>
                          </tr>
                        ))
                      )}

                      {/* Cumulative HSN Footer */}
                      {hsnList.length > 0 && (
                        <tr className="bg-slate-50 font-black border-t-2 border-slate-300">
                          <td colSpan={3} className="py-3 px-4 text-right font-sans uppercase text-[11px]">
                            Total Taxable & GST:
                          </td>
                          <td className="py-3 px-4 text-right text-slate-900">
                            ₹{hsnList.reduce((s, h) => s + h.taxableValue, 0).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right text-emerald-700">
                            ₹{hsnList.reduce((s, h) => s + h.cgstAmount, 0).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right text-emerald-700">
                            ₹{hsnList.reduce((s, h) => s + h.sgstAmount, 0).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-900 text-sm">
                            ₹{hsnList.reduce((s, h) => s + h.totalValue, 0).toFixed(2)}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: ORDERS & ROUTE DISPATCH ANALYTICS */}
          {/* ========================================================================= */}
          {activeTab === 'ORDERS' && (
            <div className="space-y-4">
              {/* Status Breakdown Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {['ordered', 'accepted', 'denied', 'completed'].map((statusKey) => (
                  <div key={statusKey} className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      {statusKey}
                    </span>
                    <h4 className="text-xl font-black text-slate-800 mt-1">
                      {statusStatsMap[statusKey] || 0}
                    </h4>
                    <span className="text-[10px] text-slate-400">Total orders</span>
                  </div>
                ))}
              </div>

              {/* Route-Wise Volume & Revenue Matrix */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Dispatch Route Velocity & Revenue
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Order concentration, truck delivery loads, and sales value across routes
                  </p>
                </div>

                <div className="w-full overflow-x-auto">
                  <table className="w-full min-w-[550px] text-left text-xs border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px]">
                      <tr>
                        <th className="py-3 px-4">#</th>
                        <th className="py-3 px-4">Dispatch Route</th>
                        <th className="py-3 px-4 text-center">Orders Count</th>
                        <th className="py-3 px-4 text-right">Total Cargo Weight</th>
                        <th className="py-3 px-4 text-right">Route Gross Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {routeList.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="py-10 text-center text-slate-400">
                            No dispatch routes recorded.
                          </td>
                        </tr>
                      ) : (
                        routeList.map((r, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/60 transition">
                            <td className="py-3 px-4 font-mono text-slate-400 font-bold">{idx + 1}</td>
                            <td className="py-3 px-4 font-extrabold text-slate-900">{r.route}</td>
                            <td className="py-3 px-4 text-center">
                              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold text-[11px]">
                                {r.ordersCount} shops
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-slate-700">
                              {r.totalWeight.toFixed(2)} KG
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-black text-emerald-700 text-sm">
                              ₹{r.totalAmount.toFixed(2)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}