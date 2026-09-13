import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import Sidebar from '@/components/Sidebar';
import ThemeToggle from '@/components/ThemeToggle';
import NotificationBell from '@/components/NotificationBell';
import { Button } from '@/components/ui/button';

export default function Layout() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
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
            {user?.role === 'admin' && (
              <div
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 dark:text-emerald-400"
                title="Signed in as System Administrator"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Administrator</span>
              </div>
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