import { useState, useEffect } from 'react';
import { api } from '@/api/supabaseClient';

let cachedApiKey = null;
let scriptPromise = null;

function loadGoogleMapsScript(apiKey) {
  if (scriptPromise) return scriptPromise;
  if (window.google?.maps) return Promise.resolve();
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=weekly`;
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
  const [state, setState] = useState({ isLoaded: false, error: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!cachedApiKey) {
          const res = await api.functions.invoke('getMapsConfig', {});
          cachedApiKey = (res.data || res).apiKey;
        }
        await loadGoogleMapsScript(cachedApiKey);
        if (!cancelled) setState({ isLoaded: true, error: null });
      } catch (e) {
        if (!cancelled) setState({ isLoaded: false, error: e.message || 'Failed to load maps' });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return state;
}