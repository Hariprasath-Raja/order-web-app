import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function ShopPortal({ currentUser }) {
  const [activeTab, setActiveTab] = useState('catalog'); // 'catalog' or 'my_orders'
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [cart, setCart] = useState({});
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState(1);
  const [showCartDrawer, setShowCartDrawer] = useState(false);

  // My Orders State
  const [myOrders, setMyOrders] = useState([]);
  const [selectedOrderItems, setSelectedOrderItems] = useState([]);
  const [selectedOrderView, setSelectedOrderView] = useState(null);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    loadShopCatalog();
    fetchMyOrders();

    // Realtime listener: Agency status maathina udane update aagum
    const channel = supabase
      .channel('public:Orders:ShopOrders')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'Orders',
          filter: `ShopUserId=eq.${currentUser.UserId}`,
        },
        (payload) => {
          setMyOrders((prev) =>
            prev.map((o) => (o.OrderId === payload.new.OrderId ? { ...o, ...payload.new } : o))
          );
          if (selectedOrderView?.OrderId === payload.new.OrderId) {
            setSelectedOrderView((prev) => ({ ...prev, ...payload.new }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser.UserId]);

  const loadShopCatalog = async () => {
    const { data: catData } = await supabase
      .from('Categories')
      .select('*')
      .order('DisplayOrder', { ascending: true });
    if (catData) setCategories(catData);

    const { data: prodData, error: prodErr } = await supabase
      .from('Products')
      .select(`
        ProductId,
        ProductName,
        BasePrice,
        IsAvailable,
        CategoryId,
        HsnCode,
        UomMaster ( UomCode, UomName ),
        TaxSlabMaster ( TaxPercentage, CgstPercentage, SgstPercentage )
      `)
      .eq('IsAvailable', true)
      .order('ProductName', { ascending: true });

    if (prodErr) {
      setErrorMessage(`Failed to load catalog: ${prodErr.message}`);
    } else if (prodData) {
      setProducts(prodData);
    }

    const { data: payData } = await supabase
      .from('PaymentMaster')
      .select('*')
      .eq('IsActive', true);
    if (payData && payData.length > 0) {
      setPaymentMethods(payData);
      setSelectedPaymentId(payData[0].PaymentId);
    }
  };

  const fetchMyOrders = async () => {
    setLoadingOrders(true);
    const { data } = await supabase
      .from('Orders')
      .select(`
        *,
        PaymentMaster ( MethodName )
      `)
      .eq('ShopUserId', currentUser.UserId)
      .order('OrderId', { ascending: false });

    if (data) setMyOrders(data);
    setLoadingOrders(false);
  };

  const viewOrderItems = async (order) => {
    setSelectedOrderView(order);
    const { data } = await supabase
      .from('OrderItems')
      .select('*')
      .eq('OrderId', order.OrderId);
    if (data) setSelectedOrderItems(data);
  };

  const updateQuantity = (productId, delta) => {
    setCart((prev) => {
      const currentQty = prev[productId] || 0;
      const nextQty = Math.max(0, currentQty + delta);
      if (nextQty === 0) {
        const { [productId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [productId]: nextQty };
    });
  };

  const handleManualQuantity = (productId, value) => {
    const qty = parseFloat(value);
    setCart((prev) => {
      if (isNaN(qty) || qty <= 0) {
        const { [productId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [productId]: qty };
    });
  };

  const cartItemsList = Object.entries(cart).map(([productId, quantity]) => {
    const product = products.find((p) => p.ProductId === parseInt(productId));
    if (!product) return null;

    const basePrice = parseFloat(product.BasePrice) || 0;
    const cgstRate = parseFloat(product.TaxSlabMaster?.CgstPercentage) || 0;
    const sgstRate = parseFloat(product.TaxSlabMaster?.SgstPercentage) || 0;
    const taxRate = parseFloat(product.TaxSlabMaster?.TaxPercentage) || (cgstRate + sgstRate);

    const itemBaseTotal = basePrice * quantity;
    const itemCgst = (itemBaseTotal * cgstRate) / 100;
    const itemSgst = (itemBaseTotal * sgstRate) / 100;
    const itemTotalTax = itemCgst + itemSgst;
    const itemLineTotal = itemBaseTotal + itemTotalTax;

    return {
      product,
      quantity,
      basePrice,
      taxRate,
      cgstRate,
      sgstRate,
      itemBaseTotal,
      itemCgst,
      itemSgst,
      itemTotalTax,
      itemLineTotal,
    };
  }).filter(Boolean);

  const subTotal = cartItemsList.reduce((sum, item) => sum + item.itemBaseTotal, 0);
  const totalTaxAmount = cartItemsList.reduce((sum, item) => sum + item.itemTotalTax, 0);
  const grandTotal = subTotal + totalTaxAmount;
  const totalItemsCount = cartItemsList.reduce((sum, item) => sum + item.quantity, 0);

  const handlePlaceOrder = async () => {
    if (cartItemsList.length === 0) return;

    setIsSubmitting(true);
    setErrorMessage('');
    setOrderSuccess(null);

    try {
      const shopData = Array.isArray(currentUser?.ShopDetails)
        ? currentUser.ShopDetails[0]
        : currentUser?.ShopDetails;

      const contactPhone = currentUser?.Phone || '9600791919';
      const calculatedWeight = cartItemsList.reduce((sum, item) => sum + Number(item.quantity), 0);

      const { data: newOrder, error: orderError } = await supabase
        .from('Orders')
        .insert([
          {
            ShopUserId: currentUser.UserId,
            ShopNameSnapshot: shopData?.ShopName || 'Sri Murugan Stores',
            OwnerNameSnapshot: shopData?.OwnerName || 'Murugan',
            PhoneSnapshot: contactPhone,
            RouteSnapshot: shopData?.Route || 'Default Route',
            AddressSnapshot: shopData?.Address || 'Main Road',
            TotalWeightKg: calculatedWeight.toFixed(2),
            SubTotal: subTotal.toFixed(2),
            TotalTaxAmount: totalTaxAmount.toFixed(2),
            TotalAmount: grandTotal.toFixed(2),
            PaymentId: selectedPaymentId,
            OrderStatus: 'ordered',
          },
        ])
        .select()
        .single();

      if (orderError || !newOrder) {
        throw new Error(orderError?.message || 'Order initialization failed.');
      }

      const orderItemsPayload = cartItemsList.map((item) => ({
        OrderId: newOrder.OrderId,
        ProductId: item.product.ProductId,
        ProductNameSnapshot: item.product.ProductName,
        Quantity: item.quantity,
        WeightKg: Number(item.quantity).toFixed(2),
        PricePerKgSnapshot: item.basePrice.toFixed(2),
        UnitPriceSnapshot: item.basePrice.toFixed(2),
        UomCodeSnapshot: item.product.UomMaster?.UomCode || 'KG',
        TaxPercentageSnapshot: item.taxRate.toFixed(2),
        CgstAmount: item.itemCgst.toFixed(2),
        SgstAmount: item.itemSgst.toFixed(2),
        LineTotal: item.itemLineTotal.toFixed(2),
      }));

      const { error: itemsError } = await supabase
        .from('OrderItems')
        .insert(orderItemsPayload);

      if (itemsError) throw new Error(itemsError.message);

      setCart({});
      setShowCartDrawer(false);
      setOrderSuccess(`Order #${newOrder.OrderId} placed successfully! Amount: ₹${grandTotal.toFixed(2)}`);
      fetchMyOrders();
    } catch (err) {
      setErrorMessage(`Order Failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ordered':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            Order Placed (Waiting)
          </span>
        );
      case 'accepted':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Accepted (Dispatching)
          </span>
        );
      case 'denied':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            Denied (Cancelled)
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  const filteredProducts = selectedCategory === 'ALL'
    ? products
    : products.filter((p) => p.CategoryId === parseInt(selectedCategory));

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-32">
      {/* Top Header & Section Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Retail Store Portal</span>
          <h2 className="text-base font-extrabold text-slate-800">
            {activeTab === 'catalog' ? 'Wholesale Grocery Catalog' : 'My Orders & Live Status'}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Catalog / My Orders Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab('catalog')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                activeTab === 'catalog' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📦 Order Items
            </button>
            <button
              onClick={() => {
                setActiveTab('my_orders');
                fetchMyOrders();
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'my_orders' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>📋 My Orders</span>
              {myOrders.length > 0 && (
                <span className="bg-slate-200 text-slate-800 text-[10px] px-1.5 py-0.2 rounded-full font-extrabold">
                  {myOrders.length}
                </span>
              )}
            </button>
          </div>

          {activeTab === 'catalog' && (
            <button
              onClick={() => setShowCartDrawer(true)}
              className="relative flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold shadow transition active:scale-95"
            >
              <span>🛒 Cart</span>
              <span className="bg-emerald-500 text-white px-1.5 py-0.2 rounded-full text-[10px] font-extrabold">
                {totalItemsCount}
              </span>
            </button>
          )}
        </div>
      </div>

      {orderSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs font-semibold flex items-center justify-between">
          <span>✅ {orderSuccess}</span>
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setActiveTab('my_orders')}
              className="underline font-bold text-emerald-900 hover:text-emerald-700"
            >
              Track Order ➔
            </button>
            <button onClick={() => setOrderSuccess(null)} className="text-slate-500 font-bold ml-2">✕</button>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl text-rose-700 text-xs font-semibold">
          ⚠️ {errorMessage}
        </div>
      )}

      {/* TAB 1: CATALOG SCREEN */}
      {activeTab === 'catalog' && (
        <>
          {/* Category Horizontal Filter Chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                selectedCategory === 'ALL'
                  ? 'bg-slate-900 text-white shadow'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              All Items ({products.length})
            </button>
            {categories.map((c) => (
              <button
                key={c.CategoryId}
                onClick={() => setSelectedCategory(c.CategoryId)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  selectedCategory === c.CategoryId
                    ? 'bg-slate-900 text-white shadow'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {c.CategoryName}
              </button>
            ))}
          </div>

          {/* Products List Cards */}
          <div className="space-y-3">
            {filteredProducts.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
                No products available in this category.
              </div>
            ) : (
              filteredProducts.map((prod) => {
                const qty = cart[prod.ProductId] || 0;
                const uomCode = prod.UomMaster?.UomCode || 'Unit';
                const taxPct = prod.TaxSlabMaster?.TaxPercentage || 0;

                return (
                  <div
                    key={prod.ProductId}
                    className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">{prod.ProductName}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-bold text-emerald-700">₹{prod.BasePrice}</span>
                        <span className="text-[11px] text-slate-400">/ {uomCode}</span>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                          GST {taxPct}%
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {qty === 0 ? (
                        <button
                          onClick={() => updateQuantity(prod.ProductId, 1)}
                          className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 font-bold text-xs rounded-xl transition active:scale-95"
                        >
                          + Add
                        </button>
                      ) : (
                        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                          <button
                            onClick={() => updateQuantity(prod.ProductId, -1)}
                            className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center font-bold text-slate-700 hover:bg-slate-50 transition"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={qty}
                            onChange={(e) => handleManualQuantity(prod.ProductId, e.target.value)}
                            className="w-12 text-center bg-transparent font-bold text-xs text-slate-800 focus:outline-none"
                          />
                          <button
                            onClick={() => updateQuantity(prod.ProductId, 1)}
                            className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center font-bold text-slate-700 hover:bg-slate-50 transition"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* TAB 2: MY ORDERS SCREEN (Live Status Tracking) */}
      {activeTab === 'my_orders' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Live Status updates automatically without refresh</span>
            <button
              onClick={fetchMyOrders}
              className="text-xs font-bold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-sm"
            >
              🔄 Refresh List
            </button>
          </div>

          {loadingOrders ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
              Loading orders...
            </div>
          ) : myOrders.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
              No orders placed yet. Add items from the catalog tab to create your first order!
            </div>
          ) : (
            myOrders.map((ord) => (
              <div
                key={ord.OrderId}
                className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-sm text-slate-800">#{ord.OrderId}</span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(ord.CreatedAt).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">
                    <span>Total Weight: <strong className="text-slate-700">{ord.TotalWeightKg} KG</strong></span>
                    <span className="mx-2">•</span>
                    <span>Payment: <strong className="text-slate-700">{ord.PaymentMaster?.MethodName || 'COD'}</strong></span>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                  <div className="text-left sm:text-right">
                    <span className="text-base font-black text-slate-900 block">₹{ord.TotalAmount}</span>
                    <span className="text-[10px] text-emerald-600 block">(GST: ₹{ord.TotalTaxAmount})</span>
                  </div>

                  {/* Status Pill Badge */}
                  <div>{getStatusBadge(ord.OrderStatus)}</div>

                  <button
                    onClick={() => viewOrderItems(ord)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition active:scale-95"
                  >
                    View Items ➔
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Floating Bottom Bar (Catalog Only) */}
      {activeTab === 'catalog' && cartItemsList.length > 0 && !showCartDrawer && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl p-4 z-40">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 block font-medium">
                {cartItemsList.length} items ({totalItemsCount} units selected)
              </span>
              <span className="text-xl font-extrabold text-slate-900">
                ₹{grandTotal.toFixed(2)}
              </span>
            </div>

            <button
              onClick={() => setShowCartDrawer(true)}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition active:scale-95 flex items-center gap-2"
            >
              <span>Review & Place Order</span>
              <span>➔</span>
            </button>
          </div>
        </div>
      )}

      {/* Cart Drawer Modal */}
      {showCartDrawer && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex justify-end">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col p-6 animate-in slide-in-from-right">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-base text-slate-800">Order Verification</h3>
                <p className="text-[11px] text-slate-400">Review line items & taxes before placing order</p>
              </div>
              <button
                onClick={() => setShowCartDrawer(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 py-3">
              {cartItemsList.length === 0 ? (
                <div className="text-center py-20 text-xs text-slate-400">
                  Your cart is empty.
                </div>
              ) : (
                cartItemsList.map((item) => (
                  <div key={item.product.ProductId} className="py-3 flex justify-between items-center text-xs">
                    <div>
                      <p className="font-bold text-slate-800">{item.product.ProductName}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Base: ₹{item.basePrice} × {item.quantity} {item.product.UomMaster?.UomCode}
                      </p>
                      <p className="text-[10px] text-emerald-600 font-medium mt-0.5">
                        GST ({item.taxRate}%): ₹{item.itemTotalTax.toFixed(2)}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                        <button
                          onClick={() => updateQuantity(item.product.ProductId, -1)}
                          className="w-6 h-6 bg-white rounded flex items-center justify-center font-bold text-slate-700 text-xs"
                        >
                          -
                        </button>
                        <span className="w-8 text-center font-bold text-xs">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product.ProductId, 1)}
                          className="w-6 h-6 bg-white rounded flex items-center justify-center font-bold text-slate-700 text-xs"
                        >
                          +
                        </button>
                      </div>
                      <span className="font-extrabold text-slate-900 text-xs w-16 text-right">
                        ₹{item.itemLineTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cartItemsList.length > 0 && (
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Taxable Base Value</span>
                    <span>₹{subTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>CGST (Central Tax)</span>
                    <span>₹{(totalTaxAmount / 2).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>SGST (State Tax)</span>
                    <span>₹{(totalTaxAmount / 2).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-base font-extrabold text-slate-900 pt-2 border-t border-slate-100">
                    <span>Final Payable Bill</span>
                    <span className="text-emerald-700">₹{grandTotal.toFixed(2)}</span>
                  </div>
                </div>

                <div className="pt-2">
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                    Payment Mode
                  </label>
                  <select
                    value={selectedPaymentId}
                    onChange={(e) => setSelectedPaymentId(parseInt(e.target.value))}
                    className="w-full text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 focus:outline-none"
                  >
                    {paymentMethods.map((p) => (
                      <option key={p.PaymentId} value={p.PaymentId}>
                        {p.MethodName}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handlePlaceOrder}
                  disabled={isSubmitting}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-lg transition active:scale-95 disabled:opacity-50 mt-2"
                >
                  {isSubmitting ? 'Submitting to Agency...' : `Confirm Wholesale Order (₹${grandTotal.toFixed(2)}) ➔`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Past Order Details Drawer (Items Receipt) */}
      {selectedOrderView && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex justify-end">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col p-6 animate-in slide-in-from-right">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-base text-slate-800">
                  Order #{selectedOrderView.OrderId} Summary
                </h3>
                <span className="text-xs text-slate-400">
                  Placed on {new Date(selectedOrderView.CreatedAt).toLocaleDateString()}
                </span>
              </div>
              <button
                onClick={() => setSelectedOrderView(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="py-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Current Status:</span>
                {getStatusBadge(selectedOrderView.OrderStatus)}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 py-2">
              {selectedOrderItems.map((it) => (
                <div key={it.OrderItemId} className="py-2.5 flex justify-between items-center text-xs">
                  <div>
                    <p className="font-bold text-slate-800">{it.ProductNameSnapshot}</p>
                    <p className="text-[11px] text-slate-400">
                      ₹{it.UnitPriceSnapshot} × {it.Quantity} {it.UomCodeSnapshot}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-slate-900 block">₹{it.LineTotal}</span>
                    <span className="text-[10px] text-slate-400">GST: {it.TaxPercentageSnapshot}%</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span>₹{selectedOrderView.SubTotal}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Total GST</span>
                <span>₹{selectedOrderView.TotalTaxAmount}</span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-slate-900 pt-2 border-t border-slate-100">
                <span>Total Bill</span>
                <span className="text-emerald-700">₹{selectedOrderView.TotalAmount}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}