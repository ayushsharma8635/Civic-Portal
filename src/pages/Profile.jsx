import React, { useState, useEffect } from 'react';
import { User, Mail, Shield, Save, Loader2 } from 'lucide-react';
import { api } from '@/api/supabaseClient';
import { showToast } from '@/lib/toast';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function Profile() {
  const [user, setUser] = useState(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.auth.me().then((u) => {
      setUser(u);
      setName(u?.full_name || '');
    }).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await api.auth.updateMe({ full_name: name });
      setUser(updated);
      showToast('Profile updated successfully', 'success');
    } catch (e) {
      showToast('Update failed: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Profile</h1>
        <p className="text-muted-foreground text-sm">Manage your account information and view your verified role.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Account Details</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary text-primary-foreground grid place-items-center text-xl font-bold">
              {(user.full_name || user.email || '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-medium text-foreground">{user.full_name || 'Unnamed user'}</p>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <Shield className="h-3 w-3 text-primary" /> {user.role === 'admin' ? 'Administrator' : 'Citizen'}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Full Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </div>

          <div className="space-y-1.5">
            <Label>Email</Label>
            <div className="flex items-center gap-2 text-sm text-muted-foreground border border-input rounded-md px-3 py-2 bg-muted/30">
              <Mail className="h-4 w-4" /> {user.email}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Role & Access Level</Label>
            <div className="flex items-center gap-2.5 text-sm text-foreground border border-input rounded-md px-3.5 py-2.5 bg-muted/20">
              {user.role === 'admin' ? (
                <>
                  <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-300">System Administrator</span>
                    <p className="text-xs text-muted-foreground">Authorized single administrator access.</p>
                  </div>
                </>
              ) : (
                <>
                  <User className="h-4 w-4 text-primary shrink-0" />
                  <div>
                    <span className="font-semibold text-primary">Citizen</span>
                    <p className="text-xs text-muted-foreground">Submit, track, and view local grievances.</p>
                  </div>
                </>
              )}
            </div>
          </div>

          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}