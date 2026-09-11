import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { base44, supabase } from '@/api/supabaseClient';

/**
 * @typedef {Object} AuthContextType
 * @property {any} user
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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState({ id: 'smart-complaint' });

  const checkUserAuth = useCallback(async () => {
    try {
      setIsLoadingAuth(true);

      if (typeof window !== 'undefined') {
        const searchParams = new URLSearchParams(window.location.search);
        const hashStr = window.location.hash.startsWith('#') ? window.location.hash.substring(1) : '';
        const hashParams = new URLSearchParams(hashStr);

        // Check if OAuth provider returned an error
        const oauthError =
          searchParams.get('error_description') ||
          searchParams.get('error') ||
          hashParams.get('error_description') ||
          hashParams.get('error');

        if (oauthError) {
          const message = decodeURIComponent(oauthError.replace(/\+/g, ' '));
          console.warn('OAuth callback error:', message);
          setAuthError({ type: 'oauth_error', message });
          setIsLoadingAuth(false);
          setAuthChecked(true);
          return;
        }

        // Exchange PKCE auth code if present in URL
        const code = searchParams.get('code');
        if (code) {
          try {
            const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
            if (exchangeErr) {
              console.warn('exchangeCodeForSession warning:', exchangeErr.message);
            }
            // Strip code from URL to keep history clean and avoid replay
            searchParams.delete('code');
            const newSearch = searchParams.toString() ? `?${searchParams.toString()}` : '';
            window.history.replaceState(window.history.state, '', window.location.pathname + newSearch + window.location.hash);
          } catch (codeErr) {
            console.warn('Error during exchangeCodeForSession:', codeErr);
          }
        } else if (window.location.hash.includes('access_token')) {
          await supabase.auth.getSession().catch(() => {});
        }
      }

      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthError(null);
    } catch {
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
      setIsLoadingPublicSettings(false);
    }
  }, []);

  useEffect(() => {
    checkUserAuth();

    // Listen for Supabase auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        checkUserAuth();
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
        setAuthChecked(true);
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe?.();
    };
  }, [checkUserAuth]);

  const logout = async (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    await base44.auth.logout(shouldRedirect ? '/login' : null);
  };

  const navigateToLogin = () => {
    base44.auth.redirectToLogin(window.location.pathname + window.location.search);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
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
