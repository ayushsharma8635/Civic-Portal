import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Menu, LogOut, ShieldCheck, User } from 'lucide-react';
import { api } from '@/api/supabaseClient';
import Sidebar from '@/components/Sidebar';
import ThemeToggle from '@/components/ThemeToggle';
import NotificationBell from '@/components/NotificationBell';
import { Button } from '@/components/ui/button';

export default function Layout() {
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  const handleLogout = async () => {
    await api.auth.logout();
    window.location.href = '/login';
  };

  const handleToggleRole = async () => {
    const nextRole = user?.role === 'admin' ? 'citizen' : 'admin';
    const updated = await api.auth.updateMe({ role: nextRole });
    setUser(updated);
    if (nextRole === 'admin') {
      navigate('/admin');
    } else {
      navigate('/');
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar user={user} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border/60 flex items-center justify-between px-4 md:px-6 bg-background">
          <button className="md:hidden text-foreground" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-6 w-6" />
          </button>
          <h2 className="font-display font-bold text-foreground hidden md:block tracking-tight">
            Smart Complaint Management System
          </h2>
          <div className="flex items-center gap-2 ml-auto">
            {user && (
              <button
                type="button"
                onClick={handleToggleRole}
                title={`Currently in ${user.role === 'admin' ? 'Admin' : 'Citizen'} mode. Click to switch.`}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  user.role === 'admin'
                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20 dark:text-emerald-400'
                    : 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20'
                }`}
              >
                {user.role === 'admin' ? (
                  <>
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Admin Mode</span>
                  </>
                ) : (
                  <>
                    <User className="h-3.5 w-3.5" />
                    <span>Citizen Mode</span>
                  </>
                )}
                <span className="text-[10px] opacity-60 underline ml-0.5">Switch</span>
              </button>
            )}
            <NotificationBell />
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground">
              <LogOut className="h-4 w-4 mr-1" /> Logout
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}