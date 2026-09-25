import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Icons } from './Icons';

export default function AgencyOrders() {
  const [orders, setOrders] = useState([]);
  const [statusList, setStatusList] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState('ALL');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchStatuses();
    fetchOrders();
  }, []);

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
        PaymentMaster ( MethodName )
      `)
      .order('OrderId', { ascending: false });

    if (error) {
      setMessage(`Fetch Error: ${error.message}`);
    } else if (data) {
      setOrders(data);
    }
    setLoading(false);
  };

  const viewOrderDetails = async (order) => {
    setSelectedOrder(order);
    const { data } = await supabase
      .from('OrderItems')
      .select('*')
      .eq('OrderId', order.OrderId);
    if (data) setOrderItems(data);
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

  const routes = ['ALL', ...new Set(orders.map((o) => o.RouteSnapshot).filter(Boolean))];

  const filteredOrders = selectedRoute === 'ALL'
    ? orders
    : orders.filter((o) => o.RouteSnapshot === selectedRoute);

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
    <div className="w-full max-w-6xl mx-auto space-y-4">
      {/* Header & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-base font-extrabold text-slate-800">Incoming Wholesale Orders</h2>
          <p className="text-xs text-slate-500">Track, review line items, and manage dispatch statuses</p>
        </div>

        {/* Route Filter & Refresh Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
            <span className="text-xs font-semibold text-slate-500 shrink-0">Route:</span>
            <select
              value={selectedRoute}
              onChange={(e) => setSelectedRoute(e.target.value)}
              className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none w-full sm:w-auto cursor-pointer"
            >
              {routes.map((r) => (
                <option key={r} value={r}>
                  {r === 'ALL' ? 'All Routes' : r}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={fetchOrders}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl transition active:scale-95 shrink-0 cursor-pointer"
          >
            <Icons.Refresh className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {message && (
        <div className="flex items-center gap-2 p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-xl font-medium">
          <Icons.Alert className="w-4 h-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Orders Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-xs border-collapse">
            <thead className="bg-slate-50/75 border-b border-slate-200/80 text-slate-500 uppercase font-bold tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Order ID</th>
                <th className="py-3 px-4">Shop Details</th>
                <th className="py-3 px-4">Route / Location</th>
                <th className="py-3 px-4 text-right">Weight</th>
                <th className="py-3 px-4 text-right">Total Bill</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">Loading orders...</td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">No orders placed yet.</td>
                </tr>
              ) : (
                filteredOrders.map((ord) => (
                  <tr key={ord.OrderId} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-800 whitespace-nowrap">
                      #{ord.OrderId}
                      <span className="block text-[10px] text-slate-400 font-sans font-normal">
                        {new Date(ord.CreatedAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 min-w-[180px]">
                      <span className="font-bold text-slate-800 block truncate">{ord.ShopNameSnapshot}</span>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span className="truncate">{ord.OwnerNameSnapshot}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-mono text-slate-600 shrink-0">
                          <Icons.Phone className="w-3 h-3" />
                          {ord.PhoneSnapshot}
                        </span>
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
                      <button
                        type="button"
                        onClick={() => viewOrderDetails(ord)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition active:scale-95 shadow-xs cursor-pointer"
                      >
                        <span>Items</span>
                        <Icons.ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-out Order Details Drawer */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex justify-end">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col p-5 sm:p-6 animate-in slide-in-from-right">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="min-w-0 pr-2">
                <h3 className="font-extrabold text-base text-slate-800 truncate">
                  Order #{selectedOrder.OrderId}
                </h3>
                <span className="text-xs text-slate-500 font-medium truncate block">
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
                <div key={it.OrderItemId} className="py-3 flex justify-between items-center text-xs gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 truncate">{it.ProductNameSnapshot}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Rate: ₹{it.UnitPriceSnapshot} × {it.Quantity} {it.UomCodeSnapshot}
                    </p>
                    <p className="text-[10px] text-emerald-600 font-medium">
                      GST ({it.TaxPercentageSnapshot}%): ₹{(parseFloat(it.CgstAmount) + parseFloat(it.SgstAmount)).toFixed(2)}
                    </p>
                  </div>
                  <span className="font-extrabold text-slate-900 text-sm whitespace-nowrap">
                    ₹{it.LineTotal}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Taxable Subtotal</span>
                <span>₹{selectedOrder.SubTotal}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Total GST</span>
                <span>₹{selectedOrder.TotalTaxAmount}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Total Weight</span>
                <span className="font-bold">{selectedOrder.TotalWeightKg} KG</span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-slate-900 pt-2 border-t border-slate-100">
                <span>Total Amount</span>
                <span className="text-emerald-700">₹{selectedOrder.TotalAmount}</span>
              </div>

              <div className="pt-3">
                <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                  Change Order Status
                </label>
                <select
                  value={selectedOrder.OrderStatus}
                  onChange={(e) => handleStatusChange(selectedOrder.OrderId, e.target.value)}
                  className="w-full text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 focus:outline-none cursor-pointer"
                >
                  {statusList.map((st) => (
                    <option key={st.StatusCode} value={st.StatusCode}>
                      {st.StatusName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}