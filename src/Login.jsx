import React, { useState } from 'react';
import { supabase } from './supabaseClient';

export default function Login({ onLoginSuccess }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      // 1. Fetch user by Phone & Password with related profiles
      const { data: user, error: userError } = await supabase
        .from('Users')
        .select(`
          UserId,
          Phone,
          RoleId,
          IsActive,
          Roles ( RoleName ),
          ShopDetails:ShopDetails ( ShopName, OwnerName, Address, Route, GstNumber ),
          AgencyStaffDetails:AgencyStaffDetails ( StaffName, Designation )
        `)
        .eq('Phone', phone.trim())
        .eq('Password', password.trim())
        .single();

      console.log('Logged-in User Data:', user); // Inspection check

      if (userError || !user) {
        setErrorMsg('Invalid Phone number or Password.');
        setLoading(false);
        return;
      }

      if (!user.IsActive) {
        setErrorMsg('Your account is inactive. Please contact Agency Admin.');
        setLoading(false);
        return;
      }

      // Login success: pass user details to parent state
      onLoginSuccess(user);
    } catch (err) {
      setErrorMsg('Login failed. Please check your network connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6 sm:p-8 border border-slate-200">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 text-2xl font-bold mb-3">
            📦
          </div>
          <h1 className="text-2xl font-extrabold text-slate-800">Wholesale Order</h1>
          <p className="text-sm text-slate-500 mt-1">Agency & Retail Store Login</p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-600 text-xs font-medium rounded-lg">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
              Mobile Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 9600791919"
              required
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] transition font-semibold text-white shadow-md text-sm mt-2 disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Login'}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400">
            For retail login access, contact Shree Gowsik Agencies.
          </p>
        </div>
      </div>
    </div>
  );
}