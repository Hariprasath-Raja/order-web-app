import React, { useState } from 'react';
import { Truck, CheckCircle, Store, ArrowRight, Minus, Plus, FolderPlus, PlusCircle, Trash2, ShoppingCart, X, ArrowLeft } from 'lucide-react';

const INITIAL_CATEGORIES = [
  { id: 'cat-rice', name: 'Rices (அரிசி வகைகள்)' },
  { id: 'cat-dhal', name: 'Dhall (பருப்பு வகைகள்)' },
  { id: 'cat-oils', name: 'Cooking Oils (எண்ணெய் வகைகள்)' }
];

const INITIAL_PRODUCTS = [
  { id: 1, categoryId: 'cat-rice', name: 'Ponni Boiled Rice', pricePerKg: 56 },
  { id: 2, categoryId: 'cat-rice', name: 'Basmati Classic', pricePerKg: 110 },
  { id: 3, categoryId: 'cat-rice', name: 'Jeera Samba Rice', pricePerKg: 95 },
  { id: 4, categoryId: 'cat-dhal', name: 'Green Gram (பாசிப் பருப்பு)', pricePerKg: 130 },
  { id: 5, categoryId: 'cat-dhal', name: 'Horse Gram (கொள்ளு)', pricePerKg: 78 },
  { id: 6, categoryId: 'cat-dhal', name: 'Toor Dal Premium', pricePerKg: 145 },
  { id: 7, categoryId: 'cat-oils', name: 'Refined Sunflower Oil', pricePerKg: 135 }
];

const INITIAL_SHOPS = [
  { id: 'S1', name: 'Sri Murugan Stores', owner: 'Murugan', phone: '9876543210', address: 'No 12, Bazaar St, North Gate', route: 'North Route' },
  { id: 'S2', name: 'Annai Maligai', owner: 'Selvam', phone: '9123456780', address: 'Plot 4, Market Main Rd, South Bazar', route: 'South Route' }
];

