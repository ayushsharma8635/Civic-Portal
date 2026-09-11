import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Lock, Loader2, ArrowLeft, User } from 'lucide-react';
import AuthLayout from '@/components/AuthLayout';
import { setOfficerSession } from '@/lib/officerSession';
import { showToast } from '@/lib/toast';

export default function OfficerLoginForm({ onBack }) {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username || !password) {
      setError('Please enter username and password');
      return;
    }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('officerLogin', { username, password });
      const data = res.data || res;
      if (data.officer) {
        setOfficerSession(data.officer);
        showToast('Login successful', 'success');
        navigate('/officer/complaints');
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      const msg = err?.response?.data?.error || err.message || 'Login failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      icon={Shield}
      title="Officer Login"
      subtitle="Access your assigned complaints"
      footer={<span className="text-xs">Forgot password? Contact your administrator.</span>}
    >
      <button onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground mb-4 flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Back to role selection
      </button>

      {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username">Officer Username</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="username" autoFocus placeholder="Enter username" value={username} onChange={(e) => setUsername(e.target.value)} className="pl-10 h-12" required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 h-12" required />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Logging in...</> : 'Log in'}
        </Button>
      </form>
    </AuthLayout>
  );
}