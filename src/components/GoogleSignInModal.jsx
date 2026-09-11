import React, { useState, useEffect, useRef } from 'react';
import { Shield, User, X, Key, ExternalLink, CheckCircle } from 'lucide-react';
import GoogleIcon from '@/components/GoogleIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/api/supabaseClient';

// Helper to decode Google JWT token
function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

// Singleton tracking to ensure google.accounts.id.initialize is called only ONCE
let initializedGsiClientId = null;
let activeGsiHandler = null;

export default function GoogleSignInModal({ isOpen, onClose, defaultRole = 'citizen', onSignIn = (_user) => {} }) {
  const [role, setRole] = useState(defaultRole);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [customClientId, setCustomClientId] = useState(() => localStorage.getItem('scms_google_client_id') || '');
  const [showClientIdInput, setShowClientIdInput] = useState(false);
  const googleBtnRef = useRef(null);

  const activeClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || customClientId || '';

  const roleRef = useRef(role);
  roleRef.current = role;

  const onSignInRef = useRef(onSignIn);
  onSignInRef.current = onSignIn;

  // Keep active handler pointing to latest state/refs without re-initializing GSI
  activeGsiHandler = async (response) => {
    if (!response?.credential) return;
    const payload = parseJwt(response.credential);
    if (!payload) return;

    const currentRole = roleRef.current;
    const verifiedUser = {
      id: 'google-' + (payload.sub || Math.random().toString(36).substring(2, 9)),
      email: payload.email,
      full_name: payload.name || payload.email.split('@')[0],
      avatar_url: payload.picture,
      role: currentRole,
    };
    localStorage.setItem('scms_demo_user', JSON.stringify(verifiedUser));
    localStorage.setItem('scms_auth_intended_role', currentRole);

    try {
      if (supabase?.auth?.signInWithIdToken) {
        await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: response.credential,
        });
      }
    } catch (e) {
      console.warn('Supabase signInWithIdToken sync:', e);
    }

    if (onSignInRef.current) {
      onSignInRef.current(verifiedUser);
    } else {
      window.location.href = currentRole === 'admin' ? '/admin' : '/';
    }
  };

  // Initialize Google Identity Services strictly ONCE per client ID
  useEffect(() => {
    if (!isOpen || !activeClientId) return;

    let isMounted = true;

    const setupGoogle = () => {
      if (!isMounted) return;
      const google = window.google;
      if (google?.accounts?.id && googleBtnRef.current) {
        try {
          if (initializedGsiClientId !== activeClientId) {
            google.accounts.id.initialize({
              client_id: activeClientId,
              callback: (response) => {
                if (activeGsiHandler) {
                  activeGsiHandler(response);
                }
              },
            });
            initializedGsiClientId = activeClientId;
          }

          // Render official Google button
          googleBtnRef.current.innerHTML = '';
          google.accounts.id.renderButton(googleBtnRef.current, {
            theme: 'outline',
            size: 'large',
            width: 360,
            text: 'continue_with',
            shape: 'pill',
          });
        } catch (e) {
          console.warn('Google GSI render error:', e);
        }
      }
    };

    const timer = setTimeout(setupGoogle, 150);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [isOpen, activeClientId]);

  if (!isOpen) return null;

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!email) return;

    const user = {
      id: 'google-user-' + Math.random().toString(36).substring(2, 9),
      email: email.trim(),
      full_name: fullName.trim() || email.split('@')[0],
      role,
    };

    localStorage.setItem('scms_demo_user', JSON.stringify(user));
    localStorage.setItem('scms_auth_intended_role', role);

    if (onSignIn) {
      onSignIn(user);
    } else {
      window.location.href = role === 'admin' ? '/admin' : '/';
    }
  };

  const handleSaveClientId = (e) => {
    e.preventDefault();
    if (customClientId.trim()) {
      localStorage.setItem('scms_google_client_id', customClientId.trim());
      setShowClientIdInput(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card text-card-foreground w-full max-w-md rounded-2xl border border-border shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-muted/60 grid place-items-center border border-border shrink-0">
            <GoogleIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-heading font-semibold text-lg text-foreground">Sign in with Google</h3>
            <p className="text-xs text-muted-foreground">Select your access role and sign in</p>
          </div>
        </div>

        {/* Access Level Picker */}
        <div className="mb-5 space-y-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase">1. Choose Access Level</Label>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setRole('citizen')}
              className={`p-3 rounded-xl border text-left transition-all ${
                role === 'citizen'
                  ? 'border-primary bg-primary/10 ring-1 ring-primary text-foreground'
                  : 'border-border bg-muted/30 text-muted-foreground hover:border-border/80'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <User className={`h-4 w-4 ${role === 'citizen' ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="text-sm font-semibold">Citizen</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-tight">Submit & track complaints</p>
            </button>

            <button
              type="button"
              onClick={() => setRole('admin')}
              className={`p-3 rounded-xl border text-left transition-all ${
                role === 'admin'
                  ? 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500 text-foreground'
                  : 'border-border bg-muted/30 text-muted-foreground hover:border-border/80'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Shield className={`h-4 w-4 ${role === 'admin' ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                <span className="text-sm font-semibold">Admin</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-tight">Full system access</p>
            </button>
          </div>
        </div>

        {/* Official Google GSI Button Section */}
        {activeClientId ? (
          <div className="mb-5 p-4 rounded-xl border border-primary/20 bg-primary/5 text-center space-y-3">
            <p className="text-xs font-medium text-foreground">
              Google Official Popup is active! Click below:
            </p>
            <div className="flex justify-center" ref={googleBtnRef}></div>
            <div className="flex items-center justify-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="w-3.5 h-3.5" /> Client ID connected
            </div>
          </div>
        ) : (
          <div className="mb-4 space-y-3">
            <Label className="text-xs font-semibold text-muted-foreground uppercase">2. Sign In Directly</Label>

            {/* Direct Google ID Email Input */}
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="google-email" className="text-xs">Your Google Email ID</Label>
                <Input
                  id="google-email"
                  type="email"
                  placeholder="e.g. yourname@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="h-10"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="google-name" className="text-xs">Your Name (Optional)</Label>
                <Input
                  id="google-name"
                  type="text"
                  placeholder="e.g. Ayush"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-10"
                />
              </div>

              <Button type="submit" className="w-full h-10 font-medium">
                <GoogleIcon className="w-4 h-4 mr-2" />
                Sign in as {role === 'admin' ? 'Administrator' : 'Citizen'}
              </Button>
            </form>
          </div>
        )}

        {/* Connect Google Client ID expander */}
        <div className="border-t border-border pt-3 mt-3 text-xs text-muted-foreground">
          {!showClientIdInput ? (
            <button
              type="button"
              onClick={() => setShowClientIdInput(true)}
              className="text-primary hover:underline flex items-center gap-1 text-xs"
            >
              <Key className="w-3.5 h-3.5" />
              {activeClientId ? 'Change Google Client ID' : 'Connect Google Client ID for 1-click Popup'}
            </button>
          ) : (
            <form onSubmit={handleSaveClientId} className="space-y-2 mt-2 p-3 bg-muted/40 rounded-xl border border-border">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Google Client ID</Label>
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-primary hover:underline flex items-center gap-0.5"
                >
                  Get free ID <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
              <Input
                placeholder="xxxx.apps.googleusercontent.com"
                value={customClientId}
                onChange={(e) => setCustomClientId(e.target.value)}
                className="h-9 text-xs"
              />
              <div className="flex gap-2">
                <Button type="submit" size="sm" className="h-8 text-xs flex-1">Save & Enable Popup</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setShowClientIdInput(false)} className="h-8 text-xs">Cancel</Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
