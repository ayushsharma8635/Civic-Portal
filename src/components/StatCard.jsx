import React from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function StatCard({ label, value, icon: Icon, accent = 'text-primary' }) {
  return (
    <Card className="p-5 flex items-center gap-4">
      <div className={cn('h-12 w-12 rounded-2xl grid place-items-center bg-primary/10', accent)}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-3xl font-display font-bold text-foreground leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-1.5 font-medium">{label}</p>
      </div>
    </Card>
  );
}