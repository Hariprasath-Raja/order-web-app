import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function ShopPortal({ currentUser, onLogout }) {
  const [shopDetails, setShopDetails] = useState(null);
  const [agencies, setAgencies] = useState([]);
  const [selectedAgencyId, setSelectedAgencyId] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState({});
  const [loading, setLoading] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (currentUser?.UserId) {
      loadShopkeeperData();
    }
  }, [currentUser]);

  useEffect(() => {
    if (selectedAgencyId) {
      loadAgencyCatalog(selectedAgencyId);
    }
  }, [selectedAgencyId]);

  // Step 1: Fetch ShopDetails for this logged-in user and linked agencies
  const loadShopkeeperData = async () => {
    setLoading(true);
    setMessage('');
    try {
      // 1. Fetch ShopDetails for this user
      const { data: shop, error: shopErr } = await supabase
        .from('ShopDetails')
        .select('*')
        .eq('UserId', currentUser.UserId)
        .maybeSingle();

      if (shopErr) throw shopErr;

      if (!shop) {
        setMessage('No shop profile found linked to this account.');
        setLoading(false);
        return;
      }

      setShopDetails(shop);

      // 2. Fetch Mapped Agencies from AgencyShopMapping
      const { data: mappings, error: mapErr } = await supabase
        .from('AgencyShopMapping')
        .select('AgencyId, IsApproved')
        .eq('ShopId', shop.ShopId)
        .eq('IsApproved', true);

      let agencyList = [];
      if (!mapErr && mappings && mappings.length > 0) {
        const agencyIds = mappings.map((m) => m.AgencyId);

        // Fetch agency records directly
        const { data: agencyData, error: agErr } = await supabase
          .from('Agencies')
          .select('*')
          .in('AgencyId', agencyIds);

        if (!agErr && agencyData && agencyData.length > 0) {
          agencyList = agencyData;
        }
      }

      // Fallback: If mapping table has no approved entry, fetch primary agency
      if (agencyList.length === 0) {
        const { data: fallbackAgencies } = await supabase
          .from('Agencies')
          .select('*')
          .order('AgencyId', { ascending: true })
          .limit(1);

        if (fallbackAgencies && fallbackAgencies.length > 0) {
          agencyList = fallbackAgencies;
        }
      }

      setAgencies(agencyList);
      if (agencyList.length > 0) {
        setSelectedAgencyId(agencyList[0].AgencyId);
      }
    } catch (err) {
      console.error('Failed to load shopkeeper portal:', err);
      setMessage(`Error loading portal: ${err.message}`);
    }
    setLoading(false);
  };

  // Step 2: Load Products & Categories for Selected Agency
  const loadAgencyCatalog = async (agencyId) => {
    try {
      // 1. Fetch Categories for Agency
      const { data: catData } = await supabase
        .from('Categories')
        .select('*')
        .eq('AgencyId', agencyId)
        .order('CategoryName', { ascending: true });

      if (catData) setCategories(catData);

      // 2. Fetch Available Products
      const { data: prodData, error: prodErr } = await supabase
        .from('Products')
        .select(`
          *,
          Categories ( CategoryName ),
          UomMaster ( UomCode, UomName ),
          TaxSlabMaster ( TaxPercentage, SlabName )
        `)
        .eq('AgencyId', agencyId)
        .eq('IsAvailable', true)
        .order('ProductName', { ascending: true });

      if (prodErr) throw prodErr;
      setProducts(prodData || []);
      setCart({});
    } catch (err) {
      console.error('Catalog load error:', err);
    }
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

  // Calculations
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

  // Place Order as Shopkeeper
  const handlePlaceOrder = async () => {
    if (cartItems.length === 0 || !selectedAgencyId || !shopDetails) return;

    setPlacingOrder(true);
    setMessage('');

    try {
      const orderPayload = {
        AgencyId: selectedAgencyId,
        ShopUserId: currentUser.UserId,
        PaymentId: 1, // COD Default
        OrderStatus: 'ordered',
        SubTotal: parseFloat(subtotal.toFixed(2)),
        TotalTaxAmount: parseFloat(totalTax.toFixed(2)),
        TotalAmount: parseFloat(totalAmount.toFixed(2)),
        TotalWeightKg: parseFloat(totalWeight.toFixed(2)),
        ShopNameSnapshot: shopDetails.ShopName,
        OwnerNameSnapshot: shopDetails.OwnerName || shopDetails.ShopName,
        PhoneSnapshot: shopDetails.Phone || currentUser.Phone || '',
        AddressSnapshot: shopDetails.Address || '',
        RouteSnapshot: shopDetails.Route || 'Direct',
      };

      const { data: order, error: orderErr } = await supabase
        .from('Orders')
        .insert([orderPayload])
        .select()
        .single();

      if (orderErr) throw orderErr;

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
      if (itemsErr) throw itemsErr;

      setMessage(`✓ Order #${order.OrderId} placed successfully! Agency will process your delivery.`);
      setCart({});
    } catch (err) {
      setMessage(`Failed placing order: ${err.message}`);
    }
    setPlacingOrder(false);
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch = (p.ProductName || '')
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === 'ALL' || String(p.CategoryId) === String(selectedCategory);
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Top Header */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded font-mono text-[10px] font-bold">
                {shopDetails?.ShopCode || 'SHOP'}
              </span>
              <h1 className="text-base sm:text-lg font-extrabold text-slate-900">
                {shopDetails?.ShopName || 'Retail Store'}
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Route: {shopDetails?.Route || 'Direct'} • {shopDetails?.Address || '-'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {agencies.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600">Supplying Agency:</span>
                <select
                  value={selectedAgencyId || ''}
                  onChange={(e) => setSelectedAgencyId(parseInt(e.target.value, 10))}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                >
                  {agencies.map((ag) => (
                    <option key={ag.AgencyId} value={ag.AgencyId}>
                      {ag.AgencyName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Logout
              </button>
            )}
          </div>
        </div>

        {message && (
          <div className="p-3 bg-slate-900 text-white text-xs rounded-xl flex items-center justify-between shadow-xs">
            <span>{message}</span>
            <button type="button" onClick={() => setMessage('')} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
          </div>
        )}

        {/* Catalog & Cart Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Products */}
          <div className="lg:col-span-8 space-y-3">
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
              <input
                type="text"
                placeholder="Search products to order..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border border-slate-200 bg-slate-50/50 rounded-xl px-3.5 py-2 text-xs focus:bg-white focus:outline-none"
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
                {categories.map((c) => (
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
                    {c.CategoryName}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              {loading ? (
                <div className="py-16 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
                  Loading catalog...
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
                  No products available for this agency.
                </div>
              ) : (
                filteredProducts.map((p) => {
                  const currentQty = cart[p.ProductId]?.quantity || 0;
                  return (
                    <div
                      key={p.ProductId}
                      className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-3"
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
                          className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl border border-emerald-200 transition cursor-pointer"
                        >
                          + Add
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => updateQuantity(p, currentQty - 1)}
                            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-xs text-slate-700 flex items-center justify-center cursor-pointer"
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
                            className="w-7 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center cursor-pointer"
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

          {/* Right Column: Cart Summary */}
          <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 sticky top-6">
            <h3 className="text-sm font-extrabold text-slate-900">Your Order Cart</h3>

            <div className="border border-slate-100 rounded-xl overflow-hidden min-h-[140px]">
              {cartItems.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">Cart is empty</div>
              ) : (
                <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                  {cartItems.map(({ product, quantity }) => (
                    <div key={product.ProductId} className="p-3 flex items-center justify-between text-xs">
                      <div className="min-w-0 pr-2">
                        <p className="font-bold text-slate-800 truncate">{product.ProductName}</p>
                        <span className="text-[10px] text-slate-400">
                          {quantity} × ₹{product.BasePrice}
                        </span>
                      </div>
                      <span className="font-bold text-slate-900">
                        ₹{(quantity * parseFloat(product.BasePrice)).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 pt-3 space-y-2 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Total Items</span>
                <span className="font-bold text-slate-800">{totalUnits} units</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>GST Amount</span>
                <span className="text-emerald-700">+₹{totalTax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-slate-900 border-t border-slate-100 pt-2">
                <span>Grand Total</span>
                <span className="text-emerald-700">₹{totalAmount.toFixed(2)}</span>
              </div>
            </div>

            <button
              type="button"
              disabled={placingOrder || cartItems.length === 0}
              onClick={handlePlaceOrder}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl text-xs transition active:scale-95 shadow-sm cursor-pointer disabled:opacity-50"
            >
              {placingOrder ? 'Submitting Order...' : `Confirm Order (₹${totalAmount.toFixed(2)})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}