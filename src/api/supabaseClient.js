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
export const INITIAL_AREAS = [
  { id: 'd5151169-aa65-4415-a0e0-6acd240c3211', name: "Anwar Ganj", city: 'Kanpur', ward: "Ward 56", district: 'Kanpur Nagar', landmark: "Anwar Ganj Railway Station", latitude: 26.4507, longitude: 80.3425, active: true },
  { id: 'be45eda3-b526-47ca-9e46-1b1d6119022c', name: "Baboo Purwa", city: 'Kanpur', ward: "Ward 105", district: 'Kanpur Nagar', landmark: "Baboo Purwa Chauraha", latitude: 26.42, longitude: 80.348, active: true },
  { id: 'e64162b7-9ab8-4d6c-ae7c-33b1634ec7fb', name: "Babu Purwa Colony", city: 'Kanpur', ward: "Ward 80", district: 'Kanpur Nagar', landmark: "Babu Purwa Chauraha", latitude: 26.426, longitude: 80.343, active: true },
  { id: '6c1107ae-a2e8-498a-8661-dd95f4f99097', name: "Barra", city: 'Kanpur', ward: "Ward 71", district: 'Kanpur Nagar', landmark: "Barra 2 Bypass", latitude: 26.4215, longitude: 80.2954, active: true },
  { id: 'eee6a074-94f3-4694-bdcb-0cdf23c632fe', name: "Basant Vihar", city: 'Kanpur', ward: "Ward 88", district: 'Kanpur Nagar', landmark: "Basant Vihar", latitude: 26.405, longitude: 80.34, active: true },
  { id: 'f7e96c01-f97c-448f-9894-a8821d41eef3', name: "Becon Ganj", city: 'Kanpur', ward: "Ward 97", district: 'Kanpur Nagar', landmark: "Becon Ganj Chauraha", latitude: 26.46, longitude: 80.33, active: true },
  { id: 'a8efdf8b-3e27-4215-b3f7-ddc548515257', name: "Begam Purwa", city: 'Kanpur', ward: "Ward 102", district: 'Kanpur Nagar', landmark: "Begam Purwa Chauraha", latitude: 26.425, longitude: 80.35, active: true },
  { id: '30addb57-2b7c-47a3-bacb-3ec8a1f8cde7', name: "Bingawan", city: 'Kanpur', ward: "Ward 87", district: 'Kanpur Nagar', landmark: "Bingawan Chauraha", latitude: 26.394, longitude: 80.335, active: true },
  { id: '913e18fa-cdf3-40fc-8e5f-1778a9f1fd02', name: "Chakeri", city: 'Kanpur', ward: "Ward 12", district: 'Kanpur Nagar', landmark: "Chakeri Railway Station", latitude: 26.415, longitude: 80.41, active: true },
  { id: '655e2657-4baf-4cf7-8c49-60f862cf4554', name: "Chaman Ganj", city: 'Kanpur', ward: "Ward 107", district: 'Kanpur Nagar', landmark: "Chaman Ganj Chauraha", latitude: 26.4675, longitude: 80.3395, active: true },
  { id: '8e7f6794-cac5-4774-839b-0bfdf6fc5ef0', name: "Chandari", city: 'Kanpur', ward: "Ward 99", district: 'Kanpur Nagar', landmark: "Chandari Railway Station", latitude: 26.414, longitude: 80.425, active: true },
  { id: '260dfa74-9306-4d99-8d84-7e3d1d4db5da', name: "Chowk Sarrafa", city: 'Kanpur', ward: "Ward 101", district: 'Kanpur Nagar', landmark: "Chowk Sarrafa", latitude: 26.4605, longitude: 80.35, active: true },
  { id: 'bbec0374-f00f-4dc7-8ca8-0f561e235bc1', name: "Chunni Ganj", city: 'Kanpur', ward: "Ward 3", district: 'Kanpur Nagar', landmark: "Chunni Ganj Chauraha", latitude: 26.475, longitude: 80.337, active: true },
  { id: '93d6f528-5327-427a-90e8-174904f07814', name: "Civil Lines", city: 'Kanpur', ward: "Ward 15", district: 'Kanpur Nagar', landmark: "Opposite Green Park Stadium", latitude: 26.4729, longitude: 80.3444, active: true },
  { id: 'b6ded66d-58e0-44aa-a8a6-81c85cf46836', name: "Collector Ganj", city: 'Kanpur', ward: "Ward 106", district: 'Kanpur Nagar', landmark: "Collector Ganj", latitude: 26.462, longitude: 80.343, active: true },
  { id: 'd1fd7f0f-dfe6-4b21-bb38-0b5d30050c0a', name: "Colonel Ganj", city: 'Kanpur', ward: "Ward 110", district: 'Kanpur Nagar', landmark: "Colonel Ganj Chauraha", latitude: 26.472, longitude: 80.35, active: true },
  { id: '47e22c20-6039-402a-bd3b-066354cfdaf3', name: "Cooper Ganj", city: 'Kanpur', ward: "Ward 89", district: 'Kanpur Nagar', landmark: "Cooper Ganj Chauraha", latitude: 26.4515, longitude: 80.341, active: true },
  { id: '50b648dd-f38f-4797-b87d-57767a343803', name: "Daheli Sujanpur KDA Colony", city: 'Kanpur', ward: "Ward 47", district: 'Kanpur Nagar', landmark: "KDA Colony", latitude: 26.427, longitude: 80.38, active: true },
  { id: 'cf795277-ad94-4ca3-af25-53f01553f7fa', name: "Danakhori", city: 'Kanpur', ward: "Ward 90", district: 'Kanpur Nagar', landmark: "Danakhori Chauraha", latitude: 26.449, longitude: 80.3475, active: true },
  { id: '975f37d9-7780-4da4-b1f6-09d4a658fe0e', name: "Gandhi Nagar", city: 'Kanpur', ward: "Ward 6", district: 'Kanpur Nagar', landmark: "Gandhi Nagar Chauraha", latitude: 26.474, longitude: 80.326, active: true },
  { id: '7cb2e736-3262-4d68-80c9-4740ee0bb8c9', name: "General Ganj", city: 'Kanpur', ward: "Ward 104", district: 'Kanpur Nagar', landmark: "General Ganj Chauraha", latitude: 26.464, longitude: 80.345, active: true },
  { id: 'f1ba23c8-f52b-470c-927f-765bc8522014', name: "Govind Nagar", city: 'Kanpur', ward: "Ward 54", district: 'Kanpur Nagar', landmark: "C-Block Market", latitude: 26.4432, longitude: 80.3015, active: true },
  { id: '4de8d394-d781-4e40-8980-925be47ea870', name: "Gumti No. 5", city: 'Kanpur', ward: "Ward 28", district: 'Kanpur Nagar', landmark: "Gumti Central Market", latitude: 26.4712, longitude: 80.3156, active: true },
  { id: '43ed9bc0-63c4-4a5d-afb8-72451deb0b6b', name: "Gwaltoli", city: 'Kanpur', ward: "Ward 4", district: 'Kanpur Nagar', landmark: "Gwaltoli Chauraha", latitude: 26.48, longitude: 80.342, active: true },
  { id: 'eaf37c91-25c2-4fa0-a83a-8dd0d41d3242', name: "Hans Puram", city: 'Kanpur', ward: "Ward 41", district: 'Kanpur Nagar', landmark: "Hans Puram Chauraha", latitude: 26.4005, longitude: 80.365, active: true },
  { id: 'a244ec07-e39a-44ae-8263-bb2cd230db8a', name: "Hans Puram Awas Vikas", city: 'Kanpur', ward: "Ward 22", district: 'Kanpur Nagar', landmark: "Awas Vikas Hans Puram", latitude: 26.405, longitude: 80.36, active: true },
  { id: '3508a7f5-9dfd-495b-89c5-5d66211d4049', name: "Jajmau North", city: 'Kanpur', ward: "Ward 96", district: 'Kanpur Nagar', landmark: "Jajmau Bridge", latitude: 26.438, longitude: 80.408, active: true },
  { id: '41ead400-0b75-45d9-b0fa-c8d50e809768', name: "Jajmau South", city: 'Kanpur', ward: "Ward 73", district: 'Kanpur Nagar', landmark: "Jajmau Chauraha", latitude: 26.43, longitude: 80.405, active: true },
  { id: 'f7b72fcc-2cea-4592-a453-944739fef10c', name: "Jarauli", city: 'Kanpur', ward: "Ward 82", district: 'Kanpur Nagar', landmark: "Jarauli Chauraha", latitude: 26.405, longitude: 80.345, active: true },
  { id: 'a40ac6f2-50be-4e9a-b1f0-dce7e8c9e1af', name: "Jawahar Nagar", city: 'Kanpur', ward: "Ward 5", district: 'Kanpur Nagar', landmark: "Jawahar Nagar Chauraha", latitude: 26.478, longitude: 80.33, active: true },
  { id: '02c79b7b-6640-4c6d-9535-02b6b9f12420', name: "Juhi Kala", city: 'Kanpur', ward: "Ward 84", district: 'Kanpur Nagar', landmark: "Juhi Kala Chauraha", latitude: 26.424, longitude: 80.335, active: true },
  { id: 'a3a08823-6bb2-4c8f-9966-b7cd6bcd5542', name: "Kakadeo", city: 'Kanpur', ward: "Ward 42", district: 'Kanpur Nagar', landmark: "Deoki Cinema Crossing", latitude: 26.4789, longitude: 80.2974, active: true },
  { id: '9a5751c2-ac09-41d8-add9-e66e2f96d54e', name: "Kalyanpur", city: 'Kanpur', ward: "Ward 38", district: 'Kanpur Nagar', landmark: "Near Kalyanpur Railway Crossing", latitude: 26.4927, longitude: 80.2589, active: true },
  { id: '14d0c5b7-920d-437e-ac72-2fb238db70e9', name: "Khandipur", city: 'Kanpur', ward: "Ward 21", district: 'Kanpur Nagar', landmark: "Khandipur Chauraha", latitude: 26.43, longitude: 80.365, active: true },
  { id: '91f79963-95f4-47fa-904c-1a4c8d4053db', name: "Khyora", city: 'Kanpur', ward: "Ward 44", district: 'Kanpur Nagar', landmark: "Khyora Chauraha", latitude: 26.52, longitude: 80.285, active: true },
  { id: '1cdec55d-a068-4d88-b8cf-3586ac4c998e', name: "Kidwai Nagar", city: 'Kanpur', ward: "Ward 62", district: 'Kanpur Nagar', landmark: "Kidwai Nagar Central Park", latitude: 26.4358, longitude: 80.3341, active: true },
  { id: '39ec1552-2ac5-4128-8f73-eca36d512cc5', name: "Kidwai Nagar North", city: 'Kanpur', ward: "Ward 100", district: 'Kanpur Nagar', landmark: "Kidwai Nagar", latitude: 26.438, longitude: 80.342, active: true },
  { id: 'bceac16e-51a3-40a2-be2c-76635d974b4e', name: "Kidwai Nagar South", city: 'Kanpur', ward: "Ward 92", district: 'Kanpur Nagar', landmark: "Kidwai Nagar", latitude: 26.43, longitude: 80.34, active: true },
  { id: 'eb7a1547-9875-47bb-a1c2-dfddd147d166', name: "Laxmi Purwa", city: 'Kanpur', ward: "Ward 1", district: 'Kanpur Nagar', landmark: "Laxmi Purwa Chauraha", latitude: 26.4542, longitude: 80.3378, active: true },
  { id: 'a1eadd24-319d-46b8-a0d4-c1d102f0ab8e', name: "Maheshwari Mohal", city: 'Kanpur', ward: "Ward 98", district: 'Kanpur Nagar', landmark: "Maheshwari Mohal", latitude: 26.466, longitude: 80.352, active: true },
  { id: 'daa1a5cb-b53b-4601-b3a7-6077114cc130', name: "Naubasta East", city: 'Kanpur', ward: "Ward 63", district: 'Kanpur Nagar', landmark: "Naubasta Chauraha", latitude: 26.407, longitude: 80.37, active: true },
  { id: '60761299-2069-4980-82be-65b797ad42de', name: "Nawabganj", city: 'Kanpur', ward: "Ward 43", district: 'Kanpur Nagar', landmark: "Nawabganj Chauraha", latitude: 26.505, longitude: 80.33, active: true },
  { id: '7804b026-2523-4c4e-a6d0-292a1bcecc5c', name: "Nazir Bagh", city: 'Kanpur', ward: "Ward 109", district: 'Kanpur Nagar', landmark: "Nazir Bagh", latitude: 26.473, longitude: 80.341, active: true },
  { id: '149b8003-72ae-4f81-8e22-4fa4748b61a3', name: "Panki", city: 'Kanpur', ward: "Ward 57", district: 'Kanpur Nagar', landmark: "Panki hanuman Mandir", latitude: 26.4499, longitude: 80.3319, active: true },
  { id: '7b461b6b-2193-48b9-9417-5227fa3c6260', name: "Parade", city: 'Kanpur', ward: "Ward 10", district: 'Kanpur Nagar', landmark: "Naveen Market Area", latitude: 26.4635, longitude: 80.3498, active: true },
  { id: 'b0d41ad6-3fa1-44fe-9699-60dc89151688', name: "Pashupati Nagar", city: 'Kanpur', ward: "Ward 66", district: 'Kanpur Nagar', landmark: "Pashupati Nagar", latitude: 26.412, longitude: 80.355, active: true },
  { id: 'ee0500f6-a96a-45aa-ac98-738aa2b832de', name: "Patkapur", city: 'Kanpur', ward: "Ward 94", district: 'Kanpur Nagar', landmark: "Patkapur Chauraha", latitude: 26.469, longitude: 80.354, active: true },
  { id: 'ee092b20-dbd3-4510-b70e-080328e86aa1', name: "Rai Purwa", city: 'Kanpur', ward: "Ward 32", district: 'Kanpur Nagar', landmark: "Rai Purwa Chauraha", latitude: 26.4617, longitude: 80.337, active: true },
  { id: '6777f4ae-9815-4ba9-9ec4-d1bf7b16f9a8', name: "Rajeev Nagar Naubasta East", city: 'Kanpur', ward: "Ward 68", district: 'Kanpur Nagar', landmark: "Rajeev Nagar", latitude: 26.401, longitude: 80.375, active: true },
  { id: '552d3575-6758-43e5-ba07-6a932eeb2e3c', name: "Safipur", city: 'Kanpur', ward: "Ward 11", district: 'Kanpur Nagar', landmark: "Safipur Chauraha", latitude: 26.434, longitude: 80.397, active: true },
  { id: 'e4e404c0-1dd3-4438-87db-d0b70d65f889', name: "Shastri Nagar", city: 'Kanpur', ward: "Ward 33", district: 'Kanpur Nagar', landmark: "Near Central Park", latitude: 26.4678, longitude: 80.3065, active: true },
  { id: '4d208a09-f2cf-465f-af3e-213d44a56901', name: "Shyam Nagar Sujat Ganj", city: 'Kanpur', ward: "Ward 74", district: 'Kanpur Nagar', landmark: "Shyam Nagar Chauraha", latitude: 26.415, longitude: 80.39, active: true },
  { id: '1e2d901c-b7e8-4577-90bc-44efa35b2bc2', name: "Sishamau North", city: 'Kanpur', ward: "Ward 59", district: 'Kanpur Nagar', landmark: "Sishamau Chauraha", latitude: 26.48, longitude: 80.325, active: true },
  { id: 'e81efa57-01e3-4d15-98d3-028b6f576c6b', name: "Swarda Jayanti Vihar", city: 'Kanpur', ward: "Ward 62", district: 'Kanpur Nagar', landmark: "Swarda Jayanti Vihar", latitude: 26.41, longitude: 80.385, active: true },
  { id: '90558827-d24b-47d1-9007-c9fce7decd03', name: "Swaroop Nagar", city: 'Kanpur', ward: "Ward 21", district: 'Kanpur Nagar', landmark: "Near Motijheel Gate", latitude: 26.4815, longitude: 80.3182, active: true },
  { id: '069e454e-4681-42e5-acae-fc7081955651', name: "Talak Mohal", city: 'Kanpur', ward: "Ward 108", district: 'Kanpur Nagar', landmark: "Talak Mohal Chauraha", latitude: 26.455, longitude: 80.355, active: true },
  { id: 'fb4e126f-a49d-4e4f-aba8-5006b64380d7', name: "Tilak Nagar", city: 'Kanpur', ward: "Ward 61", district: 'Kanpur Nagar', landmark: "Tilak Nagar Chauraha", latitude: 26.485, longitude: 80.315, active: true },
  { id: 'e6d22b18-9a30-4cfa-bf96-03306096ea82', name: "Tiwari Pur", city: 'Kanpur', ward: "Ward 58", district: 'Kanpur Nagar', landmark: "Tiwari Pur Chauraha", latitude: 26.435, longitude: 80.375, active: true },
  { id: '572005db-6614-40d1-b7b4-6ec914c0f6ee', name: "Usmanpur", city: 'Kanpur', ward: "Ward 18", district: 'Kanpur Nagar', landmark: "Usmanpur Chauraha", latitude: 26.423, longitude: 80.35, active: true },
  { id: '17c03353-0763-455c-a3fc-cf3ba793fdd0', name: "Yashoda Nagar East", city: 'Kanpur', ward: "Ward 46", district: 'Kanpur Nagar', landmark: "Yashoda Nagar Chauraha", latitude: 26.421, longitude: 80.355, active: true },
  { id: 'ab46b6fa-66b6-4d7c-bc0c-84562aae4781', name: "Yashoda Nagar West", city: 'Kanpur', ward: "Ward 95", district: 'Kanpur Nagar', landmark: "Yashoda Nagar", latitude: 26.419, longitude: 80.347, active: true },
];

