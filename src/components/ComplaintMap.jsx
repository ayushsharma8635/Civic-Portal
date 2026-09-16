import React, { useEffect, useRef } from 'react';
import { useGoogleMaps } from '@/hooks/useGoogleMaps';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

function makeLeafletPin(color) {
  const svg = `<svg width="32" height="32" viewBox="0 0 24 24" fill="${color}" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.35));"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/></svg>`;
  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: svg,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
}

export default function ComplaintMap({ position, onPick, markers = [], height = '320px', zoom = 13 }) {
  const { isLoaded, useFallback } = useGoogleMaps();
  const mapContainerRef = useRef(null);

  // Google Maps instances
  const googleMapInstance = useRef(null);
  const googlePositionMarker = useRef(null);
  const googleComplaintMarkers = useRef([]);

  // Leaflet instances
  const leafletMapInstance = useRef(null);
  const leafletPositionMarker = useRef(null);
  const leafletComplaintMarkers = useRef([]);

  const getCenter = () => {
    if (position && position.lat != null && position.lng != null) {
      return { lat: Number(position.lat), lng: Number(position.lng) };
    }
    if (markers.length && markers[0].latitude != null && markers[0].longitude != null) {
      return { lat: Number(markers[0].latitude), lng: Number(markers[0].longitude) };
    }
    return KANPUR_CENTER;
  };

  const useGoogle = isLoaded && !useFallback && typeof window !== 'undefined' && Boolean(window.google?.maps);

  // ==========================================
  // GOOGLE MAPS IMPLEMENTATION
  // ==========================================
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
      googleComplaintMarkers.current.push(marker);
      bounds.extend({ lat: Number(m.latitude), lng: Number(m.longitude) });
    });

    if (validMarkers.length > 1) {
      googleMapInstance.current.fitBounds(bounds);
    } else if (validMarkers.length === 0 && !position) {
      googleMapInstance.current.setCenter(KANPUR_CENTER);
    }
  }, [useGoogle, markers]);

  // ==========================================
  // LEAFLET / OPENSTREETMAP IMPLEMENTATION
  // ==========================================
  useEffect(() => {
    if (useGoogle || !mapContainerRef.current) return;

    if (!leafletMapInstance.current) {
      const center = getCenter();
      const map = L.map(mapContainerRef.current, {
        center: [center.lat, center.lng],
        zoom,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      if (onPick) {
        map.on('click', (e) => {
          onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
        });
      }

      leafletMapInstance.current = map;

      // Invalidate size to ensure full container tile rendering
      setTimeout(() => {
        if (leafletMapInstance.current) {
          leafletMapInstance.current.invalidateSize();
        }
      }, 100);
    }

    return () => {
      if (leafletMapInstance.current) {
        leafletMapInstance.current.remove();
        leafletMapInstance.current = null;
      }
    };
  }, [useGoogle]);

  useEffect(() => {
    if (useGoogle || !leafletMapInstance.current) return;
    const map = leafletMapInstance.current;

    if (leafletPositionMarker.current) {
      map.removeLayer(leafletPositionMarker.current);
      leafletPositionMarker.current = null;
    }

    if (position && position.lat != null && position.lng != null) {
      const marker = L.marker([Number(position.lat), Number(position.lng)], {
        icon: makeLeafletPin('#ef4444'),
        draggable: Boolean(onPick),
      }).addTo(map);

      if (onPick) {
        marker.on('dragend', (e) => {
          const latLng = e.target.getLatLng();
          onPick({ lat: latLng.lat, lng: latLng.lng });
        });
      }

      leafletPositionMarker.current = marker;
      map.setView([Number(position.lat), Number(position.lng)], Math.max(map.getZoom() || 13, 15));
    }
  }, [useGoogle, position?.lat, position?.lng]);

  useEffect(() => {
    if (useGoogle || !leafletMapInstance.current) return;
    const map = leafletMapInstance.current;

    leafletComplaintMarkers.current.forEach((m) => map.removeLayer(m));
    leafletComplaintMarkers.current = [];

    const validMarkers = markers.filter((m) => m.latitude != null && m.longitude != null);
    if (validMarkers.length > 0) {
      const bounds = [];
      validMarkers.forEach((m) => {
        const marker = L.marker([Number(m.latitude), Number(m.longitude)], {
          icon: makeLeafletPin(priorityColor(m.priority)),
          title: m.title || '',
        }).addTo(map);

        if (m.title) {
          marker.bindPopup(
            `<div style="font-size:12px;line-height:1.4;">
              <strong style="font-size:13px;">${m.title}</strong>
              <div style="color:#666;margin-top:2px;">${m.category || ''} · <b>${m.status || ''}</b></div>
              ${m.area || m.location ? `<div style="color:#888;font-size:11px;margin-top:2px;">${m.area || m.location}</div>` : ''}
            </div>`
          );
        }

        leafletComplaintMarkers.current.push(marker);
        bounds.push([Number(m.latitude), Number(m.longitude)]);
      });

      if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [30, 30] });
      }
    } else if (!position) {
      map.setView([KANPUR_CENTER.lat, KANPUR_CENTER.lng], zoom);
    }
  }, [useGoogle, markers]);

  return (
    <div
      ref={mapContainerRef}
      style={{ height, width: '100%', minHeight: '200px' }}
      className="rounded-lg overflow-hidden border border-border relative z-0"
    />
  );
}