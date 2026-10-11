import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function AgencyProducts({ currentUser, selectedAgency }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [uoms, setUoms] = useState([]);
  const [taxSlabs, setTaxSlabs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Category Form State
  const [newCatName, setNewCatName] = useState('');
  const [newCatOrder, setNewCatOrder] = useState('0');
  const [catSubmitting, setCatSubmitting] = useState(false);

  // Edit / Add Mode State
  const [editingProduct, setEditingProduct] = useState(null);

  // Form Fields State
  const [productName, setProductName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [uomId, setUomId] = useState('');
  const [taxSlabId, setTaxSlabId] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [hsnCode, setHsnCode] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Filters State for Product List
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  useEffect(() => {
    fetchMasters();
  }, []);

  useEffect(() => {
    if (selectedAgency?.AgencyId) {
      fetchCategories();
      fetchProducts();
      resetForm();
    }
  }, [selectedAgency]);

  const fetchMasters = async () => {
    const { data: uomData } = await supabase
      .from('UomMaster')
      .select('*')
      .order('UomId', { ascending: true });
    if (uomData) setUoms(uomData);

    const { data: taxData } = await supabase
      .from('TaxSlabMaster')
      .select('*')
      .order('TaxSlabId', { ascending: true });
    if (taxData) setTaxSlabs(taxData);
  };

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('Categories')
      .select('*')
      .eq('AgencyId', selectedAgency.AgencyId)
      .order('CategoryId', { ascending: true });
    if (data) setCategories(data);
  };

  const fetchProducts = async () => {
    setLoading(true);
    setMessage('');
    const { data, error } = await supabase
      .from('Products')
      .select(`
        *,
        Categories ( CategoryName ),
        UomMaster ( UomCode, UomName ),
        TaxSlabMaster ( TaxPercentage, SlabName )
      `)
      .eq('AgencyId', selectedAgency.AgencyId)
      .order('ProductId', { ascending: false });

    if (error) {
      setMessage(`Fetch Error: ${error.message}`);
    } else if (data) {
      setProducts(data);
    }
    setLoading(false);
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    setCatSubmitting(true);
    const { data, error } = await supabase
      .from('Categories')
      .insert([
        {
          CategoryName: newCatName.trim(),
          AgencyId: selectedAgency.AgencyId,
        },
      ])
      .select()
      .single();

    if (!error && data) {
      setCategories((prev) => [...prev, data]);
      setNewCatName('');
      setNewCatOrder('0');
    } else {
      setMessage(`Category Failed: ${error?.message}`);
    }
    setCatSubmitting(false);
  };

  const handleSelectForEdit = (product) => {
    setEditingProduct(product);
    setProductName(product.ProductName || '');
    setCategoryId(product.CategoryId ? String(product.CategoryId) : '');
    setUomId(product.UomId ? String(product.UomId) : '');
    setTaxSlabId(product.TaxSlabId ? String(product.TaxSlabId) : '');
    setBasePrice(product.BasePrice !== null ? String(product.BasePrice) : '');
    setHsnCode(product.HsnCode || '');
    setIsAvailable(Boolean(product.IsAvailable));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setEditingProduct(null);
    setProductName('');
    setCategoryId('');
    setUomId('');
    setTaxSlabId('');
    setBasePrice('');
    setHsnCode('');
    setIsAvailable(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!productName.trim() || !basePrice) {
      setMessage('Product Name and Base Price are required.');
      return;
    }

    setSubmitting(true);
    setMessage('');

    const payload = {
      AgencyId: selectedAgency.AgencyId,
      CategoryId: categoryId ? parseInt(categoryId, 10) : null,
      ProductName: productName.trim(),
      HsnCode: hsnCode.trim() || null,
      BasePrice: parseFloat(basePrice),
      UomId: uomId ? parseInt(uomId, 10) : null,
      TaxSlabId: taxSlabId ? parseInt(taxSlabId, 10) : null,
      IsAvailable: isAvailable,
      DisplayOrder: 0,
    };

    if (editingProduct) {
      const { data, error } = await supabase
        .from('Products')
        .update(payload)
        .eq('ProductId', editingProduct.ProductId)
        .select(`
          *,
          Categories ( CategoryName ),
          UomMaster ( UomCode, UomName ),
          TaxSlabMaster ( TaxPercentage, SlabName )
        `)
        .single();

      if (error) {
        setMessage(`Failed to update product: ${error.message}`);
      } else if (data) {
        setProducts((prev) =>
          prev.map((p) => (p.ProductId === editingProduct.ProductId ? data : p))
        );
        setMessage('Product updated successfully!');
        resetForm();
      }
    } else {
      const { data, error } = await supabase
        .from('Products')
        .insert([payload])
        .select(`
          *,
          Categories ( CategoryName ),
          UomMaster ( UomCode, UomName ),
          TaxSlabMaster ( TaxPercentage, SlabName )
        `)
        .single();

      if (error) {
        setMessage(`Failed to add product: ${error.message}`);
      } else if (data) {
        setProducts((prev) => [data, ...prev]);
        setMessage('Product added successfully!');
        resetForm();
      }
    }
    setSubmitting(false);
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      (p.ProductName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.HsnCode || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      filterCategory === 'ALL' || String(p.CategoryId) === String(filterCategory);

    const matchesStatus =
      filterStatus === 'ALL' ||
      (filterStatus === 'ACTIVE' && p.IsAvailable) ||
      (filterStatus === 'INACTIVE' && !p.IsAvailable);

    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {message && (
        <div className="p-3 bg-slate-900 text-white text-xs rounded-xl flex items-center justify-between shadow-xs">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage('')} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* 1. TOP CATEGORY BAR */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <form onSubmit={handleAddCategory} className="flex flex-col sm:flex-row items-center gap-2.5">
          <input
            type="text"
            required
            placeholder="Category Name (e.g. Rice, Dhall, Spices)"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            className="flex-1 w-full border border-slate-300 rounded-xl px-4 py-2.5 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          />
          <input
            type="number"
            value={newCatOrder}
            onChange={(e) => setNewCatOrder(e.target.value)}
            className="w-full sm:w-16 border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-center text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          />
          <button
            type="submit"
            disabled={catSubmitting}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs rounded-xl whitespace-nowrap transition cursor-pointer disabled:opacity-50"
          >
            {catSubmitting ? 'Adding...' : '+ Add Category'}
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {categories.length === 0 ? (
            <span className="text-[11px] text-slate-400 italic">No categories created yet.</span>
          ) : (
            categories.map((cat, idx) => (
              <span
                key={cat.CategoryId}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100/90 text-slate-600 rounded-lg text-xs font-medium"
              >
                <span>{cat.CategoryName}</span>
                <span className="text-slate-400 text-[10px]">#{idx}</span>
              </span>
            ))
          )}
        </div>
      </div>

      {/* 2. MAIN 2-COLUMN SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* LEFT COLUMN: Add / Edit Product Form (Includes Availability Toggle) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 sticky top-20">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                {editingProduct ? `Edit Product #${editingProduct.ProductId}` : 'Add New Product'}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {editingProduct
                  ? 'Update rates, availability, or catalog specs'
                  : 'Register wholesale item to catalog'}
              </p>
            </div>
            {editingProduct && (
              <button
                type="button"
                onClick={resetForm}
                className="text-[11px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 cursor-pointer"
              >
                Cancel Edit
              </button>
            )}
          </div>

          <form onSubmit={handleSaveProduct} className="space-y-3.5 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Product Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Ponni Boiled Rice (Deluxe)"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Category *</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 cursor-pointer"
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
                <label className="block font-semibold text-slate-700 mb-1">UOM Unit *</label>
                <select
                  value={uomId}
                  onChange={(e) => setUomId(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 cursor-pointer"
                >
                  <option value="">-- Unit --</option>
                  {uoms.map((u) => (
                    <option key={u.UomId} value={u.UomId}>
                      {u.UomCode} ({u.UomName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">GST Slab *</label>
                <select
                  value={taxSlabId}
                  onChange={(e) => setTaxSlabId(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 cursor-pointer"
                >
                  <option value="">-- Tax Slab --</option>
                  {taxSlabs.map((t) => (
                    <option key={t.TaxSlabId} value={t.TaxSlabId}>
                      {t.SlabName || `${t.TaxPercentage}%`} ({t.TaxPercentage}%)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Base Price (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 54.00"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-700 font-mono placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">HSN Code</label>
                <input
                  type="text"
                  placeholder="e.g. 1006"
                  value={hsnCode}
                  onChange={(e) => setHsnCode(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-700 font-mono placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                />
              </div>
            </div>

            {/* iOS Green Toggle Switch in Form */}
            <div className="flex items-center justify-between pt-2">
              <div>
                <span className="block font-semibold text-slate-800 text-xs">Stock Availability</span>
                <span className="block text-[11px] text-slate-400">Shops can place orders</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isAvailable}
                onClick={() => setIsAvailable((prev) => !prev)}
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

            <button
              type="submit"
              disabled={submitting}
              className={`w-full py-2.5 mt-2 text-white font-bold rounded-xl text-xs transition active:scale-95 shadow-sm cursor-pointer disabled:opacity-50 ${
                editingProduct ? 'bg-slate-900 hover:bg-slate-800' : 'bg-emerald-600 hover:bg-emerald-500'
              }`}
            >
              {submitting
                ? 'Saving...'
                : editingProduct
                ? 'Update Product'
                : '+ Add Product'}
            </button>
          </form>
        </div>

        {/* RIGHT COLUMN: Agency Product Catalog (Clean List Grid without Toggle) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {/* Header & Filter Controls */}
          <div className="p-4 border-b border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                  Agency Product Catalog
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Click any record to edit rates or specs</p>
              </div>
              <span className="px-2.5 py-1 bg-slate-100 rounded-lg text-xs font-bold text-slate-600">
                Total: {filteredProducts.length}
              </span>
            </div>

            {/* Filter Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
              <input
                type="text"
                placeholder="🔍 Search name / HSN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border border-slate-200 bg-slate-50 rounded-xl px-3 py-1.5 text-xs focus:bg-white focus:outline-none"
              />

              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full border border-slate-200 bg-slate-50 rounded-xl px-2 py-1.5 text-xs focus:bg-white focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Categories</option>
                {categories.map((c) => (
                  <option key={c.CategoryId} value={c.CategoryId}>
                    {c.CategoryName}
                  </option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full border border-slate-200 bg-slate-50 rounded-xl px-2 py-1.5 text-xs focus:bg-white focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Available Only</option>
                <option value="INACTIVE">Out of Stock Only</option>
              </select>
            </div>
          </div>

          {/* List Table Grid (Clean Status Badge Only) */}
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/75 border-b border-slate-200/80 text-slate-500 uppercase font-bold text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Product Name</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3 text-right">Price</th>
                  <th className="py-2.5 px-3 text-right">GST</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="py-12 text-center text-xs text-slate-400">Loading catalog...</td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-12 text-center text-xs text-slate-400">
                      No matching products found.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => {
                    const isSelected = editingProduct?.ProductId === p.ProductId;

                    return (
                      <tr
                        key={p.ProductId}
                        onClick={() => handleSelectForEdit(p)}
                        className={`transition cursor-pointer select-none ${
                          isSelected
                            ? 'bg-emerald-50/70 border-l-4 border-l-emerald-600'
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="py-3 px-3">
                          <span className="font-bold text-slate-800 block truncate max-w-[180px]">
                            {p.ProductName}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {p.HsnCode ? `HSN ${p.HsnCode}` : `ID: #${p.ProductId}`}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-slate-600 truncate max-w-[120px]">
                          {p.Categories?.CategoryName || '-'}
                        </td>

                        <td className="py-3 px-3 text-right font-extrabold text-slate-900 whitespace-nowrap">
                          ₹{p.BasePrice}
                          <span className="text-[10px] font-normal text-slate-400 block">
                            /{p.UomMaster?.UomCode || 'Unit'}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-right font-medium text-emerald-700 whitespace-nowrap">
                          {p.TaxSlabMaster ? `${p.TaxSlabMaster.TaxPercentage}%` : '0%'}
                        </td>

                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              p.IsAvailable
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                          >
                            {p.IsAvailable ? 'Available' : 'Out of Stock'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}