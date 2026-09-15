import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Loader2, Eye, Save, Filter, AlertTriangle, Lightbulb, MapPin, Trash2 } from 'lucide-react';
import moment from 'moment';
import { api } from '@/api/supabaseClient';
import { showToast } from '@/lib/toast';
import StatusBadge from '@/components/StatusBadge';
import { isComplaintDelayed } from '@/lib/resolutionConfig';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem
} from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogAction, AlertDialogCancel
} from '@/components/ui/alert-dialog';

const STATUSES = ['Pending','In Review','Assigned','Accepted','Work Started','In Progress','Work Completed','Resolved','Rejected'];
const CATEGORIES = ['Road Damage','Garbage Collection','Street Light','Water Leakage','Drainage','Electricity','Stray Animals','Illegal Parking','Public Safety','Other'];

export default function AdminComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [areas, setAreas] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [areaFilter, setAreaFilter] = useState('All');
  const [showTemp, setShowTemp] = useState(false);
  const [managing, setManaging] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [manageForm, setManageForm] = useState({ status: '', department: '', remarks: '', estimated_days: '', temporary_solution: '', temp_alt_route: '', temp_alt_facility: '', temp_availability_time: '', temp_contact: '', officer_id: '', officer_name: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [cl, dl, al, ol] = await Promise.all([
        api.entities.Complaint.list('-created_date', 500),
        api.entities.Department.list('name'),
        api.entities.Area.list('name'),
        api.entities.Officer.filter({ status: 'Active' })
      ]);
      setComplaints(cl.items || cl || []);
      setDepartments(dl.items || dl || []);
      setAreas(al.items || al || []);
      setOfficers(ol.items || ol || []);
    } catch (e) {
      showToast('Failed to load: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const unsub = api.entities.Complaint.subscribe(() => load());
    return unsub;
  }, []);

  const filtered = complaints.filter((c) => {
    if (statusFilter !== 'All' && c.status !== statusFilter) return false;
    if (categoryFilter !== 'All' && c.category !== categoryFilter) return false;
    if (areaFilter !== 'All' && (c.area || '') !== areaFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!c.title.toLowerCase().includes(q) && !(c.complaint_code || c.id).toLowerCase().includes(q) && !(c.location || '').toLowerCase().includes(q) && !(c.area || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const openManage = (c) => {
    setManaging(c.id);
    setShowTemp(!!c.temporary_solution);
    setManageForm({
      status: c.status, department: c.department || '', remarks: c.remarks || '',
      estimated_days: c.estimated_days ?? '', temporary_solution: c.temporary_solution || '',
      temp_alt_route: c.temp_alt_route || '', temp_alt_facility: c.temp_alt_facility || '',
      temp_availability_time: c.temp_availability_time || '', temp_contact: c.temp_contact || '',
      officer_id: c.officer_id || '', officer_name: c.officer_name || '',
    });
  };

  const saveManage = async () => {
    try {
      const c = complaints.find((x) => x.id === managing);
      const timeline = c.timeline || [];
      const now = new Date().toISOString();
      const patch = {
        status: manageForm.status,
        department: manageForm.department,
        remarks: manageForm.remarks,
        officer_id: manageForm.officer_id || null,
        officer_name: manageForm.officer_name || '',
        timeline: [...timeline, { status: manageForm.status, note: manageForm.remarks || 'Status updated by admin', timestamp: now }],
      };
      if (manageForm.officer_id && manageForm.officer_id !== (c.officer_id || '')) {
        patch.status = 'Assigned';
      }
      if (manageForm.estimated_days !== '' && manageForm.estimated_days !== null) {
        patch.estimated_days = Number(manageForm.estimated_days);
        patch.expected_date = new Date(new Date(c.created_date || now).getTime() + patch.estimated_days * 86400000).toISOString();
      }
      if (showTemp) {
        patch.temporary_solution = manageForm.temporary_solution;
        patch.temp_alt_route = manageForm.temp_alt_route;
        patch.temp_alt_facility = manageForm.temp_alt_facility;
        patch.temp_availability_time = manageForm.temp_availability_time;
        patch.temp_contact = manageForm.temp_contact;
      }
      const updated = await api.entities.Complaint.update(managing, patch);
      setComplaints((arr) => arr.map((x) => (x.id === managing ? { ...x, ...updated } : x)));
      await api.entities.Notification.create({
        title: `Complaint ${manageForm.status}`,
        message: `Your complaint "${c.title}" was updated to ${manageForm.status}.`,
        type: 'status_update',
        complaint_id: managing
      });
      if (showTemp && manageForm.temporary_solution) {
        await api.entities.Notification.create({
          title: 'Temporary solution available',
          message: `A temporary solution has been provided for "${c.title}".`,
          type: 'remark',
          complaint_id: managing
        });
      }
      if (manageForm.officer_id && manageForm.officer_id !== (c.officer_id || '')) {
        await api.entities.Notification.create({
          title: 'New Complaint Assigned',
          message: `Complaint "${c.title}" has been assigned to you.`,
          type: 'assignment',
          complaint_id: managing,
          officer_id: manageForm.officer_id,
        });
      }
      await api.entities.ActivityLog.create({ action: 'update_status', entity: 'Complaint', entity_id: managing, details: `Status -> ${manageForm.status}` });
      showToast('Complaint updated', 'success');
      setManaging(null);
    } catch (e) {
      showToast('Update failed: ' + e.message, 'error');
    }
  };

  const deleteComplaint = async () => {
    try {
      await api.entities.Complaint.delete(deleting.id);
      setComplaints((arr) => arr.filter((x) => x.id !== deleting.id));
      await api.entities.ActivityLog.create({ action: 'delete_complaint', entity: 'Complaint', entity_id: deleting.id, details: `Deleted spam complaint: ${deleting.title}` });
      showToast('Spam complaint deleted', 'success');
    } catch (e) {
      showToast('Delete failed: ' + e.message, 'error');
    } finally {
      setDeleting(null);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Manage Complaints</h1>
        <p className="text-muted-foreground text-sm">Assign, update status, and add remarks.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search title, ID, or location..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="md:w-44"><Filter className="h-4 w-4 mr-1" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="md:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All categories</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={areaFilter} onValueChange={setAreaFilter}>
          <SelectTrigger className="md:w-44"><Filter className="h-4 w-4 mr-1" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All areas</SelectItem>
            {areas.map((a) => <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>)}
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
                <TableHead className="hidden lg:table-cell">Dept</TableHead>
                <TableHead className="hidden xl:table-cell">Expected</TableHead>
                <TableHead className="hidden lg:table-cell">Date</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No complaints match your filters.</TableCell></TableRow>
              ) : filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium max-w-[200px] truncate">{c.title}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{c.category}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <StatusBadge status={c.status} />
                      {c.is_spam && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400">
                          <AlertTriangle className="h-2.5 w-2.5" /> Spam
                        </span>
                      )}
                      {isComplaintDelayed(c) && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400">
                          <AlertTriangle className="h-2.5 w-2.5" /> Delayed
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{c.area || '—'}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{c.department || '—'}</TableCell>
                  <TableCell className="hidden xl:table-cell text-muted-foreground">{c.expected_date ? moment(c.expected_date).format('MMM D') : '—'}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{moment(c.created_date).format('MMM D')}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {c.latitude != null && (
                        <a href={`https://www.google.com/maps/search/?api=1&query=${c.latitude},${c.longitude}`} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="icon" title="Open in Google Maps"><MapPin className="h-4 w-4" /></Button>
                        </a>
                      )}
                      <Link to={`/track?id=${c.id}`}><Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button></Link>
                      {c.is_spam && (
                        <Button variant="ghost" size="icon" onClick={() => setDeleting(c)} title="Delete spam complaint"><Trash2 className="h-4 w-4 text-rose-500" /></Button>
                      )}
                      <Dialog open={managing === c.id} onOpenChange={(o) => !o && setManaging(null)}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => openManage(c)}>Manage</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>Manage: {c.title}</DialogTitle></DialogHeader>
                          <div className="space-y-3">
                            <p className="text-xs text-muted-foreground">{c.category} · {c.priority} priority</p>
                            <div className="space-y-1.5">
                              <label className="text-sm font-medium">Status</label>
                              <Select value={manageForm.status} onValueChange={(v) => setManageForm((f) => ({ ...f, status: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-sm font-medium">Assign Department</label>
                              <Select value={manageForm.department} onValueChange={(v) => setManageForm((f) => ({ ...f, department: v }))}>
                                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                                <SelectContent>
                                  {departments.map((d) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-sm font-medium">Assign Officer</label>
                              <Select value={manageForm.officer_id || 'none'} onValueChange={(v) => {
                                if (v === 'none') {
                                  setManageForm((f) => ({ ...f, officer_id: '', officer_name: '' }));
                                } else {
                                  const o = officers.find((x) => x.id === v);
                                  setManageForm((f) => ({ ...f, officer_id: v, officer_name: o?.name || '' }));
                                }
                              }}>
                                <SelectTrigger><SelectValue placeholder="Select officer" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Unassigned</SelectItem>
                                  {officers.map((o) => <SelectItem key={o.id} value={o.id}>{o.name} — {o.department || 'No dept'}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-sm font-medium">Remarks</label>
                              <Textarea rows={3} value={manageForm.remarks} onChange={(e) => setManageForm((f) => ({ ...f, remarks: e.target.value }))} placeholder="Add a remark visible to the citizen..." />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-sm font-medium">Estimated Resolution (days)</label>
                              <Input type="number" min="0" value={manageForm.estimated_days} onChange={(e) => setManageForm((f) => ({ ...f, estimated_days: e.target.value }))} placeholder="e.g. 3" />
                            </div>
                            <div className="rounded-lg border border-amber-200 dark:border-amber-500/30 p-3 space-y-2.5">
                              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                                <input type="checkbox" checked={showTemp} onChange={(e) => setShowTemp(e.target.checked)} className="rounded" />
                                <Lightbulb className="h-4 w-4 text-amber-500" /> Provide a temporary solution
                              </label>
                              {showTemp && (
                                <div className="space-y-2.5">
                                  <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Temporary Solution</label>
                                    <Textarea rows={2} value={manageForm.temporary_solution} onChange={(e) => setManageForm((f) => ({ ...f, temporary_solution: e.target.value }))} placeholder="e.g. Use the alternate route through ABC Road..." />
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div className="space-y-1.5">
                                      <label className="text-xs font-medium text-muted-foreground">Alternate Route</label>
                                      <Input value={manageForm.temp_alt_route} onChange={(e) => setManageForm((f) => ({ ...f, temp_alt_route: e.target.value }))} placeholder="e.g. Via XYZ Road" />
                                    </div>
                                    <div className="space-y-1.5">
                                      <label className="text-xs font-medium text-muted-foreground">Alternative Facility</label>
                                      <Input value={manageForm.temp_alt_facility} onChange={(e) => setManageForm((f) => ({ ...f, temp_alt_facility: e.target.value }))} placeholder="e.g. Water tanker at Community Center" />
                                    </div>
                                    <div className="space-y-1.5">
                                      <label className="text-xs font-medium text-muted-foreground">Availability Time</label>
                                      <Input value={manageForm.temp_availability_time} onChange={(e) => setManageForm((f) => ({ ...f, temp_availability_time: e.target.value }))} placeholder="e.g. 8 AM – 11 AM" />
                                    </div>
                                    <div className="space-y-1.5">
                                      <label className="text-xs font-medium text-muted-foreground">Contact Info</label>
                                      <Input value={manageForm.temp_contact} onChange={(e) => setManageForm((f) => ({ ...f, temp_contact: e.target.value }))} placeholder="e.g. 9876543210" />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setManaging(null)}>Cancel</Button>
                            <Button onClick={saveManage}><Save className="h-4 w-4 mr-2" /> Save</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">{filtered.length} of {complaints.length} complaints shown.</p>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete spam complaint?</AlertDialogTitle></AlertDialogHeader>
          <p className="text-sm text-muted-foreground px-6">
            This will permanently delete "{deleting?.title}" and all associated media and notifications. This cannot be undone.
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteComplaint} className="bg-rose-600 hover:bg-rose-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}