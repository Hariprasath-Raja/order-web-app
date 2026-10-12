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
      // Ungal original database query: Password column + relation joins
      const { data: user, error } = await supabase
        .from('Users')
        .select(`
          *,
          Roles ( RoleName ),
          ShopDetails ( * ),
          AgencyStaffDetails ( * )
        `)
        .eq('Phone', phone.trim())
        .eq('Password', password.trim())
        .maybeSingle();

      if (error) throw error;

      if (!user) {
        setErrorMsg('Invalid Phone Number or Password.');
        setLoading(false);
        return;
      }

      if (!user.IsActive) {
        setErrorMsg('Your account has been deactivated. Please contact administrator.');
        setLoading(false);
        return;
      }

      onLoginSuccess(user);
    } catch (err) {
      console.error('Login error:', err);
      setErrorMsg(err.message || 'Login failed.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-800 space-y-6">
        
        {/* LOGO SECTION ONLY */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-48 h-20 bg-white rounded-2xl flex items-center justify-center p-2">
            <img
              src="/logo.png"
              alt="HRV Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Wholesale Agency OS</h1>
            <p className="text-xs text-slate-400 font-medium">B2B Wholesale & Distribution Suite</p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-semibold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-bold mb-1">Phone Number (Login ID)</label>
            <input
              type="text"
              required
              placeholder="e.g. 6382808739"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-xs"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Password</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl transition active:scale-95 shadow-md cursor-pointer disabled:opacity-50 text-xs"
          >
            {loading ? 'Authenticating...' : 'Sign In to Agency Portal'}
          </button>
        </form>

        <p className="text-center text-[11px] text-slate-400 font-medium">
          Authorized Agency Staff & Retail Partners only
        </p>
      </div>
    </div>
  );
}