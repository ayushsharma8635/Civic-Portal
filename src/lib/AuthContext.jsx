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
    const isAdmin = isAuthorizedAdminEmail(email);
    const role = isAdmin ? 'admin' : 'citizen';

    let full_name = rawUser.user_metadata?.full_name || rawUser.user_metadata?.name || '';
    const avatar_url = rawUser.user_metadata?.avatar_url || rawUser.user_metadata?.picture || '';

    logAuth('ADMIN CHECK', {
      USER_EMAIL: email,
      CONFIGURED_ADMIN: getConfiguredAdminEmail(),
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
    }
  }, [resolveUserFromSession]);

  useEffect(() => {
    let isMounted = true;
    let fallbackTimer = null;

    // Check for provider error parameters in URL
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const hashStr = window.location.hash.startsWith('#') ? window.location.hash.substring(1) : '';
      const hashParams = new URLSearchParams(hashStr);

      const oauthError =
        searchParams.get('error_description') ||
        searchParams.get('error') ||
        hashParams.get('error_description') ||
        hashParams.get('error');

      if (oauthError) {
        const message = decodeURIComponent(oauthError.replace(/\+/g, ' '));
        logAuth('AUTH EVENT: OAUTH_ERROR', { REDIRECT_REASON: message });
        setAuthError({ type: 'oauth_error', message });
        setIsLoadingAuth(false);
        setAuthChecked(true);
        cleanUrlOAuthParams();
        return;
      }
    }

    const hasCodeInUrl = typeof window !== 'undefined' && (
      window.location.search.includes('code=') || window.location.hash.includes('access_token=')
    );

    logAuth('AUTH INITIALIZING', {
      AUTH_LOADING: true,
      HAS_CODE_IN_URL: hasCodeInUrl,
    });

    // Register Supabase onAuthStateChange listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!isMounted) return;

      logAuth('AUTH EVENT', {
        EVENT: event,
        SESSION_EXISTS: Boolean(currentSession),
        USER_EMAIL: currentSession?.user?.email || null,
      });

      switch (event) {
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
            logAuth('SESSION RESTORED (INITIAL_SESSION)', {
              USER_EMAIL: resolvedUser?.email,
              ROLE: resolvedUser?.role,
            });
          } else if (hasCodeInUrl) {
            // OAuth PKCE exchange in flight — keep loading = true and wait for SIGNED_IN
            logAuth('INITIAL_SESSION PENDING', {
              REDIRECT_REASON: 'Waiting for Supabase OAuth PKCE exchange',
            });
          } else {
            // No stored session and no pending code in URL
            setSession(null);
            setUser(null);
            setIsAuthenticated(false);
            setAuthError(null);
            setIsLoadingAuth(false);
            setAuthChecked(true);
          }
          break;
        }

        case 'SIGNED_IN': {
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
            logAuth('SESSION ESTABLISHED (SIGNED_IN)', {
              USER_EMAIL: resolvedUser?.email,
              ROLE: resolvedUser?.role,
            });
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
          logAuth('SIGNED_OUT');
          break;
        }

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
          }
          break;
        }

        default:
          break;
      }
    });

    // Safety fallback: if URL has an OAuth code but no event fires within 8s, query session directly
    if (hasCodeInUrl) {
      fallbackTimer = setTimeout(async () => {
        if (!isMounted) return;
        logAuth('AUTH TIMEOUT FALLBACK CHECK', {
          REDIRECT_REASON: 'Safety timer elapsed, checking session directly',
        });
        try {
          const { data: { session: fallbackSession } } = await supabase.auth.getSession();
          if (fallbackSession?.user) {
            const resolvedUser = await resolveUserFromSession(fallbackSession);
            if (!isMounted) return;
            setSession(fallbackSession);
            setUser(resolvedUser);
            setIsAuthenticated(true);
          } else {
            setUser(null);
            setIsAuthenticated(false);
          }
        } catch (e) {
          console.warn('[Civic Auth] Fallback session check error:', e);
          setUser(null);
          setIsAuthenticated(false);
        } finally {
          if (isMounted) {
            setIsLoadingAuth(false);
            setAuthChecked(true);
            cleanUrlOAuthParams();
          }
        }
      }, 8000);
    }

    return () => {
      isMounted = false;
      if (fallbackTimer) clearTimeout(fallbackTimer);
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
