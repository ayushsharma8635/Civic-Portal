import React from 'react';
import { cn } from '@/lib/utils';

const styles = {
  Pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  'In Review': 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  Assigned: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-400',
  Accepted: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400',
  'Work Started': 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400',
  'In Progress': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400',
  'Work Completed': 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400',
  Resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  Rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
};

const priorityStyles = {
  Low: 'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300',
  Medium: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  High: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
};

export default function StatusBadge({ status, type = 'status' }) {
  const map = type === 'priority' ? priorityStyles : styles;
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', map[status] || 'bg-muted text-muted-foreground')}>
      {status}
    </span>
  );
}