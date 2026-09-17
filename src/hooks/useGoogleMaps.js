import { useState, useEffect } from 'react';
import { api } from '@/api/supabaseClient';

let cachedApiKey = null;
let scriptPromise = null;

// Suppress Google Maps auth failure alert dialog so it never interrupts the UI
if (typeof window !== 'undefined') {
  window.gm_authFailure = () => {
    console.error(
      '[Google Maps] Authentication Failure (gm_authFailure triggered by Google):\n' +
      'Google Maps rejected the API key or project authorization. Common reasons:\n' +
      '1. Billing not enabled: Google Cloud requires a linked billing account (free $200/mo credit applies).\n' +
      '2. API not enabled: "Maps JavaScript API" must be enabled in Google Cloud Console -> APIs & Services.\n' +
      '3. Application Restrictions: If restricted by HTTP Referrers, ensure you allow:\n' +
      '   - https://civicportalproject-aaaa1-6bb1.vercel.app/*\n' +
      '   - https://*.vercel.app/*\n' +
      '   - http://localhost:*/*'
    );
  };
}

export function getGoogleMapsApiKey() {
  // 1. Runtime override via window or localStorage (useful for instant debugging/testing)
  if (typeof window !== 'undefined') {
    const local =
      window.localStorage.getItem('scms_google_maps_api_key') ||
      window.localStorage.getItem('google_maps_api_key') ||
      window.localStorage.getItem('VITE_GOOGLE_MAPS_API_KEY');
    if (local && local.trim()) return local.trim();
  }

  // 2. Vite compile-time define injection
  if (typeof __GOOGLE_MAPS_API_KEY__ !== 'undefined' && __GOOGLE_MAPS_API_KEY__) {
    const key = String(__GOOGLE_MAPS_API_KEY__).trim();
    if (key) return key;
  }

  // 3. Environment variables
  const envKey = (
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
    import.meta.env.GOOGLE_MAPS_API_KEY ||
    import.meta.env.VITE_GOOGLE_MAP_API_KEY ||
    import.meta.env.GOOGLE_MAP_API_KEY ||
    import.meta.env.VITE_MAPS_API_KEY ||
    import.meta.env.MAPS_API_KEY ||
    import.meta.env.VITE_MAP_API_KEY ||
    import.meta.env.MAP_API_KEY ||
    import.meta.env.VITE_GOOGLE_API_KEY ||
    import.meta.env.GOOGLE_API_KEY ||
    ''
  ).trim();

  return envKey;
}

function loadGoogleMapsScript(apiKey) {
  if (scriptPromise) return scriptPromise;
  if (typeof window !== 'undefined' && window.google?.maps) return Promise.resolve();

  if (apiKey) {
    console.info(`[Google Maps] Loading with API key: ${apiKey.slice(0, 6)}...${apiKey.slice(-4)} (length: ${apiKey.length})`);
  } else {
    console.warn('[Google Maps] Loading WITHOUT API key. Map may show "For development purposes only". Set VITE_GOOGLE_MAPS_API_KEY in Vercel or .env');
  }

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) {
      if (window.google?.maps) return resolve();
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', (e) => reject(e));
      return;
    }

    const script = document.createElement('script');
    const keyParam = apiKey ? `key=${encodeURIComponent(apiKey)}&` : '';
    script.src = `https://maps.googleapis.com/maps/api/js?${keyParam}libraries=places&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('Failed to load Google Maps script'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export function useGoogleMaps() {
  const [state, setState] = useState({
    isLoaded: Boolean(typeof window !== 'undefined' && window.google?.maps),
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (typeof window !== 'undefined' && window.google?.maps) {
          if (!cancelled) setState({ isLoaded: true, error: null });
          return;
        }

        if (cachedApiKey === null) {
          const envKey = getGoogleMapsApiKey();
          if (envKey) {
            cachedApiKey = envKey;
          } else {
            const res = await api.functions.invoke('getMapsConfig', {}).catch(() => ({}));
            cachedApiKey = (res?.data || res)?.apiKey || getGoogleMapsApiKey() || '';
          }
        }

        await loadGoogleMapsScript(cachedApiKey);
        if (!cancelled) {
          setState({ isLoaded: true, error: null });
        }
      } catch (err) {
        if (!cancelled) {
          setState({ isLoaded: Boolean(window.google?.maps), error: err.message });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}