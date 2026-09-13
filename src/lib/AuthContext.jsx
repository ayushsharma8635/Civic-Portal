import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { api, supabase, isAuthorizedAdminEmail, getConfiguredAdminEmail } from '@/api/supabaseClient';

/**
 * @typedef {Object} AuthContextType
 * @property {any} user
 * @property {any} session
 * @property {boolean} isAuthenticated
 * @property {boolean} isLoadingAuth
 * @property {boolean} isLoadingPublicSettings
 * @property {any} authError
 * @property {any} appPublicSettings
 * @property {boolean} authChecked
 * @property {(shouldRedirect?: boolean) => Promise<void>} logout
 * @property {() => void} navigateToLogin
 * @property {() => Promise<void>} checkUserAuth
 */

/** @type {React.Context<AuthContextType | null>} */
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState({ id: 'smart-complaint' });

  // Structured diagnostic logging
  const logAuth = useCallback((stage, details = {}) => {
    const route = typeof window !== 'undefined' ? window.location.pathname : '';
    console.log(`[Civic Auth] ${stage}:`, {
      ...details,
      CURRENT_ROUTE: route,
    });
  }, []);

  // Resolves profile and role for an authenticated Supabase session
  const resolveUserFromSession = useCallback(async (currentSession) => {
    if (!currentSession?.user) return null;
    const rawUser = currentSession.user;
    const email = (rawUser.email || '').trim().toLowerCase();
    const adminEmail = getConfiguredAdminEmail();
    const isAdmin = isAuthorizedAdminEmail(email);
    const role = isAdmin ? 'admin' : 'citizen';

    let full_name = rawUser.user_metadata?.full_name || rawUser.user_metadata?.name || '';
    const avatar_url = rawUser.user_metadata?.avatar_url || rawUser.user_metadata?.picture || '';

    console.log('[AUTH] user email:', email);
    console.log('[AUTH] admin email:', adminEmail);
    console.log('[AUTH] admin check:', isAdmin);
    console.log('[AUTH] selected role:', role);
    console.log('[AUTH] current route:', typeof window !== 'undefined' ? window.location.pathname : '');

    logAuth('ADMIN CHECK', {
      USER_EMAIL: email,
      CONFIGURED_ADMIN: adminEmail,
      IS_ADMIN: isAdmin,
      RESOLVED_ROLE: role,
    });

    try {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', rawUser.id).maybeSingle();
      if (profile) {
        full_name = profile.full_name || full_name;
        if (profile.role !== role) {
          await supabase.from('profiles').update({ role, updated_at: new Date().toISOString() }).eq('id', rawUser.id);
        }
      } else {
        await supabase.from('profiles').upsert({
          id: rawUser.id,
          email: rawUser.email,
          full_name: full_name || rawUser.email?.split('@')[0] || 'User',
          role,
          avatar_url: avatar_url || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    } catch (profileErr) {
      console.warn('[Civic Auth] Non-fatal profile sync warning:', profileErr.message);
    }

    return {
      id: rawUser.id,
      email: rawUser.email,
      full_name: full_name || rawUser.email?.split('@')[0] || 'User',
      role,
      avatar_url,
    };
  }, [logAuth]);

  // Strip ?code= and ?state= from the URL cleanly after successful session establishment
  const cleanUrlOAuthParams = useCallback(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (url.searchParams.has('code') || url.searchParams.has('state')) {
      url.searchParams.delete('code');
      url.searchParams.delete('state');
      window.history.replaceState(window.history.state, '', url.pathname + (url.search ? url.search : '') + url.hash);
    }
  }, []);

  // Primary manual check helper
  const checkUserAuth = useCallback(async () => {
    try {
      const { data: { session: curSession } } = await supabase.auth.getSession();
      if (curSession?.user) {
        const resolved = await resolveUserFromSession(curSession);
        setSession(curSession);
        setUser(resolved);
        setIsAuthenticated(true);
      } else {
        setSession(null);
        setUser(null);
        setIsAuthenticated(false);
      }
      setAuthError(null);
    } catch (err) {
      console.warn('[Civic Auth] checkUserAuth error:', err);
      setSession(null);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
      console.log('[AUTH] auth loading: false');
    }
  }, [resolveUserFromSession]);

  useEffect(() => {
    let isMounted = true;

    console.log('[AUTH] App started');
    console.log('[AUTH] Initializing Supabase session');
    console.log('[AUTH] Auth loading: true');

    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get('code');

    // Check for provider error parameters in URL
    const oauthError =
      searchParams.get('error_description') ||
      searchParams.get('error') ||
      new URLSearchParams(window.location.hash.substring(1)).get('error_description') ||
      new URLSearchParams(window.location.hash.substring(1)).get('error');

    if (oauthError) {
      const message = decodeURIComponent(oauthError.replace(/\+/g, ' '));
      logAuth('AUTH EVENT: OAUTH_ERROR', { REDIRECT_REASON: message });
      setAuthError({ type: 'oauth_error', message });
      setIsLoadingAuth(false);
      setAuthChecked(true);
      console.log('[AUTH] Auth loading: false');
      cleanUrlOAuthParams();
      return;
    }

    // 1. Asynchronous session restoration
    const restoreSession = async () => {
      try {
        let activeSession = null;

        // If an OAuth code is present in URL, ensure PKCE exchange is performed
        if (code) {
          try {
            console.log('[AUTH] Exchanging authorization code from URL...');
            const { data: exchangeData, error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
            if (!exchangeErr && exchangeData?.session) {
              activeSession = exchangeData.session;
            } else if (exchangeErr) {
              console.warn('[AUTH] Code exchange notice:', exchangeErr.message);
            }
          } catch (codeErr) {
            console.warn('[AUTH] Code exchange exception:', codeErr);
          }
        }

        // If code exchange didn't return a session, read from getSession()
        if (!activeSession) {
          const { data: { session: existingSession } } = await supabase.auth.getSession();
          activeSession = existingSession;
        }

        if (!isMounted) return;

        if (activeSession?.user) {
          const resolvedUser = await resolveUserFromSession(activeSession);
          if (!isMounted) return;
          setSession(activeSession);
          setUser(resolvedUser);
          setIsAuthenticated(true);
          setAuthError(null);
          console.log('[AUTH] Session restored');
          console.log('[AUTH] User email:', resolvedUser?.email);
          console.log('[AUTH] Admin email:', getConfiguredAdminEmail());
          console.log('[AUTH] Admin check:', resolvedUser?.role === 'admin');
          console.log('[AUTH] Selected role:', resolvedUser?.role);
          cleanUrlOAuthParams();
        } else {
          console.log('[AUTH] Session restored: none');
          console.log('[AUTH] User email: null');
          setSession(null);
          setUser(null);
          setIsAuthenticated(false);
          setAuthError(null);
        }
      } catch (err) {
        console.warn('[AUTH] Session restoration exception:', err);
        if (isMounted) {
          setSession(null);
          setUser(null);
          setIsAuthenticated(false);
        }
      } finally {
        if (isMounted) {
          setIsLoadingAuth(false);
          setAuthChecked(true);
          console.log('[AUTH] Auth loading: false');
        }
      }
    };

    restoreSession();

    // 2. Real-time auth state synchronization
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!isMounted) return;

      logAuth('AUTH EVENT', {
        EVENT: event,
        SESSION_EXISTS: Boolean(currentSession),
        USER_EMAIL: currentSession?.user?.email || null,
      });

      switch (event) {
        case 'SIGNED_IN':
        case 'TOKEN_REFRESHED':
        case 'USER_UPDATED': {
          if (currentSession?.user) {
            const resolvedUser = await resolveUserFromSession(currentSession);
            if (!isMounted) return;
            setSession(currentSession);
            setUser(resolvedUser);
            setIsAuthenticated(true);
            setAuthError(null);
            setIsLoadingAuth(false);
            setAuthChecked(true);
            console.log('[AUTH] Session restored');
            console.log('[AUTH] User email:', resolvedUser?.email);
            console.log('[AUTH] Selected role:', resolvedUser?.role);
            console.log('[AUTH] Auth loading: false');
            cleanUrlOAuthParams();
          }
          break;
        }

        case 'SIGNED_OUT': {
          setSession(null);
          setUser(null);
          setIsAuthenticated(false);
          setAuthError(null);
          setIsLoadingAuth(false);
          setAuthChecked(true);
          console.log('[AUTH] Session restored: signed out');
          console.log('[AUTH] Auth loading: false');
          break;
        }

        case 'INITIAL_SESSION': {
          if (currentSession?.user) {
            const resolvedUser = await resolveUserFromSession(currentSession);
            if (!isMounted) return;
            setSession(currentSession);
            setUser(resolvedUser);
            setIsAuthenticated(true);
            setAuthError(null);
            setIsLoadingAuth(false);
            setAuthChecked(true);
            cleanUrlOAuthParams();
          }
          break;
        }

        default:
          break;
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [cleanUrlOAuthParams, logAuth, resolveUserFromSession]);

  const logout = async (shouldRedirect = true) => {
    logAuth('LOGOUT INITIATED');
    setUser(null);
    setSession(null);
    setIsAuthenticated(false);
    await api.auth.logout(shouldRedirect ? '/login' : null);
  };

  const navigateToLogin = () => {
    api.auth.redirectToLogin(window.location.pathname + window.location.search);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        appPublicSettings,
        authChecked,
        logout,
        navigateToLogin,
        checkUserAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
