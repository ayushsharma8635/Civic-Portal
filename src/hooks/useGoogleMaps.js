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

function loadGoogleMapsScript(apiKey) {
  if (scriptPromise) return scriptPromise;
  if (typeof window !== 'undefined' && window.google?.maps) return Promise.resolve();

  scriptPromise = new Promise((resolve, reject) => {
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
          const envKey = (
            import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
            import.meta.env.VITE_GOOGLE_MAP_API_KEY ||
            ''
          ).trim();

          if (envKey) {
            cachedApiKey = envKey;
          } else {
            const res = await api.functions.invoke('getMapsConfig', {}).catch(() => ({}));
            cachedApiKey = (res?.data || res)?.apiKey || '';
          }
        }

        await loadGoogleMapsScript(cachedApiKey);
        if (!cancelled) {
          setState({ isLoaded: true, error: null });
        }
      } catch (err) {
        if (!cancelled) {
          setState({ isLoaded: Boolean(typeof window !== 'undefined' && window.google?.maps), error: err.message });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}