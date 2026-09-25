import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function AgencyProducts({ currentUser }) {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [uomList, setUomList] = useState([]);
  const [taxSlabs, setTaxSlabs] = useState([]);

  // Category State (Add / Edit)
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [catName, setCatName] = useState('');
  const [catOrder, setCatOrder] = useState(0);

  // Product State (Add / Edit)
  const [editingProductId, setEditingProductId] = useState(null);
  const [prodName, setProdName] = useState('');
  const [selectedCatId, setSelectedCatId] = useState('');
  const [selectedUomId, setSelectedUomId] = useState('');
  const [selectedTaxId, setSelectedTaxId] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);
  const [hsnCode, setHsnCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    // 1. Fetch Categories
    const { data: catData } = await supabase
      .from('Categories')
      .select('*')
      .order('DisplayOrder', { ascending: true });
    if (catData) setCategories(catData);

    // 2. Fetch Active UOMs
    const { data: uomData } = await supabase
      .from('UomMaster')
      .select('*')
      .eq('IsActive', true);
    if (uomData) setUomList(uomData);

    // 3. Fetch Active Tax Slabs
    const { data: taxData } = await supabase
      .from('TaxSlabMaster')
      .select('*')
      .eq('IsActive', true);
    if (taxData) setTaxSlabs(taxData);

    // 4. Fetch Products with joined relation
    const { data: prodData } = await supabase
      .from('Products')
      .select(`
        ProductId,
        ProductName,
        BasePrice,
        IsAvailable,
        HsnCode,
        CategoryId,
        UomId,
        TaxSlabId,
        Categories ( CategoryName ),
        UomMaster ( UomCode ),
        TaxSlabMaster ( SlabName, TaxPercentage )
      `)
      .order('ProductId', { ascending: false });
    if (prodData) setProducts(prodData);
  };

  // ---------------- CATEGORY HANDLERS ----------------
  const selectCategoryForEdit = (cat) => {
    setEditingCategoryId(cat.CategoryId);
    setCatName(cat.CategoryName);
    setCatOrder(cat.DisplayOrder || 0);
    setMessage('');
  };

  const cancelEditCategory = () => {
    setEditingCategoryId(null);
    setCatName('');
    setCatOrder(0);
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!catName.trim()) return;

    setLoading(true);
    setMessage('');

    if (editingCategoryId) {
      // Update Category
      const { error } = await supabase
        .from('Categories')
        .update({
          CategoryName: catName.trim(),
          DisplayOrder: parseInt(catOrder) || 0,
        })
        .eq('CategoryId', editingCategoryId);

      if (error) {
        setMessage(`Category Error: ${error.message}`);
      } else {
        cancelEditCategory();
        setMessage('Category updated successfully!');
        loadAllData();
      }
    } else {
      // Add Category
      const { error } = await supabase.from('Categories').insert([
        {
          CategoryName: catName.trim(),
          DisplayOrder: parseInt(catOrder) || 0,
          CreatedBy: currentUser?.UserId,
        },
      ]);

      if (error) {
        setMessage(`Category Error: ${error.message}`);
      } else {
        cancelEditCategory();
        setMessage('Category added successfully!');
        loadAllData();
      }
    }
    setLoading(false);
  };

  // ---------------- PRODUCT HANDLERS ----------------
  const selectProductForEdit = (item) => {
    setEditingProductId(item.ProductId);
    setProdName(item.ProductName);
    setSelectedCatId(item.CategoryId || '');
    setSelectedUomId(item.UomId || '');
    setSelectedTaxId(item.TaxSlabId || '');
    setBasePrice(item.BasePrice);
    setIsAvailable(item.IsAvailable !== false);
    setHsnCode(item.HsnCode || '');
    setMessage('');
  };

  const cancelEditProduct = () => {
    setEditingProductId(null);
    setProdName('');
    setSelectedCatId('');
    setSelectedUomId('');
    setSelectedTaxId('');
    setBasePrice('');
    setIsAvailable(true);
    setHsnCode('');
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!prodName.trim() || !selectedCatId || !selectedUomId || !selectedTaxId || !basePrice) {
      setMessage('Error: Please fill all required product fields');
      return;
    }

    setLoading(true);
    setMessage('');

    const currentPriceNum = parseFloat(basePrice);

    if (editingProductId) {
      const oldProd = products.find((p) => p.ProductId === editingProductId);
      const oldPriceNum = parseFloat(oldProd?.BasePrice || 0);

      const { error: updateError } = await supabase
        .from('Products')
        .update({
          ProductName: prodName.trim(),
          CategoryId: selectedCatId,
          UomId: selectedUomId,
          TaxSlabId: selectedTaxId,
          BasePrice: currentPriceNum,
          IsAvailable: isAvailable,
          HsnCode: hsnCode.trim() || null,
          UpdatedBy: currentUser?.UserId,
          UpdatedAt: new Date().toISOString(),
        })
        .eq('ProductId', editingProductId);

      if (updateError) {
        setMessage(`Error: ${updateError.message}`);
      } else {
        if (oldPriceNum !== currentPriceNum) {
          await supabase.from('ProductPriceLogs').insert([
            {
              ProductId: editingProductId,
              OldBasePrice: oldPriceNum,
              NewBasePrice: currentPriceNum,
              ChangedBy: currentUser?.UserId,
            },
          ]);
        }
        cancelEditProduct();
        setMessage('Product updated successfully!');
        loadAllData();
      }
    } else {
      const { error: insertError } = await supabase.from('Products').insert([
        {
          ProductName: prodName.trim(),
          CategoryId: selectedCatId,
          UomId: selectedUomId,
          TaxSlabId: selectedTaxId,
          BasePrice: currentPriceNum,
          IsAvailable: isAvailable,
          HsnCode: hsnCode.trim() || null,
          UpdatedBy: currentUser?.UserId,
        },
      ]);

      if (insertError) {
        setMessage(`Error: ${insertError.message}`);
      } else {
        cancelEditProduct();
        setMessage('Product added to catalog!');
        loadAllData();
      }
    }
    setLoading(false);
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-5">
      {/* Category Management Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              {editingCategoryId ? 'Edit Category' : 'Manage Categories'}
            </h3>
            <p className="text-[11px] text-slate-400">Click any category badge below to edit its name or order</p>
          </div>
          {editingCategoryId && (
            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full font-medium w-fit">
              Editing mode active
            </span>
          )}
        </div>

        {/* Category Add/Edit Form */}
        <form onSubmit={handleSaveCategory} className="flex flex-wrap items-center gap-2.5">
          <input
            type="text"
            placeholder="Category Name (e.g. Rice, Dhall, Spices)"
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
            required
          />
          <input
            type="number"
            placeholder="Order"
            title="Display priority order"
            value={catOrder}
            onChange={(e) => setCatOrder(e.target.value)}
            className="w-20 px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Saving...' : editingCategoryId ? 'Update Category' : '+ Add Category'}
          </button>
          {editingCategoryId && (
            <button
              type="button"
              onClick={cancelEditCategory}
              className="py-2 px-3 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
          )}
        </form>

        {/* Clickable Category Chips */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
          {categories.map((c) => {
            const isSelected = editingCategoryId === c.CategoryId;
            return (
              <button
                key={c.CategoryId}
                type="button"
                onClick={() => selectCategoryForEdit(c)}
                className={`px-3 py-1 text-xs rounded-xl font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-400 ring-offset-1'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                <span>{c.CategoryName}</span>
                <span className={`text-[10px] ${isSelected ? 'text-emerald-100' : 'text-slate-400'}`}>
                  #{c.DisplayOrder || 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {message && (
        <div
          className={`p-3 text-xs rounded-xl font-medium border ${
            message.startsWith('Error') || message.startsWith('Category Error')
              ? 'bg-rose-50 text-rose-600 border-rose-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}
        >
          {message}
        </div>
      )}

      {/* Main Grid: Product Form + Products List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* Product Form Card */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs h-fit">
          <h3 className="text-sm font-bold text-slate-800 mb-1">
            {editingProductId ? 'Edit Product Rate & Specs' : 'Add New Product'}
          </h3>
          <p className="text-[11px] text-slate-400 mb-4">
            {editingProductId ? 'Modify pricing, UOM or tax slab below' : 'Register wholesale item to catalog'}
          </p>

          <form onSubmit={handleSaveProduct} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Product Name *</label>
              <input
                type="text"
                placeholder="e.g. Ponni Boiled Rice (Deluxe)"
                value={prodName}
                onChange={(e) => setProdName(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Category *</label>
              <select
                value={selectedCatId}
                onChange={(e) => setSelectedCatId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none cursor-pointer"
                required
              >
                <option value="">-- Select Category --</option>
                {categories.map((c) => (
                  <option key={c.CategoryId} value={c.CategoryId}>
                    {c.CategoryName}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">UOM Unit *</label>
                <select
                  value={selectedUomId}
                  onChange={(e) => setSelectedUomId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none cursor-pointer"
                  required
                >
                  <option value="">-- Unit --</option>
                  {uomList.map((u) => (
                    <option key={u.UomId} value={u.UomId}>
                      {u.UomCode} ({u.UomName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">GST Slab *</label>
                <select
                  value={selectedTaxId}
                  onChange={(e) => setSelectedTaxId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none cursor-pointer"
                  required
                >
                  <option value="">-- Tax Slab --</option>
                  {taxSlabs.map((t) => (
                    <option key={t.TaxSlabId} value={t.TaxSlabId}>
                      {t.SlabName} ({t.TaxPercentage}%)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Base Price (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 54.00"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">HSN Code</label>
                <input
                  type="text"
                  placeholder="e.g. 1006"
                  value={hsnCode}
                  onChange={(e) => setHsnCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Availability Switch */}
            <div className="flex items-center justify-between py-2 border-t border-slate-100">
              <div>
                <span className="text-xs font-semibold text-slate-700 block">Stock Availability</span>
                <span className="text-[11px] text-slate-400">
                  {isAvailable ? 'Shops can place orders' : 'Marked as Out of Stock'}
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isAvailable}
                onClick={() => setIsAvailable(!isAvailable)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isAvailable ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isAvailable ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Saving...' : editingProductId ? 'Update Product' : '+ Add Product'}
              </button>
              {editingProductId && (
                <button
                  type="button"
                  onClick={cancelEditProduct}
                  className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Product Catalog Responsive List */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800">
                Agency Product Catalog
              </h3>
              <p className="text-[11px] text-slate-400">Click any card to edit rates or specs</p>
            </div>
            <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-xl">
              Total: {products.length}
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {products.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No products added yet. Use the form to register wholesale items.
              </div>
            ) : (
              products.map((p) => {
                const isOutOfStock = p.IsAvailable === false;
                const categoryName = p.Categories?.CategoryName;
                const uomCode = p.UomMaster?.UomCode || 'PCS';
                const taxPercent = p.TaxSlabMaster?.TaxPercentage ?? 0;

                return (
                  <div
                    key={p.ProductId}
                    onClick={() => selectProductForEdit(p)}
                    className="p-3.5 sm:p-4 hover:bg-slate-50/80 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 active:bg-slate-100/70"
                  >
                    {/* Left: Product Name, Category & GST */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs sm:text-sm text-slate-900 leading-tight">
                          {p.ProductName}
                        </span>
                        {categoryName && (
                          <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md whitespace-nowrap">
                            {categoryName}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                        <span>Tax: GST {taxPercent}%</span>
                        {p.HsnCode && (
                          <>
                            <span>•</span>
                            <span className="font-mono">HSN: {p.HsnCode}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Right: Price & Stock Badge */}
                    <div className="flex items-center justify-between sm:justify-end gap-3.5 pt-1.5 sm:pt-0 border-t border-slate-100/60 sm:border-0 shrink-0">
                      <div className="sm:text-right">
                        <div className="text-sm font-extrabold text-emerald-700 leading-tight">
                          ₹{p.BasePrice}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          per {uomCode}
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap shrink-0 border ${
                          isOutOfStock
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {isOutOfStock ? 'Out of Stock' : 'In Stock'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}