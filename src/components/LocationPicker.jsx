import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Crosshair, Loader2, Check } from 'lucide-react';
import { api, INITIAL_AREAS } from '@/api/supabaseClient';
import { useGoogleMaps } from '@/hooks/useGoogleMaps';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import ComplaintMap from '@/components/ComplaintMap';
import { cn } from '@/lib/utils';
import { showToast } from '@/lib/toast';

const KANPUR_BOUNDS = {
  north: 26.65,
  south: 26.10,
  east: 80.45,
  west: 80.10,
};

function findNearestArea(lat, lng, areaList = INITIAL_AREAS) {
  const list = areaList && areaList.length ? areaList : INITIAL_AREAS;
  if (lat == null || lng == null || !list || list.length === 0) return null;
  let nearest = null;
  let minDistance = Infinity;
  for (const area of list) {
    if (area.latitude != null && area.longitude != null) {
      const dLat = area.latitude - lat;
      const dLng = area.longitude - lng;
      const dist = dLat * dLat + dLng * dLng;
      if (dist < minDistance) {
        minDistance = dist;
        nearest = area;
      }
    }
  }
  return nearest;
}

export default function LocationPicker({ onSelect, defaultArea = 'Kalyanpur' }) {
  const { isLoaded } = useGoogleMaps();
  const [areas, setAreas] = useState(INITIAL_AREAS);
  const [areaQuery, setAreaQuery] = useState('');
  const [areaOpen, setAreaOpen] = useState(false);
  const [usingGps, setUsingGps] = useState(false);
  const [selectedArea, setSelectedArea] = useState(null);
  const [selectedPlace, setSelectedPlace] = useState(null);

  const areaWrapRef = useRef(null);

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
    if (!area) return;
    setSelectedArea(area);
    setAreaQuery(area.name);
    setAreaOpen(false);
    const updatedPlace = selectedPlace || (area.latitude != null && area.longitude != null
      ? {
          location_name: area.name,
          formatted_address: [area.name, area.ward, 'Kanpur'].filter(Boolean).join(', '),
          latitude: area.latitude,
          longitude: area.longitude,
          google_place_id: '',
        }
      : null);
    if (updatedPlace && !selectedPlace) {
      setSelectedPlace(updatedPlace);
    }
    emitSelection(area, updatedPlace);
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await api.entities.Area.filter({ active: true });
        const list = res.items || res || [];
        setAreas(list);
        if (list.length > 0) {
          const match = list.find((a) => a.name.toLowerCase() === defaultArea.toLowerCase()) || list[0];
          pickArea(match);
        }
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

  const handleQueryChange = (val) => {
    setAreaQuery(val);
    setAreaOpen(true);
    const trimmed = val.trim();
    if (!trimmed) {
      setSelectedArea(null);
      emitSelection(null, selectedPlace);
      return;
    }
    const matched = areas.find((a) => a.name.toLowerCase() === trimmed.toLowerCase());
    if (matched) {
      setSelectedArea(matched);
      emitSelection(matched, selectedPlace);
    } else {
      const customArea = { id: null, name: trimmed };
      setSelectedArea(customArea);
      emitSelection(customArea, selectedPlace);
    }
  };

  const useGps = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser', 'error');
      return;
    }
    setUsingGps(true);

    const onGeoSuccess = async (pos) => {
      const { latitude, longitude } = pos.coords;
      const activeList = areas.length ? areas : INITIAL_AREAS;

      // 1. Immediately find nearest registered municipal area from GPS coords
      let detectedArea = findNearestArea(latitude, longitude, activeList) || activeList[0];
      let detectedLocationName = detectedArea?.name || 'Current Location';
      let detectedAddress = detectedArea ? `${detectedArea.name}, ${detectedArea.ward ? detectedArea.ward + ', ' : ''}Kanpur` : 'Kanpur';

      // 2. Reverse geocode to check for exact neighborhood or ward name
      try {
        if (isLoaded && window.google?.maps) {
          const geocoder = new window.google.maps.Geocoder();
          const res = await new Promise((resolve) => {
            geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results, status) => {
              if (status === 'OK' && results?.[0]) resolve(results[0]);
              else resolve(null);
            });
          });
          if (res) {
            const comp = res.address_components || [];
            const sublocality = comp.find((c) =>
              c.types?.includes('sublocality') ||
              c.types?.includes('sublocality_level_1') ||
              c.types?.includes('neighborhood')
            )?.long_name;

            if (sublocality) {
              const matched = activeList.find((a) =>
                a.name.toLowerCase() === sublocality.toLowerCase() ||
                a.name.toLowerCase().includes(sublocality.toLowerCase()) ||
                sublocality.toLowerCase().includes(a.name.toLowerCase())
              );
              if (matched) {
                detectedArea = matched;
                detectedLocationName = matched.name;
              }
            }
            detectedAddress = res.formatted_address || detectedAddress;
          }
        } else {
          // OpenStreetMap Nominatim reverse geocoding fallback
          const nomRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
            { headers: { 'Accept-Language': 'en' } }
          ).then((r) => r.json()).catch(() => null);

          if (nomRes?.address) {
            const addr = nomRes.address;
            const sublocality =
              addr.suburb ||
              addr.neighbourhood ||
              addr.city_district ||
              addr.residential ||
              addr.quarter ||
              addr.commercial ||
              addr.road;

            if (sublocality) {
              const matched = activeList.find((a) =>
                a.name.toLowerCase().includes(sublocality.toLowerCase()) ||
                sublocality.toLowerCase().includes(a.name.toLowerCase())
              );
              if (matched) {
                detectedArea = matched;
                detectedLocationName = matched.name;
              }
            }
            detectedAddress = nomRes.display_name || detectedAddress;
          }
        }
      } catch {
        // Fallback handled by nearest registered area
      }

      // Guarantee detectedArea is a valid registered area from the database list
      if (!detectedArea || !detectedArea.name) {
        detectedArea = findNearestArea(latitude, longitude, activeList) || activeList[0];
      }

      // 3. Update all states and auto-select area
      setSelectedArea(detectedArea);
      setAreaQuery(detectedArea.name);

      const placeData = {
        location_name: detectedLocationName || detectedArea.name,
        formatted_address: detectedAddress,
        latitude,
        longitude,
        google_place_id: '',
      };
      setSelectedPlace(placeData);
      setUsingGps(false);
      emitSelection(detectedArea, placeData);
      showToast(`Auto-selected Area: ${detectedArea.name} (${detectedArea.ward || 'Kanpur'})`, 'success');
    };

    const onGeoError = () => {
      setUsingGps(false);
      const activeList = areas.length ? areas : INITIAL_AREAS;
      const defaultPin = {
        location_name: selectedArea?.name || 'Kanpur Center',
        formatted_address: selectedArea ? `${selectedArea.name}, Kanpur` : 'Kanpur, Uttar Pradesh',
        latitude: selectedArea?.latitude || 26.4499,
        longitude: selectedArea?.longitude || 80.3319,
        google_place_id: '',
      };
      const fallbackArea = selectedArea || activeList[0];
      setSelectedPlace(defaultPin);
      emitSelection(fallbackArea, defaultPin);
      showToast('GPS unavailable. Pin placed on map — click or drag to adjust.', 'info');
    };

    navigator.geolocation.getCurrentPosition(
      onGeoSuccess,
      () => {
        // Automatic retry with enableHighAccuracy: false for quick desktop/wifi location
        navigator.geolocation.getCurrentPosition(
          onGeoSuccess,
          onGeoError,
          { enableHighAccuracy: false, timeout: 6000, maximumAge: 300000 }
        );
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
    );
  };

  const handleMapPick = async (p) => {
    // 1. Immediately find nearest registered municipal area where the pin dropped on the map!
    const activeList = areas.length ? areas : INITIAL_AREAS;
    const nearest = findNearestArea(p.lat, p.lng, activeList) || activeList[0];
    let detectedArea = nearest;
    let locationName = detectedArea?.name || 'Pinned Location';
    let formattedAddress = detectedArea ? `${detectedArea.name}, ${detectedArea.ward ? detectedArea.ward + ', ' : ''}Kanpur` : 'Kanpur';

    setSelectedArea(detectedArea);
    setAreaQuery(detectedArea.name);

    const placeData = {
      location_name: locationName,
      formatted_address: formattedAddress,
      latitude: p.lat,
      longitude: p.lng,
      google_place_id: '',
    };
    setSelectedPlace(placeData);
    emitSelection(detectedArea, placeData);
    showToast(`Auto-selected Area: ${detectedArea.name} (${detectedArea.ward || 'Kanpur'})`, 'info');

    // 2. Refine reverse-geocoded address asynchronously
    try {
      if (isLoaded && window.google?.maps) {
        const geocoder = new window.google.maps.Geocoder();
        const res = await new Promise((resolve) => {
          geocoder.geocode({ location: { lat: p.lat, lng: p.lng } }, (results, status) => {
            if (status === 'OK' && results?.[0]) resolve(results[0]);
            else resolve(null);
          });
        });
        if (res) {
          const comp = res.address_components || [];
          const sublocality = comp.find((c) =>
            c.types?.includes('sublocality') ||
            c.types?.includes('sublocality_level_1') ||
            c.types?.includes('neighborhood')
          )?.long_name;
          if (sublocality) {
            const matched = activeList.find((a) =>
              a.name.toLowerCase() === sublocality.toLowerCase() ||
              a.name.toLowerCase().includes(sublocality.toLowerCase()) ||
              sublocality.toLowerCase().includes(a.name.toLowerCase())
            );
            if (matched) {
              detectedArea = matched;
              setSelectedArea(matched);
              setAreaQuery(matched.name);
            }
          }
          const updatedPlace = {
            ...placeData,
            location_name: sublocality || placeData.location_name,
            formatted_address: res.formatted_address || placeData.formatted_address,
          };
          setSelectedPlace(updatedPlace);
          emitSelection(detectedArea, updatedPlace);
        }
      } else {
        const nomRes = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${p.lat}&lon=${p.lng}&zoom=18&addressdetails=1`,
          { headers: { 'Accept-Language': 'en' } }
        ).then((r) => r.json()).catch(() => null);

        if (nomRes?.address) {
          const addr = nomRes.address;
          const sublocality =
            addr.suburb ||
            addr.neighbourhood ||
            addr.city_district ||
            addr.residential ||
            addr.quarter ||
            addr.road;

          const updatedPlace = {
            ...placeData,
            location_name: sublocality || placeData.location_name,
            formatted_address: nomRes.display_name || placeData.formatted_address,
          };
          setSelectedPlace(updatedPlace);
          emitSelection(detectedArea, updatedPlace);
        }
      }
    } catch {
      // ignore
    }
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
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => setAreaOpen(true)}
            placeholder="Search or type area (e.g. Kakadeo, Kalyanpur)..."
            className="pl-10 h-11"
          />
          {areaOpen && (
            <div className="absolute z-30 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg max-h-56 overflow-y-auto">
              {filteredAreas.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">
                  No matching registered area. Your typed name &ldquo;{areaQuery}&rdquo; will be used.
                </div>
              ) : (
                filteredAreas.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => pickArea(a)}
                    className="w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-accent cursor-pointer transition-colors"
                  >
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

        {/* Quick select popular areas chips */}
        {areas.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className="text-xs text-muted-foreground font-medium mr-1">Popular:</span>
            {areas.slice(0, 7).map((a) => {
              const isSelected = selectedArea?.name?.toLowerCase() === a.name.toLowerCase();
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => pickArea(a)}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-full border transition-all cursor-pointer",
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                      : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground border-border/60"
                  )}
                >
                  {a.name}
                </button>
              );
            })}
          </div>
        )}
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