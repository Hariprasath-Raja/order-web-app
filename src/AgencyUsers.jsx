import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Icons } from './Icons';

export default function AgencyUsers() {
  const [activeSubTab, setActiveSubTab] = useState('shops');
  const [roles, setRoles] = useState([]);
  const [shopsList, setShopsList] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const [editingShopId, setEditingShopId] = useState(null);
  const [editingStaffId, setEditingStaffId] = useState(null);

  const [shopForm, setShopForm] = useState({
    userId: null,
    shopCode: '',
    phone: '',
    password: '',
    shopName: '',
    ownerName: '',
    route: '',
    address: '',
    gstNumber: '',
    isActive: true,
  });

  const [staffForm, setStaffForm] = useState({
    userId: null,
    phone: '',
    password: '',
    staffName: '',
    designation: '',
    roleId: '',
    isActive: true,
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    const { data: rolesData } = await supabase.from('Roles').select('*');
    if (rolesData) {
      setRoles(rolesData);
      const staffRole = rolesData.find((r) => r.RoleName === 'AgencyStaff') || rolesData[0];
      if (staffRole) setStaffForm((prev) => ({ ...prev, roleId: staffRole.RoleId }));
    }

    await fetchShops();
    await fetchStaff();
    setLoading(false);
  };

  const fetchShops = async () => {
    setIsRefreshing(true);
    const { data } = await supabase
      .from('ShopDetails')
      .select(`
        ShopId,
        ShopCode,
        ShopName,
        OwnerName,
        Route,
        Address,
        GstNumber,
        Users ( UserId, Phone, IsActive )
      `)
      .order('ShopId', { ascending: false });
    if (data) setShopsList(data);
    setIsRefreshing(false);
  };

  const fetchStaff = async () => {
    setIsRefreshing(true);
    const { data } = await supabase
      .from('AgencyStaffDetails')
      .select(`
        StaffId,
        StaffName,
        Designation,
        Users ( 
          UserId, 
          Phone, 
          IsActive,
          RoleId,
          Roles ( RoleName )
        )
      `)
      .order('StaffId', { ascending: false });
    if (data) setStaffList(data);
    setIsRefreshing(false);
  };

  const resetShopForm = () => {
    setEditingShopId(null);
    setShopForm({
      userId: null,
      shopCode: '',
      phone: '',
      password: '',
      shopName: '',
      ownerName: '',
      route: '',
      address: '',
      gstNumber: '',
      isActive: true,
    });
  };

  const resetStaffForm = () => {
    setEditingStaffId(null);
    const staffRole = roles.find((r) => r.RoleName === 'AgencyStaff') || roles[0];
    setStaffForm({
      userId: null,
      phone: '',
      password: '',
      staffName: '',
      designation: '',
      roleId: staffRole ? staffRole.RoleId : '',
      isActive: true,
    });
  };

  const startEditShop = (shop) => {
    setEditingShopId(shop.ShopId);
    setShopForm({
      userId: shop.Users?.UserId,
      shopCode: shop.ShopCode || '',
      phone: shop.Users?.Phone || '',
      password: '••••••••',
      shopName: shop.ShopName || '',
      ownerName: shop.OwnerName || '',
      route: shop.Route || '',
      address: shop.Address || '',
      gstNumber: shop.GstNumber || '',
      isActive: shop.Users?.IsActive ?? true,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startEditStaff = (staff) => {
    setEditingStaffId(staff.StaffId);
    setStaffForm({
      userId: staff.Users?.UserId,
      phone: staff.Users?.Phone || '',
      password: '••••••••',
      staffName: staff.StaffName || '',
      designation: staff.Designation || '',
      roleId: staff.Users?.RoleId || (roles[0]?.RoleId ?? ''),
      isActive: staff.Users?.IsActive ?? true,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveShop = async (e) => {
    e.preventDefault();
    setMessage({ text: '', type: '' });

    const formattedCode = shopForm.shopCode.trim().toUpperCase().replace(/\s/g, '');

    if (!formattedCode || !shopForm.phone || (!editingShopId && !shopForm.password) || !shopForm.shopName || !shopForm.route || !shopForm.address) {
      setMessage({ text: 'Please fill all mandatory fields (Shop Code, Phone, Shop, Route, Address)', type: 'error' });
      return;
    }

    if (formattedCode.length > 7) {
      setMessage({ text: 'Shop Code must be 7 characters or less', type: 'error' });
      return;
    }

    try {
      if (editingShopId) {
        const { error: userError } = await supabase
          .from('Users')
          .update({
            Phone: shopForm.phone.trim(),
            IsActive: shopForm.isActive,
          })
          .eq('UserId', shopForm.userId);

        if (userError) throw userError;

        const { error: shopError } = await supabase
          .from('ShopDetails')
          .update({
            ShopCode: formattedCode,
            ShopName: shopForm.shopName.trim(),
            OwnerName: shopForm.ownerName.trim() || shopForm.shopName.trim(),
            Route: shopForm.route.trim(),
            Address: shopForm.address.trim(),
            GstNumber: shopForm.gstNumber.trim() || null,
          })
          .eq('ShopId', editingShopId);

        if (shopError) throw shopError;

        setMessage({ text: `Shop "${shopForm.shopName}" (${formattedCode}) updated successfully!`, type: 'success' });
        resetShopForm();
      } else {
        const shopRole = roles.find((r) => r.RoleName === 'ShopOwner');
        if (!shopRole) throw new Error('ShopOwner role not found in database');

        const { data: newUser, error: userError } = await supabase
          .from('Users')
          .insert([
            {
              Phone: shopForm.phone.trim(),
              Password: shopForm.password.trim(),
              RoleId: shopRole.RoleId,
              IsActive: shopForm.isActive,
            },
          ])
          .select()
          .single();

        if (userError) throw userError;

        const { error: shopError } = await supabase
          .from('ShopDetails')
          .insert([
            {
              UserId: newUser.UserId,
              ShopCode: formattedCode,
              ShopName: shopForm.shopName.trim(),
              OwnerName: shopForm.ownerName.trim() || shopForm.shopName.trim(),
              Route: shopForm.route.trim(),
              Address: shopForm.address.trim(),
              GstNumber: shopForm.gstNumber.trim() || null,
            },
          ]);

        if (shopError) throw shopError;

        setMessage({ text: `Shop "${shopForm.shopName}" registered with code [${formattedCode}]!`, type: 'success' });
        resetShopForm();
      }
      fetchShops();
    } catch (err) {
      if (err.message?.includes('duplicate key') || err.message?.includes('shopdetails_shopcode_unique') || err.message?.includes('ShopCode')) {
        setMessage({ text: `Shop Code "${formattedCode}" is already taken! Please choose another unique code.`, type: 'error' });
      } else {
        setMessage({ text: `Action Failed: ${err.message}`, type: 'error' });
      }
    }
  };

  const handleSaveStaff = async (e) => {
    e.preventDefault();
    setMessage({ text: '', type: '' });

    if (!staffForm.phone || (!editingStaffId && !staffForm.password) || !staffForm.staffName) {
      setMessage({ text: 'Please fill Staff Name, Phone, and Password', type: 'error' });
      return;
    }

    try {
      if (editingStaffId) {
        const { error: userError } = await supabase
          .from('Users')
          .update({
            Phone: staffForm.phone.trim(),
            RoleId: parseInt(staffForm.roleId),
            IsActive: staffForm.isActive,
          })
          .eq('UserId', staffForm.userId);

        if (userError) throw userError;

        const { error: staffError } = await supabase
          .from('AgencyStaffDetails')
          .update({
            StaffName: staffForm.staffName.trim(),
            Designation: staffForm.designation.trim() || 'Staff',
          })
          .eq('StaffId', editingStaffId);

        if (staffError) throw staffError;

        setMessage({ text: `Staff "${staffForm.staffName}" updated successfully!`, type: 'success' });
        resetStaffForm();
      } else {
        const { data: newUser, error: userError } = await supabase
          .from('Users')
          .insert([
            {
              Phone: staffForm.phone.trim(),
              Password: staffForm.password.trim(),
              RoleId: parseInt(staffForm.roleId),
              IsActive: staffForm.isActive,
            },
          ])
          .select()
          .single();

        if (userError) throw userError;

        const { error: staffError } = await supabase
          .from('AgencyStaffDetails')
          .insert([
            {
              UserId: newUser.UserId,
              StaffName: staffForm.staffName.trim(),
              Designation: staffForm.designation.trim() || 'Staff',
            },
          ]);

        if (staffError) throw staffError;

        setMessage({ text: `Staff "${staffForm.staffName}" created successfully!`, type: 'success' });
        resetStaffForm();
      }
      fetchStaff();
    } catch (err) {
      setMessage({ text: `Action Failed: ${err.message}`, type: 'error' });
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Tab Switcher Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-base font-extrabold text-slate-800">User & Party Management</h2>
          <p className="text-xs text-slate-500">Configure retail accounts with custom 7-char Shop Codes & agency personnel</p>
        </div>

        <div className="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => {
              setActiveSubTab('shops');
              resetShopForm();
              setMessage({ text: '', type: '' });
            }}
            className={`flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeSubTab === 'shops'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Icons.Store />
            <span>Retail Shops</span>
            <span className="ml-1 px-1.5 py-0.2 bg-slate-200/80 text-slate-700 text-[10px] rounded-md font-semibold">
              {shopsList.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveSubTab('staff');
              resetStaffForm();
              setMessage({ text: '', type: '' });
            }}
            className={`flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeSubTab === 'staff'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Icons.Parties />
            <span>Agency Staff</span>
            <span className="ml-1 px-1.5 py-0.2 bg-slate-200/80 text-slate-700 text-[10px] rounded-md font-semibold">
              {staffList.length}
            </span>
          </button>
        </div>
      </div>

      {message.text && (
        <div
          className={`flex items-center gap-2 p-3.5 text-xs rounded-xl font-medium border ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {message.type === 'success' ? <Icons.Check /> : <Icons.Close />}
          <span>{message.text}</span>
        </div>
      )}

      {/* SUB-SECTION 1: SHOPS MANAGEMENT */}
      {activeSubTab === 'shops' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Shop Form Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs h-fit">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                  {editingShopId ? <Icons.Edit /> : <Icons.UserPlus />}
                </span>
                <h3 className="text-xs font-bold tracking-wide uppercase text-slate-700">
                  {editingShopId ? 'Edit Shopkeeper' : 'Register New Shop'}
                </h3>
              </div>

              {editingShopId && (
                <button
                  type="button"
                  onClick={resetShopForm}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-xs font-semibold shadow-xs transition active:scale-95 cursor-pointer"
                >
                  <Icons.Close />
                  <span>Cancel</span>
                </button>
              )}
            </div>

            <form onSubmit={handleSaveShop} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="block text-slate-600 font-semibold mb-1">
                    Code * <span className="text-[10px] text-slate-400 font-normal">(Max 7)</span>
                  </label>
                  <input
                    type="text"
                    maxLength="7"
                    placeholder="SLM01"
                    value={shopForm.shopCode}
                    onChange={(e) =>
                      setShopForm({
                        ...shopForm,
                        shopCode: e.target.value.toUpperCase().replace(/\s/g, ''),
                      })
                    }
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-800 font-mono font-bold uppercase focus:bg-white focus:border-slate-400 focus:outline-none transition"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-slate-600 font-semibold mb-1">Shop Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Annai Maligai"
                    value={shopForm.shopName}
                    onChange={(e) => setShopForm({ ...shopForm, shopName: e.target.value })}
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:bg-white focus:border-slate-400 focus:outline-none transition"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Owner Name</label>
                <input
                  type="text"
                  placeholder="e.g. Senthil Kumar"
                  value={shopForm.ownerName}
                  onChange={(e) => setShopForm({ ...shopForm, ownerName: e.target.value })}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:bg-white focus:border-slate-400 focus:outline-none transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Phone (Login) *</label>
                  <input
                    type="text"
                    maxLength="10"
                    placeholder="10 digits"
                    value={shopForm.phone}
                    onChange={(e) => setShopForm({ ...shopForm, phone: e.target.value })}
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:bg-white focus:border-slate-400 focus:outline-none transition font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    Password {editingShopId ? '(Secured)' : '*'}
                  </label>
                  <input
                    type="text"
                    disabled={!!editingShopId}
                    placeholder="Min 6 chars"
                    value={shopForm.password}
                    onChange={(e) => setShopForm({ ...shopForm, password: e.target.value })}
                    className={`w-full border rounded-xl px-3 py-2 focus:outline-none font-mono transition ${
                      editingShopId
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed select-none'
                        : 'bg-slate-50/50 text-slate-800 border-slate-200 focus:bg-white focus:border-slate-400'
                    }`}
                    required={!editingShopId}
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Dispatch Route *</label>
                <input
                  type="text"
                  placeholder="e.g. Salem Town / Attur Main Rd"
                  value={shopForm.route}
                  onChange={(e) => setShopForm({ ...shopForm, route: e.target.value })}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:bg-white focus:border-slate-400 focus:outline-none transition"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Delivery Address *</label>
                <textarea
                  rows="2"
                  placeholder="Door No, Street name, landmark"
                  value={shopForm.address}
                  onChange={(e) => setShopForm({ ...shopForm, address: e.target.value })}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:bg-white focus:border-slate-400 focus:outline-none transition resize-none"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">GSTIN (Optional)</label>
                <input
                  type="text"
                  placeholder="15-digit GST number"
                  value={shopForm.gstNumber}
                  onChange={(e) => setShopForm({ ...shopForm, gstNumber: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:bg-white focus:border-slate-400 focus:outline-none uppercase font-mono tracking-wider transition"
                />
              </div>

              {/* IN-FORM ACTIVE SWITCH */}
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                <div>
                  <span className="font-semibold text-slate-700 block">Account Status</span>
                  <span className="text-[11px] text-slate-500">
                    {shopForm.isActive ? 'Active (Ready to order)' : 'Inactive (Access blocked)'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShopForm((prev) => ({ ...prev, isActive: !prev.isActive }))}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ${
                    shopForm.isActive ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <div className="bg-white w-4 h-4 rounded-full shadow-xs transform" />
                </button>
              </div>

              <button
                type="submit"
                className={`w-full py-2.5 text-white font-bold rounded-xl shadow-xs transition active:scale-95 cursor-pointer ${
                  editingShopId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-900 hover:bg-slate-800'
                }`}
              >
                {editingShopId ? 'Update Shopkeeper Details' : 'Create Shopkeeper Account'}
              </button>
            </form>
          </div>

          {/* Shops Table Card with ShopCode Badge */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Enrolled Retail Stores</h3>
                <p className="text-[11px] text-slate-400">Click any row to load into editor</p>
              </div>
              <button
                type="button"
                onClick={fetchShops}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 hover:text-slate-800 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <span className={isRefreshing ? 'animate-spin' : ''}>
                  <Icons.Refresh />
                </span>
                <span>Refresh</span>
              </button>
            </div>

            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/75 border-b border-slate-100 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Code & Shop</th>
                    <th className="py-3 px-4">Route & Address</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shopsList.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-12 text-center text-slate-400">
                        No shops registered yet.
                      </td>
                    </tr>
                  ) : (
                    shopsList.map((s) => {
                      const isSelected = editingShopId === s.ShopId;
                      return (
                        <tr
                          key={s.ShopId}
                          onClick={() => startEditShop(s)}
                          className={`group cursor-pointer transition select-none ${
                            isSelected
                              ? 'bg-blue-50/80 ring-2 ring-inset ring-blue-500/50'
                              : 'hover:bg-slate-50/70'
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200/80">
                                {s.ShopCode || `S-${s.ShopId}`}
                              </span>
                              <span className="font-bold text-slate-800">{s.ShopName}</span>
                            </div>
                            <span className="text-[11px] text-slate-400 block mt-0.5">{s.OwnerName || '-'}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-block bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded-md font-semibold mb-0.5">
                              {s.Route}
                            </span>
                            <span className="block text-[11px] text-slate-500 truncate max-w-[180px]">
                              {s.Address}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-700">
                            {s.Users?.Phone}
                            {s.GstNumber && (
                              <span className="block text-[10px] text-slate-400 font-sans">
                                GST: {s.GstNumber}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                s.Users?.IsActive
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  s.Users?.IsActive ? 'bg-emerald-500' : 'bg-rose-500'
                                }`}
                              />
                              {s.Users?.IsActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="opacity-0 group-hover:opacity-100 text-blue-600 transition-opacity flex items-center justify-center">
                              <Icons.Edit />
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

      {/* SUB-SECTION 2: STAFF MANAGEMENT */}
      {activeSubTab === 'staff' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Staff Form Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs h-fit">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                  {editingStaffId ? <Icons.Edit /> : <Icons.UserPlus />}
                </span>
                <h3 className="text-xs font-bold tracking-wide uppercase text-slate-700">
                  {editingStaffId ? 'Edit Agency Staff' : 'Add Agency Staff'}
                </h3>
              </div>

              {editingStaffId && (
                <button
                  type="button"
                  onClick={resetStaffForm}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-xs font-semibold shadow-xs transition active:scale-95 cursor-pointer"
                >
                  <Icons.Close />
                  <span>Cancel</span>
                </button>
              )}
            </div>

            <form onSubmit={handleSaveStaff} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Staff Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Karthik"
                  value={staffForm.staffName}
                  onChange={(e) => setStaffForm({ ...staffForm, staffName: e.target.value })}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:bg-white focus:border-slate-400 focus:outline-none transition"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Phone Number (Login ID) *</label>
                <input
                  type="text"
                  maxLength="10"
                  placeholder="10 digits"
                  value={staffForm.phone}
                  onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:bg-white focus:border-slate-400 focus:outline-none transition font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Login Password {editingStaffId ? '(Secured)' : '*'}
                </label>
                <input
                  type="text"
                  disabled={!!editingStaffId}
                  placeholder="Min 6 characters"
                  value={staffForm.password}
                  onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                  className={`w-full border rounded-xl px-3 py-2 focus:outline-none font-mono transition ${
                    editingStaffId
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed select-none'
                      : 'bg-slate-50/50 text-slate-800 border-slate-200 focus:bg-white focus:border-slate-400'
                  }`}
                  required={!editingStaffId}
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Designation</label>
                <input
                  type="text"
                  placeholder="e.g. Dispatcher / Sales Exec"
                  value={staffForm.designation}
                  onChange={(e) => setStaffForm({ ...staffForm, designation: e.target.value })}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:bg-white focus:border-slate-400 focus:outline-none transition"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">System Role *</label>
                <select
                  value={staffForm.roleId}
                  onChange={(e) => setStaffForm({ ...staffForm, roleId: e.target.value })}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-semibold focus:bg-white focus:border-slate-400 focus:outline-none transition cursor-pointer"
                >
                  {roles
                    .filter((r) => r.RoleName.startsWith('Agency'))
                    .map((r) => (
                      <option key={r.RoleId} value={r.RoleId}>
                        {r.RoleName} ({r.Description || 'Access'})
                      </option>
                    ))}
                </select>
              </div>

              {/* IN-FORM ACTIVE SWITCH */}
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                <div>
                  <span className="font-semibold text-slate-700 block">Account Status</span>
                  <span className="text-[11px] text-slate-500">
                    {staffForm.isActive ? 'Active (Panel access enabled)' : 'Inactive (Login restricted)'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setStaffForm((prev) => ({ ...prev, isActive: !prev.isActive }))}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ${
                    staffForm.isActive ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <div className="bg-white w-4 h-4 rounded-full shadow-xs transform" />
                </button>
              </div>

              <button
                type="submit"
                className={`w-full py-2.5 text-white font-bold rounded-xl shadow-xs transition active:scale-95 cursor-pointer ${
                  editingStaffId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-900 hover:bg-slate-800'
                }`}
              >
                {editingStaffId ? 'Update Staff Member' : 'Create Staff Access'}
              </button>
            </form>
          </div>

          {/* Staff Table Card */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Agency Personnel</h3>
                <p className="text-[11px] text-slate-400">Click any row to load into editor</p>
              </div>
              <button
                type="button"
                onClick={fetchStaff}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 hover:text-slate-800 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <span className={isRefreshing ? 'animate-spin' : ''}>
                  <Icons.Refresh />
                </span>
                <span>Refresh</span>
              </button>
            </div>

            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/75 border-b border-slate-100 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Staff Name</th>
                    <th className="py-3 px-4">Designation</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Phone</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {staffList.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-12 text-center text-slate-400">
                        No agency personnel found.
                      </td>
                    </tr>
                  ) : (
                    staffList.map((st) => {
                      const isSelected = editingStaffId === st.StaffId;
                      return (
                        <tr
                          key={st.StaffId}
                          onClick={() => startEditStaff(st)}
                          className={`group cursor-pointer transition select-none ${
                            isSelected
                              ? 'bg-blue-50/80 ring-2 ring-inset ring-blue-500/50'
                              : 'hover:bg-slate-50/70'
                          }`}
                        >
                          <td className="py-3 px-4 font-bold text-slate-800">{st.StaffName}</td>
                          <td className="py-3 px-4 text-slate-600">{st.Designation || '-'}</td>
                          <td className="py-3 px-4">
                            <span className="bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded-md font-semibold border border-slate-200/80">
                              {st.Users?.Roles?.RoleName}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-700">{st.Users?.Phone}</td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                st.Users?.IsActive
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  st.Users?.IsActive ? 'bg-emerald-500' : 'bg-rose-500'
                                }`}
                              />
                              {st.Users?.IsActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="opacity-0 group-hover:opacity-100 text-blue-600 transition-opacity flex items-center justify-center">
                              <Icons.Edit />
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