import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getConfiguredAdminEmail } from '@/api/supabaseClient';

const AdminLoadingFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
  </div>
);

/**
 * Route protection strictly for the single authorized system administrator.
 * Redirects unauthorized users or non-admin citizens to login with a warning.
 */
export default function AdminProtectedRoute() {
  const { user, isAuthenticated, isLoadingAuth, authChecked } = useAuth();

  console.log('[AUTH] auth loading:', isLoadingAuth || !authChecked);
  console.log('[AUTH] current route:', typeof window !== 'undefined' ? window.location.pathname : '');

  if (isLoadingAuth || !authChecked) {
    return <AdminLoadingFallback />;
  }

  if (!isAuthenticated || !user) {
    console.log('[AUTH] user email:', null);
    console.log('[AUTH] admin email:', getConfiguredAdminEmail());
    console.log('[AUTH] admin check:', false);
    console.log('[AUTH] selected role:', null);
    console.log('[AUTH] navigating to: /login?role=admin');
    return <Navigate to="/login?role=admin" replace />;
  }

  console.log('[AUTH] user email:', user.email);
  console.log('[AUTH] admin email:', getConfiguredAdminEmail());
  console.log('[AUTH] admin check:', user.role === 'admin');
  console.log('[AUTH] selected role:', user.role);

  if (user?.role !== 'admin') {
    console.log('[AUTH] navigating to: /login?role=admin&error=unauthorized');
    return <Navigate to="/login?role=admin&error=unauthorized" replace />;
  }

  return <Outlet />;
}
