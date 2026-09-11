import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ListChecks, LogOut, Menu, X, Shield } from 'lucide-react';
import { clearOfficerSession } from '@/lib/officerSession';

const navItems = [
  { to: '/officer/complaints', label: 'Assigned Complaints', icon: ListChecks, end: true },
];

export default function OfficerLayout() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const officer = JSON.parse(localStorage.getItem('civic_officer_session') || 'null');

  const logout = () => {
    clearOfficerSession();
    navigate('/officer-login');
  };

  const Item = ({ item }) => (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={() => setOpen(false)}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        }`
      }
    >
      <item.icon className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
      {item.label}
    </NavLink>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {open && <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setOpen(false)} />}
      <aside className={`fixed md:static z-40 h-full w-64 shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col transition-transform duration-200 ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="flex items-center justify-between px-5 h-16 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white grid place-items-center">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="font-heading font-semibold text-sm leading-tight">Officer Portal</p>
              <p className="text-xs text-muted-foreground">Civic Portal</p>
            </div>
          </div>
          <button className="md:hidden text-muted-foreground" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <p className="px-3 text-xs font-semibold uppercase text-muted-foreground mb-1">Officer</p>
          {navItems.map((item) => <Item key={item.to} item={item} />)}
        </nav>
        <div className="px-5 py-4 border-t border-sidebar-border text-xs text-muted-foreground">
          <p className="font-medium text-sidebar-foreground truncate">{officer?.name || 'Officer'}</p>
          <p>{officer?.department || 'Department'}</p>
          <button onClick={logout} className="mt-2 flex items-center gap-1.5 text-rose-500 hover:text-rose-600 font-medium">
            <LogOut className="h-3.5 w-3.5" /> Logout
          </button>
        </div>
      </aside>
      <div className="flex-1 overflow-y-auto">
        <div className="md:hidden flex items-center justify-between px-4 h-14 border-b border-border bg-background">
          <button onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></button>
          <span className="font-medium text-sm">Officer Portal</span>
          <div className="w-5" />
        </div>
        <main className="p-4 md:p-6 max-w-6xl mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}