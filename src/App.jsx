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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-slate-900 text-white px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-emerald-400">
            {isAgency ? <Icons.Orders className="w-5 h-5" /> : <Icons.Store className="w-5 h-5" />}
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-wide">
              {isAgency ? 'Wholesale Agency Panel' : 'Store Order Portal'}
            </h1>
            <p className="text-xs text-emerald-400 font-medium">
              {displayName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isAgency && (
            <div className="flex bg-slate-800/90 p-1 rounded-xl border border-slate-700/80 overflow-x-auto">
              <button
                type="button"
                onClick={() => setAgencySubTab('orders')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap cursor-pointer ${
                  agencySubTab === 'orders' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Icons.Orders className="w-3.5 h-3.5" />
                <span>Orders</span>
              </button>
              <button
                type="button"
                onClick={() => setAgencySubTab('products')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap cursor-pointer ${
                  agencySubTab === 'products' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Icons.Products className="w-3.5 h-3.5" />
                <span>Products</span>
              </button>
              <button
                type="button"
                onClick={() => setAgencySubTab('counter')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap cursor-pointer ${
                  agencySubTab === 'counter' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Icons.Cart className="w-3.5 h-3.5" />
                <span>Counter Order</span>
              </button>
              <button
                type="button"
                onClick={() => setAgencySubTab('users')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap cursor-pointer ${
                  agencySubTab === 'users' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Icons.Parties className="w-3.5 h-3.5" />
                <span>Parties & Users</span>
              </button>
              <button
                type="button"
                onClick={() => setAgencySubTab('config')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap cursor-pointer ${
                  agencySubTab === 'config' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Icons.Settings className="w-3.5 h-3.5" />
                <span>Master Config</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs bg-rose-600/90 hover:bg-rose-600 px-3 py-1.5 rounded-xl font-semibold transition active:scale-95 whitespace-nowrap shadow-xs cursor-pointer"
          >
            <Icons.Logout className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="p-4 sm:p-6 flex-1">
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