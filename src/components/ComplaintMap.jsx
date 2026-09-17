import React, { useEffect, useRef } from 'react';
import { useGoogleMaps } from '@/hooks/useGoogleMaps';
import { Loader2 } from 'lucide-react';

const KANPUR_CENTER = { lat: 26.4499, lng: 80.3319 };

function priorityColor(p) {
  return p === 'High' ? '#e11d48' : p === 'Medium' ? '#2563eb' : '#64748b';
}

function makeGooglePin(color) {
  const svg = `<svg width="28" height="28" viewBox="0 0 24 24" fill="${color}" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/></svg>`;
  if (typeof window !== 'undefined' && window.google?.maps?.Size) {
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: new window.google.maps.Size(28, 28),
      anchor: new window.google.maps.Point(14, 28),
    };
  }
  return undefined;
}

export default function ComplaintMap({ position, onPick, markers = [], height = '320px', zoom = 13 }) {
  const { isLoaded } = useGoogleMaps();
  const mapContainerRef = useRef(null);
  const googleMapInstance = useRef(null);
  const googlePositionMarker = useRef(null);
  const googleComplaintMarkers = useRef([]);

  const getCenter = () => {
    if (position && position.lat != null && position.lng != null) {
      return { lat: Number(position.lat), lng: Number(position.lng) };
    }
    if (markers.length && markers[0].latitude != null && markers[0].longitude != null) {
      return { lat: Number(markers[0].latitude), lng: Number(markers[0].longitude) };
    }
    return KANPUR_CENTER;
  };

  const useGoogle = isLoaded && typeof window !== 'undefined' && Boolean(window.google?.maps);

  // Initialize Google Map
  useEffect(() => {
    if (!useGoogle || !mapContainerRef.current) return;
    const g = window.google.maps;

    if (!googleMapInstance.current) {
      googleMapInstance.current = new g.Map(mapContainerRef.current, {
        center: getCenter(),
        zoom,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
      });

      if (onPick) {
        googleMapInstance.current.addListener('click', (e) => {
          onPick({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        });
      }
    }
  }, [useGoogle]);

  // Continuously suppress and auto-dismiss Google Maps warning dialogs and backdrops
  useEffect(() => {
    if (!mapContainerRef.current) return;
    const container = mapContainerRef.current;

    const cleanupErrors = () => {
      const errorElements = container.querySelectorAll(
        '.gm-err-container, .gm-err-content, [role="dialog"], a[href*="mapsjs-error"], .dismissButton'
      );
      errorElements.forEach((el) => {
        const modalBox = el.closest('[role="dialog"]') || el.closest('.gm-err-container') || el.closest('div[style*="z-index"]') || el;
        if (modalBox && modalBox !== container) {
          modalBox.style.setProperty('display', 'none', 'important');
          modalBox.style.setProperty('visibility', 'hidden', 'important');
          modalBox.style.setProperty('pointer-events', 'none', 'important');
        }
      });

      // Remove dark overlay backdrop Google Maps injects
      const overlays = container.querySelectorAll('div[style*="rgba(0, 0, 0"]');
      overlays.forEach((o) => {
        o.style.setProperty('display', 'none', 'important');
      });
    };

    const observer = new MutationObserver(() => {
      cleanupErrors();
    });

    observer.observe(container, { childList: true, subtree: true });
    cleanupErrors();

    const timer = setInterval(cleanupErrors, 400);
    return () => {
      observer.disconnect();
      clearInterval(timer);
    };
  }, [useGoogle]);

  // Update draggable position marker and pan/zoom
  useEffect(() => {
    if (!useGoogle || !googleMapInstance.current) return;
    const g = window.google.maps;
    if (googlePositionMarker.current) googlePositionMarker.current.setMap(null);

    if (position && position.lat != null && position.lng != null) {
      googlePositionMarker.current = new g.Marker({
        position: { lat: Number(position.lat), lng: Number(position.lng) },
        map: googleMapInstance.current,
        icon: makeGooglePin('#ef4444'),
        draggable: Boolean(onPick),
      });

      if (onPick) {
        googlePositionMarker.current.addListener('dragend', (e) => {
          onPick({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        });
      }

      googleMapInstance.current.panTo({ lat: Number(position.lat), lng: Number(position.lng) });
      if (googleMapInstance.current.getZoom() < 15) {
        googleMapInstance.current.setZoom(15);
      }
    }
  }, [useGoogle, position?.lat, position?.lng]);

  // Update complaint markers
  useEffect(() => {
    if (!useGoogle || !googleMapInstance.current) return;
    const g = window.google.maps;
    googleComplaintMarkers.current.forEach((m) => m.setMap(null));
    googleComplaintMarkers.current = [];

    const bounds = new g.LatLngBounds();
    const validMarkers = markers.filter((m) => m.latitude != null && m.longitude != null);

    validMarkers.forEach((m) => {
      const marker = new g.Marker({
        position: { lat: Number(m.latitude), lng: Number(m.longitude) },
        map: googleMapInstance.current,
        icon: makeGooglePin(priorityColor(m.priority)),
        title: m.title,
      });

      if (m.title) {
        const infoWindow = new g.InfoWindow({
          content: `<div style="font-size:12px;line-height:1.4;">
            <strong style="font-size:13px;">${m.title}</strong>
            <div style="color:#666;margin-top:2px;">${m.category || ''} · <b>${m.status || ''}</b></div>
            ${m.area || m.location ? `<div style="color:#888;font-size:11px;margin-top:2px;">${m.area || m.location}</div>` : ''}
          </div>`,
        });
        marker.addListener('click', () => {
          infoWindow.open(googleMapInstance.current, marker);
        });
      }

      googleComplaintMarkers.current.push(marker);
      bounds.extend({ lat: Number(m.latitude), lng: Number(m.longitude) });
    });

    if (validMarkers.length > 1) {
      googleMapInstance.current.fitBounds(bounds);
    } else if (validMarkers.length === 0 && !position) {
      googleMapInstance.current.setCenter(KANPUR_CENTER);
    }
  }, [useGoogle, markers]);

  return (
    <div className="relative rounded-lg overflow-hidden border border-border" style={{ height, width: '100%', minHeight: '200px' }}>
      <div
        ref={mapContainerRef}
        style={{ height: '100%', width: '100%' }}
        className="relative z-0"
      />
      {!useGoogle && (
        <div className="absolute inset-0 bg-muted/40 backdrop-blur-xs flex flex-col items-center justify-center gap-2 z-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground font-medium">Loading Google Maps...</p>
        </div>
      )}
    </div>
  );
}