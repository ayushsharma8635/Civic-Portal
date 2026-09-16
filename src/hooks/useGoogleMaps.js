import { useState, useEffect } from 'react';
import { api } from '@/api/supabaseClient';

let cachedApiKey = null;
let scriptPromise = null;

// Suppress Google Maps auth failure alert dialog so it never interrupts the UI
if (typeof window !== 'undefined') {
  window.gm_authFailure = () => {
    console.warn('[Google Maps] Warning: Google Maps key has referrer/billing restrictions, running in developer mode.');
  };
}

export function getGoogleMapsApiKey() {
  const key = (
    (typeof __GOOGLE_MAPS_API_KEY__ !== 'undefined' ? __GOOGLE_MAPS_API_KEY__ : '') ||
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
    import.meta.env.GOOGLE_MAPS_API_KEY ||
    import.meta.env.VITE_GOOGLE_MAP_API_KEY ||
    import.meta.env.GOOGLE_MAP_API_KEY ||
    import.meta.env.VITE_MAPS_API_KEY ||
    import.meta.env.MAPS_API_KEY ||
    ''
  ).trim();
  return key;
}

function loadGoogleMapsScript(apiKey) {
  if (scriptPromise) return scriptPromise;
  if (typeof window !== 'undefined' && window.google?.maps) return Promise.resolve();

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