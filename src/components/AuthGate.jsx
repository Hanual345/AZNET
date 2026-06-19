import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from '../firebase';
import { ShieldCheck, ShieldAlert, Key, Mail, UserPlus, LogIn, Activity } from 'lucide-react';

export default function AuthGate({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Register Auth state listener
    const unsubscribe = onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setSubmitting(true);

    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(email, password);
      } else {
        await signInWithEmailAndPassword(email, password);
      }
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoLogin = async () => {
    setEmail('admin@aznet.co');
    setPassword('admin123');
    setAuthError('');
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword('admin@aznet.co', 'admin123');
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080b11] flex flex-col items-center justify-center text-slate-100 cyber-grid">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Activity className="w-5 h-5 animate-spin text-cyan-400" />
          <span>Hydrating Firebase Authorization tokens...</span>
        </div>
      </div>
    );
  }

  // If user is authenticated, render application children
  if (user) {
    return (
      <div className="relative">
        {/* Floating Logout Button or Auth indicator in App header */}
        <div className="hidden">
          <button onClick={() => signOut()}>Sign Out</button>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080b11] cyber-grid flex items-center justify-center p-4">
      <div className="max-w-md w-full glass-card p-8 rounded-2xl border border-slate-800 shadow-2xl relative overflow-hidden animate-scale-up">
        {/* Glowing Top Decoration */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-40 h-20 bg-cyan-500/10 blur-2xl pointer-events-none" />

        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/20 mx-auto mb-4">
            <span className="font-mono text-xl font-extrabold text-slate-950">AZ</span>
          </div>
          <h2 className="text-xl font-black tracking-wider text-white uppercase">AZNET</h2>
          <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest font-mono">Firebase Gateway</span>
        </div>

        {/* Form panel */}
        <form onSubmit={handleAuthSubmit} className="space-y-4">
          {authError && (
            <div className="p-3 bg-red-950/50 border border-red-800/60 rounded-lg flex items-start gap-2.5 text-xs text-red-400">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-500" />
              <span>Email Address</span>
            </label>
            <input
              type="email"
              placeholder="e.g. admin@aznet.co"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-medium"
              required
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-slate-500" />
              <span>Password</span>
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-mono"
              required
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold py-3 rounded-lg text-xs tracking-wider uppercase transition flex items-center justify-center gap-2 disabled:opacity-50 mt-6 shadow-lg shadow-cyan-600/10"
          >
            {isRegister ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
            <span>{submitting ? 'Authenticating...' : isRegister ? 'Create Account' : 'Authenticate'}</span>
          </button>
        </form>

        {/* Toggle Form Mode */}
        <div className="mt-6 text-center text-xs">
          <button
            onClick={() => { setIsRegister(!isRegister); setAuthError(''); }}
            className="text-slate-400 hover:text-cyan-400 transition"
          >
            {isRegister ? 'Already registered? Sign In instead' : "Don't have an account? Sign Up now"}
          </button>
        </div>

        {/* Sandbox test notice */}
        <div className="mt-6 pt-5 border-t border-slate-900 flex flex-col items-center gap-2">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500/80" />
            <span>Sandbox Simulation Mode Active</span>
          </div>
          <button
            onClick={handleDemoLogin}
            type="button"
            className="text-[10px] bg-slate-900/60 hover:bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-cyan-400 font-semibold transition"
          >
            One-Click Admin Demo Login
          </button>
        </div>
      </div>
    </div>
  );
}
