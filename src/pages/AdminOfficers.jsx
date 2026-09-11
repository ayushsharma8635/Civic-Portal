import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Power, Trash2, Loader2, Search, KeyRound } from 'lucide-react';
import { api } from '@/api/supabaseClient';
import { showToast } from '@/lib/toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';

const BLANK = { name: '', employee_id: '', email: '', mobile: '', username: '', password: '', department: '', area_id: '', area_name: '', designation: '', status: 'Active' };

export default function AdminOfficers() {
  const [officers, setOfficers] = useState([]);
  const [areas, setAreas] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [deleting, setDeleting] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [ol, al, dl] = await Promise.all([
        api.entities.Officer.list('-name', 500),
        api.entities.Area.filter({ active: true }),
        api.entities.Department.list(),
      ]);
      setOfficers(ol.items || ol || []);
      setAreas(al.items || al || []);
      setDepartments(dl.items || dl || []);
    } catch (e) {
      showToast('Failed to load: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = officers.filter((o) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return [o.name, o.username, o.employee_id, o.department, o.area_name].filter(Boolean).some((v) => v.toLowerCase().includes(q));
  });

  const openAdd = () => { setForm(BLANK); setEditing('new'); };
  const openEdit = (o) => { setForm({ ...o, password: '' }); setEditing(o.id); };

  const save = async () => {
    if (!form.name.trim() || !form.username.trim()) {
      showToast('Name and username are required', 'warning');
      return;
    }
    if (editing === 'new' && !form.password) {
      showToast('Password is required for new officers', 'warning');
      return;
    }
    setSaving(true);
    try {
      const res = await api.functions.invoke('saveOfficer', {
        officer_id: editing === 'new' ? '' : editing,
        name: form.name.trim(),
        employee_id: form.employee_id,
        email: form.email,
        mobile: form.mobile,
        username: form.username.trim(),
        password: form.password || undefined,
        department: form.department,
        area_id: form.area_id,
        area_name: areas.find((a) => a.id === form.area_id)?.name || '',
        designation: form.designation,
        status: form.status,
      });
      const data = res.data || res;
      if (data.error) {
        showToast(data.error, 'error');
      } else {
        const saved = data.officer;
        if (editing === 'new') {
          setOfficers((arr) => [...arr, saved]);
        } else {
          setOfficers((arr) => arr.map((o) => (o.id === editing ? { ...o, ...saved } : o)));
        }
        showToast('Officer saved', 'success');
        setEditing(null);
      }
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      showToast('Save failed: ' + msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (o) => {
    try {
      const res = await api.functions.invoke('saveOfficer', {
        officer_id: o.id, name: o.name, employee_id: o.employee_id, email: o.email,
        mobile: o.mobile, username: o.username, department: o.department,
        area_id: o.area_id, area_name: o.area_name, designation: o.designation,
        status: o.status === 'Active' ? 'Inactive' : 'Active',
      });
      const data = res.data || res;
      if (data.officer) {
        setOfficers((arr) => arr.map((x) => (x.id === o.id ? { ...x, ...data.officer } : x)));
        showToast(`${o.name} ${data.officer.status === 'Active' ? 'activated' : 'deactivated'}`, 'success');
      }
    } catch (e) {
      showToast('Update failed: ' + e.message, 'error');
    }
  };

  const doResetPassword = async () => {
    if (!resetPassword) {
      showToast('Enter a new password', 'warning');
      return;
    }
    try {
      await api.functions.invoke('saveOfficer', {
        officer_id: resetting.id, name: resetting.name, employee_id: resetting.employee_id,
        email: resetting.email, mobile: resetting.mobile, username: resetting.username,
        department: resetting.department, area_id: resetting.area_id, area_name: resetting.area_name,
        designation: resetting.designation, status: resetting.status, password: resetPassword,
      });
      showToast('Password reset', 'success');
      setResetting(null);
      setResetPassword('');
    } catch (e) {
      showToast('Reset failed: ' + e.message, 'error');
    }
  };

  const remove = async () => {
    try {
      await api.entities.Officer.delete(deleting.id);
      setOfficers((arr) => arr.filter((x) => x.id !== deleting.id));
      showToast('Officer deleted', 'success');
    } catch (e) {
      showToast('Delete failed: ' + e.message, 'error');
    } finally {
      setDeleting(null);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Manage Officers</h1>
          <p className="text-muted-foreground text-sm">Add, edit, and manage field officers.</p>
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" /> Add Officer</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search officers..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Officer ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Department</TableHead>
                <TableHead className="hidden lg:table-cell">Area</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No officers found.</TableCell></TableRow>
              ) : filtered.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="text-muted-foreground text-xs">{o.employee_id || o.username}</TableCell>
                  <TableCell className="font-medium">{o.name}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{o.department || '—'}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{o.area_name || '—'}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${o.status === 'Active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                      {o.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setResetting(o)} title="Reset Password"><KeyRound className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(o)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => toggleActive(o)} title={o.status === 'Active' ? 'Deactivate' : 'Activate'}><Power className={`h-4 w-4 ${o.status === 'Active' ? 'text-emerald-500' : 'text-muted-foreground'}`} /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleting(o)} title="Delete"><Trash2 className="h-4 w-4 text-rose-500" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">{filtered.length} of {officers.length} officers shown.</p>

      {/* Add/Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing === 'new' ? 'Add New Officer' : 'Edit Officer'}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Full Name *</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Raj Kumar" /></div>
              <div className="space-y-1.5"><Label>Employee ID</Label><Input value={form.employee_id} onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))} placeholder="e.g. OF001" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="officer@example.com" /></div>
              <div className="space-y-1.5"><Label>Mobile</Label><Input value={form.mobile} onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))} placeholder="9876543210" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Username *</Label><Input value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} placeholder="raj.kumar" /></div>
              <div className="space-y-1.5">
                <Label>Password {editing !== 'new' && '(leave blank to keep)'}</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="••••••••" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Department</Label>
                <Select value={form.department} onValueChange={(v) => setForm((f) => ({ ...f, department: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Assigned Area</Label>
                <Select value={form.area_id} onValueChange={(v) => setForm((f) => ({ ...f, area_id: v, area_name: areas.find((a) => a.id === v)?.name || '' }))}>
                  <SelectTrigger><SelectValue placeholder="Select area" /></SelectTrigger>
                  <SelectContent>
                    {areas.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Designation</Label><Input value={form.designation} onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))} placeholder="e.g. Field Officer" /></div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetting} onOpenChange={(o) => !o && setResetting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset Password — {resetting?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>New Password</Label>
              <Input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="Enter new password" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetting(null)}>Cancel</Button>
            <Button onClick={doResetPassword}>Reset Password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete officer?</AlertDialogTitle></AlertDialogHeader>
          <p className="text-sm text-muted-foreground px-6">Are you sure you want to delete "{deleting?.name}"? This cannot be undone.</p>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-rose-600 hover:bg-rose-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}