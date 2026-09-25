import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Icons } from './Icons';

export default function AgencyCounterOrder({ currentUser }) {
  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [productSearch, setProductSearch] = useState('');

  const [cart, setCart] = useState({});
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState(1);
  const [orderStatus, setOrderStatus] = useState('accepted');

  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);

    const { data: shopsData } = await supabase
      .from('ShopDetails')
      .select(`
        ShopId,
        ShopCode,
        ShopName,
        OwnerName,
        Route,
        Address,
        Users!inner ( UserId, Phone, IsActive )
      `)
      .eq('Users.IsActive', true)
      .order('ShopId', { ascending: true });

    if (shopsData) {
      setShops(shopsData);
      if (shopsData.length > 0) setSelectedShop(shopsData[0]);
    }

    const { data: catData } = await supabase
      .from('Categories')
      .select('*')
      .order('DisplayOrder', { ascending: true });
    if (catData) setCategories(catData);

    const { data: prodData } = await supabase
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
    if (prodData) setProducts(prodData);

    const { data: payData } = await supabase
      .from('PaymentMaster')
      .select('*')
      .eq('IsActive', true);
    if (payData && payData.length > 0) {
      setPaymentMethods(payData);
      setSelectedPaymentId(payData[0].PaymentId);
    }

    setLoading(false);
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

  const handlePlaceCounterOrder = async () => {
    if (!selectedShop) {
      setErrorMessage('Please select a customer/retail store.');
      return;
    }
    if (cartItemsList.length === 0) {
      setErrorMessage('Cart is empty. Add at least one item.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setOrderSuccess(null);

    try {
      const calculatedWeight = cartItemsList.reduce((sum, item) => sum + Number(item.quantity), 0);

      const { data: newOrder, error: orderError } = await supabase
        .from('Orders')
        .insert([
          {
            ShopUserId: selectedShop.Users.UserId,
            ShopNameSnapshot: selectedShop.ShopName,
            OwnerNameSnapshot: selectedShop.OwnerName || selectedShop.ShopName,
            PhoneSnapshot: selectedShop.Users.Phone,
            RouteSnapshot: selectedShop.Route || 'Direct Dispatch',
            AddressSnapshot: selectedShop.Address || 'Direct Dispatch',
            TotalWeightKg: calculatedWeight.toFixed(2),
            SubTotal: subTotal.toFixed(2),
            TotalTaxAmount: totalTaxAmount.toFixed(2),
            TotalAmount: grandTotal.toFixed(2),
            PaymentId: selectedPaymentId,
            OrderStatus: orderStatus,
          },
        ])
        .select()
        .single();

      if (orderError || !newOrder) throw new Error(orderError?.message || 'Failed to initialize order.');

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
      setOrderSuccess(`Order #${newOrder.OrderId} created for "${selectedShop.ShopName}" [${selectedShop.ShopCode || 'SHP-' + selectedShop.ShopId}]! Bill: ₹${grandTotal.toFixed(2)}`);
    } catch (err) {
      setErrorMessage(`Billing Failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredShops = shops.filter((s) => {
    const q = customerSearch.toLowerCase();
    const code = (s.ShopCode || `SHP-${s.ShopId}`).toLowerCase();
    const name = s.ShopName.toLowerCase();
    const owner = (s.OwnerName || '').toLowerCase();
    const phone = (s.Users?.Phone || '').toLowerCase();
    const route = (s.Route || '').toLowerCase();

    return code.includes(q) || name.includes(q) || owner.includes(q) || phone.includes(q) || route.includes(q);
  });

  const filteredProducts = products.filter((p) => {
    const matchCat = selectedCategory === 'ALL' || p.CategoryId === parseInt(selectedCategory);
    const matchSearch = p.ProductName.toLowerCase().includes(productSearch.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Top Header & Search Toolbar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-800">Direct Customer Billing (Counter / Tele Order)</h2>
            <p className="text-xs text-slate-500">Quickly search shopkeepers by Shop Code (max 7 chars), Name, Phone, or Route</p>
          </div>

          {selectedShop && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
              <span className="font-mono text-xs font-black text-emerald-800 bg-emerald-200/60 px-2 py-0.5 rounded">
                {selectedShop.ShopCode || `SHP-${selectedShop.ShopId}`}
              </span>
              <span className="font-bold text-emerald-950 text-xs">{selectedShop.ShopName}</span>
              <span className="text-[11px] text-emerald-700">({selectedShop.Route})</span>
            </div>
          )}
        </div>

        {/* Customer Search Box */}
        <div className="relative">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 focus-within:bg-white focus-within:border-slate-500 transition">
            <Icons.Store className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search by Shop Code (e.g. SLM01), Shop Name, Owner, Phone or Route..."
              value={customerSearch}
              onFocus={() => setIsCustomerDropdownOpen(true)}
              onChange={(e) => {
                setCustomerSearch(e.target.value);
                setIsCustomerDropdownOpen(true);
              }}
              className="w-full bg-transparent text-xs font-semibold text-slate-800 focus:outline-none"
            />
            {customerSearch && (
              <button
                type="button"
                onClick={() => setCustomerSearch('')}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <Icons.Close className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Interactive Customer Dropdown Results */}
          {isCustomerDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setIsCustomerDropdownOpen(false)}
              />
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-64 overflow-y-auto divide-y divide-slate-100 z-40">
                {filteredShops.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    No matching customer found.
                  </div>
                ) : (
                  filteredShops.map((s) => {
                    const shopDisplayCode = s.ShopCode || `SHP-${s.ShopId}`;
                    const isCurrent = selectedShop?.ShopId === s.ShopId;
                    return (
                      <div
                        key={s.ShopId}
                        onClick={() => {
                          setSelectedShop(s);
                          setIsCustomerDropdownOpen(false);
                          setCustomerSearch('');
                        }}
                        className={`p-3 flex items-center justify-between cursor-pointer transition ${
                          isCurrent ? 'bg-blue-50/80 font-bold' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs font-black px-2 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-200/80">
                            {shopDisplayCode}
                          </span>
                          <div>
                            <span className="text-xs text-slate-800 font-bold block">{s.ShopName}</span>
                            <span className="text-[11px] text-slate-500 font-normal">
                              {s.OwnerName || '-'} • 📞 {s.Users?.Phone}
                            </span>
                          </div>
                        </div>

                        <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold">
                          {s.Route}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {orderSuccess && (
        <div className="flex items-center justify-between p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium">
          <div className="flex items-center gap-2">
            <Icons.Check className="w-4 h-4 text-emerald-600" />
            <span>{orderSuccess}</span>
          </div>
          <button onClick={() => setOrderSuccess(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
            <Icons.Close className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-2 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
          <Icons.Alert className="w-4 h-4 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Split Grid: Left Catalog, Right Order Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: PRODUCT SELECTION */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search products by name..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:bg-white focus:outline-none transition"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  selectedCategory === 'ALL'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All ({products.length})
              </button>
              {categories.map((c) => (
                <button
                  type="button"
                  key={c.CategoryId}
                  onClick={() => setSelectedCategory(c.CategoryId)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                    selectedCategory === c.CategoryId
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {c.CategoryName}
                </button>
              ))}
            </div>
          </div>

          {/* Product Items List */}
          <div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-1">
            {loading ? (
              <div className="bg-white p-12 rounded-2xl text-center text-xs text-slate-400">Loading catalog...</div>
            ) : filteredProducts.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl text-center text-xs text-slate-400">No products match search.</div>
            ) : (
              filteredProducts.map((prod) => {
                const qty = cart[prod.ProductId] || 0;
                const uomCode = prod.UomMaster?.UomCode || 'KG';
                const taxPct = prod.TaxSlabMaster?.TaxPercentage || 0;

                return (
                  <div
                    key={prod.ProductId}
                    className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between hover:border-slate-300 transition"
                  >
                    <div>
                      <h4 className="font-bold text-slate-800 text-xs">{prod.ProductName}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-extrabold text-emerald-700">₹{prod.BasePrice}</span>
                        <span className="text-[11px] text-slate-400">/ {uomCode}</span>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium">
                          GST {taxPct}%
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {qty === 0 ? (
                        <button
                          type="button"
                          onClick={() => updateQuantity(prod.ProductId, 1)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-xs rounded-lg transition active:scale-95 cursor-pointer"
                        >
                          <Icons.Plus className="w-3 h-3" />
                          <span>Add</span>
                        </button>
                      ) : (
                        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                          <button
                            type="button"
                            onClick={() => updateQuantity(prod.ProductId, -1)}
                            className="w-6 h-6 bg-white rounded shadow-xs flex items-center justify-center font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                          >
                            <Icons.Minus className="w-2.5 h-2.5" />
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={qty}
                            onChange={(e) => handleManualQuantity(prod.ProductId, e.target.value)}
                            className="w-10 text-center bg-transparent font-bold text-xs text-slate-800 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => updateQuantity(prod.ProductId, 1)}
                            className="w-6 h-6 bg-white rounded shadow-xs flex items-center justify-center font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                          >
                            <Icons.Plus className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: ORDER INVOICE REVIEW & DISPATCH */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs h-fit space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="font-extrabold text-slate-800 text-sm">Order Summary</h3>
            {selectedShop ? (
              <p className="text-xs text-slate-500 mt-1">
                Billed to: <strong className="text-slate-800">{selectedShop.ShopName}</strong>{' '}
                <span className="font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded font-bold text-slate-700 border border-slate-200/80">
                  {selectedShop.ShopCode || `SHP-${selectedShop.ShopId}`}
                </span>{' '}
                ({selectedShop.Route})
              </p>
            ) : (
              <p className="text-xs text-rose-500 mt-0.5">Please select a customer above</p>
            )}
          </div>

          {/* Cart Itemized List */}
          <div className="space-y-2 max-h-[260px] overflow-y-auto divide-y divide-slate-100 pr-1">
            {cartItemsList.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">Cart is empty. Select products from left.</div>
            ) : (
              cartItemsList.map((item) => (
                <div key={item.product.ProductId} className="pt-2 flex justify-between items-center text-xs">
                  <div>
                    <span className="font-bold text-slate-800 block">{item.product.ProductName}</span>
                    <span className="text-[11px] text-slate-400">
                      ₹{item.basePrice} × {item.quantity} {item.product.UomMaster?.UomCode} (+GST {item.taxRate}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-xs">₹{item.itemLineTotal.toFixed(2)}</span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.product.ProductId, -item.quantity)}
                      className="text-slate-400 hover:text-rose-600 transition cursor-pointer"
                    >
                      <Icons.Close className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Bill Calculation Details */}
          <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>Items Count / Weight</span>
              <span className="font-semibold text-slate-700">{totalItemsCount} units ({totalItemsCount} KG)</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Taxable Base Subtotal</span>
              <span>₹{subTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Total GST (CGST + SGST)</span>
              <span>₹{totalTaxAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-2 border-t border-slate-100">
              <span>Final Bill Amount</span>
              <span className="text-emerald-700">₹{grandTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment & Order Status Control */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Payment</label>
              <select
                value={selectedPaymentId}
                onChange={(e) => setSelectedPaymentId(parseInt(e.target.value))}
                className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none cursor-pointer"
              >
                {paymentMethods.map((p) => (
                  <option key={p.PaymentId} value={p.PaymentId}>
                    {p.MethodName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Initial Status</label>
              <select
                value={orderStatus}
                onChange={(e) => setOrderStatus(e.target.value)}
                className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none cursor-pointer"
              >
                <option value="accepted">Accepted (Ready)</option>
                <option value="ordered">Ordered (Pending)</option>
              </select>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="button"
            onClick={handlePlaceCounterOrder}
            disabled={isSubmitting || cartItemsList.length === 0}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            <span>{isSubmitting ? 'Creating Order...' : `Confirm & Place Order (₹${grandTotal.toFixed(2)})`}</span>
            <Icons.ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}