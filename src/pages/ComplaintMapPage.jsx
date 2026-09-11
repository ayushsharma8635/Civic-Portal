import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ComplaintMap from '@/components/ComplaintMap';
import { Card, CardContent } from '@/components/ui/card';
import { showToast } from '@/lib/toast';

export default function ComplaintMapPage() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const list = await base44.entities.Complaint.list('-created_date', 300);
        const all = list.items || list || [];
        setComplaints(all.filter((c) => c.latitude != null && c.longitude != null));
      } catch (e) {
        showToast('Failed to load map: ' + e.message, 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Complaint Map</h1>
        <p className="text-muted-foreground text-sm">{complaints.length} geo-located complaints.</p>
      </div>
      <Card>
        <CardContent className="p-2">
          <ComplaintMap markers={complaints} height="600px" />
        </CardContent>
      </Card>
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-rose-500" /> High priority</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-blue-500" /> Medium priority</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-slate-400" /> Low priority</span>
      </div>
    </div>
  );
}