import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Icons } from './Icons';

export default function AgencyConfig() {
  const [activeTab, setActiveTab] = useState('uom'); // 'uom' or 'tax'
  const [uoms, setUoms] = useState([]);
  const [taxSlabs, setTaxSlabs] = useState([]);

  // UOM Form State
  const [uomCode, setUomCode] = useState('');
  const [uomName, setUomName] = useState('');
  const [isUomActive, setIsUomActive] = useState(true);
  const [editingUomId, setEditingUomId] = useState(null);

  // Tax Slab Form State
  const [slabName, setSlabName] = useState('');
  const [taxPct, setTaxPct] = useState('');
  const [isTaxActive, setIsTaxActive] = useState(true);
  const [editingTaxId, setEditingTaxId] = useState(null);

  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchUoms();
    fetchTaxSlabs();
  }, []);

  const fetchUoms = async () => {
    const { data } = await supabase
      .from('UomMaster')
      .select('*')
      .order('UomId', { ascending: true });
    if (data) setUoms(data);
  };

  const fetchTaxSlabs = async () => {
    const { data } = await supabase
      .from('TaxSlabMaster')
      .select('*')
      .order('TaxSlabId', { ascending: true });
    if (data) setTaxSlabs(data);
  };

  const resetUomForm = () => {
    setEditingUomId(null);
    setUomCode('');
    setUomName('');
    setIsUomActive(true);
  };

  const resetTaxForm = () => {
    setEditingTaxId(null);
    setSlabName('');
    setTaxPct('');
    setIsTaxActive(true);
  };

  const handleSaveUom = async (e) => {
    e.preventDefault();
    if (!uomCode.trim() || !uomName.trim()) return;

    if (editingUomId) {
      const { error } = await supabase
        .from('UomMaster')
        .update({
          UomCode: uomCode.trim().toUpperCase(),
          UomName: uomName.trim(),
          IsActive: isUomActive,
        })
        .eq('UomId', editingUomId);

      if (error) setMessage(`Error: ${error.message}`);
      else {
        setMessage('UOM updated successfully!');
        resetUomForm();
        fetchUoms();
      }
    } else {
      const { error } = await supabase.from('UomMaster').insert([
        {
          UomCode: uomCode.trim().toUpperCase(),
          UomName: uomName.trim(),
          IsActive: isUomActive,
        },
      ]);

      if (error) setMessage(`Error: ${error.message}`);
      else {
        setMessage('UOM created successfully!');
        resetUomForm();
        fetchUoms();
      }
    }
  };

  const handleSaveTax = async (e) => {
    e.preventDefault();
    const rate = parseFloat(taxPct);
    if (!slabName.trim() || isNaN(rate)) return;

    const half = rate / 2;

    if (editingTaxId) {
      const { error } = await supabase
        .from('TaxSlabMaster')
        .update({
          SlabName: slabName.trim(),
          TaxPercentage: rate,
          CgstPercentage: half,
          SgstPercentage: half,
          IsActive: isTaxActive,
        })
        .eq('TaxSlabId', editingTaxId);

      if (error) setMessage(`Error: ${error.message}`);
      else {
        setMessage('Tax Slab updated successfully!');
        resetTaxForm();
        fetchTaxSlabs();
      }
    } else {
      const { error } = await supabase.from('TaxSlabMaster').insert([
        {
          SlabName: slabName.trim(),
          TaxPercentage: rate,
          CgstPercentage: half,
          SgstPercentage: half,
          IsActive: isTaxActive,
        },
      ]);

      if (error) setMessage(`Error: ${error.message}`);
      else {
        setMessage('Tax Slab created successfully!');
        resetTaxForm();
        fetchTaxSlabs();
      }
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Header & Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-base font-extrabold text-slate-800">Master Configurations</h2>
          <p className="text-xs text-slate-500">Manage billing units of measurement and GST tax slabs</p>
        </div>

        {/* Navigation Sub-Tabs with hand pointer */}
        <div className="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => {
              setActiveTab('uom');
              setMessage('');
              resetUomForm();
            }}
            className={`flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'uom'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Icons.Scale className="w-3.5 h-3.5" />
            <span>Units of Measurement (UOM)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('tax');
              setMessage('');
              resetTaxForm();
            }}
            className={`flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'tax'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Icons.Percent className="w-3.5 h-3.5" />
            <span>Tax Slabs (GST)</span>
          </button>
        </div>
      </div>

      {message && (
        <div className="flex items-center gap-2 p-3 text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-medium">
          <Icons.Check className="w-4 h-4 text-emerald-600" />
          <span>{message}</span>
        </div>
      )}

      {/* SECTION 1: UOM CONFIG */}
      {activeTab === 'uom' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* UOM Form */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs h-fit">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                  {editingUomId ? <Icons.Edit /> : <Icons.Plus />}
                </span>
                <h3 className="text-xs font-bold tracking-wide uppercase text-slate-700">
                  {editingUomId ? 'Edit Unit' : 'Add New Unit'}
                </h3>
              </div>

              {editingUomId && (
                <button
                  type="button"
                  onClick={resetUomForm}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-xs font-semibold shadow-xs transition active:scale-95 cursor-pointer"
                >
                  <Icons.Close />
                  <span>Cancel</span>
                </button>
              )}
            </div>

            <form onSubmit={handleSaveUom} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Code</label>
                <input
                  type="text"
                  placeholder="e.g. TIN, CTN, LTR"
                  value={uomCode}
                  onChange={(e) => setUomCode(e.target.value.toUpperCase())}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 uppercase focus:bg-white focus:border-slate-400 focus:outline-none transition font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Tin (15L), Carton"
                  value={uomName}
                  onChange={(e) => setUomName(e.target.value)}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:bg-white focus:border-slate-400 focus:outline-none transition"
                  required
                />
              </div>

              {/* Status Switch */}
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                <div>
                  <span className="font-semibold text-slate-700 block">Status</span>
                  <span className="text-[11px] text-slate-500">
                    {isUomActive ? 'Available in product selection' : 'Disabled from selection'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsUomActive(!isUomActive)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ${
                    isUomActive ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <div className="bg-white w-4 h-4 rounded-full shadow-xs transform" />
                </button>
              </div>

              <button
                type="submit"
                className={`flex items-center justify-center gap-1.5 w-full py-2.5 text-white font-bold rounded-xl shadow-xs transition active:scale-95 cursor-pointer ${
                  editingUomId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {!editingUomId && <Icons.Plus className="w-3.5 h-3.5" />}
                <span>{editingUomId ? 'Update UOM' : 'Add UOM'}</span>
              </button>
            </form>
          </div>

          {/* UOM List */}
          <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Configured Units</h3>
                <p className="text-[11px] text-slate-400">Click any row to load into form</p>
              </div>
              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                Total: {uoms.length}
              </span>
            </div>

            <div className="divide-y divide-slate-100 overflow-y-auto">
              {uoms.map((u) => {
                const isSelected = editingUomId === u.UomId;
                return (
                  <div
                    key={u.UomId}
                    onClick={() => {
                      setEditingUomId(u.UomId);
                      setUomCode(u.UomCode);
                      setUomName(u.UomName);
                      setIsUomActive(u.IsActive);
                    }}
                    className={`group p-3.5 flex items-center justify-between cursor-pointer select-none transition ${
                      isSelected
                        ? 'bg-blue-50/80 ring-2 ring-inset ring-blue-500/50'
                        : 'hover:bg-slate-50/70'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-7 rounded-lg bg-slate-100 border border-slate-200/80 flex items-center justify-center font-mono font-bold text-slate-700 text-xs">
                        {u.UomCode}
                      </span>
                      <span className="font-semibold text-slate-800 text-xs">{u.UomName}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          u.IsActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${u.IsActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        {u.IsActive ? 'Active' : 'Inactive'}
                      </span>
                      <span className="opacity-0 group-hover:opacity-100 text-blue-600 transition-opacity">
                        <Icons.Edit />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: TAX SLABS CONFIG */}
      {activeTab === 'tax' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Tax Slab Form */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs h-fit">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                  {editingTaxId ? <Icons.Edit /> : <Icons.Plus />}
                </span>
                <h3 className="text-xs font-bold tracking-wide uppercase text-slate-700">
                  {editingTaxId ? 'Edit Tax Slab' : 'Add Tax Slab'}
                </h3>
              </div>

              {editingTaxId && (
                <button
                  type="button"
                  onClick={resetTaxForm}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-xs font-semibold shadow-xs transition active:scale-95 cursor-pointer"
                >
                  <Icons.Close />
                  <span>Cancel</span>
                </button>
              )}
            </div>

            <form onSubmit={handleSaveTax} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Slab Name</label>
                <input
                  type="text"
                  placeholder="e.g. GST 5%, GST 18%"
                  value={slabName}
                  onChange={(e) => setSlabName(e.target.value)}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:bg-white focus:border-slate-400 focus:outline-none transition"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Total GST %</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 5, 12, 18"
                  value={taxPct}
                  onChange={(e) => setTaxPct(e.target.value)}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-mono focus:bg-white focus:border-slate-400 focus:outline-none transition"
                  required
                />
                {taxPct && !isNaN(parseFloat(taxPct)) && (
                  <p className="text-[11px] text-emerald-600 mt-1 font-medium">
                    Split: CGST {(parseFloat(taxPct) / 2).toFixed(2)}% + SGST {(parseFloat(taxPct) / 2).toFixed(2)}%
                  </p>
                )}
              </div>

              {/* Status Switch */}
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                <div>
                  <span className="font-semibold text-slate-700 block">Status</span>
                  <span className="text-[11px] text-slate-500">
                    {isTaxActive ? 'Available in product billing' : 'Disabled from selection'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTaxActive(!isTaxActive)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ${
                    isTaxActive ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <div className="bg-white w-4 h-4 rounded-full shadow-xs transform" />
                </button>
              </div>

              <button
                type="submit"
                className={`flex items-center justify-center gap-1.5 w-full py-2.5 text-white font-bold rounded-xl shadow-xs transition active:scale-95 cursor-pointer ${
                  editingTaxId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {!editingTaxId && <Icons.Plus className="w-3.5 h-3.5" />}
                <span>{editingTaxId ? 'Update Slab' : 'Add Tax Slab'}</span>
              </button>
            </form>
          </div>

          {/* Tax Slabs List */}
          <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
              <div>
                <h3 className="text-sm font-bold text-slate-800">GST Tax Slabs</h3>
                <p className="text-[11px] text-slate-400">Click any row to load into form</p>
              </div>
              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                Total: {taxSlabs.length}
              </span>
            </div>

            <div className="divide-y divide-slate-100 overflow-y-auto">
              {taxSlabs.map((t) => {
                const isSelected = editingTaxId === t.TaxSlabId;
                return (
                  <div
                    key={t.TaxSlabId}
                    onClick={() => {
                      setEditingTaxId(t.TaxSlabId);
                      setSlabName(t.SlabName);
                      setTaxPct(t.TaxPercentage);
                      setIsTaxActive(t.IsActive);
                    }}
                    className={`group p-3.5 flex items-center justify-between cursor-pointer select-none transition ${
                      isSelected
                        ? 'bg-blue-50/80 ring-2 ring-inset ring-blue-500/50'
                        : 'hover:bg-slate-50/70'
                    }`}
                  >
                    <div>
                      <span className="font-bold text-slate-800 text-xs block">{t.SlabName}</span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        CGST: {t.CgstPercentage}% | SGST: {t.SgstPercentage}%
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-black text-slate-700 font-mono text-xs">
                        {t.TaxPercentage}%
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          t.IsActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${t.IsActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        {t.IsActive ? 'Active' : 'Inactive'}
                      </span>
                      <span className="opacity-0 group-hover:opacity-100 text-blue-600 transition-opacity">
                        <Icons.Edit />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}