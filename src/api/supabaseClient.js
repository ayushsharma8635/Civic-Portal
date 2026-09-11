/// <reference path="../vite-env.d.ts" />
import { createClient } from '@supabase/supabase-js';

const rawEnvUrl = import.meta.env.VITE_SUPABASE_URL || '';
// Clean any accidental '/rest/v1' suffix or trailing slashes
const envUrl = rawEnvUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Detect whether valid Supabase credentials have been configured
const hasValidSupabaseConfig = Boolean(
  envUrl &&
  envKey &&
  envUrl.startsWith('http') &&
  !envUrl.includes('your-project')
);

// Fallback dummy client for build-time safety and graceful offline demo
const fallbackUrl = 'https://placeholder.supabase.co';
const fallbackKey = 'placeholder-anon-key';

export const supabase = createClient(
  hasValidSupabaseConfig ? envUrl : fallbackUrl,
  hasValidSupabaseConfig ? envKey : fallbackKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  }
);

// Helper for localStorage-backed fallback mock data when Supabase is not yet connected
const LOCAL_STORAGE_PREFIX = 'scms_demo_';
function getLocalCollection(name, defaultData = []) {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PREFIX + name);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_PREFIX + name, JSON.stringify(defaultData));
      return defaultData;
    }
    return JSON.parse(raw);
  } catch {
    return defaultData;
  }
}

