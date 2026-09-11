import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Crosshair, Loader2, Check } from 'lucide-react';
import { api } from '@/api/supabaseClient';
import { useGoogleMaps } from '@/hooks/useGoogleMaps';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import ComplaintMap from '@/components/ComplaintMap';

const KANPUR_BOUNDS = {
  north: 26.65,
  south: 26.10,
  east: 80.45,
  west: 80.10,
};

export default function LocationPicker({ onSelect }) {
  const { isLoaded } = useGoogleMaps();
  const [areas, setAreas] = useState([]);
  const [areaQuery, setAreaQuery] = useState('');
  const [areaOpen, setAreaOpen] = useState(false);
  const [usingGps, setUsingGps] = useState(false);
  const [selectedArea, setSelectedArea] = useState(null);
  const [selectedPlace, setSelectedPlace] = useState(null);

  const areaWrapRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.entities.Area.filter({ active: true });
        setAreas(res.items || res || []);
      } catch {
        setAreas([]);
      }
    })();
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (areaWrapRef.current && !areaWrapRef.current.contains(e.target)) setAreaOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const emitSelection = (area, place) => {
    onSelect({
      area_id: area?.id || '',
      area_name: area?.name || '',
      location_name: place?.location_name || '',
      formatted_address: place?.formatted_address || '',
      latitude: place?.latitude ?? area?.latitude ?? null,
      longitude: place?.longitude ?? area?.longitude ?? null,
      google_place_id: place?.google_place_id || '',
    });
  };

  const pickArea = (area) => {
    setSelectedArea(area);
    setAreaQuery(area.name);
    setAreaOpen(false);
    emitSelection(area, selectedPlace);
  };

  const useGps = () => {
    if (!navigator.geolocation) return;
    setUsingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (isLoaded && window.google.maps) {
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results, status) => {
            setUsingGps(false);
            if (status === 'OK' && results[0]) {
              const r = results[0];
              const placeData = {
                location_name: r.address_components?.[0]?.long_name || 'Current Location',
                formatted_address: r.formatted_address,
                latitude, longitude,
                google_place_id: r.place_id || '',
              };
              setSelectedPlace(placeData);
              emitSelection(selectedArea, placeData);
            } else {
              const placeData = { location_name: 'Current Location', formatted_address: '', latitude, longitude, google_place_id: '' };
              setSelectedPlace(placeData);
              emitSelection(selectedArea, placeData);
            }
          });
        } else {
          const placeData = { location_name: 'Current Location', formatted_address: '', latitude, longitude, google_place_id: '' };
          setSelectedPlace(placeData);
          setUsingGps(false);
          emitSelection(selectedArea, placeData);
        }
      },
      () => { setUsingGps(false); }
    );
  };

  const handleMapPick = (p) => {
    const placeData = {
      ...selectedPlace,
      location_name: selectedPlace?.location_name || 'Pinned Location',
      latitude: p.lat,
      longitude: p.lng,
      google_place_id: selectedPlace?.google_place_id || '',
    };
    setSelectedPlace(placeData);
    emitSelection(selectedArea, placeData);
  };

  const filteredAreas = areaQuery.trim()
    ? areas.filter((a) =>
        [a.name, a.ward, a.landmark, a.district].filter(Boolean).some((v) => v.toLowerCase().includes(areaQuery.toLowerCase()))
      )
    : areas;

  const mapPosition = (selectedPlace?.latitude != null)
    ? { lat: selectedPlace.latitude, lng: selectedPlace.longitude }
    : (selectedArea?.latitude != null)
    ? { lat: selectedArea.latitude, lng: selectedArea.longitude }
    : null;

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-1.5 block">1. Select Area / Locality</label>
        <div className="relative" ref={areaWrapRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
          <Input
            value={areaQuery}
            onChange={(e) => { setAreaQuery(e.target.value); setAreaOpen(true); }}
            onFocus={() => setAreaOpen(true)}
            placeholder="Search Kanpur area..."
            className="pl-10 h-11"
          />
          {areaOpen && (
            <div className="absolute z-30 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg max-h-56 overflow-y-auto">
              {filteredAreas.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">No areas found.</div>
              ) : (
                filteredAreas.map((a) => (
                  <button key={a.id} onClick={() => pickArea(a)} className="w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-accent">
                    <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{[a.ward, a.landmark].filter(Boolean).join(' · ')}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <Button variant="outline" onClick={useGps} disabled={usingGps} className="w-full sm:w-auto">
        {usingGps ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Crosshair className="h-4 w-4 mr-2" />}
        Use My Current Location
      </Button>

      <ComplaintMap position={mapPosition} onPick={handleMapPick} height="320px" />

      {(selectedArea || selectedPlace) && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
          <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-foreground">
              Selected: {selectedArea?.name || 'No area'}{selectedPlace?.location_name ? `, ${selectedPlace.location_name}` : ''}
            </p>
            {selectedPlace?.formatted_address && (
              <p className="text-xs text-muted-foreground mt-0.5">{selectedPlace.formatted_address}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}