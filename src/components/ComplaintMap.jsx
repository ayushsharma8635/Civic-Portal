import React, { useEffect, useRef } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useGoogleMaps } from '@/hooks/useGoogleMaps';

const KANPUR_CENTER = { lat: 26.4499, lng: 80.3319 };

function makePin(color) {
  const svg = `<svg width="28" height="28" viewBox="0 0 24 24" fill="${color}" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/></svg>`;
  return {
    url: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(28, 28),
    anchor: new window.google.maps.Point(14, 28),
  };
}

function priorityColor(p) {
  return p === 'High' ? '#e11d48' : p === 'Medium' ? '#2563eb' : '#64748b';
}

export default function ComplaintMap({ position, onPick, markers = [], height = '320px', zoom = 13 }) {
  const { isLoaded, error } = useGoogleMaps();
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const positionMarker = useRef(null);
  const complaintMarkers = useRef([]);

  const getCenter = () => {
    if (position) return { lat: position.lat, lng: position.lng };
    if (markers.length && markers[0].latitude != null) return { lat: markers[0].latitude, lng: markers[0].longitude };
    return KANPUR_CENTER;
  };

  useEffect(() => {
    if (!isLoaded || !mapRef.current || mapInstance.current) return;
    const g = window.google.maps;
    mapInstance.current = new g.Map(mapRef.current, {
      center: getCenter(),
      zoom,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });
    if (onPick) {
      mapInstance.current.addListener('click', (e) => {
        onPick({ lat: e.latLng.lat(), lng: e.latLng.lng() });
      });
    }
  }, [isLoaded]);

  useEffect(() => {
    if (!isLoaded || !mapInstance.current) return;
    const g = window.google.maps;
    if (positionMarker.current) positionMarker.current.setMap(null);
    if (position) {
      positionMarker.current = new g.Marker({
        position: { lat: position.lat, lng: position.lng },
        map: mapInstance.current,
        icon: makePin('#ef4444'),
        draggable: !!onPick,
      });
      if (onPick) {
        positionMarker.current.addListener('dragend', (e) => {
          onPick({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        });
      }
      mapInstance.current.panTo({ lat: position.lat, lng: position.lng });
    }
  }, [isLoaded, position]);

  useEffect(() => {
    if (!isLoaded || !mapInstance.current) return;
    const g = window.google.maps;
    complaintMarkers.current.forEach((m) => m.setMap(null));
    complaintMarkers.current = [];
    const bounds = new g.LatLngBounds();
    markers.forEach((m) => {
      if (m.latitude == null || m.longitude == null) return;
      const marker = new g.Marker({
        position: { lat: m.latitude, lng: m.longitude },
        map: mapInstance.current,
        icon: makePin(priorityColor(m.priority)),
        title: m.title,
      });
      complaintMarkers.current.push(marker);
      bounds.extend({ lat: m.latitude, lng: m.longitude });
    });
    if (markers.length > 1) {
      mapInstance.current.fitBounds(bounds);
    } else if (markers.length === 0 && !position) {
      mapInstance.current.setCenter(KANPUR_CENTER);
    }
  }, [isLoaded, markers]);

  if (error) {
    return (
      <div style={{ height }} className="rounded-lg border border-border flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <AlertTriangle className="h-6 w-6 text-rose-500" />
        <p className="text-sm text-center px-4">{error}</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div style={{ height }} className="rounded-lg border border-border flex items-center justify-center bg-muted/30">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <div ref={mapRef} style={{ height, width: '100%' }} className="rounded-lg overflow-hidden border border-border" />;
}