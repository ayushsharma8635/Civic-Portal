import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import {
  LayoutDashboard, Clock, CheckCircle2, AlertCircle, FilePlus, TrendingUp, AlertTriangle
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import moment from 'moment';
import { api } from '@/api/supabaseClient';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { showToast } from '@/lib/toast';
import { isComplaintDelayed } from '@/lib/resolutionConfig';

const PIE_COLORS = ['#5C7C66', '#A9C6B5', '#D89B92', '#d97706', '#799D85', '#c4a47c', '#8b9d83', '#e0a8a0', '#6b8e7f', '#b8a290'];

export default function Home() {
  const { user: authUser } = useAuth();
  const [user, setUser] = useState(authUser);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadComplaints = async (userId) => {
    try {
      const list = await api.entities.Complaint.filter({ created_by_id: userId }, '-created_date', 200);
      setComplaints(list.items || list || []);
    } catch (e) {
      console.warn('Could not load complaints:', e.message);
    }
  };

  useEffect(() => {
    let unsub = () => {};
    if (!authUser?.id) {
      setLoading(false);
      return;
    }
    setUser(authUser);
    loadComplaints(authUser.id).finally(() => {
      setLoading(false);
    });
    unsub = api.entities.Complaint.subscribe(() => loadComplaints(authUser.id));
    return () => unsub();
  }, [authUser]);

  const stats = useMemo(() => {
    const total = complaints.length;
    const pending = complaints.filter((c) => c.status === 'Pending').length;
    const inProgress = complaints.filter((c) => c.status === 'In Progress' || c.status === 'In Review').length;
    const resolved = complaints.filter((c) => c.status === 'Resolved').length;
    const delayed = complaints.filter((c) => isComplaintDelayed(c)).length;
    return { total, pending, inProgress, resolved, delayed };
  }, [complaints]);

  const monthly = useMemo(() => {
    const map = {};
    complaints.forEach((c) => {
      const m = moment(c.created_date).format('MMM');
      map[m] = (map[m] || 0) + 1;
    });
    const order = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const now = moment();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const m = now.clone().subtract(i, 'months');
      const label = m.format('MMM');
      months.push({ name: label, complaints: map[label] || 0 });
    }
    return months;
  }, [complaints]);

  const byCategory = useMemo(() => {
    const map = {};
    complaints.forEach((c) => { map[c.category] = (map[c.category] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [complaints]);

  const recent = complaints.slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">Welcome back{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''} 👋</h1>
          <p className="text-muted-foreground text-sm">Here's an overview of your civic complaints.</p>
        </div>
        <Link to="/submit">
          <Button><FilePlus className="h-4 w-4 mr-2" /> New Complaint</Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Total Complaints" value={stats.total} icon={LayoutDashboard} />
        <StatCard label="Pending" value={stats.pending} icon={Clock} accent="text-amber-500" />
        <StatCard label="In Progress" value={stats.inProgress} icon={TrendingUp} accent="text-indigo-500" />
        <StatCard label="Resolved" value={stats.resolved} icon={CheckCircle2} accent="text-emerald-500" />
        <StatCard label="Delayed" value={stats.delayed} icon={AlertTriangle} accent="text-rose-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Complaints Over Time</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={monthly}>
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5C7C66" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#5C7C66" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12 }} />
                <Area type="monotone" dataKey="complaints" stroke="#5C7C66" strokeWidth={2.5} fill="url(#areaGradient)" dot={{ r: 4, fill: '#5C7C66' }} activeDot={{ r: 6 }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">By Category</CardTitle></CardHeader>
          <CardContent>
            {byCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={byCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                    {byCategory.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent Complaints</CardTitle></CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <div className="text-center py-10">
              <AlertCircle className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground text-sm">No complaints yet.</p>
              <Link to="/submit"><Button variant="outline" className="mt-3">Submit your first complaint</Button></Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recent.map((c) => (
                <Link to={`/track?id=${c.id}`} key={c.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground text-sm truncate">{c.title}</p>
                    <p className="text-xs text-muted-foreground">{c.category} · {moment(c.created_date).format('MMM D, YYYY')}</p>
                  </div>
                  <StatusBadge status={c.status} />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}