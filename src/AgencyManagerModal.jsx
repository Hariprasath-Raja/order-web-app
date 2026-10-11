import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import { Icons } from './Icons';

export default function AgencyManagerModal({ isOpen, onClose, onAgencyCreated, currentUser, isFirstRun = false }) {
  const [agencyName, setAgencyName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [gstin, setGstin] = useState('');
  const [jurisdiction, setJurisdiction] = useState('Salem');
  const [invoicePrefix, setInvoicePrefix] = useState('INV');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen && !isFirstRun) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!agencyName.trim()) {
      setErrorMsg('Agency Name is required.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    // 1. Insert New Agency
    const { data: agencyData, error: agencyError } = await supabase
      .from('Agencies')
      .insert([
        {
          AgencyName: agencyName.trim(),
          Address: address.trim(),
          Phone: phone.trim(),
          Gstin: gstin.trim(),
          Jurisdiction: jurisdiction.trim() || 'Salem',
          InvoicePrefix: invoicePrefix.trim() || 'INV',
          IsActive: true,
        },
      ])
      .select()
      .single();

    if (agencyError) {
      setErrorMsg(`Failed to save agency: ${agencyError.message}`);
      setLoading(false);
      return;
    }

    // 2. Automatically Map Current Admin User to this newly created Agency
    if (currentUser?.UserId && agencyData?.AgencyId) {
      await supabase.from('UserAgencyMapping').insert([
        {
          UserId: currentUser.UserId,
          AgencyId: agencyData.AgencyId,
        },
      ]);
    }

    setLoading(false);
    onAgencyCreated(agencyData);
    if (onClose) onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-sm sm:text-base">
              {isFirstRun ? '🏢 Welcome! Setup Your First Agency' : '🏢 Register New Agency'}
            </h3>
            <p className="text-xs text-slate-400">
              {isFirstRun
                ? 'Create your primary wholesale agency to unlock the dashboard'
                : 'Add a secondary brand or distributor agency'}
            </p>
          </div>
          {!isFirstRun && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white transition p-1 cursor-pointer"
            >
              <Icons.Close className="w-4 h-4" />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
          {errorMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl font-medium">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 mb-1">Agency / Distributor Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Shree Moogambigai Agencies"
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Registered Address</label>
            <textarea
              rows="2"
              placeholder="12/3, Kalyanamman Kovil St, Tharamangalam, Salem"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Phone Number</label>
              <input
                type="text"
                placeholder="9600924500"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">GSTIN Number</label>
              <input
                type="text"
                placeholder="33FKIPS0747H1ZY"
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none uppercase font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Legal Jurisdiction</label>
              <input
                type="text"
                placeholder="Salem"
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Invoice Prefix</label>
              <input
                type="text"
                placeholder="INV"
                value={invoicePrefix}
                onChange={(e) => setInvoicePrefix(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none uppercase font-mono"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            {!isFirstRun && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition cursor-pointer"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition active:scale-95 shadow-sm cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Registering...' : isFirstRun ? 'Setup & Launch Agency' : 'Register Agency'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}