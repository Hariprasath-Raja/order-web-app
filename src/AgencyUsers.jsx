import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function AgencyUsers({ currentUser, selectedAgency }) {
  // 3 Primary Sub Tabs
  const [activeTab, setActiveTab] = useState('RETAIL_SHOPS'); // 'ASSOCIATION' | 'RETAIL_SHOPS' | 'STAFF'

  // Master Data States
  const [allRegisteredShops, setAllRegisteredShops] = useState([]);
  const [associatedShops, setAssociatedShops] = useState([]);
  const [staffList, setStaffList] = useState([]);

  // Common UI State
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  // TAB 1: ASSOCIATION STATE
  const [selectedShopToLink, setSelectedShopToLink] = useState('');
  const [creditLimit, setCreditLimit] = useState('0');
  const [assocSearch, setAssocSearch] = useState('');

  // TAB 2: RETAIL SHOPS FORM STATE (Edit & Create)
  const [editingShop, setEditingShop] = useState(null);
  const [shopCode, setShopCode] = useState('');
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [shopPhone, setShopPhone] = useState('');
  const [shopPassword, setShopPassword] = useState('1234');
  const [dispatchRoute, setDispatchRoute] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [shopIsActive, setShopIsActive] = useState(true);

  // TAB 3: STAFF FORM STATE
  const [editingStaff, setEditingStaff] = useState(null);
  const [staffName, setStaffName] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffPassword, setStaffPassword] = useState('123456');
  const [staffDesignation, setStaffDesignation] = useState('');
  const [staffRole, setStaffRole] = useState(1); // 1: AgencyAdmin, 2: Staff
  const [staffIsActive, setStaffIsActive] = useState(true);

  useEffect(() => {
    fetchAllShops();
    fetchStaff();
  }, []);

  useEffect(() => {
    if (selectedAgency?.AgencyId) {
      fetchAssociatedShops();
    }
  }, [selectedAgency]);

  const fetchAllShops = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('ShopDetails')
      .select('*, Users ( UserId, Phone, Password, IsActive )')
      .order('ShopId', { ascending: false });

    if (data) setAllRegisteredShops(data);
    setLoading(false);
  };

  const fetchAssociatedShops = async () => {
    if (!selectedAgency?.AgencyId) return;
    const { data, error } = await supabase
      .from('AgencyShopMapping')
      .select('*, ShopDetails ( * )')
      .eq('AgencyId', selectedAgency.AgencyId)
      .order('MappingId', { ascending: false });

    if (!error && data) setAssociatedShops(data);
  };

  const fetchStaff = async () => {
    const { data } = await supabase
      .from('Users')
      .select('*')
      .in('RoleId', [1, 2])
      .order('CreatedAt', { ascending: false });

    if (data) setStaffList(data);
  };

  // -------------------------------------------------------------
  // TAB 1 ACTIONS: ASSOCIATION
  // -------------------------------------------------------------
  const handleLinkShop = async (e) => {
    e.preventDefault();
    if (!selectedShopToLink || !selectedAgency?.AgencyId) return;

    setSubmitting(true);
    setMessage('');

    const newMapping = {
      AgencyId: selectedAgency.AgencyId,
      ShopId: parseInt(selectedShopToLink, 10),
      IsApproved: true,
      CreditLimit: parseFloat(creditLimit) || 0,
      OutstandingBalance: 0,
    };

    const { data, error } = await supabase
      .from('AgencyShopMapping')
      .insert([newMapping])
      .select('*, ShopDetails ( * )')
      .single();

    if (error) {
      setMessage(`Linking Failed: ${error.message}`);
    } else if (data) {
      setAssociatedShops((prev) => [data, ...prev]);
      setSelectedShopToLink('');
      setCreditLimit('0');
      setMessage('Shop associated to agency successfully!');
    }
    setSubmitting(false);
  };

  const handleToggleAssocStatus = async (mapping) => {
    const nextStatus = !mapping.IsApproved;
    const { error } = await supabase
      .from('AgencyShopMapping')
      .update({ IsApproved: nextStatus })
      .eq('MappingId', mapping.MappingId);

    if (!error) {
      setAssociatedShops((prev) =>
        prev.map((m) =>
          m.MappingId === mapping.MappingId ? { ...m, IsApproved: nextStatus } : m
        )
      );
    }
  };

  const handleRemoveAssoc = async (mappingId) => {
    if (!window.confirm('Are you sure you want to unlink this shop from this agency?')) return;
    const { error } = await supabase
      .from('AgencyShopMapping')
      .delete()
      .eq('MappingId', mappingId);

    if (!error) {
      setAssociatedShops((prev) => prev.filter((m) => m.MappingId !== mappingId));
      setMessage('Association removed.');
    }
  };

  // -------------------------------------------------------------
  // TAB 2 ACTIONS: RETAIL SHOPS CRUD
  // -------------------------------------------------------------
  const loadShopIntoEditor = (shop) => {
    setEditingShop(shop);
    setShopCode(shop.ShopCode || '');
    setShopName(shop.ShopName || '');
    setOwnerName(shop.OwnerName || '');
    setShopPhone(shop.Users?.Phone || shop.Phone || '');
    setShopPassword(shop.Users?.Password || '••••••');
    setDispatchRoute(shop.Route || '');
    setDeliveryAddress(shop.Address || '');
    setGstin(shop.GstNumber || '');
    setShopIsActive(shop.Users?.IsActive ?? true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetShopForm = () => {
    setEditingShop(null);
    setShopCode('');
    setShopName('');
    setOwnerName('');
    setShopPhone('');
    setShopPassword('1234');
    setDispatchRoute('');
    setDeliveryAddress('');
    setGstin('');
    setShopIsActive(true);
  };

  const handleSaveShopkeeper = async (e) => {
    e.preventDefault();
    if (!shopName.trim() || !shopPhone.trim()) {
      setMessage('Shop Name and Phone number are required.');
      return;
    }

    setSubmitting(true);
    setMessage('');

    try {
      if (editingShop) {
        if (editingShop.UserId) {
          const userUpdatePayload = {
            Phone: shopPhone.trim(),
            FullName: ownerName.trim() || shopName.trim(),
            IsActive: shopIsActive,
          };
          if (shopPassword && shopPassword !== '••••••') {
            userUpdatePayload.Password = shopPassword.trim();
          }

          await supabase
            .from('Users')
            .update(userUpdatePayload)
            .eq('UserId', editingShop.UserId);
        }

        const shopUpdatePayload = {
          ShopName: shopName.trim(),
          OwnerName: ownerName.trim() || null,
          ShopCode: shopCode.trim().toUpperCase() || null,
          Address: deliveryAddress.trim() || null,
          Route: dispatchRoute.trim() || null,
          GstNumber: gstin.trim() || null,
        };

        const { data: updatedShop, error: shopErr } = await supabase
          .from('ShopDetails')
          .update(shopUpdatePayload)
          .eq('ShopId', editingShop.ShopId)
          .select('*, Users ( UserId, Phone, Password, IsActive, FullName )')
          .single();

        if (shopErr) throw shopErr;

        setAllRegisteredShops((prev) =>
          prev.map((s) => (s.ShopId === editingShop.ShopId ? updatedShop : s))
        );
        setMessage(`Shop "${updatedShop.ShopName}" updated successfully!`);
        resetShopForm();
      } else {
        const userPayload = {
          Phone: shopPhone.trim(),
          Password: shopPassword.trim() || shopPhone.trim().slice(-4) || '1234',
          FullName: ownerName.trim() || shopName.trim(),
          RoleId: 3,
          IsActive: shopIsActive,
          CreatedBy: currentUser?.UserId || null,
        };

        const { data: newUser, error: userErr } = await supabase
          .from('Users')
          .insert([userPayload])
          .select()
          .single();

        if (userErr) throw userErr;

        const shopPayload = {
          UserId: newUser.UserId,
          ShopName: shopName.trim(),
          OwnerName: ownerName.trim() || null,
          ShopCode: shopCode.trim().toUpperCase() || null,
          Address: deliveryAddress.trim() || null,
          Route: dispatchRoute.trim() || null,
          GstNumber: gstin.trim() || null,
        };

        const { data: newShop, error: shopErr } = await supabase
          .from('ShopDetails')
          .insert([shopPayload])
          .select('*, Users ( UserId, Phone, Password, IsActive, FullName )')
          .single();

        if (shopErr) throw shopErr;

        if (selectedAgency?.AgencyId) {
          const { data: mappingData } = await supabase
            .from('AgencyShopMapping')
            .insert([
              {
                AgencyId: selectedAgency.AgencyId,
                ShopId: newShop.ShopId,
                IsApproved: true,
                CreditLimit: 0,
              },
            ])
            .select('*, ShopDetails ( * )')
            .single();

          if (mappingData) setAssociatedShops((prev) => [mappingData, ...prev]);
        }

        setAllRegisteredShops((prev) => [newShop, ...prev]);
        setMessage(`Shop "${newShop.ShopName}" registered successfully!`);
        resetShopForm();
      }
    } catch (err) {
      setMessage(`Operation failed: ${err.message}`);
    }
    setSubmitting(false);
  };

  // -------------------------------------------------------------
  // TAB 3 ACTIONS: AGENCY STAFF CRUD (FullName & Designation)
  // -------------------------------------------------------------
  const loadStaffIntoEditor = (st) => {
    setEditingStaff(st);
    setStaffName(st.FullName || '');
    setStaffPhone(st.Phone || '');
    setStaffPassword(st.Password || '••••••');
    setStaffDesignation(st.Designation || '');
    setStaffRole(st.RoleId || 1);
    setStaffIsActive(st.IsActive ?? true);
  };

  const resetStaffForm = () => {
    setEditingStaff(null);
    setStaffName('');
    setStaffPhone('');
    setStaffPassword('123456');
    setStaffDesignation('');
    setStaffRole(1);
    setStaffIsActive(true);
  };

  const handleSaveStaff = async (e) => {
    e.preventDefault();
    if (!staffPhone.trim()) {
      setMessage('Mobile Number is required.');
      return;
    }

    setSubmitting(true);
    setMessage('');

    try {
      if (editingStaff) {
        const updatePayload = {
          Phone: staffPhone.trim(),
          FullName: staffName.trim() || null,
          Designation: staffDesignation.trim() || null,
          RoleId: parseInt(staffRole, 10),
          IsActive: staffIsActive,
        };
        if (staffPassword && staffPassword !== '••••••') {
          updatePayload.Password = staffPassword.trim();
        }

        const { data: updated, error } = await supabase
          .from('Users')
          .update(updatePayload)
          .eq('UserId', editingStaff.UserId)
          .select()
          .single();

        if (error) throw error;
        setStaffList((prev) =>
          prev.map((s) => (s.UserId === editingStaff.UserId ? updated : s))
        );
        setMessage(`Staff account "${updated.FullName || updated.Phone}" updated!`);
        resetStaffForm();
      } else {
        const staffPayload = {
          Phone: staffPhone.trim(),
          Password: staffPassword.trim() || '123456',
          FullName: staffName.trim() || null,
          Designation: staffDesignation.trim() || null,
          RoleId: parseInt(staffRole, 10),
          IsActive: staffIsActive,
          CreatedBy: currentUser?.UserId || null,
        };

        const { data, error } = await supabase
          .from('Users')
          .insert([staffPayload])
          .select()
          .single();

        if (error) throw error;
        setStaffList((prev) => [data, ...prev]);
        setMessage(`Staff account "${data.FullName || data.Phone}" created!`);
        resetStaffForm();
      }
    } catch (err) {
      setMessage(`Staff error: ${err.message}`);
    }
    setSubmitting(false);
  };

  // Associated Filter
  const alreadyMappedShopIds = new Set(associatedShops.map((m) => m.ShopId));
  const availableShopsToLink = allRegisteredShops.filter(
    (s) => !alreadyMappedShopIds.has(s.ShopId)
  );

  const filteredAssocShops = associatedShops.filter((m) => {
    const q = assocSearch.toLowerCase();
    const name = (m.ShopDetails?.ShopName || '').toLowerCase();
    const code = (m.ShopDetails?.ShopCode || '').toLowerCase();
    const route = (m.ShopDetails?.Route || '').toLowerCase();
    return name.includes(q) || code.includes(q) || route.includes(q);
  });

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 sm:space-y-5">
      {/* Top Banner Header */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
            User & Party Management
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure retail accounts with custom 7-char Shop Codes & agency personnel
          </p>
        </div>

        {/* 3 Clear Sub Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('RETAIL_SHOPS')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'RETAIL_SHOPS'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>🏪 Retail Shops</span>
            <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded-md text-[10px]">
              {allRegisteredShops.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ASSOCIATION')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'ASSOCIATION'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>🔗 Agency Association</span>
            <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded-md text-[10px]">
              {associatedShops.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('STAFF')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'STAFF'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>👥 Agency Staff</span>
            <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded-md text-[10px]">
              {staffList.length}
            </span>
          </button>
        </div>
      </div>

      {message && (
        <div className="p-3 bg-slate-900 text-white text-xs rounded-xl flex items-center justify-between shadow-xs">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage('')} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* ============================================================= */}
      {/* 1. RETAIL SHOPS TAB */}
      {/* ============================================================= */}
      {activeTab === 'RETAIL_SHOPS' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <span>{editingShop ? '📝 EDIT SHOPKEEPER' : '➕ ADD SHOPKEEPER'}</span>
              </h3>
              {editingShop && (
                <button
                  type="button"
                  onClick={resetShopForm}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-lg cursor-pointer"
                >
                  ✕ Cancel
                </button>
              )}
            </div>

            <form onSubmit={handleSaveShopkeeper} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-4">
                  <label className="block font-bold text-slate-700 mb-1">
                    Code * <span className="text-[10px] text-slate-400 font-normal">(Max 7)</span>
                  </label>
                  <input
                    type="text"
                    maxLength={7}
                    placeholder="SLM03"
                    value={shopCode}
                    onChange={(e) => setShopCode(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono uppercase focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-8">
                  <label className="block font-bold text-slate-700 mb-1">Shop Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Sri Makkal Maligai"
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Owner Name</label>
                <input
                  type="text"
                  placeholder="Gnanvel"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Phone (Login) *</label>
                  <input
                    type="tel"
                    required
                    placeholder="9600560425"
                    value={shopPhone}
                    onChange={(e) => setShopPhone(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Password (Secured) *</label>
                  <input
                    type="text"
                    required
                    placeholder="1234"
                    value={shopPassword}
                    onChange={(e) => setShopPassword(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Dispatch Route *</label>
                <input
                  type="text"
                  required
                  placeholder="Tharamangalam"
                  value={dispatchRoute}
                  onChange={(e) => setDispatchRoute(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Delivery Address *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Bus stand Opposite, Tharamangalam"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">GSTIN (Optional)</label>
                <input
                  type="text"
                  placeholder="33AAA91829122GST"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono uppercase focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <div>
                  <span className="block font-bold text-slate-800 text-xs">Account Status</span>
                  <span className="block text-[11px] text-slate-400">
                    {shopIsActive ? 'Active (Ready to order)' : 'Disabled / Suspended'}
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={shopIsActive}
                  onClick={() => setShopIsActive((prev) => !prev)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    shopIsActive ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      shopIsActive ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 mt-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {submitting
                  ? 'Saving...'
                  : editingShop
                  ? 'Update Shopkeeper'
                  : '+ Register Shopkeeper'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
                  Enrolled Retail Stores
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Click any row to load into editor</p>
              </div>
              <button
                type="button"
                onClick={fetchAllShops}
                className="flex items-center gap-1 px-3 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 cursor-pointer"
              >
                🔄 Refresh
              </button>
            </div>

            <div className="w-full overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50/75 border-b border-slate-200/80 text-slate-500 uppercase font-bold text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">CODE & SHOP</th>
                    <th className="py-2.5 px-3">ROUTE & ADDRESS</th>
                    <th className="py-2.5 px-3">CONTACT</th>
                    <th className="py-2.5 px-3 text-center">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan="4" className="py-12 text-center text-xs text-slate-400">Loading enrolled stores...</td>
                    </tr>
                  ) : allRegisteredShops.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="py-12 text-center text-xs text-slate-400">No retail stores enrolled yet.</td>
                    </tr>
                  ) : (
                    allRegisteredShops.map((s) => {
                      const isSelected = editingShop?.ShopId === s.ShopId;
                      const user = s.Users;
                      const isActive = user?.IsActive ?? true;

                      return (
                        <tr
                          key={s.ShopId}
                          onClick={() => loadShopIntoEditor(s)}
                          className={`cursor-pointer transition ${
                            isSelected
                              ? 'bg-emerald-50/80 border-l-4 border-l-emerald-600'
                              : 'hover:bg-slate-50/70'
                          }`}
                        >
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              {s.ShopCode && (
                                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-800 font-mono text-[10px] font-bold rounded">
                                  {s.ShopCode}
                                </span>
                              )}
                              <span className="font-bold text-slate-900">{s.ShopName}</span>
                            </div>
                            <span className="text-[11px] text-slate-400 block mt-0.5">{s.OwnerName || '-'}</span>
                          </td>

                          <td className="py-3 px-3">
                            {s.Route && (
                              <span className="inline-block bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded-md font-semibold mb-0.5">
                                {s.Route}
                              </span>
                            )}
                            <span className="block text-[11px] text-slate-400 truncate max-w-[180px]">
                              {s.Address || '-'}
                            </span>
                          </td>

                          <td className="py-3 px-3">
                            <span className="font-mono font-bold text-slate-800 block">
                              {user?.Phone || s.Phone || '-'}
                            </span>
                            {s.GstNumber && (
                              <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                                GST: {s.GstNumber}
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                isActive
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                              {isActive ? 'Active' : 'Disabled'}
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
      )}

      {/* ============================================================= */}
      {/* 2. AGENCY ASSOCIATION TAB */}
      {/* ============================================================= */}
      {activeTab === 'ASSOCIATION' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <h3 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">
              Associate Enrolled Retail Store to {selectedAgency?.AgencyName}
            </h3>

            <form onSubmit={handleLinkShop} className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs items-end">
              <div className="sm:col-span-6">
                <label className="block font-bold text-slate-700 mb-1">Select Enrolled Store *</label>
                <select
                  required
                  value={selectedShopToLink}
                  onChange={(e) => setSelectedShopToLink(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 cursor-pointer"
                >
                  <option value="">-- Choose Store to Link --</option>
                  {availableShopsToLink.map((s) => (
                    <option key={s.ShopId} value={s.ShopId}>
                      {s.ShopName} {s.ShopCode ? `(${s.ShopCode})` : ''} {s.Route ? `— ${s.Route}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="block font-bold text-slate-700 mb-1">Credit Limit (₹)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none"
                />
              </div>

              <div className="sm:col-span-3">
                <button
                  type="submit"
                  disabled={submitting || !selectedShopToLink}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition active:scale-95 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Linking...' : '+ Associate Shop to Agency'}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
                  Shops Connected to {selectedAgency?.AgencyName}
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Only approved stores can order products from this agency
                </p>
              </div>
              <input
                type="text"
                placeholder="🔍 Search shop name, code, route..."
                value={assocSearch}
                onChange={(e) => setAssocSearch(e.target.value)}
                className="w-full sm:w-64 border border-slate-200 bg-slate-50 rounded-xl px-3 py-1.5 text-xs focus:bg-white focus:outline-none"
              />
            </div>

            <div className="w-full overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50/75 border-b border-slate-200/80 text-slate-500 uppercase font-bold text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Store Details</th>
                    <th className="py-3 px-4">Owner Name</th>
                    <th className="py-3 px-4">Route</th>
                    <th className="py-3 px-4 text-right">Credit Limit</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAssocShops.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-12 text-center text-xs text-slate-400">
                        No stores mapped to this agency yet.
                      </td>
                    </tr>
                  ) : (
                    filteredAssocShops.map((m) => {
                      const shop = m.ShopDetails;
                      return (
                        <tr key={m.MappingId} className="hover:bg-slate-50/70 transition">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              {shop?.ShopCode && (
                                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 font-mono text-[10px] font-bold rounded">
                                  {shop.ShopCode}
                                </span>
                              )}
                              <span className="font-bold text-slate-800">{shop?.ShopName}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-700">{shop?.OwnerName || '-'}</td>
                          <td className="py-3.5 px-4 text-slate-600">
                            <span className="inline-block bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded-md font-semibold">
                              {shop?.Route || 'Direct'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-700">
                            ₹{m.CreditLimit || 0}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleAssocStatus(m)}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition cursor-pointer active:scale-95 ${
                                m.IsApproved
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                            >
                              {m.IsApproved ? 'Approved' : 'Suspended'}
                            </button>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveAssoc(m.MappingId)}
                              className="px-2.5 py-1 text-slate-400 hover:text-rose-600 text-[11px] font-bold rounded-lg hover:bg-rose-50 transition cursor-pointer"
                            >
                              Unlink
                            </button>
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
      )}

      {/* ============================================================= */}
      {/* 3. AGENCY STAFF TAB (FULL MATCH TO YOUR SCREENSHOT) */}
      {/* ============================================================= */}
      {activeTab === 'STAFF' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* LEFT: Add / Edit Staff Form */}
          <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <span>{editingStaff ? '📝 EDIT AGENCY STAFF' : '➕ ADD AGENCY STAFF'}</span>
              </h3>
              {editingStaff && (
                <button
                  type="button"
                  onClick={resetStaffForm}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-lg cursor-pointer"
                >
                  ✕ Cancel
                </button>
              )}
            </div>

            <form onSubmit={handleSaveStaff} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Staff Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Karthik"
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Phone Number (Login ID) *</label>
                <input
                  type="tel"
                  required
                  placeholder="10 digits"
                  value={staffPhone}
                  onChange={(e) => setStaffPhone(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Login Password *</label>
                <input
                  type="text"
                  required
                  placeholder="Min 6 characters"
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Designation</label>
                <input
                  type="text"
                  placeholder="e.g. Dispatcher / Sales Exec"
                  value={staffDesignation}
                  onChange={(e) => setStaffDesignation(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">System Role *</label>
                <select
                  value={staffRole}
                  onChange={(e) => setStaffRole(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none cursor-pointer"
                >
                  <option value={1}>AgencyAdmin (Super Administrator / Agency Owner)</option>
                  <option value={2}>Staff (Billing & Counter Operator)</option>
                </select>
              </div>

              {/* iOS Green Account Status Toggle */}
              <div className="flex items-center justify-between pt-1">
                <div>
                  <span className="block font-bold text-slate-800 text-xs">Account Status</span>
                  <span className="block text-[11px] text-slate-400">
                    {staffIsActive ? 'Active (Panel access enabled)' : 'Disabled / Suspended'}
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={staffIsActive}
                  onClick={() => setStaffIsActive((prev) => !prev)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    staffIsActive ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      staffIsActive ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 mt-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {submitting
                  ? 'Saving...'
                  : editingStaff
                  ? 'Update Staff Access'
                  : 'Create Staff Access'}
              </button>
            </form>
          </div>

          {/* RIGHT: Agency Personnel List Grid (Matches Exact Columns in Screenshot 2) */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
                  Agency Personnel
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Click any row to load into editor</p>
              </div>
              <button
                type="button"
                onClick={fetchStaff}
                className="flex items-center gap-1 px-3 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 cursor-pointer"
              >
                🔄 Refresh
              </button>
            </div>

            <div className="w-full overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50/75 border-b border-slate-200/80 text-slate-500 uppercase font-bold text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">STAFF NAME</th>
                    <th className="py-2.5 px-3">DESIGNATION</th>
                    <th className="py-2.5 px-3">ROLE</th>
                    <th className="py-2.5 px-3">PHONE</th>
                    <th className="py-2.5 px-3 text-center">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {staffList.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-12 text-center text-xs text-slate-400">
                        No agency personnel registered yet.
                      </td>
                    </tr>
                  ) : (
                    staffList.map((st) => {
                      const isSelected = editingStaff?.UserId === st.UserId;
                      return (
                        <tr
                          key={st.UserId}
                          onClick={() => loadStaffIntoEditor(st)}
                          className={`cursor-pointer transition ${
                            isSelected
                              ? 'bg-emerald-50/80 border-l-4 border-l-emerald-600'
                              : 'hover:bg-slate-50/70'
                          }`}
                        >
                          <td className="py-3 px-3 font-bold text-slate-900">
                            {st.FullName || 'Unnamed Staff'}
                          </td>

                          <td className="py-3 px-3 text-slate-600">
                            {st.Designation || '-'}
                          </td>

                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                st.RoleId === 1
                                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}
                            >
                              {st.RoleId === 1 ? 'AgencyAdmin' : 'Staff'}
                            </span>
                          </td>

                          <td className="py-3 px-3 font-mono font-bold text-slate-800">
                            {st.Phone}
                          </td>

                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                st.IsActive
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${st.IsActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                              {st.IsActive ? 'Active' : 'Disabled'}
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
      )}
    </div>
  );
}