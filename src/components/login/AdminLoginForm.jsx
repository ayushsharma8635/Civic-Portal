import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, AUTHORIZED_ADMIN_EMAIL, isAuthorizedAdminEmail } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, Mail, Lock, Loader2, ArrowLeft, ShieldAlert } from 'lucide-react';
import AuthLayout from '@/components/AuthLayout';
import GoogleIcon from '@/components/GoogleIcon';
import GoogleSignInModal from '@/components/GoogleSignInModal';

export default function AdminLoginForm({ onBack }) {
  const [email, setEmail] = useState(AUTHORIZED_ADMIN_EMAIL);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showGoogleModal, setShowGoogleModal] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem('admin_login_error');
    if (stored) {
      setError(stored);
      sessionStorage.removeItem('admin_login_error');
    }
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const hashStr = window.location.hash.startsWith('#') ? window.location.hash.substring(1) : '';
      const hashParams = new URLSearchParams(hashStr);
      const hashError = searchParams.get('error_description') || searchParams.get('error') || hashParams.get('error_description') || hashParams.get('error');
      if (hashError) {
        setError(decodeURIComponent(hashError.replace(/\+/g, ' ')));
        window.history.replaceState({}, '', window.location.pathname);
      } else if (searchParams.get('error') === 'unauthorized') {
        setError('Unauthorized access. Only the designated system administrator can access the Admin Dashboard.');
      }
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isAuthorizedAdminEmail(email)) {
      setError(`Access denied. Only the single authorized administrator (${AUTHORIZED_ADMIN_EMAIL}) is permitted to log in.`);
      return;
    }

    setLoading(true);
    try {
      await api.auth.loginViaEmailPassword(email, password);
      const user = await api.auth.me();
      if (user.role !== 'admin') {
        sessionStorage.setItem('admin_login_error', 'This account does not have administrator privileges.');
        api.auth.logout('/login?role=admin');
        return;
      }
      window.location.href = '/admin/dashboard';
    } catch (err) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('invalid login credentials') || msg.toLowerCase().includes('user not found')) {
        setError(
          `Authentication failed. If this admin account has not been created yet in Supabase, please create "${AUTHORIZED_ADMIN_EMAIL}" manually in your Supabase Dashboard under Authentication -> Users.`
        );
      } else {
        setError(err.message || 'Invalid email or password');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    try {
      console.log('[AUTH] Target route: /admin/dashboard');
      console.log('[AUTH] Navigating to dashboard');
      await api.auth.loginWithProvider('google', '/admin/dashboard');
    } catch (err) {
      console.error('[AUTH] Google sign in error:', err);
      setError(err.message || 'Failed to initiate Google sign in');
    }
  };

  return (
    <AuthLayout
      icon={ShieldCheck}
      title="Admin Login"
      subtitle="Single authorized administrator access"
      footer={
        <div className="text-center space-y-1">
          <p className="text-xs text-muted-foreground">
            Strictly one authorized system administrator account.
          </p>
          <p className="text-[11px] text-muted-foreground/70">
            Citizen registration is available on the citizen portal.
          </p>
        </div>
      }
    >
      <GoogleSignInModal
        isOpen={showGoogleModal}
        onClose={() => setShowGoogleModal(false)}
        defaultRole="admin"
        onSignIn={(_user) => {
          setShowGoogleModal(false);
          window.location.href = '/admin/dashboard';
        }}
      />

      <button onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground mb-4 flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Back to role selection
      </button>

      <div className="mb-4 p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-xs text-muted-foreground flex items-start gap-2">
        <ShieldAlert className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-foreground">Designated Admin:</span> {AUTHORIZED_ADMIN_EMAIL}
        </div>
      </div>

      <Button variant="outline" className="w-full h-12 text-sm font-medium mb-6" onClick={handleGoogle}>
        <GoogleIcon className="w-5 h-5 mr-2" />
        Continue with Google (Admin)
      </Button>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
        <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-3 text-muted-foreground">or</span></div>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="admin-email">Admin Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="admin-email" type="email" autoComplete="email" autoFocus placeholder={AUTHORIZED_ADMIN_EMAIL} value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-12" required />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="admin-password">Password</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="admin-password" type="password" autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 h-12" required />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Logging in...</> : 'Log in'}
        </Button>
      </form>
    </AuthLayout>
  );
}