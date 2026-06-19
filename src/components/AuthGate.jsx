import React, { useState, useEffect } from 'react';
import { 
  auth,
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  GoogleAuthProvider,
  OAuthProvider,
  GithubAuthProvider,
  signInWithPopup
} from '../firebase';
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
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
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
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSocialLogin = async (providerName) => {
    setAuthError('');
    setSubmitting(true);
    try {
      let provider;
      if (providerName === 'google') {
        provider = new GoogleAuthProvider();
      } else if (providerName === 'apple') {
        provider = new OAuthProvider('apple.com');
      } else if (providerName === 'github') {
        provider = new GithubAuthProvider();
      }
      await signInWithPopup(auth, provider);
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
      await signInWithEmailAndPassword(auth, 'admin@aznet.co', 'admin123');
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
          <button onClick={() => signOut(auth)}>Sign Out</button>
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

        {/* Social Auth Providers */}
        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-mono tracking-widest">
              <span className="bg-[#0a0f19] px-2 text-slate-500">Or continue with</span>
            </div>
          </div>
          
          <div className="mt-5 grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => handleSocialLogin('google')}
              disabled={submitting}
              className="flex items-center justify-center py-2.5 border border-slate-800 rounded-lg hover:bg-slate-800 hover:text-white text-slate-400 transition bg-[#0a0f19] disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            </button>
            <button
              type="button"
              disabled={true}
              className="flex items-center justify-center py-2.5 border border-slate-800/50 rounded-lg text-slate-600 bg-[#0a0f19]/50 opacity-30 cursor-not-allowed"
              title="Apple Login currently disabled"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.05 2.26.45 3.09.45.71 0 2-.45 3.39-.45 1.7 0 3.16.59 4.16 1.72-3.41 2.08-2.73 6.64.67 8.01-1.03 1.25-2.14 2.15-3.31 3.24zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
            </button>
            <button
              type="button"
              disabled={true}
              className="flex items-center justify-center py-2.5 border border-slate-800/50 rounded-lg text-slate-600 bg-[#0a0f19]/50 opacity-30 cursor-not-allowed"
              title="GitHub Login currently disabled"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
            </button>
          </div>
        </div>

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
