import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, FilePlus, Search, History, User, ShieldCheck,
  ListChecks, MapPinned, MapPin, X
} from 'lucide-react';

const userNav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/submit', label: 'Submit Complaint', icon: FilePlus },
  { to: '/track', label: 'Track Complaint', icon: Search },
  { to: '/history', label: 'My Complaints', icon: History },
  { to: '/profile', label: 'Profile', icon: User },
];

const adminNav = [
  { to: '/admin', label: 'Admin Dashboard', icon: ShieldCheck, end: true },
  { to: '/admin/complaints', label: 'Manage Complaints', icon: ListChecks },
  { to: '/admin/areas', label: 'Manage Areas', icon: MapPin },
  { to: '/admin/officers', label: 'Manage Officers', icon: User },
  { to: '/admin/map', label: 'Complaint Map', icon: MapPinned },
];

export default function Sidebar({ user, open, onClose }) {
  const isAdmin = user?.role === 'admin';
  const Item = ({ item }) => (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onClose}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        }`
      }
    >
      <item.icon className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
      {item.label}
    </NavLink>
  );

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={onClose} />
      )}
      <aside
        className={`fixed md:static z-40 h-full w-64 shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between px-5 h-16 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-primary text-primary-foreground grid place-items-center font-bold">
              SC
            </div>
            <div>
              <p className="font-heading font-semibold text-sm leading-tight">SmartComplaint</p>
              <p className="text-xs text-muted-foreground">Civic Portal</p>
            </div>
          </div>
          <button className="md:hidden text-muted-foreground" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <p className="px-3 text-xs font-semibold uppercase text-muted-foreground mb-1">Citizen</p>
          {userNav.map((item) => (
            <Item key={item.to} item={item} />
          ))}

          {isAdmin && (
            <>
              <p className="px-3 mt-4 text-xs font-semibold uppercase text-muted-foreground mb-1">Administration</p>
              {adminNav.map((item) => (
                <Item key={item.to} item={item} />
              ))}
            </>
          )}
        </nav>

        <div className="px-5 py-4 border-t border-sidebar-border text-xs text-muted-foreground">
          <p className="font-medium text-sidebar-foreground truncate">{user?.full_name || user?.email || 'Guest'}</p>
          <p>{isAdmin ? 'Administrator' : 'Citizen'}</p>
        </div>
      </aside>
    </>
  );
}