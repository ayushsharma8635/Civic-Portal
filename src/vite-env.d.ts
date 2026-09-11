/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  google?: any;
}

declare const google: any;

declare module '@supabase/supabase-js' {
  export function createClient(supabaseUrl: string, supabaseKey: string, options?: any): any;
  export type SupabaseClient = any;
  export type User = any;
  export type Session = any;
  export type AuthError = any;
}

