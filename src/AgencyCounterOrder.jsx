import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function AgencyCounterOrder({ currentUser, selectedAgency }) {
  // Shops State
  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [shopSearchQuery, setShopSearchQuery] = useState('');
  const [isShopDropdownOpen, setIsShopDropdownOpen] = useState(false);

  // Products & Categories State
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [cart, setCart] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  // Payment Methods State
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState(null);

  useEffect(() => {
    fetchPaymentMethods();
  }, []);

  useEffect(() => {
    if (selectedAgency?.AgencyId) {
      fetchShops();
      fetchCategories();
      fetchProducts();
      setCart({});
    }
  }, [selectedAgency]);

  const fetchShops = async () => {
    if (!selectedAgency?.AgencyId) return;

    try {
      const { data: mappings, error: mapErr } = await supabase
        .from('AgencyShopMapping')
        .select('ShopId')
        .eq('AgencyId', selectedAgency.AgencyId)
        .eq('IsApproved', true);

      let fetchedShops = [];

      if (!mapErr && mappings && mappings.length > 0) {
        const shopIds = mappings.map((m) => m.ShopId);
        const { data: mappedShopData } = await supabase
          .from('ShopDetails')
          .select('*, Users ( Phone )')
          .in('ShopId', shopIds)
          .order('ShopName', { ascending: true });

        if (mappedShopData && mappedShopData.length > 0) {
          fetchedShops = mappedShopData;
        }
      }

      if (fetchedShops.length === 0) {
        const { data: allShops } = await supabase
          .from('ShopDetails')
          .select('*, Users ( Phone )')
          .order('ShopName', { ascending: true });
        if (allShops) fetchedShops = allShops;
      }

      setShops(fetchedShops);

      if (fetchedShops.length > 0) {
        setSelectedShop(fetchedShops[0]);
      } else {
        setSelectedShop(null);
      }
    } catch (err) {
      console.error('Error loading shops:', err);
    }
  };

  const fetchPaymentMethods = async () => {
    const { data } = await supabase.from('PaymentMaster').select('*');
    if (data && data.length > 0) {
      setPaymentMethods(data);
      const firstId = data[0].PaymentId || data[0].PaymentMethodId || 1;
      setSelectedPaymentId(firstId);
    } else {
      setSelectedPaymentId(1);
    }
  };

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('Categories')
      .select('*')
      .eq('AgencyId', selectedAgency.AgencyId)
      .order('CategoryName', { ascending: true });
    if (data) setCategories(data);
  };

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('Products')
      .select(`
        *,
        Categories ( CategoryName ),
        UomMaster ( UomCode, UomName ),
        TaxSlabMaster ( TaxPercentage, SlabName )
      `)
      .eq('AgencyId', selectedAgency.AgencyId)
      .eq('IsAvailable', true)
      .order('ProductName', { ascending: true });

    if (!error && data) {
      setProducts(data);
    }
    setLoading(false);
  };

  const updateQuantity = (product, qty) => {
    const num = Math.max(0, parseFloat(qty) || 0);
    setCart((prev) => {
      const next = { ...prev };
      if (num === 0) {
        delete next[product.ProductId];
      } else {
        next[product.ProductId] = { product, quantity: num };
      }
      return next;
    });
  };

  const handleSelectShop = (shop) => {
    setSelectedShop(shop);
    setShopSearchQuery('');
    setIsShopDropdownOpen(false);
    setMessage('');
  };

  // Cart Calculations
  const cartItems = Object.values(cart);
  const totalUnits = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalWeight = cartItems.reduce(
    (sum, item) =>
      sum + (item.product.UomMaster?.UomCode === 'KG' ? item.quantity : 0),
    0
  );
  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.quantity * parseFloat(item.product.BasePrice || 0),
    0
  );
  const totalTax = cartItems.reduce((sum, item) => {
    const itemSub = item.quantity * parseFloat(item.product.BasePrice || 0);
    const taxRate = parseFloat(item.product.TaxSlabMaster?.TaxPercentage || 0) / 100;
    return sum + itemSub * taxRate;
  }, 0);
  const totalAmount = subtotal + totalTax;

  // STRICT ORDER PLACEMENT
  const handlePlaceOrder = async () => {
    if (cartItems.length === 0 || !selectedAgency?.AgencyId) return;

    if (!selectedShop || !selectedShop.UserId) {
      setMessage('Please select a valid registered shopkeeper with an active account.');
      return;
    }

    setSubmitting(true);
    setMessage('');

    const shopOwnerName =
      selectedShop.OwnerName || selectedShop.ShopName || 'Shopkeeper';
    const shopPhone =
      selectedShop.Phone ||
      selectedShop.Users?.Phone ||
      '';
    const shopAddress = selectedShop.Address || '';
    const shopRoute = selectedShop.Route || 'Direct Route';

    // 1. Insert into Orders Table
    const orderPayload = {
      AgencyId: selectedAgency.AgencyId,
      ShopUserId: selectedShop.UserId,
      PaymentId: selectedPaymentId ? parseInt(selectedPaymentId, 10) : 1,
      OrderStatus: 'accepted',
      SubTotal: parseFloat(subtotal.toFixed(2)),
      TotalTaxAmount: parseFloat(totalTax.toFixed(2)),
      TotalAmount: parseFloat(totalAmount.toFixed(2)),
      TotalWeightKg: parseFloat(totalWeight.toFixed(2)),
      ShopNameSnapshot: selectedShop.ShopName,
      OwnerNameSnapshot: shopOwnerName,
      PhoneSnapshot: shopPhone,
      AddressSnapshot: shopAddress,
      RouteSnapshot: shopRoute,
    };

    const { data: order, error: orderErr } = await supabase
      .from('Orders')
      .insert([orderPayload])
      .select()
      .single();

    if (orderErr) {
      setMessage(`Order Placement Failed: ${orderErr.message}`);
      setSubmitting(false);
      return;
    }

    // 2. Prepare and Insert OrderItems
    const itemsDbPayload = cartItems.map((item) => {
      const isKg = item.product.UomMaster?.UomCode === 'KG';
      const itemSub = item.quantity * parseFloat(item.product.BasePrice || 0);
      const taxRate = parseFloat(item.product.TaxSlabMaster?.TaxPercentage || 0) / 100;
      const taxAmt = itemSub * taxRate;
      const unitPrice = parseFloat(item.product.BasePrice || 0);

      return {
        OrderId: order.OrderId,
        ProductId: item.product.ProductId,
        ProductNameSnapshot: item.product.ProductName,
        WeightKg: isKg ? parseFloat(item.quantity) : 0,
        PricePerKgSnapshot: isKg ? unitPrice : 0,
        Quantity: parseFloat(item.quantity),
        UnitPriceSnapshot: unitPrice,
        UomCodeSnapshot: item.product.UomMaster?.UomCode || 'Unit',
        TaxPercentageSnapshot: parseFloat(item.product.TaxSlabMaster?.TaxPercentage || 0),
        CgstAmount: parseFloat((taxAmt / 2).toFixed(2)),
        SgstAmount: parseFloat((taxAmt / 2).toFixed(2)),
        LineTotal: parseFloat((itemSub + taxAmt).toFixed(2)),
      };
    });

    const { error: itemsErr } = await supabase.from('OrderItems').insert(itemsDbPayload);

    if (itemsErr) {
      setMessage(`Order created, but items failed: ${itemsErr.message}`);
    } else {
      setMessage(`✓ Order #${order.OrderId} placed successfully for ${selectedShop.ShopName}!`);
      setCart({});
    }
    setSubmitting(false);
  };

  const filteredShops = shops.filter((s) => {
    const q = shopSearchQuery.toLowerCase();
    const code = (s.ShopCode || '').toLowerCase();
    const name = (s.ShopName || '').toLowerCase();
    const owner = (s.OwnerName || '').toLowerCase();
    const phone = (s.Phone || s.Users?.Phone || '').toLowerCase();
    const route = (s.Route || '').toLowerCase();
    return code.includes(q) || name.includes(q) || owner.includes(q) || phone.includes(q) || route.includes(q);
  });

  const filteredProducts = products.filter((p) => {
    const matchesSearch = (p.ProductName || '')
      .toLowerCase()
      .includes(productSearchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === 'ALL' || String(p.CategoryId) === String(selectedCategory);
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4">
      {message && (
        <div className="p-3 bg-emerald-900 text-white text-xs rounded-xl flex items-center justify-between shadow-xs">
          <span className="font-semibold">{message}</span>
          <button type="button" onClick={() => setMessage('')} className="text-slate-300 hover:text-white cursor-pointer">✕</button>
        </div>
      )}

      {/* TOP HEADER & SEARCH */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
              Direct Customer Billing (Counter / Tele Order)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Quickly search shopkeepers by Shop Code (max 7 chars), Name, Phone, or Route
            </p>
          </div>

          {selectedShop ? (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-slate-800 shrink-0">
              {selectedShop.ShopCode && (
                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-mono text-[11px] font-bold">
                  {selectedShop.ShopCode}
                </span>
              )}
              <span className="font-bold">{selectedShop.ShopName}</span>
              <span className="text-emerald-700 text-[11px]">
                ({selectedShop.Route || 'Direct Route'})
              </span>
            </div>
          ) : (
            <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold">
              ⚠️ No Shop Selected
            </span>
          )}
        </div>

        <div className="relative">
          <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50/50 focus-within:bg-white focus-within:ring-2 focus-within:ring-slate-900/10 focus-within:border-slate-300 transition">
            <span className="text-slate-400">🏪</span>
            <input
              type="text"
              placeholder="Search by Shop Code (e.g. SLM01), Shop Name, Owner, Phone or Route..."
              value={shopSearchQuery}
              onFocus={() => setIsShopDropdownOpen(true)}
              onChange={(e) => {
                setShopSearchQuery(e.target.value);
                setIsShopDropdownOpen(true);
              }}
              className="w-full text-xs text-slate-700 placeholder:text-slate-400 bg-transparent focus:outline-none"
            />
            {shopSearchQuery && (
              <button
                type="button"
                onClick={() => setShopSearchQuery('')}
                className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {isShopDropdownOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setIsShopDropdownOpen(false)} />
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 max-h-64 overflow-y-auto divide-y divide-slate-100">
                {filteredShops.length === 0 ? (
                  <div className="p-3 text-center text-xs text-slate-400">
                    No matching associated shopkeepers found
                  </div>
                ) : (
                  filteredShops.map((s) => (
                    <div
                      key={s.ShopId}
                      onClick={() => handleSelectShop(s)}
                      className={`p-3 text-xs flex items-center justify-between hover:bg-slate-50 cursor-pointer transition ${
                        selectedShop?.ShopId === s.ShopId ? 'bg-emerald-50/60' : ''
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          {s.ShopCode && (
                            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 font-mono text-[10px] font-bold rounded">
                              {s.ShopCode}
                            </span>
                          )}
                          <span className="font-bold text-slate-800 truncate">{s.ShopName}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                          {s.OwnerName || 'Owner'} • {s.Phone || s.Users?.Phone || 'No Phone'}
                        </p>
                      </div>
                      <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 shrink-0">
                        {s.Route || 'Direct'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* MAIN 2-COLUMN SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: Products */}
        <div className="lg:col-span-7 space-y-3">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <input
              type="text"
              placeholder="Search products by name..."
              value={productSearchQuery}
              onChange={(e) => setProductSearchQuery(e.target.value)}
              className="w-full border border-slate-200 bg-slate-50/50 rounded-xl px-3.5 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />

            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer ${
                  selectedCategory === 'ALL'
                    ? 'bg-slate-950 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All ({products.length})
              </button>
              {categories.map((c) => {
                const count = products.filter((p) => p.CategoryId === c.CategoryId).length;
                return (
                  <button
                    key={c.CategoryId}
                    type="button"
                    onClick={() => setSelectedCategory(c.CategoryId)}
                    className={`px-3 py-1.5 rounded-xl font-semibold transition whitespace-nowrap cursor-pointer ${
                      selectedCategory === c.CategoryId
                        ? 'bg-slate-950 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {c.CategoryName} {count > 0 && `(${count})`}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            {loading ? (
              <div className="py-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200/80">
                Loading products...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200/80">
                No products found in this category.
              </div>
            ) : (
              filteredProducts.map((p) => {
                const currentQty = cart[p.ProductId]?.quantity || 0;
                return (
                  <div
                    key={p.ProductId}
                    className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-3 hover:border-slate-300 transition"
                  >
                    <div>
                      <h4 className="font-extrabold text-xs text-slate-800">{p.ProductName}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm font-extrabold text-slate-900">
                          ₹{p.BasePrice}{' '}
                          <span className="text-[11px] font-normal text-slate-400 font-sans">
                            / {p.UomMaster?.UomCode || 'Unit'}
                          </span>
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                          GST {p.TaxSlabMaster ? `${p.TaxSlabMaster.TaxPercentage}%` : '0%'}
                        </span>
                      </div>
                    </div>

                    {currentQty === 0 ? (
                      <button
                        type="button"
                        onClick={() => updateQuantity(p, 1)}
                        className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl border border-emerald-200 transition cursor-pointer active:scale-95"
                      >
                        + Add
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateQuantity(p, currentQty - 1)}
                          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-xs text-slate-700 flex items-center justify-center cursor-pointer select-none"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={currentQty}
                          onChange={(e) => updateQuantity(p, e.target.value)}
                          className="w-12 text-center font-bold text-xs border border-slate-200 rounded-lg py-1 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => updateQuantity(p, currentQty + 1)}
                          className="w-7 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center cursor-pointer select-none"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Order Summary */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 sticky top-20">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Order Summary</h3>
            {selectedShop ? (
              <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                Billed to:{' '}
                <span className="font-bold text-slate-800">{selectedShop.ShopName}</span>{' '}
                {selectedShop.ShopCode && (
                  <span className="px-1 py-0.5 bg-slate-100 rounded text-[10px] font-mono text-slate-600 font-bold">
                    {selectedShop.ShopCode}
                  </span>
                )}{' '}
                <span className="text-emerald-700">
                  ({selectedShop.Route || 'Direct Route'})
                </span>
              </p>
            ) : (
              <p className="text-[11px] text-rose-500 mt-0.5 font-bold">
                Please search & select a shop above to bill
              </p>
            )}
          </div>

          <div className="border border-slate-100 rounded-xl overflow-hidden min-h-[140px]">
            {cartItems.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Cart is empty. Select products from left.
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                {cartItems.map(({ product, quantity }) => (
                  <div key={product.ProductId} className="p-3 flex items-center justify-between text-xs">
                    <div className="min-w-0 pr-2">
                      <p className="font-bold text-slate-800 truncate">{product.ProductName}</p>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {quantity} {product.UomMaster?.UomCode || 'Unit'} × ₹{product.BasePrice}
                      </span>
                    </div>
                    <span className="font-extrabold text-slate-900 whitespace-nowrap">
                      ₹{(quantity * parseFloat(product.BasePrice)).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 pt-3 space-y-2 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>Items Count / Weight</span>
              <span className="font-mono font-bold text-slate-700">
                {totalUnits} units ({totalWeight.toFixed(2)} KG)
              </span>
            </div>

            <div className="flex justify-between text-slate-500">
              <span>Taxable Subtotal</span>
              <span className="font-mono">₹{subtotal.toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-slate-500">
              <span>Estimated GST</span>
              <span className="font-mono text-emerald-700">+₹{totalTax.toFixed(2)}</span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Payment Method</label>
              <select
                value={selectedPaymentId || ''}
                onChange={(e) => setSelectedPaymentId(e.target.value)}
                className="w-full border border-slate-200 bg-slate-50 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none cursor-pointer"
              >
                {paymentMethods.length > 0 ? (
                  paymentMethods.map((pm) => (
                    <option key={pm.PaymentId || pm.PaymentMethodId} value={pm.PaymentId || pm.PaymentMethodId}>
                      {pm.MethodName || pm.PaymentMethod || 'COD'}
                    </option>
                  ))
                ) : (
                  <option value={1}>Cash on Delivery (COD)</option>
                )}
              </select>
            </div>

            <div className="flex justify-between text-base font-extrabold text-slate-900 border-t border-slate-100 pt-2.5">
              <span>Grand Total</span>
              <span className="text-emerald-700">₹{totalAmount.toFixed(2)}</span>
            </div>
          </div>

          <button
            type="button"
            disabled={submitting || cartItems.length === 0 || !selectedShop}
            onClick={handlePlaceOrder}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl text-xs transition active:scale-95 shadow-sm cursor-pointer disabled:opacity-50"
          >
            {submitting ? 'Placing Order...' : `Place Order (₹${totalAmount.toFixed(2)})`}
          </button>
        </div>
      </div>
    </div>
  );
}