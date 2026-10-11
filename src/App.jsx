import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Login from './Login';
import AgencyConfig from './AgencyConfig';
import AgencyProducts from './AgencyProducts';
import AgencyOrders from './AgencyOrders';
import AgencyUsers from './AgencyUsers';
import AgencyCounterOrder from './AgencyCounterOrder';
import ShopPortal from './ShopPortal';
import { Icons } from './Icons';
import AgencyAnalytics from './AgencyAnalytics';
import AgencyManagerModal from './AgencyManagerModal';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [agencySubTab, setAgencySubTab] = useState('orders');

  // Multi-Agency States
  const [agencies, setAgencies] = useState([]);
  const [selectedAgency, setSelectedAgency] = useState(null);
  const [isAgencyModalOpen, setIsAgencyModalOpen] = useState(false);
  const [loadingAgencies, setLoadingAgencies] = useState(false);

  useEffect(() => {
    if (currentUser) {
      fetchAgencies();
    }
  }, [currentUser]);

  const fetchAgencies = async () => {
    setLoadingAgencies(true);
    const { data, error } = await supabase
      .from('Agencies')
      .select('*')
      .eq('IsActive', true)
      .order('AgencyId', { ascending: true });

    if (!error && data) {
      setAgencies(data);
      if (data.length > 0) {
        // Default to first agency if not set or invalid
        setSelectedAgency((prev) => prev || data[0]);
      } else {
        setSelectedAgency(null);
      }
    }
    setLoadingAgencies(false);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSelectedAgency(null);
  };

  const handleAgencyCreated = (newAgency) => {
    setAgencies((prev) => [...prev, newAgency]);
    setSelectedAgency(newAgency);
    setIsAgencyModalOpen(false);
  };

  if (!currentUser) {
    return <Login onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  const roleName = currentUser.Roles?.RoleName;
  const isAgency = roleName === 'AgencyAdmin' || roleName === 'AgencyStaff';

  const shopData = Array.isArray(currentUser.ShopDetails)
    ? currentUser.ShopDetails[0]
    : currentUser.ShopDetails;

  const staffData = Array.isArray(currentUser.AgencyStaffDetails)
    ? currentUser.AgencyStaffDetails[0]
    : currentUser.AgencyStaffDetails;

  const displayName = isAgency
    ? staffData?.StaffName || 'Agency Admin'
    : shopData?.ShopName || 'Retail Shop';

  const AnalyticsIcon = Icons.Analytics || ((props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </svg>
  ));

  const navItems = [
    { id: 'orders', label: 'Orders', icon: Icons.Orders },
    { id: 'products', label: 'Products', icon: Icons.Products },
    { id: 'counter', label: 'Counter Order', icon: Icons.Cart },
    { id: 'users', label: 'Parties & Users', icon: Icons.Parties },
    { id: 'analytics', label: 'Analytics', icon: AnalyticsIcon },
    { id: 'config', label: 'Master Config', icon: Icons.Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans w-full max-w-full overflow-x-hidden">
      {/* Top Header */}
      <header className="bg-slate-900 text-white px-3 sm:px-6 py-2.5 sm:py-3 shadow-md sticky top-0 z-50">
        <div className="flex flex-wrap items-center justify-between gap-2 max-w-7xl mx-auto w-full">
          {/* Identity & Multi-Agency Selector */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-emerald-400 shrink-0">
              {isAgency ? <Icons.Orders className="w-4 h-4 sm:w-5 sm:h-5" /> : <Icons.Store className="w-4 h-4 sm:w-5 sm:h-5" />}
            </div>
            <div className="truncate">
              <h1 className="font-bold text-xs sm:text-sm tracking-wide text-white truncate">
                {isAgency ? 'Wholesale Agency Panel' : 'Store Order Portal'}
              </h1>

              {/* Agency Selector Dropdown for Agency Users */}
              {isAgency ? (
                <div className="flex items-center gap-1.5 mt-0.5">
                  {agencies.length > 0 ? (
                    <>
                      <select
                        value={selectedAgency?.AgencyId || ''}
                        onChange={(e) => {
                          const ag = agencies.find((a) => a.AgencyId === parseInt(e.target.value, 10));
                          if (ag) setSelectedAgency(ag);
                        }}
                        className="bg-slate-800 text-emerald-400 border border-slate-700 rounded-lg px-2 py-0.5 text-[11px] font-bold focus:outline-none cursor-pointer"
                      >
                        {agencies.map((a) => (
                          <option key={a.AgencyId} value={a.AgencyId}>
                            {a.AgencyName}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setIsAgencyModalOpen(true)}
                        title="Add Another Agency"
                        className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-1.5 py-0.5 rounded border border-slate-700 transition cursor-pointer"
                      >
                        + Add
                      </button>
                    </>
                  ) : (
                    <span className="text-[11px] text-amber-400 font-semibold">No Agencies Found</span>
                  )}
                </div>
              ) : (
                <p className="text-[11px] sm:text-xs text-emerald-400 font-medium truncate">
                  {displayName}
                </p>
              )}
            </div>
          </div>

          {/* Desktop Nav Tabs */}
          {isAgency && agencies.length > 0 && (
            <div className="hidden lg:flex bg-slate-800/90 p-1 rounded-xl border border-slate-700/80">
              {navItems.map((item) => {
                const IconComponent = item.icon;
                const isActive = agencySubTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setAgencySubTab(item.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap cursor-pointer ${
                      isActive ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <IconComponent className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Logout Button */}
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1 text-xs bg-rose-600/90 hover:bg-rose-600 px-2.5 sm:px-3 py-1.5 rounded-xl font-semibold transition active:scale-95 whitespace-nowrap shadow-xs shrink-0 cursor-pointer"
          >
            <Icons.Logout className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>

        {/* Mobile Horizontal Navigation Bar */}
        {isAgency && agencies.length > 0 && (
          <div className="lg:hidden mt-2 pt-2 border-t border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {navItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = agencySubTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setAgencySubTab(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive ? 'bg-emerald-600 text-white font-semibold shadow-xs' : 'bg-slate-800/80 text-slate-300 hover:text-white'
                  }`}
                >
                  <IconComponent className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Main Content Body */}
      <main className="p-3 sm:p-6 flex-1 w-full max-w-7xl mx-auto overflow-x-hidden">
        {/* First-Run Guard: If no agencies exist, block view with setup modal */}
        {isAgency && agencies.length === 0 && !loadingAgencies && (
          <AgencyManagerModal
            isOpen={true}
            isFirstRun={true}
            currentUser={currentUser}
            onAgencyCreated={handleAgencyCreated}
          />
        )}

        {isAgency ? (
          agencies.length > 0 && (
            agencySubTab === 'orders' ? (
              <AgencyOrders selectedAgency={selectedAgency} />
            ) : agencySubTab === 'products' ? (
              <AgencyProducts currentUser={currentUser} selectedAgency={selectedAgency} />
            ) : agencySubTab === 'counter' ? (
              <AgencyCounterOrder currentUser={currentUser} selectedAgency={selectedAgency} />
            ) : agencySubTab === 'users' ? (
              <AgencyUsers selectedAgency={selectedAgency} agencies={agencies} />
            ) : agencySubTab === 'analytics' ? (
              <AgencyAnalytics selectedAgency={selectedAgency} />
            ) : (
              <AgencyConfig selectedAgency={selectedAgency} onOpenAgencyManager={() => setIsAgencyModalOpen(true)} />
            )
          )
        ) : (
          <ShopPortal currentUser={currentUser} />
        )}
      </main>

      {/* Agency Management Modal (For adding 2nd/3rd agency) */}
      <AgencyManagerModal
        isOpen={isAgencyModalOpen}
        onClose={() => setIsAgencyModalOpen(false)}
        currentUser={currentUser}
        onAgencyCreated={handleAgencyCreated}
      />
    </div>
  );
}