import React, { useState, useEffect } from 'react';
import { User, Mail, Shield, Save, Loader2, AlertCircle } from 'lucide-react';
import { api } from '@/api/supabaseClient';
import { showToast } from '@/lib/toast';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function Profile() {
  const [user, setUser] = useState(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState('citizen');
  const [saving, setSaving] = useState(false);
  const isDemo = api.auth.isDemoMode();

  useEffect(() => {
    api.auth.me().then((u) => {
      setUser(u);
      setName(u?.full_name || '');
      setRole(u?.role || 'citizen');
    }).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await api.auth.updateMe({ full_name: name, role });
      const roleChanged = user?.role !== updated.role;
      setUser(updated);
      showToast('Profile updated successfully', 'success');
      if (roleChanged) {
        // Reload to update sidebar navigation permissions
        setTimeout(() => window.location.reload(), 600);
      }
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
        <p className="text-muted-foreground text-sm">Manage your account information and role access.</p>
      </div>

      {isDemo && (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-sm flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Demo Authentication Active</p>
            <p className="text-xs mt-1 leading-relaxed opacity-90">
              Running locally with offline mock authentication. You can switch between <strong>Citizen</strong> and <strong>Administrator</strong> access below. To log in with your actual Google ID, connect live Supabase credentials in <code>.env.local</code>.
            </p>
          </div>
        </div>
      )}

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
                <Shield className="h-3 w-3" /> {user.role === 'admin' ? 'Administrator' : 'Citizen'}
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

          <div className="space-y-2">
            <Label>Role & Access Level</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => setRole('citizen')}
                className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all ${
                  role === 'citizen'
                    ? 'border-primary bg-primary/10 ring-1 ring-primary text-foreground'
                    : 'border-border bg-card text-muted-foreground hover:border-border/80'
                }`}
              >
                <User className={`h-5 w-5 mt-0.5 ${role === 'citizen' ? 'text-primary' : 'text-muted-foreground'}`} />
                <div>
                  <div className="font-semibold text-sm">Citizen</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Submit, track, and view personal complaints</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRole('admin')}
                className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all ${
                  role === 'admin'
                    ? 'border-primary bg-primary/10 ring-1 ring-primary text-foreground'
                    : 'border-border bg-card text-muted-foreground hover:border-border/80'
                }`}
              >
                <Shield className={`h-5 w-5 mt-0.5 ${role === 'admin' ? 'text-primary' : 'text-muted-foreground'}`} />
                <div>
                  <div className="font-semibold text-sm">Administrator</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Full access: complaints, areas, officers & map</div>
                </div>
              </button>
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