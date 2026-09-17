/// <reference path="../vite-env.d.ts" />
import { createClient } from '@supabase/supabase-js';

const rawEnvUrl = (
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.SUPABASE_URL ||
  ''
).trim();

// Clean any accidental '/rest/v1' suffix or trailing slashes
const envUrl = rawEnvUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');

const envKey = (
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.SUPABASE_ANON_KEY ||
  ''
).trim();

// Detect whether valid Supabase credentials have been configured
export const hasValidSupabaseConfig = Boolean(
  envUrl &&
  envKey &&
  envUrl.startsWith('https://') &&
  !envUrl.includes('your-project') &&
  !envUrl.includes('placeholder') &&
  !envUrl.includes('vutory')
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

export const PRODUCTION_SITE_URL = (
  import.meta.env.VITE_SITE_URL ||
  'https://civicportalproject-aaaa1-6bb1.vercel.app'
).replace(/\/+$/, '');

/**
 * Returns an absolute redirect URL on the Civic Portal application domain,
 * ensuring users are returned to Civic Portal and never to the Supabase domain.
 */
export function getAuthRedirectUrl(path = '/') {
  const origin = (typeof window !== 'undefined' && window.location?.origin)
    ? window.location.origin
    : PRODUCTION_SITE_URL;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${origin}${cleanPath}`;
}

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

// UUID helpers and legacy ID mapping to ensure 100% PostgreSQL UUID compatibility
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUUID(str) {
  return typeof str === 'string' && UUID_REGEX.test(str.trim());
}

export function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // RFC4122 v4 compliant fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Deterministic UUIDs for seeded entities to avoid syntax errors with PostgreSQL UUID columns
export const LEGACY_ID_MAP = {
  // Departments
  'dept-1': 'a0000000-0000-0000-0000-000000000001',
  'dept-2': 'a0000000-0000-0000-0000-000000000002',
  'dept-3': 'a0000000-0000-0000-0000-000000000003',
  'dept-4': 'a0000000-0000-0000-0000-000000000004',
  'dept-5': 'a0000000-0000-0000-0000-000000000005',
  'dept-6': 'a0000000-0000-0000-0000-000000000006',
  // Areas
  'area-1': 'b0000000-0000-0000-0000-000000000001',
  'area-2': 'b0000000-0000-0000-0000-000000000002',
  'area-3': 'b0000000-0000-0000-0000-000000000003',
  'area-4': 'b0000000-0000-0000-0000-000000000004',
  'area-5': 'b0000000-0000-0000-0000-000000000005',
  'area-6': 'b0000000-0000-0000-0000-000000000006',
  // Officers
  'off-1': 'c0000000-0000-0000-0000-000000000001',
  'off-2': 'c0000000-0000-0000-0000-000000000002',
};

export function normalizeUUID(val) {
  if (!val || typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  if (LEGACY_ID_MAP[trimmed]) return LEGACY_ID_MAP[trimmed];
  if (isUUID(trimmed)) return trimmed;
  return null;
}

const UUID_FIELDS = new Set([
  'id',
  'area_id',
  'department_id',
  'officer_id',
  'complaint_id',
  'user_id',
  'created_by_id',
]);

function sanitizeRecordForPostgres(record, tableName = '') {
  if (!record || typeof record !== 'object') return record;
  const clean = { ...record };

  // Ensure ID is a valid UUID
  if (clean.id !== undefined) {
    const norm = normalizeUUID(clean.id);
    clean.id = norm || generateUUID();
  }

  // Sanitize UUID relational columns
  for (const field of UUID_FIELDS) {
    if (field in clean) {
      if (clean[field] === '' || clean[field] === undefined) {
        clean[field] = null;
      } else if (typeof clean[field] === 'string') {
        const norm = normalizeUUID(clean[field]);
        // If it was a string that cannot be parsed as a UUID, set to null to prevent Postgres casting errors
        clean[field] = norm;
      }
    }
  }

  return clean;
}

export function extractMissingColumn(error) {
  if (!error) return null;
  const msg = error.message || (typeof error === 'string' ? error : '');
  const m1 = msg.match(/Could not find the '([^']+)' column/i);
  if (m1) return m1[1];
  const m2 = msg.match(/column (?:[a-zA-Z0-9_]+\.)?["']?([a-zA-Z0-9_]+)["']? does not exist/i);
  if (m2) return m2[1];
  return null;
}

// Initial mock datasets for demo mode
const INITIAL_AREAS = [
  { id: 'b0000000-0000-0000-0000-000000000001', name: 'Kalyanpur', city: 'Kanpur', ward: 'Ward 38', district: 'Kanpur Nagar', landmark: 'Near Kalyanpur Crossing', latitude: 26.4927, longitude: 80.2589, active: true },
  { id: 'b0000000-0000-0000-0000-000000000002', name: 'Kakadeo', city: 'Kanpur', ward: 'Ward 42', district: 'Kanpur Nagar', landmark: 'Deoki Cinema Crossing', latitude: 26.4789, longitude: 80.2974, active: true },
  { id: 'b0000000-0000-0000-0000-000000000003', name: 'Civil Lines', city: 'Kanpur', ward: 'Ward 15', district: 'Kanpur Nagar', landmark: 'Green Park Stadium', latitude: 26.4729, longitude: 80.3444, active: true },
  { id: 'b0000000-0000-0000-0000-000000000004', name: 'Swaroop Nagar', city: 'Kanpur', ward: 'Ward 21', district: 'Kanpur Nagar', landmark: 'Near Motijheel', latitude: 26.4815, longitude: 80.3182, active: true },
  { id: 'b0000000-0000-0000-0000-000000000005', name: 'Govind Nagar', city: 'Kanpur', ward: 'Ward 54', district: 'Kanpur Nagar', landmark: 'C-Block Market', latitude: 26.4432, longitude: 80.3015, active: true },
  { id: 'b0000000-0000-0000-0000-000000000006', name: 'Kidwai Nagar', city: 'Kanpur', ward: 'Ward 62', district: 'Kanpur Nagar', landmark: 'Central Park', latitude: 26.4358, longitude: 80.3341, active: true },
  { id: 'b0000000-0000-0000-0000-000000000007', name: 'Barra', city: 'Kanpur', ward: 'Ward 48', district: 'Kanpur Nagar', landmark: 'Barra Bypass', latitude: 26.4250, longitude: 80.2900, active: true },
  { id: 'b0000000-0000-0000-0000-000000000008', name: 'Gumti No. 5', city: 'Kanpur', ward: 'Ward 33', district: 'Kanpur Nagar', landmark: 'Gumti Market', latitude: 26.4750, longitude: 80.3120, active: true },
  { id: 'b0000000-0000-0000-0000-000000000009', name: 'Fazalganj', city: 'Kanpur', ward: 'Ward 29', district: 'Kanpur Nagar', landmark: 'Kalpi Road Crossing', latitude: 26.4560, longitude: 80.2980, active: true },
  { id: 'b0000000-0000-0000-0000-000000000010', name: 'Ratan Lal Nagar', city: 'Kanpur', ward: 'Ward 51', district: 'Kanpur Nagar', landmark: 'Ratan Lal Nagar Crossing', latitude: 26.4380, longitude: 80.2850, active: true },
  { id: 'b0000000-0000-0000-0000-000000000011', name: 'Shastri Nagar', city: 'Kanpur', ward: 'Ward 35', district: 'Kanpur Nagar', landmark: 'Central Park', latitude: 26.4740, longitude: 80.2910, active: true },
  { id: 'b0000000-0000-0000-0000-000000000012', name: 'Armapur', city: 'Kanpur', ward: 'Ward 40', district: 'Kanpur Nagar', landmark: 'Armapur Estate', latitude: 26.4800, longitude: 80.2650, active: true },
  { id: 'b0000000-0000-0000-0000-000000000013', name: 'Rawatpur', city: 'Kanpur', ward: 'Ward 25', district: 'Kanpur Nagar', landmark: 'Rawatpur Station', latitude: 26.4840, longitude: 80.2920, active: true },
  { id: 'b0000000-0000-0000-0000-000000000014', name: 'Gujaini', city: 'Kanpur', ward: 'Ward 55', district: 'Kanpur Nagar', landmark: 'Gujaini Highway', latitude: 26.4200, longitude: 80.2680, active: true },
];

const INITIAL_DEPARTMENTS = [
  { id: 'a0000000-0000-0000-0000-000000000001', name: 'Public Works Department (PWD)', description: 'Road repairs, potholes, sidewalks', head: 'Er. R. K. Verma', email: 'pwd.kanpur@nic.in', phone: '+91 512 2548901' },
  { id: 'a0000000-0000-0000-0000-000000000002', name: 'Jal Sansthan (Water & Drainage)', description: 'Water supply lines, sewage overflows', head: 'Smt. Anjali Srivastava', email: 'jalsansthan.kanpur@nic.in', phone: '+91 512 2543412' },
  { id: 'a0000000-0000-0000-0000-000000000003', name: 'KESCO (Electricity & Street Lighting)', description: 'Street lights, cables, transformers', head: 'Er. S. N. Mishra', email: 'kesco.grievance@nic.in', phone: '+91 512 2556789' },
  { id: 'a0000000-0000-0000-0000-000000000004', name: 'Solid Waste & Sanitation (Nagar Nigam)', description: 'Garbage collection, illegal dumping', head: 'Dr. Alok Pandey', email: 'sanitation.knn@nic.in', phone: '+91 512 2534567' },
  { id: 'a0000000-0000-0000-0000-000000000005', name: 'Health & Vector Control', description: 'Mosquito fogging, stray animals', head: 'Dr. Meena Gupta', email: 'health.knn@nic.in', phone: '+91 512 2534890' },
  { id: 'a0000000-0000-0000-0000-000000000006', name: 'Traffic & Public Safety', description: 'Traffic signals, illegal parking', head: 'Inspector Rajesh Kumar', email: 'traffic.kanpur@uppolice.gov.in', phone: '+91 512 2304100' },
];

const INITIAL_OFFICERS = [
  { id: 'c0000000-0000-0000-0000-000000000001', name: 'Er. Vikram Singh', employee_id: 'OFF-KN-2024-01', email: 'vikram.singh@kanpur.gov.in', mobile: '9876543210', username: 'officer1', password_hash: 'password123', department: 'Public Works Department (PWD)', area_name: 'Kalyanpur', area_id: 'b0000000-0000-0000-0000-000000000001', designation: 'Junior Engineer', status: 'Active' },
  { id: 'c0000000-0000-0000-0000-000000000002', name: 'Smt. Sunita Yadav', employee_id: 'OFF-KN-2024-02', email: 'sunita.yadav@kanpur.gov.in', mobile: '9876543211', username: 'officer2', password_hash: 'password123', department: 'Jal Sansthan (Water & Drainage)', area_name: 'Kakadeo', area_id: 'b0000000-0000-0000-0000-000000000002', designation: 'Assistant Engineer', status: 'Active' }
];

// Entity Repository Factory
function createRepository(tableName, localDefault = [], defaultSort = null) {
  const isStrictSupabase = tableName === 'complaints' || tableName === 'complaint_media';
  const fallbackSort = defaultSort !== null && defaultSort !== undefined
    ? defaultSort
    : (tableName === 'departments' || tableName === 'areas' || tableName === 'officers' ? 'name' : '-created_date');

  return {
    async list(sort = fallbackSort, limit = 500) {
      if (!hasValidSupabaseConfig) {
        if (isStrictSupabase) {
          throw new Error(
            'Supabase configuration required. Complaints must be stored in and retrieved directly from Supabase as the source of truth. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
          );
        }
        let items = [...getLocalCollection(tableName, localDefault)];
        if (sort) {
          const isDesc = sort.startsWith('-');
          const field = sort.replace(/^[+-]/, '');
          items.sort((a, b) => {
            const valA = a[field] ?? a['created_at'] ?? a['name'] ?? '';
            const valB = b[field] ?? b['created_at'] ?? b['name'] ?? '';
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

      let { data, error } = await query;
      if (error) {
        // If sorting failed because the column does not exist (Postgres 42703), retry without that order clause
        if (error.code === '42703' || (error.message && error.message.toLowerCase().includes('does not exist'))) {
          console.warn(`[supabase] Column "${sort}" does not exist on table "${tableName}". Retrying without order clause.`);
          const fallbackQuery = supabase.from(tableName).select('*').limit(limit || 500);
          const fallbackRes = await fallbackQuery;
          if (!fallbackRes.error && fallbackRes.data) {
            const isDesc = sort?.startsWith('-');
            const field = sort?.replace(/^[+-]/, '');
            const sortedData = [...fallbackRes.data];
            if (field) {
              sortedData.sort((a, b) => {
                const valA = a[field] ?? a['name'] ?? a['created_at'] ?? '';
                const valB = b[field] ?? b['name'] ?? b['created_at'] ?? '';
                return isDesc ? (valB > valA ? 1 : -1) : (valA > valB ? 1 : -1);
              });
            }
            return sortedData;
          }
        }
        throw error;
      }
      return data || [];
    },

    async filter(filterObj = {}, sort = fallbackSort, limit = 200) {
      if (!hasValidSupabaseConfig) {
        if (isStrictSupabase) {
          throw new Error(
            'Supabase configuration required. Complaints must be stored in and retrieved directly from Supabase as the source of truth. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
          );
        }
        let items = getLocalCollection(tableName, localDefault).filter((item) => {
          return Object.entries(filterObj).every(([k, v]) => {
            const itemVal = item[k];
            if (v === '' || v === null || v === undefined) {
              return itemVal === '' || itemVal === null || itemVal === undefined;
            }
            return String(itemVal) === String(v) || (LEGACY_ID_MAP[v] && String(itemVal) === String(LEGACY_ID_MAP[v]));
          });
        });
        if (sort) {
          const isDesc = sort.startsWith('-');
          const field = sort.replace(/^[+-]/, '');
          items.sort((a, b) => {
            const valA = a[field] ?? a['created_at'] ?? a['name'] ?? '';
            const valB = b[field] ?? b['created_at'] ?? b['name'] ?? '';
            return isDesc ? (valB > valA ? 1 : -1) : (valA > valB ? 1 : -1);
          });
        }
        return items.slice(0, limit);
      }

      let query = supabase.from(tableName).select('*');
      Object.entries(filterObj).forEach(([k, v]) => {
        if (UUID_FIELDS.has(k)) {
          if (v === '' || v === undefined) {
            query = query.is(k, null);
          } else {
            const norm = normalizeUUID(v);
            query = query.eq(k, norm || v);
          }
        } else {
          query = query.eq(k, v);
        }
      });
      if (sort) {
        const isDesc = sort.startsWith('-');
        const field = sort.replace(/^[+-]/, '');
        query = query.order(field, { ascending: !isDesc });
      }
      if (limit) query = query.limit(limit);

      let { data, error } = await query;
      if (error) {
        if (error.code === '42703' || (error.message && error.message.toLowerCase().includes('does not exist'))) {
          console.warn(`[supabase] Column "${sort}" does not exist on table "${tableName}". Retrying filter without order clause.`);
          let fallbackQuery = supabase.from(tableName).select('*');
          Object.entries(filterObj).forEach(([k, v]) => {
            if (UUID_FIELDS.has(k)) {
              if (v === '' || v === undefined) {
                fallbackQuery = fallbackQuery.is(k, null);
              } else {
                const norm = normalizeUUID(v);
                fallbackQuery = fallbackQuery.eq(k, norm || v);
              }
            } else {
              fallbackQuery = fallbackQuery.eq(k, v);
            }
          });
          if (limit) fallbackQuery = fallbackQuery.limit(limit);
          const fallbackRes = await fallbackQuery;
          if (!fallbackRes.error && fallbackRes.data) {
            return fallbackRes.data;
          }
        }
        throw error;
      }
      return data || [];
    },

    async get(id) {
      const normalizedId = normalizeUUID(id) || id;

      if (!hasValidSupabaseConfig) {
        if (isStrictSupabase) {
          throw new Error(
            'Supabase configuration required. Complaints must be stored in and retrieved directly from Supabase as the source of truth. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
          );
        }
        const items = getLocalCollection(tableName, localDefault);
        const found = items.find((x) => x.id === id || x.id === normalizedId || (tableName === 'complaints' && x.complaint_code === id));
        if (!found) throw new Error(`${tableName} record with id ${id} not found`);
        return found;
      }

      // If querying complaints and the provided ID is not a UUID (e.g. human tracking code CP20261234),
      // query complaint_code instead to prevent Postgres syntax error for type uuid.
      if (tableName === 'complaints' && !isUUID(normalizedId)) {
        const { data, error } = await supabase.from(tableName).select('*').eq('complaint_code', id).maybeSingle();
        if (error) throw error;
        if (data) return data;
      }

      const { data, error } = await supabase.from(tableName).select('*').eq('id', normalizedId).single();
      if (error) throw error;
      return data;
    },

    async create(record) {
      const now = new Date().toISOString();
      const rawWithMeta = {
        id: record.id || generateUUID(),
        created_date: now,
        ...record,
      };
      const cleanRecord = sanitizeRecordForPostgres(rawWithMeta, tableName);

      if (!hasValidSupabaseConfig) {
        if (isStrictSupabase) {
          throw new Error(
            'Supabase configuration required. Complaints must be stored in and retrieved directly from Supabase as the source of truth. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
          );
        }
        const items = getLocalCollection(tableName, localDefault);
        items.unshift(cleanRecord);
        saveLocalCollection(tableName, items);
        return cleanRecord;
      }

      let payload = { ...cleanRecord };
      let maxAttempts = 6;
      while (maxAttempts > 0) {
        maxAttempts--;
        const { data, error } = await supabase.from(tableName).insert(payload).select().single();
        if (!error) return data;

        const missingCol = extractMissingColumn(error);
        if (missingCol && missingCol in payload) {
          console.warn(`[supabase] Column "${missingCol}" not found in schema cache for "${tableName}". Stripping and retrying insertion.`);
          delete payload[missingCol];
          continue;
        }
        throw error;
      }
    },

    async bulkCreate(records = []) {
      const now = new Date().toISOString();
      const formatted = records.map((r) =>
        sanitizeRecordForPostgres(
          {
            id: r.id || generateUUID(),
            created_date: now,
            ...r,
          },
          tableName
        )
      );

      if (!hasValidSupabaseConfig) {
        if (isStrictSupabase) {
          throw new Error(
            'Supabase configuration required. Complaints must be stored in and retrieved directly from Supabase as the source of truth. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
          );
        }
        const items = getLocalCollection(tableName, localDefault);
        const updated = [...formatted, ...items];
        saveLocalCollection(tableName, updated);
        return formatted;
      }

      let payloadList = formatted.map((item) => ({ ...item }));
      let maxAttempts = 6;
      while (maxAttempts > 0) {
        maxAttempts--;
        const { data, error } = await supabase.from(tableName).insert(payloadList).select();
        if (!error) return data || [];

        const missingCol = extractMissingColumn(error);
        if (missingCol && payloadList.some((p) => missingCol in p)) {
          console.warn(`[supabase] Column "${missingCol}" not found in schema cache for "${tableName}". Stripping and retrying bulk insert.`);
          payloadList = payloadList.map((p) => {
            const copy = { ...p };
            delete copy[missingCol];
            return copy;
          });
          continue;
        }
        throw error;
      }
    },

    async update(id, patch) {
      const now = new Date().toISOString();
      const normalizedId = normalizeUUID(id) || id;
      const patchWithTime = { ...patch };
      if (tableName === 'complaints' || tableName === 'profiles' || patch.updated_at !== undefined) {
        patchWithTime.updated_at = patch.updated_at || now;
      }
      const cleanPatch = sanitizeRecordForPostgres(patchWithTime, tableName);
      delete cleanPatch.id; // Don't overwrite PK on update

      if (!hasValidSupabaseConfig) {
        if (isStrictSupabase) {
          throw new Error(
            'Supabase configuration required. Complaints must be stored in and retrieved directly from Supabase as the source of truth. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
          );
        }
        const items = getLocalCollection(tableName, localDefault);
        const idx = items.findIndex((x) => x.id === id || x.id === normalizedId);
        if (idx === -1) throw new Error(`${tableName} record not found`);
        const updated = { ...items[idx], ...cleanPatch };
        items[idx] = updated;
        saveLocalCollection(tableName, items);
        return updated;
      }

      let payload = { ...cleanPatch };
      let maxAttempts = 6;
      while (maxAttempts > 0) {
        maxAttempts--;
        const { data, error } = await supabase
          .from(tableName)
          .update(payload)
          .eq('id', normalizedId)
          .select()
          .single();
        if (!error) return data;

        const missingCol = extractMissingColumn(error);
        if (missingCol && missingCol in payload) {
          console.warn(`[supabase] Column "${missingCol}" not found in schema cache for "${tableName}". Stripping and retrying update.`);
          delete payload[missingCol];
          continue;
        }
        throw error;
      }
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
      const normalizedId = normalizeUUID(id) || id;
      if (!hasValidSupabaseConfig) {
        if (isStrictSupabase) {
          throw new Error(
            'Supabase configuration required. Complaints must be stored in and retrieved directly from Supabase as the source of truth. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
          );
        }
        const items = getLocalCollection(tableName, localDefault).filter((x) => x.id !== id && x.id !== normalizedId);
        saveLocalCollection(tableName, items);
        return { success: true };
      }

      const { error } = await supabase.from(tableName).delete().eq('id', normalizedId);
      if (error) throw error;
      return { success: true };
    },

    subscribe(callback) {
      if (!hasValidSupabaseConfig) {
        return () => {};
      }

      const channelName = `realtime_${tableName}_${Math.random().toString(36).slice(2, 8)}`;
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: tableName },
          (payload) => {
            if (typeof callback === 'function') callback(payload);
          }
        )
        .subscribe((status, error) => {
          if (error) {
            console.warn(`[Realtime] Subscription error on ${tableName}:`, error);
          }
        });

      return () => {
        supabase.removeChannel(channel);
      };
    },
  };
}

// Map entity names to PostgreSQL tables
const entities = {
  Complaint: createRepository('complaints', [], '-created_date'),
  ComplaintMedia: createRepository('complaint_media', [], '-created_date'),
  Department: createRepository('departments', INITIAL_DEPARTMENTS, 'name'),
  Area: createRepository('areas', INITIAL_AREAS, 'name'),
  Officer: createRepository('officers', INITIAL_OFFICERS, 'name'),
  Notification: createRepository('notifications', [], '-created_date'),
  ActivityLog: createRepository('activity_logs', [], '-created_date'),
  OfficerActivityLog: createRepository('officer_activity_logs', [], '-created_date'),
  Feedback: createRepository('feedback', [], '-created_date'),
};

// Single Authorized Admin Definition - configured strictly via VITE_ADMIN_EMAIL
export function getConfiguredAdminEmail() {
  const envVal = (import.meta.env.VITE_ADMIN_EMAIL || '').trim().toLowerCase();
  return envVal && !envVal.includes('your_admin_email') ? envVal : '';
}

export function isAuthorizedAdminEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const configuredAdmin = getConfiguredAdminEmail();
  if (!configuredAdmin) return false;
  return email.trim().toLowerCase() === configuredAdmin;
}

export const AUTHORIZED_ADMIN_EMAIL = getConfiguredAdminEmail();

// Authentication Layer
const auth = {
  isDemoMode() {
    return false;
  },

  getAuthorizedAdminEmail() {
    return AUTHORIZED_ADMIN_EMAIL;
  },

  async me() {
    // Purge any stale demo user key from previous offline/testing sessions
    try {
      localStorage.removeItem('scms_demo_user');
      localStorage.removeItem('scms_auth_intended_role');
    } catch {}

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
      const email = (user.email || '').toLowerCase().trim();
      const isAuthorizedAdmin = isAuthorizedAdminEmail(email);
      // ONLY the single designated admin account can ever receive the admin role
      const role = isAuthorizedAdmin ? 'admin' : 'citizen';
      let full_name = user.user_metadata?.full_name || user.user_metadata?.name || '';
      const avatar_url = user.user_metadata?.avatar_url || user.user_metadata?.picture || '';

      try {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
        if (profile) {
          full_name = profile.full_name || full_name;
          if (profile.role !== role) {
            await supabase.from('profiles').update({ role, updated_at: new Date().toISOString() }).eq('id', user.id);
          }
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
        // Fallback to computed role
      }

      return {
        id: user.id,
        email: user.email,
        full_name: full_name || user.email?.split('@')[0] || 'User',
        role,
        avatar_url,
      };
    }

    return null;
  },

  async loginViaEmailPassword(email, password) {
    if (!hasValidSupabaseConfig) {
      throw new Error('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables.');
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async register({ email, password, full_name = '' }) {
    if (isAuthorizedAdminEmail(email)) {
      throw new Error('This authorized admin email cannot be registered publicly. Please sign in via the Admin portal.');
    }

    if (!hasValidSupabaseConfig) {
      throw new Error('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables.');
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: full_name || email.split('@')[0],
          role: 'citizen',
        },
      },
    });
    if (error) throw error;
    return data;
  },

  async verifyOtp({ email, otpCode }) {
    if (!hasValidSupabaseConfig) {
      throw new Error('Supabase is not configured.');
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
    if (!hasValidSupabaseConfig) {
      throw new Error('Supabase is not configured.');
    }
    const { data, error } = await supabase.auth.resend({
      type: 'signup',
      email,
    });
    if (error) throw error;
    return data;
  },

  async loginWithProvider(provider, returnTo = '/citizen/dashboard') {
    const isAdminFlow = returnTo?.includes('admin') || (typeof window !== 'undefined' && window.location.search.includes('role=admin'));

    if (!hasValidSupabaseConfig) {
      throw new Error('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables.');
    }

    const defaultTarget = isAdminFlow ? '/admin/dashboard' : '/citizen/dashboard';
    const targetPath = returnTo || defaultTarget;
    const redirectTo = getAuthRedirectUrl(targetPath);
    console.log('[AUTH] navigating to: OAuth provider with redirectTo =', redirectTo);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      },
    });
    if (error) throw error;
    if (data?.url) {
      window.location.href = data.url;
    }
  },

  async resetPasswordRequest(email) {
    if (!hasValidSupabaseConfig) {
      throw new Error('Supabase is not configured.');
    }
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getAuthRedirectUrl('/reset-password'),
    });
    if (error) throw error;
    return data;
  },

  async resetPassword({ resetToken, newPassword }) {
    if (!hasValidSupabaseConfig) {
      throw new Error('Supabase is not configured.');
    }
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return data;
  },

  /**
   * @param {{ full_name?: string; avatar_url?: string; phone?: string; role?: string }} [payload]
   */
  async updateMe({ full_name, avatar_url, phone, role } = {}) {
    if (!hasValidSupabaseConfig) {
      throw new Error('Supabase is not configured.');
    }

    const updates = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;
    if (phone !== undefined) updates.phone = phone;
    if (role !== undefined) updates.role = role;

    const { data: { user }, error: authErr } = await supabase.auth.updateUser({
      data: updates,
    });
    if (authErr) throw authErr;

    try {
      await supabase.from('profiles').update({
        ...updates,
        updated_at: new Date().toISOString(),
      }).eq('id', user.id);
    } catch {}

    const cur = await this.me();
    return {
      ...cur,
      ...updates,
    };
  },

  async logout(redirectUrl) {
    try {
      localStorage.removeItem('scms_demo_user');
      localStorage.removeItem('scms_auth_intended_role');
    } catch {}
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
      return false;
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
        const normOfficerId = normalizeUUID(officer_id);
        await entities.OfficerActivityLog.create({
          officer_id: normOfficerId || null,
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
      const { officer_id, password, area_id, ...rest } = payload;
      const cleanAreaId = normalizeUUID(area_id) || (area_id || null);
      const dataToSave = {
        ...rest,
        area_id: cleanAreaId,
        ...(password ? { password_hash: password } : {}),
      };
      let saved;
      const cleanOfficerId = normalizeUUID(officer_id);
      if (cleanOfficerId) {
        saved = await entities.Officer.update(cleanOfficerId, dataToSave);
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
        apiKey:
          (typeof __GOOGLE_MAPS_API_KEY__ !== 'undefined' ? __GOOGLE_MAPS_API_KEY__ : '') ||
          import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
          import.meta.env.GOOGLE_MAPS_API_KEY ||
          import.meta.env.VITE_GOOGLE_MAP_API_KEY ||
          import.meta.env.GOOGLE_MAP_API_KEY ||
          import.meta.env.VITE_MAPS_API_KEY ||
          import.meta.env.MAPS_API_KEY ||
          '',
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
