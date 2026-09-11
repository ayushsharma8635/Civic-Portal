import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { safeReturnTo } from '@/lib/authReturnTo';
import RoleSelection from '@/components/login/RoleSelection';
import CitizenLoginForm from '@/components/login/CitizenLoginForm';
import OfficerLoginForm from '@/components/login/OfficerLoginForm';
import AdminLoginForm from '@/components/login/AdminLoginForm';
import { Button } from '@/components/ui/button';
import { UserCheck, ArrowRight, LogOut, AlertCircle } from 'lucide-react';

export default function Login() {
  const urlParams = new URLSearchParams(window.location.search);
  const [role, setRole] = useState(urlParams.get('role'));
  const [oauthError, setOauthError] = useState(() => {
    const err = urlParams.get('error_description') || urlParams.get('error');
    return err ? decodeURIComponent(err.replace(/\+/g, ' ')) : '';
  });
  const { isAuthenticated, user, logout } = useAuth();

  useEffect(() => {
    if (isAuthenticated && user) {
      const returnTo = safeReturnTo();
      const target = returnTo && returnTo !== '/login' ? returnTo : (user.role === 'admin' ? '/admin' : '/');
      window.location.href = target;
    }
  }, [isAuthenticated, user]);

  const selectRole = (r) => {
    setRole(r);
    const url = new URL(window.location.href);
    if (r) url.searchParams.set('role', r);
    else url.searchParams.delete('role');
    window.history.replaceState({}, '', url.toString());
  };

  return (
    <div className="w-full">
      {oauthError && (
        <div className="max-w-md mx-auto mb-4 p-3 rounded-xl border border-destructive/20 bg-destructive/10 flex items-center gap-2 text-destructive text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{oauthError}</span>
        </div>
      )}
      {isAuthenticated && user && (
        <div className="max-w-md mx-auto mb-4 p-3 rounded-xl border border-primary/20 bg-primary/5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <UserCheck className="w-4 h-4 text-primary shrink-0" />
            <span className="truncate">
              Signed in as <strong>{user.full_name || user.email}</strong> ({user.role})
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Link to={user.role === 'admin' ? '/admin' : '/'}>
              <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs">
                Dashboard <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
              title="Log out"
              onClick={() => logout(false)}
            >
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {role === 'citizen' && <CitizenLoginForm onBack={() => selectRole(null)} />}
      {role === 'officer' && <OfficerLoginForm onBack={() => selectRole(null)} />}
      {role === 'admin' && <AdminLoginForm onBack={() => selectRole(null)} />}
      {!role && <RoleSelection onSelect={selectRole} />}
    </div>
  );
}