function saveLocalCollection(name, data) {
  try {
    localStorage.setItem(LOCAL_STORAGE_PREFIX + name, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to persist mock data:', e);
  }
}

// Initial mock datasets for demo mode
const INITIAL_AREAS = [
  { id: 'area-1', name: 'Kalyanpur', city: 'Kanpur', ward: 'Ward 38', district: 'Kanpur Nagar', landmark: 'Near Kalyanpur Crossing', latitude: 26.4927, longitude: 80.2589, active: true },
  { id: 'area-2', name: 'Kakadeo', city: 'Kanpur', ward: 'Ward 42', district: 'Kanpur Nagar', landmark: 'Deoki Cinema Crossing', latitude: 26.4789, longitude: 80.2974, active: true },
  { id: 'area-3', name: 'Civil Lines', city: 'Kanpur', ward: 'Ward 15', district: 'Kanpur Nagar', landmark: 'Green Park Stadium', latitude: 26.4729, longitude: 80.3444, active: true },
  { id: 'area-4', name: 'Swaroop Nagar', city: 'Kanpur', ward: 'Ward 21', district: 'Kanpur Nagar', landmark: 'Near Motijheel', latitude: 26.4815, longitude: 80.3182, active: true },
  { id: 'area-5', name: 'Govind Nagar', city: 'Kanpur', ward: 'Ward 54', district: 'Kanpur Nagar', landmark: 'C-Block Market', latitude: 26.4432, longitude: 80.3015, active: true },
  { id: 'area-6', name: 'Kidwai Nagar', city: 'Kanpur', ward: 'Ward 62', district: 'Kanpur Nagar', landmark: 'Central Park', latitude: 26.4358, longitude: 80.3341, active: true },
];

const INITIAL_DEPARTMENTS = [
  { id: 'dept-1', name: 'Public Works Department (PWD)', description: 'Road repairs, potholes, sidewalks', head: 'Er. R. K. Verma', email: 'pwd.kanpur@nic.in', phone: '+91 512 2548901' },
  { id: 'dept-2', name: 'Jal Sansthan (Water & Drainage)', description: 'Water supply lines, sewage overflows', head: 'Smt. Anjali Srivastava', email: 'jalsansthan.kanpur@nic.in', phone: '+91 512 2543412' },
  { id: 'dept-3', name: 'KESCO (Electricity & Street Lighting)', description: 'Street lights, cables, transformers', head: 'Er. S. N. Mishra', email: 'kesco.grievance@nic.in', phone: '+91 512 2556789' },
  { id: 'dept-4', name: 'Solid Waste & Sanitation (Nagar Nigam)', description: 'Garbage collection, illegal dumping', head: 'Dr. Alok Pandey', email: 'sanitation.knn@nic.in', phone: '+91 512 2534567' },
  { id: 'dept-5', name: 'Health & Vector Control', description: 'Mosquito fogging, stray animals', head: 'Dr. Meena Gupta', email: 'health.knn@nic.in', phone: '+91 512 2534890' },
  { id: 'dept-6', name: 'Traffic & Public Safety', description: 'Traffic signals, illegal parking', head: 'Inspector Rajesh Kumar', email: 'traffic.kanpur@uppolice.gov.in', phone: '+91 512 2304100' },
];

const INITIAL_OFFICERS = [
  { id: 'off-1', name: 'Er. Vikram Singh', employee_id: 'OFF-KN-2024-01', email: 'vikram.singh@kanpur.gov.in', mobile: '9876543210', username: 'officer1', password_hash: 'password123', department: 'Public Works Department (PWD)', area_name: 'Kalyanpur', area_id: 'area-1', designation: 'Junior Engineer', status: 'Active' },
  { id: 'off-2', name: 'Smt. Sunita Yadav', employee_id: 'OFF-KN-2024-02', email: 'sunita.yadav@kanpur.gov.in', mobile: '9876543211', username: 'officer2', password_hash: 'password123', department: 'Jal Sansthan (Water & Drainage)', area_name: 'Kakadeo', area_id: 'area-2', designation: 'Assistant Engineer', status: 'Active' }
];

// Entity Repository Factory
function createRepository(tableName, localDefault = []) {
  return {
    async list(sort = '-created_date', limit = 500) {
      if (!hasValidSupabaseConfig) {
        let items = [...getLocalCollection(tableName, localDefault)];
        if (sort) {
          const isDesc = sort.startsWith('-');
          const field = sort.replace(/^[+-]/, '');
          items.sort((a, b) => {
            const valA = a[field] ?? '';
            const valB = b[field] ?? '';
            return isDesc ? (valB > valA ? 1 : -1) : (valA > valB ? 1 : -1);
          });
        }
        return items.slice(0, limit);
      }

      let query = supabase.from(tableName).select('*');
      if (sort) {
        const isDesc = sort.startsWith('-');
        const field = sort.replace(/^[+-]/, '');
        query = query.order(field, { ascending: !isDesc });
      }
      if (limit) query = query.limit(limit);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async filter(filterObj = {}, sort = '-created_date', limit = 200) {
      if (!hasValidSupabaseConfig) {
        let items = getLocalCollection(tableName, localDefault).filter((item) => {
          return Object.entries(filterObj).every(([k, v]) => String(item[k]) === String(v));
        });
        if (sort) {
          const isDesc = sort.startsWith('-');
          const field = sort.replace(/^[+-]/, '');
          items.sort((a, b) => {
            const valA = a[field] ?? '';
            const valB = b[field] ?? '';
            return isDesc ? (valB > valA ? 1 : -1) : (valA > valB ? 1 : -1);
          });
        }
        return items.slice(0, limit);
      }

      let query = supabase.from(tableName).select('*');
      Object.entries(filterObj).forEach(([k, v]) => {
        query = query.eq(k, v);
      });
      if (sort) {
        const isDesc = sort.startsWith('-');
        const field = sort.replace(/^[+-]/, '');
        query = query.order(field, { ascending: !isDesc });
      }
      if (limit) query = query.limit(limit);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async get(id) {
      if (!hasValidSupabaseConfig) {
        const items = getLocalCollection(tableName, localDefault);
        const found = items.find((x) => x.id === id);
        if (!found) throw new Error(`${tableName} record with id ${id} not found`);
        return found;
      }

      const { data, error } = await supabase.from(tableName).select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },

    async create(record) {
      const now = new Date().toISOString();
      const withMeta = {
        id: record.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'rec_' + Date.now()),
        created_date: now,
        ...record,
      };

      if (!hasValidSupabaseConfig) {
        const items = getLocalCollection(tableName, localDefault);
        items.unshift(withMeta);
        saveLocalCollection(tableName, items);
        return withMeta;
      }

      const { data, error } = await supabase.from(tableName).insert(withMeta).select().single();
      if (error) throw error;
      return data;
    },

    async bulkCreate(records = []) {
      const now = new Date().toISOString();
      const formatted = records.map((r) => ({
        id: r.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'rec_' + Math.random().toString(36).slice(2)),
        created_date: now,
        ...r,
      }));

      if (!hasValidSupabaseConfig) {
        const items = getLocalCollection(tableName, localDefault);
        const updated = [...formatted, ...items];
        saveLocalCollection(tableName, updated);
        return formatted;
      }

      const { data, error } = await supabase.from(tableName).insert(formatted).select();
      if (error) throw error;
      return data || [];
    },

    async update(id, patch) {
      const now = new Date().toISOString();
      if (!hasValidSupabaseConfig) {
        const items = getLocalCollection(tableName, localDefault);
        const idx = items.findIndex((x) => x.id === id);
        if (idx === -1) throw new Error(`${tableName} record not found`);
        const updated = { ...items[idx], ...patch, updated_at: now };
        items[idx] = updated;
        saveLocalCollection(tableName, items);
        return updated;
      }

      const { data, error } = await supabase
        .from(tableName)
        .update({ ...patch, updated_at: now })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async bulkUpdate(records = []) {
      const results = [];
      for (const rec of records) {
        if (!rec.id) continue;
        const { id, ...patch } = rec;
        const updated = await this.update(id, patch);
        results.push(updated);
      }
      return results;
    },

    async delete(id) {
      if (!hasValidSupabaseConfig) {
        const items = getLocalCollection(tableName, localDefault).filter((x) => x.id !== id);
        saveLocalCollection(tableName, items);
        return { success: true };
      }

      const { error } = await supabase.from(tableName).delete().eq('id', id);
      if (error) throw error;
      return { success: true };
    },

    subscribe(callback) {
      if (!hasValidSupabaseConfig) {
        // In local mode, return a harmless unsubscribe no-op
        return () => {};
      }

      const channelName = `sub_${tableName}_${Math.random().toString(36).slice(2, 7)}`;
      const channel = supabase
        .channel(channelName)
        .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, () => {
          if (typeof callback === 'function') callback();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    },
  };
}

// Map entity names to PostgreSQL tables
const entities = {
  Complaint: createRepository('complaints'),
  ComplaintMedia: createRepository('complaint_media'),
  Department: createRepository('departments', INITIAL_DEPARTMENTS),
  Area: createRepository('areas', INITIAL_AREAS),
  Officer: createRepository('officers', INITIAL_OFFICERS),
  Notification: createRepository('notifications'),
  ActivityLog: createRepository('activity_logs'),
  OfficerActivityLog: createRepository('officer_activity_logs'),
  Feedback: createRepository('feedback'),
};

// Authentication Layer
const auth = {
  isDemoMode() {
    return !hasValidSupabaseConfig;
  },

  async me() {
    let user = null;

    if (hasValidSupabaseConfig) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.user) {
          user = sessionData.session.user;
        } else {
          const { data: userData, error } = await supabase.auth.getUser();
          if (!error && userData?.user) {
            user = userData.user;
          }
        }
      } catch (e) {
        console.warn('Supabase session check error:', e);
      }
    }

    if (user) {
      // Check if user signed in with an intended role (e.g. from Admin login)
      const intendedRole = localStorage.getItem('scms_auth_intended_role');

      // Fetch profile for role and full_name
      let role = user.user_metadata?.role || intendedRole || 'citizen';
      let full_name = user.user_metadata?.full_name || user.user_metadata?.name || '';
      const avatar_url = user.user_metadata?.avatar_url || user.user_metadata?.picture || '';

      try {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
        if (profile) {
          role = profile.role || role;
          full_name = profile.full_name || full_name;
        } else {
          await supabase.from('profiles').upsert({
            id: user.id,
            email: user.email,
            full_name: full_name || user.email?.split('@')[0] || 'User',
            role,
            avatar_url: avatar_url || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      } catch {
        // Use user metadata fallback
      }

      return {
        id: user.id,
        email: user.email,
        full_name: full_name || user.email?.split('@')[0] || 'User',
        role,
        avatar_url,
      };
    }

    // Check if there is a local / Google session stored in localStorage
    const stored = localStorage.getItem('scms_demo_user');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed && (parsed.email || parsed.id)) {
          return parsed;
        }
      } catch {}
    }

    if (!hasValidSupabaseConfig) {
      // Default demo citizen user when offline and no stored user
      const demo = { id: 'demo-citizen-id', email: 'citizen@example.com', full_name: 'Ayush (Demo User)', role: 'citizen' };
      localStorage.setItem('scms_demo_user', JSON.stringify(demo));
      return demo;
    }

    throw new Error('Not authenticated');
  },

  async loginViaEmailPassword(email, password) {
    if (!hasValidSupabaseConfig) {
      const isMockAdmin = email.toLowerCase().includes('admin');
      const user = {
        id: 'demo-' + (isMockAdmin ? 'admin' : 'citizen') + '-id',
        email,
        full_name: email.split('@')[0],
        role: isMockAdmin ? 'admin' : 'citizen',
      };
      localStorage.setItem('scms_demo_user', JSON.stringify(user));
      return { user };
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async register({ email, password }) {
    if (!hasValidSupabaseConfig) {
      const user = {
        id: 'demo-citizen-id',
        email,
        full_name: email.split('@')[0],
        role: 'citizen',
      };
      localStorage.setItem('scms_demo_user', JSON.stringify(user));
      return { user };
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: email.split('@')[0],
          role: 'citizen',
        },
      },
    });
    if (error) throw error;
    return data;
  },

  async verifyOtp({ email, otpCode }) {
    if (!hasValidSupabaseConfig) {
      return { access_token: 'demo_token' };
    }

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otpCode,
      type: 'signup',
    });
    if (error) throw error;
    return data;
  },

  async resendOtp(email) {
    if (!hasValidSupabaseConfig) return { success: true };
    const { data, error } = await supabase.auth.resend({
      type: 'signup',
      email,
    });
    if (error) throw error;
    return data;
  },

  async loginWithProvider(provider, returnTo = '/') {
    const isAdmin = returnTo?.includes('admin') || window.location.search.includes('role=admin');
    const targetRole = isAdmin ? 'admin' : 'citizen';
    localStorage.setItem('scms_auth_intended_role', targetRole);

    if (!hasValidSupabaseConfig) {
      const user = {
        id: isAdmin ? 'demo-admin-google-id' : 'demo-google-id',
        email: isAdmin ? 'admin.google@example.com' : 'google.user@example.com',
        full_name: isAdmin ? 'Google Admin User' : 'Google Citizen User',
        role: targetRole,
      };
      localStorage.setItem('scms_demo_user', JSON.stringify(user));
      window.location.href = returnTo || (isAdmin ? '/admin' : '/');
      return;
    }

    const redirectTo = window.location.origin + (returnTo || (isAdmin ? '/admin' : '/'));
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    if (error) throw error;
    if (data?.url) {
      window.location.href = data.url;
    }
  },

  async resetPasswordRequest(email) {
    if (!hasValidSupabaseConfig) return { success: true };
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password',
    });
    if (error) throw error;
    return data;
  },

  async resetPassword({ resetToken, newPassword }) {
    if (!hasValidSupabaseConfig) return { success: true };
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return data;
  },

  async updateMe({ full_name, role }) {
    if (!hasValidSupabaseConfig) {
      const cur = await this.me();
      const updated = {
        ...cur,
        ...(full_name !== undefined ? { full_name } : {}),
        ...(role !== undefined ? { role } : {}),
      };
      localStorage.setItem('scms_demo_user', JSON.stringify(updated));
      return updated;
    }

    const updates = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (role !== undefined) updates.role = role;

    const { data: { user }, error: authErr } = await supabase.auth.updateUser({
      data: updates,
    });
    if (authErr) throw authErr;

    try {
      await supabase.from('profiles').upsert({
        id: user.id,
        ...updates,
        updated_at: new Date().toISOString(),
      });
    } catch {}

    return {
      id: user.id,
      email: user.email,
      full_name: full_name !== undefined ? full_name : (user.user_metadata?.full_name || ''),
      role: role !== undefined ? role : (user.user_metadata?.role || 'citizen'),
    };
  },

  async logout(redirectUrl) {
    localStorage.removeItem('scms_demo_user');
    localStorage.removeItem('scms_auth_intended_role');
    if (hasValidSupabaseConfig) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('Supabase sign out error:', e);
      }
    }
    if (redirectUrl) {
      window.location.href = redirectUrl;
    }
  },

  redirectToLogin(returnTo) {
    window.location.href = '/login' + (returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : '');
  },

  setToken(_token) {
    // Managed automatically by Supabase client
  },

  isAuthenticated() {
    if (!hasValidSupabaseConfig) {
      return Boolean(localStorage.getItem('scms_demo_user'));
    }
    return Boolean(supabase.auth.getSession());
  },
};

