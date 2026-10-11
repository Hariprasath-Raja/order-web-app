import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Icons } from './Icons';
import InvoicePrintModal from './InvoicePrintModal';
import ConsolidatedStockModal from './ConsolidatedStockModal';

export default function AgencyOrders({ selectedAgency }) {
  const [orders, setOrders] = useState([]);
  const [statusList, setStatusList] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState('ALL');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [message, setMessage] = useState('');

  // Date Filter States (Default: TODAY)
  const [dateFilterPreset, setDateFilterPreset] = useState('TODAY');
  const [customDate, setCustomDate] = useState(new Date().toISOString().split('T')[0]);

  // Bulk Selection States
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Print & Summary States
  const [ordersToPrint, setOrdersToPrint] = useState([]);
  const [showStockSummary, setShowStockSummary] = useState(false);

  useEffect(() => {
    fetchStatuses();
  }, []);

  useEffect(() => {
    if (selectedAgency?.AgencyId) {
      fetchOrders();
    }
  }, [selectedAgency]);

  const fetchStatuses = async () => {
    const { data } = await supabase
      .from('OrderStatusMaster')
      .select('*')
      .eq('IsVisibleInUI', true)
      .order('DisplayOrder', { ascending: true });
    if (data) setStatusList(data);
  };

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('Orders')
      .select(`
        *,
        PaymentMaster ( MethodName ),
        OrderItems ( * )
      `)
      .eq('AgencyId', selectedAgency.AgencyId)
      .order('OrderId', { ascending: false });

    if (error) {
      setMessage(`Fetch Error: ${error.message}`);
    } else if (data) {
      setOrders(data);
      setSelectedOrderIds([]);
    }
    setLoading(false);
  };

  const isSameDay = (orderDateStr, targetDate) => {
    if (!orderDateStr) return false;
    const d = new Date(orderDateStr);
    const target = new Date(targetDate);
    return (
      d.getFullYear() === target.getFullYear() &&
      d.getMonth() === target.getMonth() &&
      d.getDate() === target.getDate()
    );
  };

  const filteredOrders = orders.filter((o) => {
    const matchesRoute = selectedRoute === 'ALL' || o.RouteSnapshot === selectedRoute;
    if (!matchesRoute) return false;

    const now = new Date();
    if (dateFilterPreset === 'ALL') return true;

    if (dateFilterPreset === 'TODAY') {
      return isSameDay(o.CreatedAt, now);
    }

    if (dateFilterPreset === 'YESTERDAY') {
      const yesterday = new Date();
      yesterday.setDate(now.getDate() - 1);
      return isSameDay(o.CreatedAt, yesterday);
    }

    if (dateFilterPreset === 'CUSTOM') {
      if (!customDate) return true;
      return isSameDay(o.CreatedAt, customDate);
    }

    return true;
  });

  const routes = ['ALL', ...new Set(orders.map((o) => o.RouteSnapshot).filter(Boolean))];

  const isAllSelected =
    filteredOrders.length > 0 &&
    filteredOrders.every((o) => selectedOrderIds.includes(o.OrderId));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      const currentFilteredIds = new Set(filteredOrders.map((o) => o.OrderId));
      setSelectedOrderIds((prev) => prev.filter((id) => !currentFilteredIds.has(id)));
    } else {
      const currentFilteredIds = filteredOrders.map((o) => o.OrderId);
      setSelectedOrderIds((prev) => Array.from(new Set([...prev, ...currentFilteredIds])));
    }
  };

  const handleToggleSelectOne = (orderId) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const handleBulkAccept = async () => {
    if (selectedOrderIds.length === 0) return;
    setBulkActionLoading(true);
    setMessage('');

    const { error } = await supabase
      .from('Orders')
      .update({ OrderStatus: 'accepted' })
      .in('OrderId', selectedOrderIds);

    if (error) {
      setMessage(`Bulk Update Failed: ${error.message}`);
    } else {
      setOrders((prev) =>
        prev.map((o) => (selectedOrderIds.includes(o.OrderId) ? { ...o, OrderStatus: 'accepted' } : o))
      );
      setMessage(`Accepted ${selectedOrderIds.length} orders!`);
    }
    setBulkActionLoading(false);
  };

  const handlePrintSelected = async () => {
    const targetOrders = orders.filter((o) => selectedOrderIds.includes(o.OrderId));
    if (targetOrders.length === 0) return;

    const enrichedOrders = await Promise.all(
      targetOrders.map(async (ord) => {
        let items = ord.OrderItems || [];
        if (items.length === 0) {
          const { data: itemData } = await supabase
            .from('OrderItems')
            .select('*')
            .eq('OrderId', ord.OrderId);
          items = itemData || [];
        }

        let shop = ord.ShopDetails || null;
        if (!shop && ord.ShopUserId) {
          const { data: shopData } = await supabase
            .from('ShopDetails')
            .select('*, Users ( Phone )')
            .eq('UserId', ord.ShopUserId)
            .maybeSingle();
          shop = shopData;
        }

        return {
          ...ord,
          OrderItems: items,
          order_items: items,
          ShopDetails: shop || {},
          PhoneSnapshot: ord.PhoneSnapshot || shop?.Phone || shop?.Users?.Phone || '',
          GstinSnapshot: shop?.GstNumber || '',
        };
      })
    );

    setOrdersToPrint(enrichedOrders);
  };

  const handleSinglePrint = async (order) => {
    let items = order.OrderItems || [];
    if (items.length === 0) {
      const { data: itemData } = await supabase
        .from('OrderItems')
        .select('*')
        .eq('OrderId', order.OrderId);
      items = itemData || [];
    }

    let shop = order.ShopDetails || null;
    if (!shop && order.ShopUserId) {
      const { data: shopData } = await supabase
        .from('ShopDetails')
        .select('*, Users ( Phone )')
        .eq('UserId', order.ShopUserId)
        .maybeSingle();
      shop = shopData;
    }

    const completeOrder = {
      ...order,
      OrderItems: items,
      order_items: items,
      ShopDetails: shop || {},
      PhoneSnapshot: order.PhoneSnapshot || shop?.Phone || shop?.Users?.Phone || '',
      GstinSnapshot: shop?.GstNumber || '',
    };

    setOrdersToPrint([completeOrder]);
  };

  const handleStatusChange = async (orderId, newStatus) => {
    setUpdatingId(orderId);
    setMessage('');

    const { error } = await supabase
      .from('Orders')
      .update({ OrderStatus: newStatus })
      .eq('OrderId', orderId);

    if (error) {
      setMessage(`Update Failed: ${error.message}`);
    } else {
      setOrders((prev) =>
        prev.map((o) => (o.OrderId === orderId ? { ...o, OrderStatus: newStatus } : o))
      );
      if (selectedOrder && selectedOrder.OrderId === orderId) {
        setSelectedOrder((prev) => ({ ...prev, OrderStatus: newStatus }));
      }
    }
    setUpdatingId(null);
  };

  const viewOrderDetails = async (order) => {
    setSelectedOrder(order);
    if (order.OrderItems && order.OrderItems.length > 0) {
      setOrderItems(order.OrderItems);
    } else {
      const { data } = await supabase
        .from('OrderItems')
        .select('*')
        .eq('OrderId', order.OrderId);
      if (data) setOrderItems(data);
    }
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'ordered':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'accepted':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'denied':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-3 sm:space-y-4 px-2 sm:px-0">
      {/* Top Header Card */}
      <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 uppercase tracking-wider">
                {selectedAgency?.AgencyName}
              </span>
              <span className="text-xs text-slate-400 font-semibold">
                {filteredOrders.length} Orders
              </span>
            </div>
            <h2 className="text-sm sm:text-base font-extrabold text-slate-800 mt-1">
              Orders & Daily Dispatch
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowStockSummary(true)}
              disabled={filteredOrders.length === 0}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <span>📦 Stock Sheet</span>
            </button>

            <button
              type="button"
              onClick={fetchOrders}
              className="flex items-center justify-center gap-1 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl transition active:scale-95 cursor-pointer"
            >
              <Icons.Refresh className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Responsive Filters: Scrollable Date Filter & Route */}
        <div className="pt-2.5 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          {/* Date Presets with Horizontal Scrolling on Small Screens */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
              Date:
            </span>
            {[
              { id: 'TODAY', label: 'Today' },
              { id: 'YESTERDAY', label: 'Yesterday' },
              { id: 'CUSTOM', label: 'Custom' },
              { id: 'ALL', label: 'All' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setDateFilterPreset(p.id)}
                className={`px-3 py-1 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                  dateFilterPreset === p.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}

            {dateFilterPreset === 'CUSTOM' && (
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="bg-white border border-slate-300 rounded-xl px-2 py-0.5 text-xs font-semibold text-slate-800 focus:outline-none shrink-0 cursor-pointer"
              />
            )}
          </div>

          {/* Route Dropdown */}
          <div className="flex items-center justify-between sm:justify-end gap-2 text-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
              Route:
            </span>
            <select
              value={selectedRoute}
              onChange={(e) => setSelectedRoute(e.target.value)}
              className="w-full sm:w-auto bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
            >
              {routes.map((r) => (
                <option key={r} value={r}>
                  {r === 'ALL' ? 'All Routes' : r}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Responsive Bulk Action Bar */}
      {selectedOrderIds.length > 0 && (
        <div className="bg-slate-900 text-white p-3 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-md animate-in fade-in">
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <span className="font-bold text-xs bg-emerald-500 text-slate-900 px-2 py-0.5 rounded-md">
              {selectedOrderIds.length} Selected
            </span>
            <button
              type="button"
              onClick={() => setSelectedOrderIds([])}
              className="text-xs text-slate-400 hover:text-white transition cursor-pointer sm:hidden"
            >
              Clear Selection
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBulkAccept}
              disabled={bulkActionLoading}
              className="flex-1 sm:flex-none px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {bulkActionLoading ? 'Accepting...' : '✓ Accept All'}
            </button>
            <button
              type="button"
              onClick={handlePrintSelected}
              className="flex-1 sm:flex-none px-3 py-1.5 bg-white text-slate-900 hover:bg-slate-100 text-xs font-bold rounded-xl transition active:scale-95 cursor-pointer"
            >
              🖨️ Print ({selectedOrderIds.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedOrderIds([])}
              className="hidden sm:inline-block px-2 text-xs text-slate-400 hover:text-white transition cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {message && (
        <div className="flex items-center justify-between p-3 text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-medium">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage('')} className="text-emerald-500 hover:text-emerald-800 cursor-pointer">✕</button>
        </div>
      )}

      {/* Select All Bar on Mobile */}
      {filteredOrders.length > 0 && (
        <div className="sm:hidden bg-white p-2.5 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs font-semibold text-slate-700">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={handleToggleSelectAll}
              className="w-4 h-4 rounded-sm text-emerald-600 focus:ring-emerald-500 border-slate-300"
            />
            <span>Select All Orders</span>
          </label>
          <span className="text-slate-400 text-[11px] font-mono">({filteredOrders.length})</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. MOBILE VIEW: Responsive Card List (Hidden on sm and larger) */}
      {/* ========================================================================= */}
      <div className="block sm:hidden space-y-2.5">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
            Loading orders...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
            No orders found for this filter.
          </div>
        ) : (
          filteredOrders.map((ord) => {
            const isChecked = selectedOrderIds.includes(ord.OrderId);
            return (
              <div
                key={ord.OrderId}
                className={`bg-white p-3.5 rounded-2xl border transition shadow-2xs space-y-3 ${
                  isChecked ? 'border-emerald-500 bg-emerald-50/20' : 'border-slate-200/80'
                }`}
              >
                {/* Header row: Checkbox, Order ID, Date & Total Bill */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleSelectOne(ord.OrderId)}
                      className="w-4 h-4 rounded-sm text-emerald-600 cursor-pointer"
                    />
                    <div>
                      <span className="font-mono font-extrabold text-xs text-slate-900">
                        #{ord.OrderId}
                      </span>
                      <span className="block text-[10px] text-slate-400">
                        {new Date(ord.CreatedAt).toLocaleDateString('en-GB')}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-extrabold text-emerald-700 text-sm">
                      ₹{ord.TotalAmount}
                    </span>
                    <span className="block text-[10px] text-slate-400 font-medium">
                      {ord.TotalWeightKg} KG • {ord.PaymentMaster?.MethodName || 'COD'}
                    </span>
                  </div>
                </div>

                {/* Shopkeeper Details */}
                <div className="bg-slate-50/70 p-2.5 rounded-xl space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="font-bold text-xs text-slate-800 truncate">
                      {ord.ShopNameSnapshot}
                    </h4>
                    <span className="px-1.5 py-0.5 bg-white border border-slate-200 text-slate-600 rounded text-[9.5px] font-semibold shrink-0">
                      {ord.RouteSnapshot}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">
                    {ord.OwnerNameSnapshot} • <span className="font-mono text-slate-600">{ord.PhoneSnapshot}</span>
                  </p>
                </div>

                {/* Actions Row: Status dropdown + Buttons */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <select
                    value={ord.OrderStatus}
                    disabled={updatingId === ord.OrderId}
                    onChange={(e) => handleStatusChange(ord.OrderId, e.target.value)}
                    className={`text-[11px] font-bold border rounded-lg px-2 py-1 transition cursor-pointer focus:outline-none ${getStatusBadgeColor(
                      ord.OrderStatus
                    )}`}
                  >
                    {statusList.map((st) => (
                      <option key={st.StatusCode} value={st.StatusCode}>
                        {st.StatusName}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSinglePrint(ord)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg text-xs transition border border-slate-200 cursor-pointer"
                    >
                      🖨️ Print
                    </button>
                    <button
                      type="button"
                      onClick={() => viewOrderDetails(ord)}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs transition shadow-2xs cursor-pointer"
                    >
                      Items
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2. DESKTOP VIEW: Full Horizontal Table (Hidden on small screens) */}
      {/* ========================================================================= */}
      <div className="hidden sm:block bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs border-collapse">
            <thead className="bg-slate-50/75 border-b border-slate-200/80 text-slate-500 uppercase font-bold text-[10px]">
              <tr>
                <th className="py-3 px-4 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleToggleSelectAll}
                    className="w-4 h-4 rounded-sm text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-3">Order ID</th>
                <th className="py-3 px-4">Shop Details</th>
                <th className="py-3 px-4">Route / Location</th>
                <th className="py-3 px-4 text-right">Weight</th>
                <th className="py-3 px-4 text-right">Total Bill</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">Loading orders...</td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    No orders found for the selected date and route filter.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((ord) => {
                  const isChecked = selectedOrderIds.includes(ord.OrderId);
                  return (
                    <tr
                      key={ord.OrderId}
                      className={`hover:bg-slate-50/60 transition ${isChecked ? 'bg-emerald-50/30' : ''}`}
                    >
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelectOne(ord.OrderId)}
                          className="w-4 h-4 rounded-sm text-emerald-600 cursor-pointer"
                        />
                      </td>
                      <td className="py-3.5 px-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                        #{ord.OrderId}
                        <span className="block text-[10px] text-slate-400 font-sans font-normal">
                          {new Date(ord.CreatedAt).toLocaleDateString('en-GB')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 min-w-[180px]">
                        <span className="font-bold text-slate-800 block truncate">{ord.ShopNameSnapshot}</span>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span className="truncate">{ord.OwnerNameSnapshot}</span>
                          <span>•</span>
                          <span className="font-mono text-slate-600">{ord.PhoneSnapshot}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 min-w-[140px]">
                        <span className="inline-block bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded-md font-semibold mb-0.5">
                          {ord.RouteSnapshot}
                        </span>
                        <span className="block text-[11px] text-slate-400 truncate max-w-[160px]">
                          {ord.AddressSnapshot}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-slate-700 whitespace-nowrap">
                        {ord.TotalWeightKg} KG
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <span className="font-extrabold text-emerald-700 text-sm block">₹{ord.TotalAmount}</span>
                        <span className="text-[10px] text-slate-400">({ord.PaymentMaster?.MethodName || 'COD'})</span>
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <select
                          value={ord.OrderStatus}
                          disabled={updatingId === ord.OrderId}
                          onChange={(e) => handleStatusChange(ord.OrderId, e.target.value)}
                          className={`text-xs font-bold border rounded-lg px-2.5 py-1 transition cursor-pointer focus:outline-none ${getStatusBadgeColor(
                            ord.OrderStatus
                          )}`}
                        >
                          {statusList.map((st) => (
                            <option key={st.StatusCode} value={st.StatusCode}>
                              {st.StatusName}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSinglePrint(ord)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition active:scale-95 border border-slate-200 cursor-pointer"
                          >
                            <span>🖨️ Print</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => viewOrderDetails(ord)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition active:scale-95 shadow-xs cursor-pointer"
                          >
                            <span>Items</span>
                            <Icons.ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drawer */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex justify-end">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col p-4 sm:p-6 animate-in slide-in-from-right">
            <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-100">
              <div className="min-w-0 pr-2">
                <h3 className="font-extrabold text-sm sm:text-base text-slate-800 truncate">
                  Order #{selectedOrder.OrderId}
                </h3>
                <span className="text-[11px] sm:text-xs text-slate-500 font-medium truncate block">
                  {selectedOrder.ShopNameSnapshot} ({selectedOrder.RouteSnapshot})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition shrink-0 cursor-pointer"
              >
                <Icons.Close className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 py-3">
              {orderItems.map((it) => (
                <div key={it.OrderItemId} className="py-2.5 flex justify-between items-center text-xs gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 truncate">{it.ProductNameSnapshot}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Rate: ₹{it.UnitPriceSnapshot} × {it.Quantity} {it.UomCodeSnapshot}
                    </p>
                  </div>
                  <span className="font-extrabold text-slate-900 text-sm whitespace-nowrap">
                    ₹{it.LineTotal}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between text-base font-extrabold text-slate-900 pt-1 border-t border-slate-100">
                <span>Total Amount</span>
                <span className="text-emerald-700">₹{selectedOrder.TotalAmount}</span>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => handleSinglePrint(selectedOrder)}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  🖨️ Print Full Invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Multi-Print Modal */}
      {ordersToPrint.length > 0 && (
        <InvoicePrintModal
          orders={ordersToPrint}
          agencyDetails={selectedAgency}
          onClose={() => setOrdersToPrint([])}
        />
      )}

      {/* Consolidated Godown Stock Modal */}
      {showStockSummary && (
        <ConsolidatedStockModal
          orders={filteredOrders}
          onClose={() => setShowStockSummary(false)}
        />
      )}
    </div>
  );
}