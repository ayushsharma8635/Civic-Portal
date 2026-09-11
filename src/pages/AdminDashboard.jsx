import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard, Clock, TrendingUp, CheckCircle2, XCircle, Gauge, AlertTriangle, MapPin
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell
} from 'recharts';
import moment from 'moment';
import { api } from '@/api/supabaseClient';
import StatCard from '@/components/StatCard';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { showToast } from '@/lib/toast';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { isComplaintDelayed } from '@/lib/resolutionConfig';

const PIE_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316','#64748b'];

export default function AdminDashboard() {
  const [complaints, setComplaints] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [cl, dl] = await Promise.all([
        api.entities.Complaint.list('-created_date', 500),
        api.entities.Department.list()
      ]);
      setComplaints(cl.items || cl || []);
      setDepartments(dl.items || dl || []);
    } catch (e) {
      showToast('Failed to load data: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const unsub = api.entities.Complaint.subscribe((payload) => {
      load();
      if (payload?.eventType === 'INSERT') {
        showToast(`Live update: New complaint "${payload.new?.title || 'Civic Issue'}" received`, 'info');
      } else if (payload?.eventType === 'UPDATE') {
        showToast(`Live update: Complaint status changed to "${payload.new?.status}"`, 'info');
      }
    });
    return unsub;
  }, []);

  const stats = useMemo(() => {
    const total = complaints.length;
    const pending = complaints.filter((c) => c.status === 'Pending').length;
    const inProgress = complaints.filter((c) => c.status === 'In Progress' || c.status === 'In Review').length;
    const resolved = complaints.filter((c) => c.status === 'Resolved').length;
    const rejected = complaints.filter((c) => c.status === 'Rejected').length;
    const delayed = complaints.filter((c) => isComplaintDelayed(c)).length;
    return { total, pending, inProgress, resolved, rejected, delayed };
  }, [complaints]);

  const byArea = useMemo(() => {
    const map = {};
    complaints.forEach((c) => {
      const a = c.area || 'Unspecified';
      if (!map[a]) map[a] = { area: a, total: 0, resolved: 0, delayed: 0 };
      map[a].total++;
      if (c.status === 'Resolved') map[a].resolved++;
      if (isComplaintDelayed(c)) map[a].delayed++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [complaints]);

  const monthly = useMemo(() => {
    const now = moment();
    const arr = [];
    for (let i = 5; i >= 0; i--) {
      const m = now.clone().subtract(i, 'months');
      const label = m.format('MMM');
      const count = complaints.filter((c) => moment(c.created_date).isSame(m, 'month')).length;
      arr.push({ name: label, complaints: count });
    }
    return arr;
  }, [complaints]);

  const byCategory = useMemo(() => {
    const map = {};
    complaints.forEach((c) => { map[c.category] = (map[c.category] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [complaints]);

  const deptPerformance = useMemo(() => {
    const map = {};
    complaints.forEach((c) => {
      const d = c.department || 'Unassigned';
      if (!map[d]) map[d] = { department: d, total: 0, resolved: 0 };
      map[d].total++;
      if (c.status === 'Resolved') map[d].resolved++;
    });
    return Object.values(map).map((r) => ({ ...r, rate: r.total ? Math.round((r.resolved / r.total) * 100) : 0 }));
  }, [complaints]);

  const avgResolution = useMemo(() => {
    const resolved = complaints.filter((c) => c.status === 'Resolved');
    if (resolved.length === 0) return '—';
    const hours = resolved.reduce((sum, c) => {
      const h = moment(c.updated_date).diff(moment(c.created_date), 'hours');
      return sum + h;
    }, 0);
    const avg = hours / resolved.length;
    return avg < 24 ? `${avg.toFixed(1)}h` : `${(avg / 24).toFixed(1)}d`;
  }, [complaints]);

  if (loading) {
    return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground text-sm">Analytics and insights across all complaints.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium w-fit">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Supabase Realtime Live</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total" value={stats.total} icon={LayoutDashboard} />
        <StatCard label="Pending" value={stats.pending} icon={Clock} accent="text-amber-500" />
        <StatCard label="In Progress" value={stats.inProgress} icon={TrendingUp} accent="text-indigo-500" />
        <StatCard label="Resolved" value={stats.resolved} icon={CheckCircle2} accent="text-emerald-500" />
        <StatCard label="Rejected" value={stats.rejected} icon={XCircle} accent="text-rose-500" />
        <StatCard label="Delayed" value={stats.delayed} icon={AlertTriangle} accent="text-rose-600" />
        <StatCard label="Avg Resolution" value={avgResolution} icon={Gauge} accent="text-violet-500" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4 text-indigo-500" /> Complaints by Locality</CardTitle></CardHeader>
        <CardContent>
          {byArea.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No locality data yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Area / Locality</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Resolved</TableHead>
                  <TableHead>Delayed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byArea.map((a) => (
                  <TableRow key={a.area}>
                    <TableCell className="font-medium"><MapPin className="h-3.5 w-3.5 inline mr-1.5 text-muted-foreground" />{a.area}</TableCell>
                    <TableCell>{a.total}</TableCell>
                    <TableCell className="text-emerald-600">{a.resolved}</TableCell>
                    <TableCell className={a.delayed ? 'text-rose-600 font-medium' : ''}>{a.delayed}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Monthly Complaint Trend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                <Bar dataKey="complaints" fill="#6366f1" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">By Category</CardTitle></CardHeader>
          <CardContent>
            {byCategory.length === 0 ? <p className="text-sm text-muted-foreground text-center py-10">No data</p> : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={byCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}>
                    {byCategory.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Department Performance</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Resolved</TableHead>
                <TableHead>Resolution Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deptPerformance.map((d) => (
                <TableRow key={d.department}>
                  <TableCell className="font-medium">{d.department}</TableCell>
                  <TableCell>{d.total}</TableCell>
                  <TableCell>{d.resolved}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${d.rate}%` }} />
                      </div>
                      <span className="text-sm text-muted-foreground">{d.rate}%</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}