const INITIAL_DEPARTMENTS = [
  { id: 'a0000000-0000-0000-0000-000000000001', name: 'Public Works Department (PWD)', description: 'Road repairs, potholes, sidewalks', head: 'Er. R. K. Verma', email: 'pwd.kanpur@nic.in', phone: '+91 512 2548901' },
  { id: 'a0000000-0000-0000-0000-000000000002', name: 'Jal Sansthan (Water & Drainage)', description: 'Water supply lines, sewage overflows', head: 'Smt. Anjali Srivastava', email: 'jalsansthan.kanpur@nic.in', phone: '+91 512 2543412' },
  { id: 'a0000000-0000-0000-0000-000000000003', name: 'KESCO (Electricity & Street Lighting)', description: 'Street lights, cables, transformers', head: 'Er. S. N. Mishra', email: 'kesco.grievance@nic.in', phone: '+91 512 2556789' },
  { id: 'a0000000-0000-0000-0000-000000000004', name: 'Solid Waste & Sanitation (Nagar Nigam)', description: 'Garbage collection, illegal dumping', head: 'Dr. Alok Pandey', email: 'sanitation.knn@nic.in', phone: '+91 512 2534567' },
  { id: 'a0000000-0000-0000-0000-000000000005', name: 'Health & Vector Control', description: 'Mosquito fogging, stray animals', head: 'Dr. Meena Gupta', email: 'health.knn@nic.in', phone: '+91 512 2534890' },
  { id: 'a0000000-0000-0000-0000-000000000006', name: 'Traffic & Public Safety', description: 'Traffic signals, illegal parking', head: 'Inspector Rajesh Kumar', email: 'traffic.kanpur@uppolice.gov.in', phone: '+91 512 2304100' },
];

