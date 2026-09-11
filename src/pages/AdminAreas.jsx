import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Pencil, Trash2, Loader2, Search } from 'lucide-react';
import { api } from '@/api/supabaseClient';
import { showToast } from '@/lib/toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';

const BLANK = { name: '', city: 'Kanpur', ward: '', district: 'Kanpur Nagar', landmark: '', latitude: '', longitude: '', active: true };

export default function AdminAreas() {
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.entities.Area.list('-name', 500);
      setAreas(res.items || res || []);
    } catch (e) {
      showToast('Failed to load: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = areas.filter((a) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return [a.name, a.city, a.ward, a.district, a.landmark].filter(Boolean).some((v) => v.toLowerCase().includes(q));
  });

  const openAdd = () => { setForm(BLANK); setEditing('new'); };
  const openEdit = (a) => { setForm({ ...a, latitude: a.latitude ?? '', longitude: a.longitude ?? '' }); setEditing(a.id); };

  const save = async () => {
    if (!form.name.trim()) {
      showToast('Area name is required', 'warning');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        city: form.city || 'Kanpur',
        ward: form.ward || '',
        district: form.district || '',
        landmark: form.landmark || '',
        latitude: form.latitude !== '' ? Number(form.latitude) : null,
        longitude: form.longitude !== '' ? Number(form.longitude) : null,
        active: form.active,
      };
      if (editing === 'new') {
        const created = await api.entities.Area.create(payload);
        setAreas((arr) => [...arr, created]);
      } else {
        const updated = await api.entities.Area.update(editing, payload);
        setAreas((arr) => arr.map((a) => (a.id === editing ? { ...a, ...updated } : a)));
      }
      await api.entities.ActivityLog.create({ action: editing === 'new' ? 'create_area' : 'update_area', entity: 'Area', entity_id: editing === 'new' ? '' : editing, details: `Area: ${payload.name}` });
      showToast('Area saved', 'success');
      setEditing(null);
    } catch (e) {
      showToast('Unable to save area: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (a) => {
    try {
      const updated = await api.entities.Area.update(a.id, { active: !a.active });
      setAreas((arr) => arr.map((x) => (x.id === a.id ? { ...x, ...updated } : x)));
      showToast(`${a.name} ${updated.active ? 'activated' : 'deactivated'}`, 'success');
    } catch (e) {
      showToast('Update failed: ' + e.message, 'error');
    }
  };

  const remove = async () => {
    try {
      await api.entities.Area.delete(deleting.id);
      setAreas((arr) => arr.filter((x) => x.id !== deleting.id));
      showToast('Area deleted', 'success');
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
          <h1 className="text-2xl font-heading font-bold text-foreground">Manage Areas</h1>
          <p className="text-muted-foreground text-sm">Add, edit, or deactivate Kanpur localities.</p>
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" /> Add Area</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search areas..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Area / Locality</TableHead>
                <TableHead className="hidden md:table-cell">Ward</TableHead>
                <TableHead className="hidden lg:table-cell">District</TableHead>
                <TableHead className="hidden xl:table-cell">Landmark</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No areas found.</TableCell></TableRow>
              ) : filtered.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      {a.name}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{a.ward || '—'}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{a.district || '—'}</TableCell>
                  <TableCell className="hidden xl:table-cell text-muted-foreground">{a.landmark || '—'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch checked={!!a.active} onCheckedChange={() => toggleActive(a)} />
                      <span className={`text-xs ${a.active ? 'text-emerald-600' : 'text-muted-foreground'}`}>{a.active ? 'Active' : 'Inactive'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(a)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleting(a)}><Trash2 className="h-4 w-4 text-rose-500" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">{filtered.length} of {areas.length} areas shown.</p>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing === 'new' ? 'Add New Area' : 'Edit Area'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Area / Locality Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Kalyanpur" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Ward</Label>
                <Input value={form.ward} onChange={(e) => setForm((f) => ({ ...f, ward: e.target.value }))} placeholder="e.g. Ward 38" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>District</Label>
                <Input value={form.district} onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))} placeholder="e.g. Kanpur Nagar" />
              </div>
              <div className="space-y-1.5">
                <Label>Landmark</Label>
                <Input value={form.landmark} onChange={(e) => setForm((f) => ({ ...f, landmark: e.target.value }))} placeholder="e.g. IIT Gate" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Latitude</Label>
                <Input type="number" step="any" value={form.latitude} onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))} placeholder="26.5145" />
              </div>
              <div className="space-y-1.5">
                <Label>Longitude</Label>
                <Input type="number" step="any" value={form.longitude} onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))} placeholder="80.2326" />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Switch checked={form.active} onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))} />
              <Label className="text-sm cursor-pointer">Active (visible to citizens)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete area?</AlertDialogTitle></AlertDialogHeader>
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