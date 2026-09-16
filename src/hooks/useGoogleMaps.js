import { useState, useEffect } from 'react';
import { api } from '@/api/supabaseClient';

let cachedApiKey = null;
let scriptPromise = null;
let isAuthFailed = false;

// Global auth failure handler for Google Maps
if (typeof window !== 'undefined') {
  window.gm_authFailure = () => {
    console.warn('[Google Maps] Authentication failed (missing billing, invalid key, or unauthorized referrer). Falling back to OpenStreetMap.');
    isAuthFailed = true;
    window.dispatchEvent(new CustomEvent('google-maps-auth-failure'));
  };
}

function isValidGoogleKey(key) {
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();
  return (
    trimmed.length > 20 &&
    !trimmed.includes('your-') &&
    !trimmed.includes('placeholder') &&
    !trimmed.includes('AIzaSyDummy')
  );
}

function loadGoogleMapsScript(apiKey) {
  if (scriptPromise) return scriptPromise;
  if (window.google?.maps) return Promise.resolve();
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly`;
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
    isLoaded: Boolean(typeof window !== 'undefined' && window.google?.maps && !isAuthFailed),
    useFallback: isAuthFailed,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    const handleAuthFailure = () => {
      if (!cancelled) {
        setState({ isLoaded: false, useFallback: true, error: null });
      }
    };
    window.addEventListener('google-maps-auth-failure', handleAuthFailure);

    (async () => {
      try {
        if (isAuthFailed) {
          if (!cancelled) setState({ isLoaded: false, useFallback: true, error: null });
          return;
        }

        if (cachedApiKey === null) {
          const res = await api.functions.invoke('getMapsConfig', {}).catch(() => ({}));
          cachedApiKey = (res?.data || res)?.apiKey || '';
        }

        if (!isValidGoogleKey(cachedApiKey)) {
          // No valid key configured -> smoothly switch to OpenStreetMap without triggering Google error modal
          if (!cancelled) setState({ isLoaded: false, useFallback: true, error: null });
          return;
        }

        await loadGoogleMapsScript(cachedApiKey);
        if (!cancelled && !isAuthFailed) {
          setState({ isLoaded: true, useFallback: false, error: null });
        }
      } catch {
        if (!cancelled) setState({ isLoaded: false, useFallback: true, error: null });
      }
    })();

    return () => {
      cancelled = true;
      window.removeEventListener('google-maps-auth-failure', handleAuthFailure);
    };
  }, []);

  return state;
}