import React, { useState } from 'react';
import Login from './Login';
import AgencyConfig from './AgencyConfig';
import AgencyProducts from './AgencyProducts';
import AgencyOrders from './AgencyOrders';
import AgencyUsers from './AgencyUsers';
import AgencyCounterOrder from './AgencyCounterOrder';
import ShopPortal from './ShopPortal';
import { Icons } from './Icons';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [agencySubTab, setAgencySubTab] = useState('orders');

  const handleLogout = () => {
    setCurrentUser(null);
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
    ? (staffData?.StaffName || 'Agency Admin') 
    : (shopData?.ShopName || 'Retail Shop');

  const navItems = [
    { id: 'orders', label: 'Orders', icon: Icons.Orders },
    { id: 'products', label: 'Products', icon: Icons.Products },
    { id: 'counter', label: 'Counter Order', icon: Icons.Cart },
    { id: 'users', label: 'Parties & Users', icon: Icons.Parties },
    { id: 'config', label: 'Master Config', icon: Icons.Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans w-full max-w-full overflow-x-hidden">
      {/* Top Header */}
      <header className="bg-slate-900 text-white px-3 sm:px-6 py-2.5 sm:py-3 shadow-md sticky top-0 z-50">
        <div className="flex items-center justify-between gap-2 max-w-7xl mx-auto w-full">
          {/* Logo & Portal Identity */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-emerald-400 shrink-0">
              {isAgency ? <Icons.Orders className="w-4 h-4 sm:w-5 sm:h-5" /> : <Icons.Store className="w-4 h-4 sm:w-5 sm:h-5" />}
            </div>
            <div className="truncate">
              <h1 className="font-bold text-xs sm:text-sm tracking-wide text-white truncate">
                {isAgency ? 'Wholesale Agency Panel' : 'Store Order Portal'}
              </h1>
              <p className="text-[11px] sm:text-xs text-emerald-400 font-medium truncate">
                {displayName}
              </p>
            </div>
          </div>

          {/* Desktop Nav Tabs */}
          {isAgency && (
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

        {/* Mobile Horizontal Navigation Bar (Directly below header on small screens) */}
        {isAgency && (
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
        {isAgency ? (
          agencySubTab === 'orders' ? (
            <AgencyOrders />
          ) : agencySubTab === 'products' ? (
            <AgencyProducts currentUser={currentUser} />
          ) : agencySubTab === 'counter' ? (
            <AgencyCounterOrder currentUser={currentUser} />
          ) : agencySubTab === 'users' ? (
            <AgencyUsers />
          ) : (
            <AgencyConfig />
          )
        ) : (
          <ShopPortal currentUser={currentUser} />
        )}
      </main>
    </div>
  );
}