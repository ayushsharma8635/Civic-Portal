import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Eye, Loader2, Filter } from 'lucide-react';
import moment from 'moment';
import { base44 } from '@/api/base44Client';
import { getOfficerSession } from '@/lib/officerSession';
import StatusBadge from '@/components/StatusBadge';
import { isComplaintDelayed } from '@/lib/resolutionConfig';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';

const STATUSES = ['All', 'Pending', 'In Review', 'Assigned', 'Accepted', 'Work Started', 'In Progress', 'Work Completed', 'Resolved', 'Rejected'];

export default function OfficerComplaints() {
  const officer = getOfficerSession();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('officerPortal', { officer_id: officer.id, action: 'complaints', status: statusFilter });
      const data = res.data || res;
      setComplaints(data.complaints || []);
    } catch {
      setComplaints([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [statusFilter]);

  const filtered = complaints.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.title.toLowerCase().includes(q) || (c.complaint_code || c.id).toLowerCase().includes(q) || (c.area || '').toLowerCase().includes(q);
  });

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Assigned Complaints</h1>
        <p className="text-muted-foreground text-sm">Complaints assigned to you in {officer?.area_name || 'your area'}.</p>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search title, ID, or area..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><Filter className="h-4 w-4 mr-1" /><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s === 'All' ? 'All statuses' : s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead className="hidden md:table-cell">Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Area</TableHead>
                <TableHead className="hidden lg:table-cell">Date</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No complaints found.</TableCell></TableRow>
              ) : filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium max-w-[200px] truncate">{c.title}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{c.category}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <StatusBadge status={c.status} />
                      {isComplaintDelayed(c) && <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400">Delayed</span>}
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{c.area || '—'}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{moment(c.created_date).format('MMM D')}</TableCell>
                  <TableCell className="text-right">
                    <Link to={`/officer/complaints/${c.id}`}>
                      <Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button>
                    </Link>
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