export default function App() {
  const [role, setRole] = useState('shop');
  const [categories, setCategories] = useState(INITIAL_CATEGORIES);
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [currentShop] = useState(INITIAL_SHOPS[0]);
  const [cartKg, setCartKg] = useState({});
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [orders, setOrders] = useState([]);
  const [orderSuccess, setOrderSuccess] = useState(false);

  // Agency form states
  const [newCatName, setNewCatName] = useState('');
  const [newProd, setNewProd] = useState({ categoryId: 'cat-rice', name: '', pricePerKg: '' });

  const handleAddCategory = (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setCategories([...categories, { id: `cat-${Date.now()}`, name: newCatName.trim() }]);
    setNewCatName('');
  };

  const handleAddProduct = (e) => {
    e.preventDefault();
    if (!newProd.name.trim() || !newProd.pricePerKg) return;
    setProducts([...products, {
      id: Date.now(),
      categoryId: newProd.categoryId,
      name: newProd.name.trim(),
      pricePerKg: Number(newProd.pricePerKg)
    }]);
    setNewProd({ categoryId: categories[0]?.id || '', name: '', pricePerKg: '' });
  };

  const handleDeleteProduct = (prodId) => {
    setProducts(products.filter(p => p.id !== prodId));
    setCartKg(prev => {
      const copy = { ...prev };
      delete copy[prodId];
      return copy;
    });
  };

  const handlePriceChange = (id, newPrice) => {
    setProducts(products.map(p => p.id === id ? { ...p, pricePerKg: Number(newPrice) || 0 } : p));
  };

  const setExactKg = (id, value) => {
    const kg = Math.max(0, parseInt(value, 10) || 0);
    setCartKg(prev => {
      const copy = { ...prev };
      if (kg === 0) delete copy[id];
      else copy[id] = kg;
      return copy;
    });
  };

  const adjustKg = (id, delta) => {
    const current = cartKg[id] || 0;
    setExactKg(id, current + delta);
  };

  const removeCartItem = (id) => {
    setCartKg(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  const totalWeightKg = Object.values(cartKg).reduce((sum, kg) => sum + kg, 0);
  const totalItemCount = Object.keys(cartKg).length;
  const totalAmount = Object.entries(cartKg).reduce((sum, [id, kg]) => {
    const prod = products.find(p => p.id === Number(id));
    return sum + (prod ? prod.pricePerKg * kg : 0);
  }, 0);

  const handlePlaceOrder = () => {
    if (totalWeightKg === 0) return;

    const newOrder = {
      id: `ORD-${Date.now().toString().slice(-4)}`,
      shopName: currentShop.name,
      address: currentShop.address,
      route: currentShop.route,
      items: Object.entries(cartKg).map(([id, kg]) => {
        const prod = products.find(p => p.id === Number(id));
        return {
          name: prod.name,
          weightKg: kg,
          lockedPricePerKg: prod.pricePerKg,
          lineTotal: prod.pricePerKg * kg
        };
      }),
      totalWeightKg,
      totalAmount,
      date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      payment: 'COD'
    };

    setOrders([newOrder, ...orders]);
    setCartKg({});
    setIsCartOpen(false);
    setOrderSuccess(true);
    setTimeout(() => setOrderSuccess(false), 4000);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-32">
      {/* Header */}
      <header className="bg-emerald-900 text-white sticky top-0 z-30 shadow px-3 py-2.5">
        <div className="max-w-md mx-auto flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="font-bold text-base leading-tight truncate flex items-center gap-1.5">
              <Store className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Shree Gowsik Agencies</span>
            </h1>
            <p className="text-[11px] text-emerald-200 truncate">1 Kg Wholesale Rates • COD Delivery</p>
          </div>

          <div className="flex items-center gap-2">
            {/* Top Cart Review Button (Shop View only) */}
            {role === 'shop' && (
              <button 
                onClick={() => setIsCartOpen(true)}
                className="relative bg-emerald-800 p-2 rounded-lg text-white active:bg-emerald-700 border border-emerald-700"
                aria-label="View Cart"
              >
                <ShoppingCart className="w-4 h-4" />
                {totalItemCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-amber-400 text-emerald-950 font-black text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                    {totalItemCount}
                  </span>
                )}
              </button>
            )}

            {/* View Switcher */}
            <div className="flex bg-emerald-950 p-1 rounded-lg shrink-0 border border-emerald-800">
              <button 
                onClick={() => setRole('shop')} 
                className={`px-2.5 py-1 text-xs font-semibold rounded transition ${role === 'shop' ? 'bg-white text-emerald-900 shadow' : 'text-emerald-300'}`}
              >
                Shop
              </button>
              <button 
                onClick={() => setRole('agency')} 
                className={`px-2.5 py-1 text-xs font-semibold rounded transition ${role === 'agency' ? 'bg-white text-emerald-900 shadow' : 'text-emerald-300'}`}
              >
                Admin
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* SHOP VIEW */}
      {role === 'shop' && (
        <main className="max-w-md mx-auto p-3 space-y-3">
          {/* Shop Card */}
          <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm flex items-start justify-between">
            <div>
              <span className="text-[10px] font-bold tracking-wider uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                Order Destination
              </span>
              <h2 className="font-bold text-sm text-slate-800 mt-1">{currentShop.name}</h2>
              <p className="text-xs text-slate-500 line-clamp-1">{currentShop.address}</p>
              <p className="text-[11px] text-slate-400">Route: {currentShop.route}</p>
            </div>
            <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-300 px-2.5 py-0.5 rounded-full">
              COD
            </span>
          </div>

          {orderSuccess && (
            <div className="bg-emerald-700 text-white p-3 rounded-xl shadow flex items-center gap-2.5 text-xs">
              <CheckCircle className="w-5 h-5 shrink-0 text-emerald-200" />
              <div>
                <p className="font-bold text-sm">Order Dispatched to Queue!</p>
                <p className="text-emerald-100">Agency will deliver your order via morning tempo.</p>
              </div>
            </div>
          )}

          {/* Categorized Catalog */}
          <div className="space-y-4">
            {categories.map((cat) => {
              const catProducts = products.filter(p => p.categoryId === cat.id);
              if (catProducts.length === 0) return null;

              return (
                <div key={cat.id} className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                    <h3 className="font-bold text-xs text-slate-700 uppercase tracking-wide">
                      {cat.name}
                    </h3>
                  </div>

                  <div className="space-y-2.5">
                    {catProducts.map((item, idx) => {
                      const currentKg = cartKg[item.id] || 0;
                      return (
                        <div key={item.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-2.5">
                          {/* Item Title and Price */}
                          <div className="flex justify-between items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-sm text-slate-800 leading-snug">
                                <span className="text-slate-400 font-normal mr-1">{idx + 1}.</span>
                                {item.name}
                              </p>
                              <p className="text-sm font-bold text-emerald-700 mt-0.5">
                                ₹{item.pricePerKg} <span className="text-xs font-normal text-slate-500">/ 1 kg</span>
                              </p>
                            </div>

                            {currentKg > 0 && (
                              <span className="shrink-0 text-xs font-bold text-emerald-900 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
                                ₹{(currentKg * item.pricePerKg).toLocaleString()}
                              </span>
                            )}
                          </div>

                          {/* Controls Row */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={() => adjustKg(item.id, -5)} 
                                className="h-8 px-2 rounded-md bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs active:bg-slate-200"
                              >
                                -5
                              </button>
                              <button 
                                onClick={() => adjustKg(item.id, -1)} 
                                className="w-8 h-8 rounded-md bg-slate-100 border border-slate-300 text-slate-700 flex items-center justify-center active:bg-slate-200"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="flex items-center border border-slate-300 rounded-md bg-white px-2 py-1">
                              <input 
                                type="number" 
                                min="0"
                                value={currentKg || ''} 
                                placeholder="0"
                                onChange={(e) => setExactKg(item.id, e.target.value)}
                                className="w-12 text-center font-bold text-sm focus:outline-none"
                              />
                              <span className="text-xs text-slate-400 font-medium">kg</span>
                            </div>

                            <div className="flex items-center gap-1">
                              <button 
                                onClick={() => adjustKg(item.id, 1)} 
                                className="w-8 h-8 rounded-md bg-emerald-700 text-white flex items-center justify-center active:bg-emerald-800 shadow-sm"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => adjustKg(item.id, 5)} 
                                className="h-8 px-2 rounded-md bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold text-xs active:bg-emerald-100"
                              >
                                +5
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Bar with "Review Cart" Button */}
          {totalWeightKg > 0 && (
            <div className="fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl z-20">
              <div className="max-w-md mx-auto flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
                    <Truck className="w-4 h-4 text-emerald-700" />
                    <span>Total Load: <strong className="text-slate-900">{totalWeightKg} kg</strong></span>
                  </div>
                  <div className="text-lg font-black text-emerald-800 leading-tight">₹{totalAmount.toLocaleString()}</div>
                </div>

                <button 
                  onClick={() => setIsCartOpen(true)}
                  className="bg-emerald-700 active:bg-emerald-800 text-white font-bold px-4 py-2.5 rounded-xl shadow-md flex items-center gap-2 text-sm shrink-0"
                >
                  <ShoppingCart className="w-4 h-4" /> Review Cart ({totalItemCount})
                </button>
              </div>
            </div>
          )}

          {/* SHOPKEEPER REVIEW CART MODAL / DRAWER */}
          {isCartOpen && (
            <div className="fixed inset-0 bg-black/60 z-50 flex flex-col justify-end">
              <div className="bg-white rounded-t-2xl max-w-md w-full mx-auto max-h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-200">
                
                {/* Cart Drawer Header */}
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setIsCartOpen(false)} className="p-1 rounded-full text-slate-500 hover:bg-slate-100">
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                      <h3 className="font-bold text-base text-slate-800">Review Order</h3>
                      <p className="text-xs text-slate-500">{totalItemCount} items selected</p>
                    </div>
                  </div>
                  <button onClick={() => setIsCartOpen(false)} className="text-slate-400 hover:text-slate-700 p-1">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Items List in Cart */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-slate-100">
                  {Object.entries(cartKg).length === 0 ? (
                    <div className="text-center py-10 text-slate-400 text-sm">
                      Your cart is empty. Add items from the catalog.
                    </div>
                  ) : (
                    Object.entries(cartKg).map(([id, kg]) => {
                      const prod = products.find(p => p.id === Number(id));
                      if (!prod) return null;
                      const lineTotal = prod.pricePerKg * kg;

                      return (
                        <div key={id} className="pt-3 first:pt-0 flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-sm text-slate-800 truncate">{prod.name}</h4>
                            <p className="text-xs text-slate-500">₹{prod.pricePerKg} / kg</p>
                            <p className="text-xs font-bold text-emerald-700 mt-0.5">₹{lineTotal.toLocaleString()}</p>
                          </div>

                          {/* Quick Adjuster inside Cart */}
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => adjustKg(prod.id, -1)}
                              className="w-7 h-7 bg-slate-100 border border-slate-300 rounded text-slate-700 flex items-center justify-center font-bold"
                            >
                              -
                            </button>
                            <span className="w-10 text-center font-bold text-xs text-slate-800">{kg} kg</span>
                            <button 
                              onClick={() => adjustKg(prod.id, 1)}
                              className="w-7 h-7 bg-emerald-700 text-white rounded flex items-center justify-center font-bold"
                            >
                              +
                            </button>
                            <button 
                              onClick={() => removeCartItem(prod.id)}
                              className="text-slate-300 hover:text-rose-600 ml-1.5 p-1"
                              title="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Bill Summary & Order Button */}
                {totalWeightKg > 0 && (
                  <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3">
                    <div className="space-y-1.5 text-xs text-slate-600">
                      <div className="flex justify-between">
                        <span>Total Load Weight</span>
                        <strong className="text-slate-800 font-bold">{totalWeightKg} kg</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Delivery Address</span>
                        <span className="text-slate-700 font-medium truncate max-w-[200px]">{currentShop.name} ({currentShop.route})</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Payment Terms</span>
                        <span className="text-amber-700 font-bold">Cash on Delivery (COD)</span>
                      </div>
                      <div className="border-t border-slate-200 pt-2 flex justify-between text-base font-black text-slate-900">
                        <span>Total Payable</span>
                        <span className="text-emerald-800">₹{totalAmount.toLocaleString()}</span>
                      </div>
                    </div>

                    <button 
                      onClick={handlePlaceOrder}
                      className="w-full bg-emerald-700 active:bg-emerald-800 text-white font-bold py-3 rounded-xl shadow flex items-center justify-center gap-2 text-sm"
                    >
                      Confirm & Place COD Order <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      )}

      {/* AGENCY ADMIN VIEW */}
      {role === 'agency' && (
        <main className="max-w-md md:max-w-2xl mx-auto p-3 space-y-4">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="font-bold text-sm text-slate-800">Agency Product & Price Manager</h2>
            <p className="text-xs text-slate-500">Configure catalog categories and weekly per-kg rates.</p>
          </div>

          {/* Add Category */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-2">
            <h3 className="font-bold text-xs text-slate-700 flex items-center gap-1.5">
              <FolderPlus className="w-4 h-4 text-emerald-700" /> New Category
            </h3>
            <form onSubmit={handleAddCategory} className="flex gap-2">
              <input 
                type="text" 
                placeholder="e.g. Spices (மசாலா)" 
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-emerald-700"
              />
              <button type="submit" className="bg-emerald-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold">
                + Add
              </button>
            </form>
          </div>

          {/* Add Product */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-2">
            <h3 className="font-bold text-xs text-slate-700 flex items-center gap-1.5">
              <PlusCircle className="w-4 h-4 text-emerald-700" /> New Product (Rate / 1 Kg)
            </h3>
            <form onSubmit={handleAddProduct} className="space-y-2">
              <div className="flex gap-2">
                <select 
                  value={newProd.categoryId} 
                  onChange={(e) => setNewProd({ ...newProd, categoryId: e.target.value })}
                  className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs bg-slate-50 w-2/5 truncate"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <input 
                  type="text" 
                  placeholder="Product name" 
                  value={newProd.name}
                  onChange={(e) => setNewProd({ ...newProd, name: e.target.value })}
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-emerald-700"
                />
              </div>
              <div className="flex gap-2">
                <input 
                  type="number" 
                  placeholder="Rate per 1 kg (₹)" 
                  value={newProd.pricePerKg}
                  onChange={(e) => setNewProd({ ...newProd, pricePerKg: e.target.value })}
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-emerald-700"
                />
                <button type="submit" className="bg-emerald-800 text-white px-4 py-1.5 rounded-lg text-xs font-bold">
                  Save Product
                </button>
              </div>
            </form>
          </div>

          {/* Catalog & Rate List */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="font-bold text-xs text-slate-700">Weekly 1 Kg Rates</h3>
            {categories.map(cat => {
              const catItems = products.filter(p => p.categoryId === cat.id);
              return (
                <div key={cat.id} className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-100 px-3 py-1.5 font-bold text-xs text-slate-700 uppercase flex justify-between">
                    <span>{cat.name}</span>
                    <span className="text-slate-400 font-normal">{catItems.length} items</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {catItems.map((prod, idx) => (
                      <div key={prod.id} className="p-2.5 flex items-center justify-between gap-2 text-xs">
                        <span className="font-medium text-slate-800 flex-1 truncate">
                          <span className="text-slate-400 mr-1">{idx + 1}.</span>
                          {prod.name}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400">₹</span>
                          <input 
                            type="number" 
                            value={prod.pricePerKg} 
                            onChange={(e) => handlePriceChange(prod.id, e.target.value)}
                            className="w-16 border border-slate-300 rounded px-1.5 py-1 font-bold text-center"
                          />
                        </div>
                        <button onClick={() => handleDeleteProduct(prod.id)} className="text-slate-400 hover:text-rose-600 p-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Received Orders */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-2.5">
            <h3 className="font-bold text-xs text-slate-700">Orders Received ({orders.length})</h3>
            {orders.length === 0 ? (
              <p className="text-xs text-slate-400 py-2 text-center">No orders yet.</p>
            ) : (
              orders.map(ord => (
                <div key={ord.id} className="border border-slate-200 rounded-lg p-2.5 bg-slate-50 text-xs space-y-1">
                  <div className="flex justify-between font-bold text-slate-800">
                    <span>{ord.shopName}</span>
                    <span className="text-emerald-700">₹{ord.totalAmount.toLocaleString()} (COD)</span>
                  </div>
                  <div className="text-slate-500 text-[11px] flex justify-between">
                    <span>{ord.route} • {ord.date}</span>
                    <span className="font-bold text-slate-700">{ord.totalWeightKg} kg load</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
      )}
    </div>
  );
}