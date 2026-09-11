import React from 'react';
import { User, Shield, ShieldCheck, Building2 } from 'lucide-react';
import AuthLayout from '@/components/AuthLayout';

const ROLES = [
  { id: 'citizen', label: 'Citizen', icon: User, desc: 'Submit & track complaints', color: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400' },
  { id: 'officer', label: 'Field Officer', icon: Shield, desc: 'Resolve assigned complaints & updates', color: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400' },
  { id: 'admin', label: 'Admin', icon: ShieldCheck, desc: 'Full system management', color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' },
];

export default function RoleSelection({ onSelect }) {
  return (
    <AuthLayout icon={Building2} title="CIVIC PORTAL" subtitle="Smart Local Complaint System">
      <p className="text-center text-sm text-muted-foreground mb-5">Select Login Type</p>
      <div className="space-y-3">
        {ROLES.map((r) => (
          <button
            key={r.id}
            onClick={() => onSelect(r.id)}
            className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/50 hover:bg-accent transition-colors text-left"
          >
            <div className={`h-10 w-10 rounded-lg grid place-items-center shrink-0 ${r.color}`}>
              <r.icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{r.label}</p>
              <p className="text-xs text-muted-foreground">{r.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </AuthLayout>
  );
}