import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Trash2, Loader2, Inbox } from 'lucide-react';
import moment from 'moment';
import { api } from '@/api/supabaseClient';
import { showToast } from '@/lib/toast';
import StatusBadge from '@/components/StatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const STATUSES = ['Pending','In Review','Assigned','Accepted','Work Started','In Progress','Work Completed','Resolved','Rejected'];

export default function ComplaintHistory() {
  const [user, setUser] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', category: '', location: '' });

  const load = async () => {
    setLoading(true);
    try {
      const u = await api.auth.me();
      setUser(u);
      const list = await api.entities.Complaint.filter({ created_by_id: u.id }, '-created_date', 200);
      setComplaints(list.items || list || []);
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
    if (filter !== 'All' && c.status !== filter) return false;
    if (search && !c.title.toLowerCase().includes(search.toLowerCase()) && !c.id.includes(search)) return false;
    return true;
  });

  const canEdit = (c) => c.status === 'Pending';

  const openEdit = (c) => {
    setEditing(c.id);
    setEditForm({ title: c.title, description: c.description, category: c.category, location: c.location || '' });
  };

  const saveEdit = async () => {
    try {
      await api.entities.Complaint.update(editing, {
        title: editForm.title, description: editForm.description, category: editForm.category, location: editForm.location
      });
      showToast('Complaint updated', 'success');
      setEditing(null);
      load();
    } catch (e) {
      showToast('Update failed: ' + e.message, 'error');
    }
  };

  const remove = async (c) => {
    if (!confirm('Delete this complaint? This cannot be undone.')) return;
    try {
      await api.entities.Complaint.delete(c.id);
      showToast('Complaint deleted', 'success');
      load();
    } catch (e) {
      showToast('Delete failed: ' + e.message, 'error');
    }
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">My Complaints</h1>
        <p className="text-muted-foreground text-sm">View, edit (while pending), or remove your complaints.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Input placeholder="Search by title or ID..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <Inbox className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground text-sm">No complaints found.</p>
          <Link to="/submit"><Button variant="outline" className="mt-3">Submit a complaint</Button></Link>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <Link to={`/track?id=${c.id}`} className="min-w-0 flex-1">
                  <p className="font-medium text-foreground text-sm truncate">{c.title}</p>
                  <p className="text-xs text-muted-foreground">{c.category} · {moment(c.created_date).format('MMM D, YYYY')}</p>
                </Link>
                <div className="flex items-center gap-2">
                  <StatusBadge status={c.status} />
                  {canEdit(c) && (
                    <Dialog open={editing === c.id} onOpenChange={(o) => !o && setEditing(null)}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Edit Complaint</DialogTitle></DialogHeader>
                        <div className="space-y-3">
                          <div className="space-y-1.5"><Label>Title</Label><Input value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} /></div>
                          <div className="space-y-1.5"><Label>Description</Label><Textarea rows={4} value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} /></div>
                          <div className="space-y-1.5"><Label>Category</Label>
                            <Select value={editForm.category} onValueChange={(v) => setEditForm((f) => ({ ...f, category: v }))}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {['Road Damage','Garbage Collection','Street Light','Water Leakage','Drainage','Electricity','Stray Animals','Illegal Parking','Public Safety','Other'].map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5"><Label>Location</Label><Input value={editForm.location} onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))} /></div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                          <Button onClick={saveEdit}>Save</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => remove(c)}><Trash2 className="h-4 w-4 text-rose-500" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}