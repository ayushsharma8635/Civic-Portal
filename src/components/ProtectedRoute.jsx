import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

const DefaultFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

export default function ProtectedRoute({ fallback = <DefaultFallback />, unauthenticatedElement }) {
  const { isAuthenticated, isLoadingAuth, authChecked, authError } = useAuth();

  console.log('[AUTH] auth loading:', isLoadingAuth || !authChecked);
  console.log('[AUTH] current route:', typeof window !== 'undefined' ? window.location.pathname : '');

  if (isLoadingAuth || !authChecked) {
    return fallback;
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
    if (authError.type === 'oauth_error') {
      console.log('[AUTH] navigating to: /login?error=' + encodeURIComponent(authError.message));
      return <Navigate to={`/login?error=${encodeURIComponent(authError.message)}`} replace />;
    }
    return unauthenticatedElement;
  }

  if (!isAuthenticated) {
    console.log('[AUTH] navigating to: unauthenticated element (login)');
    return unauthenticatedElement;
  }

  return <Outlet />;
}
