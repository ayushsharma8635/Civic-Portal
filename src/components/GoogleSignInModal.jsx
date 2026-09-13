import React, { useState, useEffect, useRef } from 'react';
import { Shield, User, X, Key, ExternalLink } from 'lucide-react';
import GoogleIcon from '@/components/GoogleIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase, isAuthorizedAdminEmail, AUTHORIZED_ADMIN_EMAIL, getAuthRedirectUrl } from '@/api/supabaseClient';

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
  const role = defaultRole;
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

    const currentRole = roleRef.current || defaultRole;
    const isAuthorizedAdmin = isAuthorizedAdminEmail(payload.email);
    if (currentRole === 'admin' && !isAuthorizedAdmin) {
      alert(`Access denied: Only the authorized administrator account (${AUTHORIZED_ADMIN_EMAIL}) can sign in as Admin.`);
      return;
    }

    const assignedRole = isAuthorizedAdmin ? 'admin' : 'citizen';
    try {
      if (supabase?.auth?.signInWithIdToken) {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: response.credential,
        });
        if (error) {
          console.warn('Supabase signInWithIdToken sync failed, falling back to OAuth redirect:', error.message);
          await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
              redirectTo: getAuthRedirectUrl(assignedRole === 'admin' ? '/admin' : '/'),
              queryParams: { prompt: 'select_account' },
            },
          });
          return;
        }
      }
    } catch (e) {
      console.warn('Supabase signInWithIdToken error:', e);
    }

    if (onSignInRef.current) {
      onSignInRef.current({ email: payload.email, role: assignedRole });
    } else {
      window.location.href = assignedRole === 'admin' ? '/admin' : '/';
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

  const handleOAuthSignIn = async () => {
    try {
      const currentRole = roleRef.current || defaultRole;
      const returnTo = currentRole === 'admin' ? '/admin' : '/';
      const redirectTo = getAuthRedirectUrl(returnTo);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      alert('Google OAuth Error: ' + (err.message || 'Failed to initialize Google login'));
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
            <p className="text-xs text-muted-foreground">
              {defaultRole === 'admin' ? 'Authorized System Administrator' : 'Citizen Grievance Redressal'}
            </p>
          </div>
        </div>

        {/* Access Level Info */}
        {defaultRole === 'admin' ? (
          <div className="mb-4 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center gap-2.5 text-xs">
            <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <p className="font-semibold text-emerald-700 dark:text-emerald-300">Administrator Portal</p>
              <p className="text-muted-foreground text-[11px]">Only the authorized system administrator account ({AUTHORIZED_ADMIN_EMAIL}) can access this portal.</p>
            </div>
          </div>
        ) : (
          <div className="mb-4 p-3 rounded-xl border border-primary/20 bg-primary/5 flex items-center gap-2.5 text-xs">
            <User className="w-4 h-4 text-primary shrink-0" />
            <div>
              <p className="font-semibold text-primary">Citizen Portal</p>
              <p className="text-muted-foreground text-[11px]">Sign in with any Google account to submit complaints and track resolution status.</p>
            </div>
          </div>
        )}

        {/* Google Sign-In Actions */}
        <div className="space-y-3 mb-4">
          {activeClientId && (
            <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 text-center space-y-2">
              <p className="text-xs font-medium text-foreground">
                Google 1-Tap / Instant Sign-In:
              </p>
              <div className="flex justify-center" ref={googleBtnRef}></div>
            </div>
          )}

          {activeClientId && (
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center text-[11px] uppercase"><span className="bg-card px-2 text-muted-foreground">or browser sign-in</span></div>
            </div>
          )}

          <Button
            type="button"
            variant={activeClientId ? "outline" : "default"}
            onClick={handleOAuthSignIn}
            className="w-full h-11 font-medium"
          >
            <GoogleIcon className="w-4 h-4 mr-2" />
            Continue with Google (OAuth)
          </Button>
          <p className="text-[11px] text-muted-foreground text-center">
            Allows any valid Google account to authenticate securely.
          </p>
        </div>

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
