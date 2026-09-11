import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  MapPin, Clock, Calendar, Building2, Loader2, Upload, Camera,
  CheckCircle2, AlertTriangle, FileText,
} from 'lucide-react';
import moment from 'moment';
import { api } from '@/api/supabaseClient';
import { getOfficerSession } from '@/lib/officerSession';
import { showToast } from '@/lib/toast';
import StatusBadge from '@/components/StatusBadge';
import ComplaintMap from '@/components/ComplaintMap';
import { isComplaintDelayed, formatExpectedResolution } from '@/lib/resolutionConfig';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

const OFFICER_STATUSES = ['Accepted', 'Work Started', 'In Progress', 'Work Completed'];
const PHASES = [
  { value: 'before', label: 'Before Repair' },
  { value: 'during', label: 'During Repair' },
  { value: 'after', label: 'After Repair' },
];

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function OfficerComplaintDetail() {
  const { id } = useParams();
  const officer = getOfficerSession();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newStatus, setNewStatus] = useState('');
  const [remarks, setRemarks] = useState('');
  const [updating, setUpdating] = useState(false);
  const [phase, setPhase] = useState('before');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.functions.invoke('officerPortal', { officer_id: officer.id, action: 'complaint_detail', complaint_id: id });
      setData(res.data || res);
      setNewStatus(res.data?.complaint?.status || res.complaint?.status || '');
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const updateStatus = async () => {
    if (!newStatus) {
      showToast('Please select a status', 'warning');
      return;
    }
    setUpdating(true);
    try {
      const res = await api.functions.invoke('officerPortal', {
        officer_id: officer.id, action: 'update_status',
        complaint_id: id, new_status: newStatus, remarks,
      });
      showToast('Status updated', 'success');
      setRemarks('');
      load();
    } catch (err) {
      showToast('Update failed: ' + err.message, 'error');
    } finally {
      setUpdating(false);
    }
  };

  const uploadEvidence = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const file_data = await readFileAsDataURL(file);
      await api.functions.invoke('officerUploadEvidence', {
        officer_id: officer.id, complaint_id: id,
        phase, file_data, file_name: file.name, file_type: file.type,
      });
      showToast('Evidence uploaded', 'success');
      if (fileRef.current) fileRef.current.value = '';
      load();
    } catch (err) {
      showToast('Upload failed: ' + err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!data?.complaint) return <div className="text-center py-16 text-muted-foreground">Complaint not found.</div>;

  const c = data.complaint;
  const media = data.media || [];
  const logs = data.logs || [];
  const delayed = isComplaintDelayed(c);

  const mediaByPhase = ['citizen', 'before', 'during', 'after'].map((p) => ({
    phase: p,
    label: p === 'citizen' ? 'Citizen Evidence' : PHASES.find((x) => x.value === p)?.label || p,
    items: media.filter((m) => m.phase === p),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      <Link to="/officer/complaints" className="text-sm text-muted-foreground hover:text-foreground">← Back to Complaints</Link>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">{c.title}</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">ID: {c.complaint_code || c.id}</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              {delayed && <span className="inline-flex items-center gap-0.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400"><AlertTriangle className="h-3 w-3" /> Delayed</span>}
              <StatusBadge status={c.status} />
              <StatusBadge status={c.priority} type="priority" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-foreground whitespace-pre-wrap">{c.description}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground"><Building2 className="h-4 w-4" /> Dept: <span className="text-foreground">{c.department || 'Not assigned'}</span></div>
            <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4" /> {c.area || c.location || 'No address'}</div>
            <div className="flex items-center gap-2 text-muted-foreground"><Clock className="h-4 w-4" /> Submitted: <span className="text-foreground">{moment(c.created_date).format('lll')}</span></div>
            <div className="flex items-center gap-2 text-muted-foreground"><Calendar className="h-4 w-4" /> Expected: <span className="text-foreground">{c.expected_date ? moment(c.expected_date).format('ll') : formatExpectedResolution(c.estimated_days)}</span></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Update Status</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-500/10 p-2.5 rounded-lg">
            Note: "Resolved" status requires admin verification. You can mark work as "Work Completed".
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
              <SelectContent>
                {OFFICER_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={updateStatus} disabled={updating || !newStatus}>
              {updating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Update Status
            </Button>
          </div>
          <Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Add remarks (optional)..." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Camera className="h-4 w-4 text-indigo-500" /> Upload Evidence</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
            <Select value={phase} onValueChange={setPhase}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PHASES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                Upload Photo/Video
              </Button>
              <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={uploadEvidence} />
            </div>
          </div>
        </CardContent>
      </Card>

      {mediaByPhase.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Evidence Gallery</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {mediaByPhase.map((g) => (
              <div key={g.phase}>
                <p className="text-sm font-medium text-foreground mb-2">{g.label}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {g.items.map((m) => (
                    <div key={m.id} className="rounded-lg overflow-hidden border border-border">
                      {m.media_type === 'photo' ? (
                        <img src={m.file_url} alt={m.file_name} className="h-28 w-full object-cover" />
                      ) : (
                        <video src={m.file_url} className="h-28 w-full object-cover" controls />
                      )}
                      {m.uploaded_by && <p className="text-xs text-muted-foreground px-2 py-1 truncate">By {m.uploaded_by}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {logs.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-indigo-500" /> Activity Log</CardTitle></CardHeader>
          <CardContent>
            <ol className="relative border-l-2 border-border ml-2 space-y-4">
              {logs.map((log, i) => (
                <li key={i} className="ml-5">
                  <span className="absolute -left-[9px] mt-1 h-4 w-4 rounded-full bg-indigo-500 ring-4 ring-background" />
                  <p className="text-sm font-medium text-foreground">{log.action === 'status_update' ? `${log.old_status} → ${log.new_status}` : log.action}</p>
                  {log.remarks && <p className="text-xs text-muted-foreground">{log.remarks}</p>}
                  <p className="text-xs text-muted-foreground mt-0.5">{moment(log.created_date).format('lll')}</p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {c.latitude != null && (
        <Card>
          <CardHeader><CardTitle className="text-base">Location</CardTitle></CardHeader>
          <CardContent>
            <ComplaintMap position={{ lat: c.latitude, lng: c.longitude }} height="280px" />
            {c.formatted_address && <p className="text-xs text-muted-foreground mt-2">{c.formatted_address}</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}