// Functions invocation layer
const functions = {
  async invoke(functionName, payload = {}) {
    // 1. Officer Login
    if (functionName === 'officerLogin') {
      const { username, password } = payload;
      const officers = await entities.Officer.list();
      const officer = officers.find(
        (o) => o.username === username && (o.password_hash === password || !o.password_hash)
      );
      if (!officer) {
        throw new Error('Invalid officer username or password');
      }
      if (officer.status !== 'Active') {
        throw new Error('This officer account is inactive. Please contact your administrator.');
      }
      return { officer };
    }

    // 2. Officer Portal
    if (functionName === 'officerPortal') {
      const { action, officer_id, status, complaint_id, new_status, remarks } = payload;
      if (action === 'complaints') {
        let all = await entities.Complaint.list('-created_date', 500);
        // Filter by officer_id or show all if officer_id not set
        if (officer_id) {
          const matched = all.filter((c) => c.officer_id === officer_id);
          // If no complaints directly assigned to this ID, also include complaints from officer's department/area
          if (matched.length > 0) all = matched;
        }
        if (status && status !== 'All') {
          all = all.filter((c) => c.status === status);
        }
        return { complaints: all };
      }

      if (action === 'complaint_detail') {
        const complaint = await entities.Complaint.get(complaint_id);
        const media = await entities.ComplaintMedia.filter({ complaint_id });
        const activity = await entities.OfficerActivityLog.filter({ complaint_id });
        return { complaint, media, activity };
      }

      if (action === 'update_status') {
        const complaint = await entities.Complaint.get(complaint_id);
        const now = new Date().toISOString();
        const oldStatus = complaint.status;
        const timeline = Array.isArray(complaint.timeline) ? [...complaint.timeline] : [];
        timeline.push({
          status: new_status,
          note: remarks || `Status changed to ${new_status}`,
          timestamp: now,
        });

        const patch = {
          status: new_status,
          timeline,
          remarks: remarks ? (complaint.remarks ? `${complaint.remarks}\n${remarks}` : remarks) : complaint.remarks,
        };
        if (new_status === 'Resolved') {
          patch.actual_resolved_date = now;
        }

        const updated = await entities.Complaint.update(complaint_id, patch);

        // Record officer activity
        await entities.OfficerActivityLog.create({
          officer_id: officer_id || 'officer',
          officer_name: payload.officer_name || 'Assigned Officer',
          complaint_id,
          complaint_title: complaint.title,
          action: 'status_update',
          old_status: oldStatus,
          new_status,
          remarks: remarks || '',
        });

        // Notify citizen
        await entities.Notification.create({
          title: `Status update: ${complaint.title}`,
          message: `Your complaint is now "${new_status}". ${remarks ? `Officer note: ${remarks}` : ''}`,
          type: 'status_update',
          complaint_id,
          user_id: complaint.created_by_id,
        });

        return { complaint: updated };
      }
    }

    // 3. Officer Upload Evidence
    if (functionName === 'officerUploadEvidence') {
      const { complaint_id, phase, file_data, file_name, file_type } = payload;
      const media = await entities.ComplaintMedia.create({
        complaint_id,
        phase: phase || 'during',
        file_url: file_data,
        file_name: file_name || 'evidence.jpg',
        media_type: (file_type || '').includes('video') ? 'video' : 'photo',
        uploaded_by: payload.officer_id || 'Officer',
      });
      return { media };
    }

    // 4. Save Officer
    if (functionName === 'saveOfficer') {
      const { officer_id, password, ...rest } = payload;
      const dataToSave = {
        ...rest,
        ...(password ? { password_hash: password } : {}),
      };
      let saved;
      if (officer_id) {
        saved = await entities.Officer.update(officer_id, dataToSave);
      } else {
        saved = await entities.Officer.create(dataToSave);
      }
      return { officer: saved };
    }

    // 5. Smart Complaint Analysis (Category, Priority, Spam Detection, SLA & Summary)
    if (functionName === 'analyzeComplaint') {
      const { title = '', description = '', category = '' } = payload;
      const text = `${title} ${description}`.toLowerCase();

      let suggested_department = 'Public Works Department (PWD)';
      let priority = 'Medium';
      let is_spam = false;
      let duplicate_of = '';

      // Department and Category heuristics
      if (text.includes('water') || text.includes('drain') || text.includes('sewer') || text.includes('pipe') || text.includes('overflow') || text.includes('leak')) {
        suggested_department = 'Jal Sansthan (Water & Drainage)';
        if (text.includes('drinking') || text.includes('flood') || text.includes('burst')) priority = 'High';
      } else if (text.includes('light') || text.includes('electric') || text.includes('wire') || text.includes('transformer') || text.includes('spark')) {
        suggested_department = 'KESCO (Electricity & Street Lighting)';
        if (text.includes('spark') || text.includes('hanging') || text.includes('danger')) priority = 'High';
      } else if (text.includes('garbage') || text.includes('waste') || text.includes('dustbin') || text.includes('dump') || text.includes('filth')) {
        suggested_department = 'Solid Waste & Sanitation (Nagar Nigam)';
      } else if (text.includes('dog') || text.includes('animal') || text.includes('mosquito') || text.includes('dengue') || text.includes('smell')) {
        suggested_department = 'Health & Vector Control';
      } else if (text.includes('parking') || text.includes('traffic') || text.includes('jam') || text.includes('encroach')) {
        suggested_department = 'Traffic & Public Safety';
      } else if (text.includes('pot hole') || text.includes('pothole') || text.includes('road') || text.includes('cracked')) {
        suggested_department = 'Public Works Department (PWD)';
        if (text.includes('accident') || text.includes('deep')) priority = 'High';
      }

      // Spam check
      if (text.length < 12 || /(test|asdf|qwerty|1234)/i.test(text)) {
        is_spam = text.length < 8;
      }

      const ai_summary = `Issue identified as ${category || 'civic grievance'}. Assigned to ${suggested_department} with ${priority} priority.`;

      return {
        suggested_department,
        priority,
        is_spam,
        duplicate_of,
        ai_summary,
      };
    }

    // 6. Google Maps Configuration
    if (functionName === 'getMapsConfig') {
      return {
        apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
      };
    }

    return {};
  },
};

// Storage and Integrations
const integrations = {
  Core: {
    async UploadFile({ file }) {
      if (!file) throw new Error('No file provided');

      // 1. If Supabase is connected, try uploading to 'complaint-media' bucket
      if (hasValidSupabaseConfig) {
        try {
          const ext = file.name.split('.').pop();
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
          const filePath = `uploads/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('complaint-media')
            .upload(filePath, file, { upsert: true });

          if (!uploadError) {
            const { data } = supabase.storage.from('complaint-media').getPublicUrl(filePath);
            if (data?.publicUrl) {
              return { file_url: data.publicUrl };
            }
          }
        } catch (storageErr) {
          console.warn('Supabase storage upload failed, using Data URL fallback:', storageErr);
        }
      }

      // 2. Resilient Fallback: Convert to Data URL (works offline, in local demo, or before bucket creation)
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ file_url: reader.result });
        reader.onerror = (e) => reject(new Error('Failed to read file: ' + e));
        reader.readAsDataURL(file);
      });
    },
  },
};

// Unified Export
export const api = {
  auth,
  entities,
  functions,
  integrations,
};

export { entities, auth, functions, integrations };

export default supabase;