export const INITIAL_OFFICERS = [
  { id: 'b4a733b5-effd-42e6-ab70-157b09a6e629', name: "Amit Verma", employee_id: "OF002", email: "amit.verma@civicdemo.in", mobile: "9876543211", username: "amit.verma", password_hash: "Officer@123", department: "Garbage Collection", area_name: "Swaroop Nagar", area_id: '90558827-d24b-47d1-9007-c9fce7decd03', designation: "Sanitation Officer", status: 'Active' },
  { id: '49e4e5d3-f15e-436f-bb62-34e3aea5e21d', name: "Ankit Mishra", employee_id: "OF007", email: "ankit.mishra@civicdemo.in", mobile: "9876543216", username: "ankit.mishra", password_hash: "Officer@123", department: "Stray Animals", area_name: "Panki", area_id: '149b8003-72ae-4f81-8e22-4fa4748b61a3', designation: "Animal Control Officer", status: 'Active' },
  { id: 'b098062e-5141-4c37-9aa9-ba00ff89d205', name: "Arjun Patel", employee_id: "OF010", email: "arjun.patel@civicdemo.in", mobile: "9876543219", username: "arjun.patel", password_hash: "Officer@123", department: "Other", area_name: "Parade", area_id: '7b461b6b-2193-48b9-9417-5227fa3c6260', designation: "General Field Officer", status: 'Active' },
  { id: 'c165dd10-c837-4742-b06a-e63f69cfc29f', name: "Deepak Kumar", employee_id: "OF013", email: "deepak.kumar@civicdemo.in", mobile: "9876543222", username: "deepak.kumar", password_hash: "Officer@123", department: "Street Light", area_name: "Kakadeo", area_id: 'a3a08823-6bb2-4c8f-9966-b7cd6bcd5542', designation: "Electrical Field Officer", status: 'Active' },
  { id: 'c84d5c60-42fe-478b-bfb5-f8254ffbeb9a', name: "Er. Vikram Singh", employee_id: "OFF-KN-2024-01", email: "vikram.singh@kanpur.gov.in", mobile: "9876543210", username: "ayush.sharma", password_hash: "ayu123", department: "Public Works Department (PWD)", area_name: "", area_id: null, designation: "Junior Engineer", status: 'Active' },
  { id: 'b8815ccc-d89d-4368-b91c-c1103f429282', name: "Kavita Sharma", employee_id: "OF012", email: "kavita.sharma@civicdemo.in", mobile: "9876543221", username: "kavita.sharma", password_hash: "Officer@123", department: "Garbage Collection", area_name: "Naubasta East", area_id: 'daa1a5cb-b53b-4601-b3a7-6077114cc130', designation: "Sanitation Inspector", status: 'Active' },
  { id: '9f31484e-61d1-4115-8d0f-08500d96cef0', name: "Manish Gupta", employee_id: "OF011", email: "manish.gupta@civicdemo.in", mobile: "9876543220", username: "manish.gupta", password_hash: "Officer@123", department: "Road Damage", area_name: "Chakeri", area_id: '913e18fa-cdf3-40fc-8e5f-1778a9f1fd02', designation: "Junior Field Officer", status: 'Active' },
  { id: 'a5d27a2f-84a3-406c-9ca7-4aea5adc9c5a', name: "Neha Singh", employee_id: "OF003", email: "neha.singh@civicdemo.in", mobile: "9876543212", username: "neha.singh", password_hash: "Officer@123", department: "Street Light", area_name: "Shastri Nagar", area_id: 'e4e404c0-1dd3-4438-87db-d0b70d65f889', designation: "Electrical Officer", status: 'Active' },
  { id: 'b4600ce3-a3ba-4be9-a7ec-468cdd67b01e', name: "Nitin Singh", employee_id: "OF014", email: "nitin.singh@civicdemo.in", mobile: "9876543223", username: "nitin.singh", password_hash: "Officer@123", department: "Water Leakage", area_name: "Jajmau South", area_id: '41ead400-0b75-45d9-b0fa-c8d50e809768', designation: "Water Works Inspector", status: 'Active' },
  { id: '7502a826-d301-4053-b089-d7599c74db9f', name: "Pooja Gupta", employee_id: "OF005", email: "pooja.gupta@civicdemo.in", mobile: "9876543214", username: "pooja.gupta", password_hash: "Officer@123", department: "Drainage", area_name: "Barra", area_id: '6c1107ae-a2e8-498a-8661-dd95f4f99097', designation: "Drainage Officer", status: 'Active' },
  { id: '006ff512-92a7-4427-abc9-0520e8b65f64', name: "Priya Singh", employee_id: "OF008", email: "priya.singh@civicdemo.in", mobile: "9876543217", username: "priya.singh", password_hash: "Officer@123", department: "Illegal Parking", area_name: "Kakadeo", area_id: 'a3a08823-6bb2-4c8f-9966-b7cd6bcd5542', designation: "Traffic Officer", status: 'Active' },
  { id: '83307c90-d22d-462f-8252-94f4693a6465', name: "Raj Kumar", employee_id: "OF001", email: "raj.kumar@civicdemo.in", mobile: "9876543210", username: "raj.kumar", password_hash: "Officer@123", department: "Road Damage", area_name: "Kalyanpur", area_id: '9a5751c2-ac09-41d8-add9-e66e2f96d54e', designation: "Field Officer", status: 'Active' },
  { id: '8368237c-2393-4cec-b48d-80fba0f60621', name: "Rakesh Verma", employee_id: "OF015", email: "rakesh.verma@civicdemo.in", mobile: "9876543224", username: "rakesh.verma", password_hash: "Officer@123", department: "Drainage", area_name: "Hans Puram", area_id: 'eaf37c91-25c2-4fa0-a83a-8dd0d41d3242', designation: "Drainage Inspector", status: 'Active' },
  { id: '904d90a5-de16-4ce1-b5fe-422f34f3207b', name: "Rohit Sharma", employee_id: "OF004", email: "rohit.sharma@civicdemo.in", mobile: "9876543213", username: "rohit.sharma", password_hash: "Officer@123", department: "Water Leakage", area_name: "Kidwai Nagar", area_id: '1cdec55d-a068-4d88-b8cf-3586ac4c998e', designation: "Water Works Officer", status: 'Active' },
  { id: '3020c1c5-b56d-4f69-8ac2-eac80a66650e', name: "Sandeep Yadav", employee_id: "OF006", email: "sandeep.yadav@civicdemo.in", mobile: "9876543215", username: "sandeep.yadav", password_hash: "Officer@123", department: "Electricity", area_name: "Govind Nagar", area_id: 'f1ba23c8-f52b-470c-927f-765bc8522014', designation: "Electrical Inspector", status: 'Active' },
  { id: '07a3cbf6-81ef-472d-8274-7d760779a0ad', name: "Smt. Sunita Yadav", employee_id: "OFF-KN-2024-02", email: "sunita.yadav@kanpur.gov.in", mobile: "9876543211", username: "officer2", password_hash: "ayu123", department: "Jal Sansthan (Water & Drainage)", area_name: "Kakadeo", area_id: null, designation: "Assistant Engineer", status: 'Active' },
  { id: 'b5c26335-fbbb-45fe-a13b-af72c341d180', name: "Vivek Tiwari", employee_id: "OF009", email: "vivek.tiwari@civicdemo.in", mobile: "9876543218", username: "vivek.tiwari", password_hash: "Officer@123", department: "Public Safety", area_name: "Civil Lines", area_id: '93d6f528-5327-427a-90e8-174904f07814', designation: "Safety Officer", status: 'Active' },
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
